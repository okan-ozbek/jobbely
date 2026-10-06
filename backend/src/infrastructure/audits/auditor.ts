import type { Company, Extraction, Provider, RawResponse, Source } from '../../domain/model.js';
import type { SourceAdapter } from '../../ports/ingestion.js';
import { htmlPreparation } from '../html.js';
import { vacancyExcluded } from '../adapters/schemas.js';
import { workableVacancyExcluded } from '../adapters/workable.js';
import { auditBlockers, configurationHash, hash } from './model.js';
import type { AuditPlan, AuditReport } from './model.js';
import type { OfficialPageTransport } from './official-http.js';
import type { OfficialSnapshot } from './official-http.js';
import {
  compareIdentities,
  greenhouseVariants,
  inspectOfficialPage,
  officialIdentity,
  resolveOfficialIds,
} from './reconcile.js';

export class SourceAuditor {
  constructor(
    private readonly company: Company,
    private readonly sources: Source[],
    private readonly plan: AuditPlan,
    private readonly pages: Pick<OfficialPageTransport, 'get'>,
    private readonly adapters: Readonly<Record<Provider, SourceAdapter>>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(
    artifactDirectory: string,
    existing?: { source: Source; extraction: Extraction },
    snapshots?: ReadonlyMap<string, Extraction>,
    automaticCoverage = false,
  ) {
    const report: AuditReport = {
      version: 1,
      companySlug: this.company.slug,
      observedAt: this.clock().toISOString(),
      configurationHash: configurationHash(this.plan, this.sources),
      artifactDirectory,
      blockers: [],
      policies: [],
      pages: [],
      sources: [],
    };

    const rawPages: OfficialSnapshot[] = [];
    const rawResponses: RawResponse[] = [];
    const technicalBlockers: string[] = [];

    const technicalIssue = (reason: string) => {
      technicalBlockers.push(reason);
      report.blockers.push(reason);
    };

    const inventories = new Map<string, Set<string>>();
    const officialBoards = new Set<string>();

    const configuredBoards = new Set(
      this.sources.map((source) => `${source.provider}:${source.board}`),
    );

    const successfulPages = new Set<string>();
    const explicitlyEmptyPages = new Set<string>();
    const companyHost = new URL(this.company.careersUrl).hostname;

    for (const [name, review] of [
      ['scope', this.plan.scope],
      ['access', this.plan.access],
    ] as const) {
      if (review.status !== 'approved') {
        report.blockers.push(`${name} review is ${review.status}: ${review.notes}`);
      }

      if (
        review.reviewedAt &&
        (Date.parse(review.reviewedAt) > this.clock().getTime() ||
          this.clock().getTime() - Date.parse(review.reviewedAt) > 30 * 24 * 60 * 60_000)
      ) {
        report.blockers.push(`${name} review is expired or future-dated`);
      }
    }

    for (const channel of this.plan.channels) {
      if (channel.disposition === 'pending') {
        report.blockers.push(`Unresolved hiring channel: ${channel.url}`);

        if (
          !channel.sourceIds.length ||
          channel.sourceIds.some((id) => !this.sources.some((source) => source.id === id))
        ) {
          technicalBlockers.push(`Unconnected hiring channel: ${channel.url}`);
        }
      }

      if (
        channel.disposition === 'included' &&
        (!channel.sourceIds.length ||
          channel.sourceIds.some((id) => !this.sources.some((source) => source.id === id)))
      ) {
        technicalIssue(`Included channel lacks a configured source: ${channel.url}`);
      }
    }

    for (const url of this.plan.access.evidenceUrls) {
      const policy: AuditReport['policies'][number] = {
        url,
        textSha256: '',
        rawSha256: '',
        robotsUrl: '',
        robotsSha256: '',
        error: null,
      };

      try {
        const snapshot = await this.pages.get(url);

        rawPages.push(snapshot);
        policy.rawSha256 = hash(snapshot.body);
        policy.textSha256 = hash(htmlPreparation.prepare(snapshot.body).text);
        policy.robotsUrl = snapshot.robotsUrl;
        policy.robotsSha256 = hash(snapshot.robotsBody);

        if (!htmlPreparation.prepare(snapshot.body).text) {
          throw new Error('Policy document has no readable text');
        }

        if (
          this.plan.access.status === 'approved' &&
          !this.plan.access.reviewedDocuments.some(
            (document) => document.url === url && document.sha256 === policy.textSha256,
          )
        ) {
          report.blockers.push(`Access policy is unreviewed or changed: ${url}`);
        }
      } catch (error) {
        policy.error = error instanceof Error ? error.message : 'Policy retrieval failed';
      }

      report.policies.push(policy);
    }

    if (
      this.plan.access.status === 'approved' &&
      !['private_full_descriptions', 'public_full_descriptions'].includes(this.plan.access.display)
    ) {
      report.blockers.push(
        'Access review does not approve full-description display for this application',
      );
    }

    const listingPagesToCheck = this.plan.pages.map((page) => ({ ...page }));
    const seenPages = new Set<string>();

    for (const page of listingPagesToCheck) {
      if (seenPages.has(page.url)) {
        continue;
      }

      seenPages.add(page.url);

      const pageReport: AuditReport['pages'][number] = {
        url: page.url,
        sha256: '',
        robotsUrl: '',
        robotsSha256: '',
        links: [],
        discoveredBoards: [],
        paginationHints: [],
        error: null,
      };

      try {
        const snapshot = await this.pages.get(page.url);

        rawPages.push(snapshot);
        pageReport.sha256 = hash(snapshot.body);
        pageReport.robotsUrl = snapshot.robotsUrl;
        pageReport.robotsSha256 = hash(snapshot.robotsBody);

        const inspected = inspectOfficialPage(snapshot.body, page, this.sources);

        pageReport.links = [...inspected.links].sort();
        pageReport.discoveredBoards = [...inspected.boards].sort();
        pageReport.paginationHints = [...inspected.paginationHints].sort();

        if (inspected.explicitlyEmpty) {
          explicitlyEmptyPages.add(page.url);
        }

        if (page.role === 'listings') {
          if (
            automaticCoverage &&
            [...new URL(page.url).searchParams.keys()].some((key) =>
              /^(?:country|location|region|department|search|query|keyword|q)$/i.test(key),
            )
          ) {
            technicalIssue(
              `Filtered official inventory cannot establish complete coverage: ${page.url}`,
            );
          }

          for (const next of inspected.paginationHints) {
            if (
              !listingPagesToCheck.some((entry) => entry.role === 'listings' && entry.url === next)
            ) {
              if (
                automaticCoverage &&
                !next.startsWith('interactive:') &&
                new URL(next).origin === new URL(page.url).origin &&
                listingPagesToCheck.length < 50
              ) {
                listingPagesToCheck.push({ ...page, url: next });
              } else {
                technicalIssue(`Untraversed official pagination on ${page.url}: ${next}`);
              }
            }
          }
        }

        if (new URL(page.url).hostname === companyHost) {
          for (const board of inspected.boards) {
            officialBoards.add(board);
          }
        }

        for (const board of inspected.boards) {
          const excluded = this.plan.channels.some(
            (channel) =>
              channel.disposition === 'excluded' && officialIdentity(channel.url)?.board === board,
          );

          if (!configuredBoards.has(board) && !excluded) {
            technicalIssue(`Unregistered board discovered: ${board} on ${page.url}`);
          }
        }

        if (page.role === 'listings') {
          for (const sourceId of page.sourceIds) {
            const source = this.sources.find((item) => item.id === sourceId);

            if (!source) {
              throw new Error(`Unknown source in audit page: ${sourceId}`);
            }

            const key = `${source.provider}:${source.board}`;
            const ids = inventories.get(sourceId) ?? new Set<string>();

            for (const id of inspected.ids.get(key) ?? []) {
              const title = inspected.titles.get(`${key}:${id}`) ?? '';

              const excluded =
                source.provider === 'workable'
                  ? workableVacancyExcluded(source.board, title)
                  : vacancyExcluded(title);

              if (!excluded) {
                ids.add(id);
              }
            }

            inventories.set(sourceId, ids);
          }
        }

        successfulPages.add(page.url);
      } catch (error) {
        pageReport.error =
          error instanceof Error ? error.message : 'Official page inspection failed';

        technicalIssue(`${page.url}: ${pageReport.error}`);
      }

      report.pages.push(pageReport);
    }

    for (const source of existing ? [existing.source] : this.sources) {
      const officialIds = inventories.get(source.id) ?? new Set<string>();

      const listingPages = listingPagesToCheck.filter(
        (page) => page.role === 'listings' && page.sourceIds.includes(source.id),
      );

      const result: AuditReport['sources'][number] = {
        sourceId: source.id,
        feedCount: 0,
        officialCount: officialIds.size,
        excludedCount: 0,
        matchedCount: 0,
        missingFromFeed: [],
        missingFromOfficial: [],
        coveredVariants: [],
        invalidDetails: [],
        enumerationComplete: false,
        officialEnumerationReviewed:
          listingPages.length > 0 &&
          (officialIds.size > 0 ||
            listingPages.every((page) => explicitlyEmptyPages.has(page.url))) &&
          listingPages.every(
            (page) => (automaticCoverage || page.complete) && successfulPages.has(page.url),
          ),
        officiallyLinked: officialBoards.has(`${source.provider}:${source.board}`),
        feedHashes: [],
        samples: [],
        error: null,
      };

      try {
        const extraction =
          existing?.extraction ??
          (snapshots
            ? snapshots.get(source.id)
            : await this.adapters[source.provider].extract(source));

        if (!extraction) {
          throw new Error('No successful snapshot from this refresh; source was not re-fetched');
        }

        rawResponses.push(...extraction.rawResponses);

        const ids = extraction.postings.map((posting) => posting.sourcePostingId);

        if (new Set(ids).size !== ids.length) {
          throw new Error('Duplicate feed posting IDs');
        }

        result.feedCount = ids.length;
        result.excludedCount = extraction.excluded;
        result.enumerationComplete = extraction.enumerationComplete;
        result.feedHashes = extraction.rawResponses.map((raw) => hash(JSON.stringify(raw.body)));

        Object.assign(
          result,
          compareIdentities(ids, resolveOfficialIds(source, extraction, officialIds)),
        );

        if (
          source.provider === 'greenhouse' &&
          this.plan.reconciliation === 'greenhouse_requisition_variants'
        ) {
          result.coveredVariants = greenhouseVariants(extraction, officialIds);

          const covered = new Set(result.coveredVariants.map((variant) => variant.feedId));

          result.missingFromOfficial = result.missingFromOfficial.filter((id) => !covered.has(id));
        }

        result.invalidDetails = extraction.postings
          .filter((posting) => {
            const identity = officialIdentity(posting.applyUrl);
            let employerApplication = false;

            try {
              const url = new URL(posting.applyUrl);

              employerApplication =
                url.protocol === 'https:' &&
                url.hostname === companyHost &&
                !url.username &&
                !url.password &&
                !url.port;
            } catch {
              /* Invalid application links fail the check below. */
            }

            return (
              !posting.title.trim() ||
              !htmlPreparation.prepare(posting.descriptionHtml).text ||
              !(employerApplication || identity?.board === `${source.provider}:${source.board}`)
            );
          })
          .map((posting) => posting.sourcePostingId);

        result.samples = extraction.postings.slice(0, 3).map((posting) => ({
          id: posting.sourcePostingId,
          title: posting.title,
          url: posting.url,
          applyUrl: posting.applyUrl,
        }));
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Feed inspection failed';
      }

      report.sources.push(result);
    }

    return {
      report,
      rawPages,
      rawResponses,
      blockers: auditBlockers(report),
      technicalBlockers: auditBlockers({ ...report, blockers: technicalBlockers, policies: [] }),
    };
  }
}

export function officialHosts(company: Company, plan: AuditPlan): Set<string> {
  const trusted = new Set([
    new URL(company.careersUrl).hostname,
    'boards.greenhouse.io',
    'job-boards.greenhouse.io',
    'jobs.lever.co',
    'jobs.eu.lever.co',
    'jobs.ashbyhq.com',
    'apply.workable.com',
    'help.workable.com',
    'www.workable.com',
    'docs.greenhouse.io',
    'developers.ashbyhq.com',
    'github.com',
    'nvidia.wd5.myworkdayjobs.com',
    'salesforce.wd12.myworkdayjobs.com',
    'adobe.wd5.myworkdayjobs.com',
    'workday.wd5.myworkdayjobs.com',
    'paypal.wd1.myworkdayjobs.com',
    'intel.wd1.myworkdayjobs.com',
    'ing.wd3.myworkdayjobs.com',
    'zoom.wd5.myworkdayjobs.com',
    'xboxgaming.wd1.myworkdayjobs.com',
    'jobs.booking.com',
    'www.linkedin.com',
    'careers.smartrecruiters.com',
    'jobs.smartrecruiters.com',
    'developers.smartrecruiters.com',
  ]);

  if (company.slug === 'hubspot' && new URL(company.careersUrl).hostname === 'www.hubspot.com') {
    trusted.add('legal.hubspot.com');
  }

  if (company.slug === 'mistral-ai' && new URL(company.careersUrl).hostname === 'mistral.ai') {
    trusted.add('legal.mistral.ai');
  }

  if (
    company.slug === 'servicenow' &&
    new URL(company.careersUrl).hostname === 'careers.servicenow.com'
  ) {
    trusted.add('www.servicenow.com');
  }

  if (company.slug === 'adyen' && new URL(company.careersUrl).hostname === 'careers.adyen.com') {
    trusted.add('www.adyen.com');
  }

  for (const url of [...plan.pages.map((page) => page.url), ...plan.access.evidenceUrls]) {
    if (!trusted.has(new URL(url).hostname)) {
      throw new Error(`Audit page is not an official employer/ATS/documentation host: ${url}`);
    }
  }

  return trusted;
}
