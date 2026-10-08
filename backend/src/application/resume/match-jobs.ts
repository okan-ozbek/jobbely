import { readJobDocument } from '../../domain/matching/document.js';
import { degreeMentions } from '../../domain/resume/qualifications.js';
import type { JobDocumentReader } from '../../ports/job-document.js';
import { conceptsById } from '../../domain/semantics/concepts.js';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Company, Source, Job } from '../../domain/model.js';
import {
  extractRequirements,
  featureVersion,
  supportedFunctions,
} from '../../domain/matching/requirements.js';
import { skillMentions } from '../../domain/resume/vocabulary.js';
import { skillMatch, relationsVersion } from '../../domain/matching/skill-relations.js';
import {
  compareMatches,
  scoreJob,
  scoringVersion,
  contextVersion,
  prepareCandidate,
} from '../../domain/matching/score.js';
import type { MatchExplanation, MatchInput, MatchProfile } from '../../domain/matching/model.js';
import type { JobFeatureRepository } from '../../ports/job-features.js';

export class MatchError extends Error {
  constructor(
    public readonly code: 'invalid_profile' | 'cursor_stale' | 'capacity_exceeded',
    message: string,
  ) {
    super(message);
  }
}

interface Cursor {
  fingerprint: string;
  revision: string;
  at: string;
  anchor: Pick<
    MatchExplanation,
    'band' | 'baseScore' | 'assessmentCoverage' | 'employerAdjustment'
  > & {
    job: { id: string; lastSeenAt: string };
  };
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class MatchJobs {
  private readonly key: Buffer;
  private active = 0;

  constructor(
    private readonly repository: JobFeatureRepository,
    private readonly companies: Company[],
    private readonly sources: Source[],
    private readonly mode: 'demo' | 'postgres',
    private readonly clock: () => Date = () => new Date(),
    signingKey?: string,
    private readonly documents: JobDocumentReader = {
      read: (input) => readJobDocument(input.descriptionText),
    },
  ) {
    this.key = signingKey ? Buffer.from(signingKey) : randomBytes(32);
  }

  private encode(cursor: Cursor) {
    const body = Buffer.from(JSON.stringify(cursor)).toString('base64url');

    return `${body}.${createHmac('sha256', this.key).update(body).digest('base64url')}`;
  }

  private decode(value: string): Cursor {
    try {
      const [body, signature] = value.split('.');
      const expected = createHmac('sha256', this.key).update(body!).digest();
      const actual = Buffer.from(signature!, 'base64url');

      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new Error();
      }

      return JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as Cursor;
    } catch {
      throw new MatchError('cursor_stale', 'Pagination expired or changed. Restart matching.');
    }
  }

  async execute(input: MatchInput) {
    if (this.active >= 2) {
      throw new MatchError('capacity_exceeded', 'Matching is busy. Try again shortly.');
    }

    this.active++;

    try {
      return await this.match(input);
    } finally {
      this.active--;
    }
  }

