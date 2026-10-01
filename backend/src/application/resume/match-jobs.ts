import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Company, Source } from '../../domain/model.js';
import { featureVersion, supportedFunctions } from '../../domain/matching/requirements.js';
import {
  compareMatches,
  scoreJob,
  scoringVersion,
  contextVersion,
  prepareCandidate,
} from '../../domain/matching/score.js';
import type { MatchExplanation, MatchInput } from '../../domain/matching/model.js';
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
  anchor: Pick<MatchExplanation, 'band' | 'baseScore' | 'completeness' | 'employerAdjustment'> & {
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

  private async match(input: MatchInput) {
    const now = this.clock();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.profile.analysisDate) ||
      !Number.isFinite(Date.parse(input.profile.analysisDate)) ||
      new Date(input.profile.analysisDate).toISOString().slice(0, 10) !==
        input.profile.analysisDate ||
      input.profile.analysisDate > now.toISOString().slice(0, 10) ||
      input.profile.analysisDate < '1900-01-01' ||
      input.categories.some((category) => !supportedFunctions.includes(category)) ||
      new Set(input.profile.skills.map((skill) => skill.id)).size !== input.profile.skills.length
    ) {
      throw new MatchError(
        'invalid_profile',
        'Review the profile date, functions and skill claims.',
      );
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

        if (cursor && compareMatches(result, cursor.anchor as MatchExplanation) <= 0) {
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
                completeness: last.completeness,
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
