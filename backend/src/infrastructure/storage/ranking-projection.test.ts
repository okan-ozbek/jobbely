import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { featureJob, candidate } from '../../test-fixtures/resume-matching.js';
import { scoreJob } from '../../domain/matching/score.js';
import type { FeatureJob } from '../../domain/matching/model.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('compact ranking parity (isolated PostgreSQL)', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Dedicated test database required');
    }

    client = new pg.Client({ connectionString });
    await client.connect();

    // A connection-local copy avoids racing schema setup in other test files.
    const sql = await readFile(
      new URL(
        '../../../prisma/migrations/202610150001_read_projections/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );

    const start = sql.indexOf('CREATE FUNCTION jobbely_ranking_requirements');
    const end = sql.indexOf('ALTER TABLE "JobFeature"', start);

    await client.query(
      sql
        .slice(start, end)
        .replace(
          'CREATE FUNCTION jobbely_ranking_requirements',
          'CREATE FUNCTION pg_temp.jobbely_ranking_requirements',
        ),
    );
  });

  afterAll(async () => {
    await client?.end();
  });

  it('preserves every ranking field across alternatives, tenure, degrees, duplicate criteria, contextual duties and truncation', async () => {
    const texts = [
      'Requirements\nTypeScript or Kotlin required.\n2 years professional experience.\nBachelor degree in Computer Science required.\nResponsibilities\nBuild software with TypeScript.',
      'Requirements\nTypeScript or ObscureTool required.\n5 years of Kubernetes experience required.\nMust be authorized to work in the Netherlands.\nPreferred qualifications\nDocker.\nResponsibilities\nImprove performance using Redis.',
      'Requirements\nTypeScript required.\nTypeScript required.\nMust have experience with UncataloguedHDL.\nStrong communication required.',
      'About us\nWe use Python and Java.\nBenefits\nLearning and development.',
    ];

    for (const text of texts) {
      for (const truncated of [false, true]) {
        const full = featureJob(text);

        full.requirements.truncated = truncated;

        const { rows } = await client.query<{ requirements: FeatureJob['requirements'] }>(
          'SELECT pg_temp.jobbely_ranking_requirements($1::jsonb) AS requirements',
          [JSON.stringify(full.requirements)],
        );

        const compact = { ...full, requirements: rows[0]!.requirements };

        expect(compact.requirements.clauses).toEqual([]);
        expect(compact.requirements.blocks.every((block) => block.text === '')).toBe(true);

        for (const profile of [
          candidate(),
          {
            ...candidate(),
            skills: [{ id: 'typescript', status: 'negated' as const }],
            skillTenure: [{ skillId: 'kubernetes', months: 12 }],
          },
        ]) {
          for (const context of [false, true]) {
            const original = scoreJob(full, profile, [], context);
            const ranking = scoreJob(compact, profile, [], context);

            for (const field of [
              'band',
              'baseScore',
              'fitScore',
              'assessmentCoverage',
              'requiredGaps',
              'unresolvedRequirements',
              'roleRelevancePoints',
              'employerAdjustment',
            ] as const) {
              expect(ranking[field]).toEqual(original[field]);
            }
          }
        }
      }
    }
  });
});