  private validateProfile(profile: MatchProfile) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(profile.analysisDate) ||
      !Number.isFinite(Date.parse(profile.analysisDate)) ||
      new Date(profile.analysisDate).toISOString().slice(0, 10) !== profile.analysisDate ||
      profile.analysisDate > this.clock().toISOString().slice(0, 10) ||
      profile.analysisDate < '1900-01-01' ||
      [...profile.skills, ...(profile.competencies ?? [])].some((signal) => {
        const allowed = conceptsById.get(signal.id)?.facets ?? ['general'];

        const refsInvalid = signal.evidenceRefs?.some(
          (ref) =>
            ref.objectId !== signal.id ||
            (ref.roleId && !profile.employment.some((role) => role.id === ref.roleId)),
        );

        return (
          !!refsInvalid ||
          [
            ...(signal.facets ?? []),
            ...(signal.deniedFacets ?? []),
            ...(signal.uncertainFacets ?? []),
          ].some((facet) => !allowed.includes(facet))
        );
      }) ||
      new Set([...profile.skills, ...(profile.competencies ?? [])].map((item) => item.id)).size !==
        profile.skills.length + (profile.competencies?.length ?? 0) ||
      new Set(profile.employment.filter((role) => role.id).map((role) => role.id)).size !==
        profile.employment.filter((role) => role.id).length ||
      new Set((profile.skillTenure ?? []).map((claim) => claim.skillId)).size !==
        (profile.skillTenure?.length ?? 0) ||
      (profile.skillTenure ?? []).some(
        (claim) =>
          !conceptsById.has(claim.skillId) ||
          !Number.isInteger(claim.months) ||
          claim.months < 0 ||
          claim.months > 600,
      )
    ) {
      throw new MatchError('invalid_profile', 'Review the profile date and skill claims.');
    }
  }

  requirements(job: Job) {
    return extractRequirements(job, this.documents.read(job));
  }

  async explain(job: Job, profile: MatchProfile) {
    this.validateProfile(profile);

    const prepared = prepareCandidate(profile, this.companies);

    const document = this.documents.read(job);
    const requirements = extractRequirements(job, document);

    const comparison = scoreJob({ ...job, requirements }, profile, this.companies, false, prepared);

    const now = this.clock().toISOString();
    const cutoff = new Date(Date.parse(now) - 36 * 60 * 60_000).toISOString();
    const run = (await this.repository.latestRuns()).find((item) => item.sourceId === job.sourceId);

    const recommendationEligible =
      this.mode !== 'demo' &&
      job.status === 'active' &&
      !job.missingSince &&
      job.lastSeenAt >= cutoff &&
      this.sources.some((source) => source.id === job.sourceId) &&
      run?.status === 'succeeded' &&
      run.enumerationComplete &&
      !run.removalsQuarantined &&
      !!run.finishedAt &&
      run.finishedAt >= cutoff &&
      run.finishedAt <= now;

    return {
      descriptionText: document.text,
      document,
      requirements,
      // Score deduplication must not erase repeated evidence in the original description.
      // Recognize within each clause so unrelated neighboring sections cannot disambiguate it.
      skills: requirements.clauses.flatMap((clause) => {
        if (
          ['overview', 'legal', 'application', 'benefits', 'compensation'].includes(clause.role)
        ) {
          return [];
        }

        return skillMentions(clause.evidence.excerpt)
          .filter((mention) => [...clause.objectIds, ...clause.exampleIds].includes(mention.id))
          .map((mention) => {
            const alternative = requirements.skills
              .find(
                (group) =>
                  clause.groupIds.includes(group.id!) &&
                  group.alternatives.some((item) => item.id === mention.id),
              )
              ?.alternatives.find((item) => item.id === mention.id);

            const interpretation = alternative?.interpretation ?? mention.interpretation;

            return {
              ...mention,
              position: (clause.evidence.start ?? 0) + mention.position,
              interpretation,
              ...skillMatch(prepared.matches, mention.id, mention.facet, interpretation),
              ...(['role', 'responsibilities'].includes(clause.role)
                ? { rule: `role-context:${mention.rule}` }
                : {}),
            };
          });
      }),
      metrics: [
        ...requirements.constraints
          .filter((constraint) => constraint.education && constraint.importance !== 'contextual')
          .flatMap((constraint, index) => {
            const match = comparison.education[index]!;

            return degreeMentions(constraint.evidence.excerpt).map((mention) => ({
              id: `degree:${mention.level}`,
              targetId: `degree:${mention.level}`,
              name: match.name,
              rule: 'education',
              interpretation: 'explicit' as const,
              facet: 'general' as const,
              position: (constraint.evidence.start ?? 0) + mention.position,
              length: mention.length,
              decision:
                match.status === 'met'
                  ? ('full' as const)
                  : match.status === 'below'
                    ? ('none' as const)
                    : ('partial' as const),
              confidence:
                match.status === 'met'
                  ? ('green' as const)
                  : match.status === 'below'
                    ? ('red' as const)
                    : ('yellow' as const),
              credit: Number(match.status === 'met'),
              sourceId: null,
              sourceName: null,
              path: [],
              suggestion: null,
              reason: match.reason,
            }));
          }),
        ...requirements.experience
          .filter((item) => item.importance !== 'contextual')
          .map((requirement, index) => {
            const match = comparison.experience[index]!;

            return {
              id: `experience:${index}`,
              targetId: `experience:${index}`,
              name: `${requirement.minimumMonths / 12}+ years · ${requirement.scope}`,
              rule: 'experience',
              interpretation: 'explicit' as const,
              facet: 'general' as const,
              position: requirement.evidence.start ?? 0,
              length:
                requirement.evidence.excerpt.match(
                  /^\d{1,2}(?:\s*(?:[-–]|to)\s*\d{1,2})?\s*\+?\s*years?/,
                )?.[0].length ?? 0,
              decision:
                match.status === 'met'
                  ? ('full' as const)
                  : match.status === 'below'
                    ? ('none' as const)
                    : ('partial' as const),
              confidence:
                match.status === 'met'
                  ? ('green' as const)
                  : match.status === 'below'
                    ? ('red' as const)
                    : ('yellow' as const),
              credit: Number(match.status === 'met'),
              sourceId: null,
              sourceName: null,
              path: [],
              suggestion: null,
              reason:
                match.status === 'uncertain'
                  ? 'This duration needs review. Career dates and related skills do not establish years using a particular tool. Add an explicit skill experience claim in your profile.'
                  : `Reviewed ${requirement.scope} experience: ${(match.candidateMinimumMonths / 12).toFixed(1)}–${(match.candidateMaximumMonths / 12).toFixed(1)} years; requirement: ${requirement.minimumMonths / 12}+ years.`,
            };
          }),
      ],
      comparison,
      recommendationEligible: !!recommendationEligible,
      availability: recommendationEligible
        ? 'Eligible under the current 36-hour availability checks.'
        : 'Description comparison only: this listing does not pass current recommendation availability checks.',
      lastSeenAt: job.lastSeenAt,
      relationsVersion,
    };
  }

  private async match(input: MatchInput) {
    const now = this.clock();

    this.validateProfile(input.profile);

    if (input.categories.some((category) => !supportedFunctions.includes(category))) {
      throw new MatchError('invalid_profile', 'Review the selected functions.');
    }

    const fingerprint = hash([
      input.profile,
      [...input.categories].sort(),
      input.employerContext,
      featureVersion,
      scoringVersion,
      contextVersion,
    ]);

    const cursor = input.cursor ? this.decode(input.cursor) : null;
    const at = cursor?.at ?? now.toISOString();

    if (
      cursor &&
      (cursor.fingerprint !== fingerprint || now.getTime() - Date.parse(at) > 15 * 60_000)
    ) {
      throw new MatchError('cursor_stale', 'Profile or preferences changed. Restart matching.');
    }

    const runs = await this.repository.latestRuns();
    const cutoff = new Date(Date.parse(at) - 36 * 60 * 60_000).toISOString();

    const sourceIds =
      this.mode === 'demo'
        ? []
        : this.sources
            .filter((source) => {
              const run = runs.find((item) => item.sourceId === source.id);

              return (
                run?.status === 'succeeded' &&
                run.enumerationComplete &&
                !run.removalsQuarantined &&
                !!run.finishedAt &&
                run.finishedAt >= cutoff &&
                run.finishedAt <= at
              );
            })
            .map((source) => source.id);

    const filter = { sourceIds, cutoff, categories: input.categories };
    const snapshot = await this.repository.featureSnapshot(filter);

    const revision = hash([
      snapshot.datasetVersion,
      snapshot.generation,
      runs.map((run) => [run.id, run.status, run.finishedAt]).sort(),
    ]);

    if (cursor && cursor.revision !== revision) {
      throw new MatchError(
        'cursor_stale',
        'Jobs or extracted requirements changed. Restart matching.',
      );
    }

    if (snapshot.eligible > 50_000) {
      throw new MatchError(
        'capacity_exceeded',
        'More than 50,000 eligible jobs. Select fewer functions.',
      );
    }

    const best: MatchExplanation[] = [];
    const prepared = prepareCandidate(input.profile, this.companies);
    let after = '';
    let evaluated = 0;
    const started = Date.now();

    for (;;) {
      const jobs = await this.repository.featureJobs(filter, after, 250);

      if (!jobs.length) {
        break;
      }

      for (const job of jobs) {
        const result = scoreJob(
          job,
          input.profile,
          this.companies,
          input.employerContext,
          prepared,
        );

        evaluated++;

        if (cursor && compareMatches(result, cursor.anchor) <= 0) {
          continue;
        }

        best.push(result);
        best.sort(compareMatches);
        best.length = Math.min(best.length, input.limit + 1);
      }

      after = jobs.at(-1)!.id;

      if (Date.now() - started > 10_000 || evaluated > 50_000) {
        throw new MatchError(
          'capacity_exceeded',
          'Matching budget exceeded. Select fewer functions.',
        );
      }
    }

    const final = await this.repository.featureSnapshot(filter);
    const finalRuns = await this.repository.latestRuns();

    if (
      hash([
        final.datasetVersion,
        final.generation,
        finalRuns.map((run) => [run.id, run.status, run.finishedAt]).sort(),
      ]) !== revision ||
      evaluated !== snapshot.eligible - snapshot.unenriched
    ) {
      throw new MatchError('cursor_stale', 'Jobs changed during matching. Restart matching.');
    }

    const items = best.slice(0, input.limit);
    const last = items.at(-1);

    return {
      items: items.map((item) => ({
        ...item,
        companyName:
          this.companies.find((company) => company.slug === item.job.companySlug)?.name ??
          item.job.companySlug,
        logoUrl:
          this.companies.find((company) => company.slug === item.job.companySlug)?.logoUrl ?? null,
        coverage:
          this.sources.find((source) => source.id === item.job.sourceId)?.auditStatus === 'verified'
            ? 'verified source scope'
            : 'candidate source; partial, unconfirmed coverage',
      })),
      nextCursor:
        best.length > input.limit && last
          ? this.encode({
              fingerprint,
              revision,
              at,
              anchor: {
                band: last.band,
                baseScore: last.baseScore,
                assessmentCoverage: last.assessmentCoverage,
                employerAdjustment: last.employerAdjustment,
                job: { id: last.job.id, lastSeenAt: last.job.lastSeenAt },
              },
            })
          : null,
      evaluated,
      eligible: snapshot.eligible,
      unenriched: snapshot.unenriched,
      datasetVersion: snapshot.datasetVersion,
      featureGeneration: snapshot.generation,
      asOf: at,
      freshnessHours: 36,
      excludedSources: this.sources.length - sourceIds.length,
      mode: this.mode,
      versions: {
        features: featureVersion,
        scoring: scoringVersion,
        employerContext: contextVersion,
      },
    };
  }
}
