import { expect, it, vi } from 'vitest';
import { JobCatalog } from './catalog.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import type { Company, Dataset, Source, SourceRun } from '../domain/model.js';
import type { CoverageAssessment } from '../ports/coverage.js';
import { createApp } from '../api/app.js';

const now = new Date('2026-10-06T12:00:00Z');

const company: Company = {
  slug: 'example',
  name: 'Example',
  careersUrl: 'https://example.com/careers',
  logoUrl: '/logos/default.svg',
  wave: 'A',
};

const source: Source = {
  id: 'example',
  companySlug: company.slug,
  provider: 'ashby',
  board: 'example',
  auditStatus: 'candidate',
  scheduled: false,
};

const run: SourceRun = {
  id: 'current',
  sourceId: source.id,
  status: 'succeeded',
  startedAt: '2026-10-06T11:00:00Z',
  finishedAt: '2026-10-06T11:01:00Z',
  listingCount: 10,
  excludedCount: 0,
  enumerationComplete: true,
  removalsQuarantined: false,
  error: null,
};

const assessment: CoverageAssessment = {
  companySlug: company.slug,
  configurationHash: 'config',
  checkedAt: '2026-10-06T11:02:00Z',
  status: 'verified',
  sourceRunIds: { example: run.id },
  blockers: [],
  accessStatus: 'unreviewed',
};

function setup(runs = [run], result = assessment, sources = [source]) {
  const repository = new MemoryJobRepository();
  const dataset: Dataset = { version: 1, jobs: [], runs };

  vi.spyOn(repository, 'read').mockResolvedValue(dataset);

  const coverage = { read: async () => [result], save: async () => {}, close: async () => {} };
  const catalog = new JobCatalog(repository, [company], sources, 'postgres', () => now, coverage);

  return { repository, catalog, dataset };
}

it('shows verified coverage for candidate sources without changing access or activation flags', async () => {
  const { repository, catalog } = setup();
  const app = await createApp({ repository, catalog });

  try {
    const response = (await app.inject('/api/v1/companies')).json();

    expect(response[0]).toMatchObject({
      status: 'healthy',
      verification: { status: 'verified', accessStatus: 'unreviewed' },
      sources: [{ auditStatus: 'candidate', scheduled: false }],
    });
  } finally {
    await app.close();
  }
});

it.each([
  ['new unaudited import', [{ ...run, id: 'new' }], assessment],
  ['failed import', [{ ...run, status: 'failed' as const }], assessment],
  ['incomplete traversal', [{ ...run, enumerationComplete: false }], assessment],
  ['quarantined collapse', [{ ...run, removalsQuarantined: true }], assessment],
  [
    'audit mismatch',
    [run],
    { ...assessment, status: 'partial' as const, blockers: ['IDs differ'] },
  ],
  ['expired audit', [run], { ...assessment, checkedAt: '2026-10-04T00:00:00Z' }],
  ['future audit', [run], { ...assessment, checkedAt: '2026-10-07T00:00:00Z' }],
])('withdraws the checkmark for %s', async (_name, runs, result) => {
  expect((await setup(runs, result).catalog.coverage())[0]?.status).not.toBe('healthy');
});

it('requires every board and updates without restarting the API', async () => {
  const second = { ...source, id: 'other', board: 'other' };

  const { catalog, dataset } = setup(
    [run, { ...run, id: 'other-run', sourceId: 'other' }],
    assessment,
    [source, second],
  );

  expect((await catalog.coverage())[0]?.status).toBe('partial');

  const single = setup();

  expect((await single.catalog.coverage())[0]?.status).toBe('healthy');
  single.dataset.runs.push({ ...run, id: 'next', startedAt: now.toISOString() });
  expect((await single.catalog.coverage())[0]?.status).toBe('partial');
  expect(dataset.runs).toHaveLength(2);
});
