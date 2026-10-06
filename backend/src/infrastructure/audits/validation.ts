import type { Company, Extraction, Provider, Source } from '../../domain/model.js';
import type { PostingValidation, SourceAdapter } from '../../ports/ingestion.js';
import { loadAuditPlans, requireVerifiedEvidence } from './registry.js';
import { OfficialPageTransport } from './official-http.js';
import { SourceAuditor, officialHosts } from './auditor.js';

export class AuditedPostingValidation implements PostingValidation {
  constructor(
    private readonly companies: Company[],
    private readonly sources: Source[],
    private readonly adapters: Readonly<Record<Provider, SourceAdapter>>,
  ) {}

  async validate(source: Source, extraction: Extraction) {
    if (source.auditStatus !== 'verified') {
      const plan = loadAuditPlans().find((entry) => entry.companySlug === source.companySlug);

      if (plan?.access.status === 'blocked' || plan?.access.display === 'blocked') {
        throw new Error(
          `Full-description publication blocked for ${source.companySlug}: ${plan.access.notes}`,
        );
      }

      return [];
    }

    const matching = this.sources.filter((entry) => entry.companySlug === source.companySlug);

    requireVerifiedEvidence(matching);

    const company = this.companies.find((entry) => entry.slug === source.companySlug)!;
    const plan = loadAuditPlans().find((entry) => entry.companySlug === company.slug)!;

    const auditor = new SourceAuditor(
      company,
      matching,
      plan,
      new OfficialPageTransport(officialHosts(company, plan)),
      this.adapters,
    );

    const { report, rawPages, blockers } = await auditor.run('database Snapshot evidence', {
      source,
      extraction,
    });

    if (blockers.length) {
      throw new Error(
        `Official reconciliation failed; previous listings preserved: ${blockers.join('; ')}`,
      );
    }

    return [
      { url: company.careersUrl, fetchedAt: report.observedAt, body: report },
      ...rawPages.map((page) => ({
        url: page.url,
        fetchedAt: page.fetchedAt,
        body: { html: page.body, robotsUrl: page.robotsUrl, robots: page.robotsBody },
      })),
    ];
  }
}
