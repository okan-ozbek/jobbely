import { describe, expect, it, vi } from 'vitest';
import type { Company, Extraction, Source, SourceRun } from '../domain/model.js';
import type { WaveAudits, WaveCompanyAudit, WaveRefreshReport } from '../ports/wave-refresh.js';
import { RefreshWaves } from './refresh-waves.js';

const companies: Company[] = ['C', 'B', 'A'].map((wave) => ({
  slug: wave.toLowerCase(),
  name: wave,
  wave: wave as Company['wave'],
  careersUrl: `https://${wave.toLowerCase()}.example/careers`,
  logoUrl: '/logos/default.svg',
}));

const sources: Source[] = companies.map((company) => ({
  id: company.slug,
  companySlug: company.slug,
  provider: 'ashby',
  board: company.slug,
  auditStatus: 'candidate',
  scheduled: false,
}));

const extraction: Extraction = {
  postings: [],
  rawResponses: [],
  excluded: 0,
  enumerationComplete: true,
};

function setup() {
  const events: string[] = [];
  const saved: WaveRefreshReport[] = [];

  const sync = {
    executeWithEvidence: vi.fn(async (source: Source) => {
      events.push(`sync:${source.id}`);

      const run: SourceRun = {
        id: `run-${source.id}`,
        sourceId: source.id,
        startedAt: '2026-10-06T00:00:00Z',
        finishedAt: '2026-10-06T00:01:00Z',
        status: 'succeeded',
        listingCount: 12,
        excludedCount: 0,
        enumerationComplete: true,
        removalsQuarantined: false,
        error: null,
      };

      return { run, extraction };
    }),
  };

  const audits = {
    verify: vi.fn<WaveAudits['verify']>(
      async (_id: string, company: Company): Promise<WaveCompanyAudit> => {
        events.push(`audit:${company.slug}`);

        return { status: 'passed' as const, blockers: [], reportPath: 'ignored/report.json' };
      },
    ),
  };

  const reports = {
    save: vi.fn(async (report: WaveRefreshReport) => {
      saved.push(structuredClone(report));
    }),
  };

  const backfill = {
    execute: vi.fn(async () => {
      events.push('backfill');
    }),
  };

  return {
    events,
    saved,
    sync,
    audits,
    reports,
    backfill,
    create: (registry = sources) =>
      new RefreshWaves(companies, registry, sync, audits, reports, backfill),
  };
}

describe('sequential wave refresh and automatic audits', () => {
  it('awaits A then B then C, reuses successful snapshots and preserves registry verification', async () => {
    const test = setup();
    const before = structuredClone(sources);
    const report = await test.create().execute('cycle');

    expect(test.events).toEqual([
      'sync:a',
      'audit:a',
      'backfill',
      'sync:b',
      'audit:b',
      'backfill',
      'sync:c',
      'audit:c',
      'backfill',
    ]);

    expect(test.audits.verify.mock.calls[0]).toEqual([
      'cycle',
      companies[2],
      [sources[2]],
      new Map([['a', extraction]]),
      new Map([['a', 'run-a']]),
    ]);

    expect(sources).toEqual(before);
    expect(report.status).toBe('succeeded');
    expect(report.finishedAt).not.toBeNull();
    expect(test.saved.some((saved) => saved.current?.stage === 'audit')).toBe(true);
  });

  it('continues after sync, audit and backfill failures without hiding their separate outcomes', async () => {
    const test = setup();

    test.sync.executeWithEvidence.mockRejectedValueOnce(new Error('Feed unavailable'));

    test.audits.verify.mockResolvedValueOnce({
      status: 'blocked',
      blockers: ['Missing official identities'],
      reportPath: 'ignored/report.json',
    });

    test.audits.verify.mockRejectedValueOnce(new Error('Official page unavailable'));
    test.backfill.execute.mockRejectedValueOnce(new Error('Projection unavailable'));

    const report = await test.create().execute('cycle');

    expect(report.status).toBe('completed_with_issues');
    expect(report.waves[0]?.companies[0]?.sources[0]?.error).toBe('Feed unavailable');
    expect(report.waves[0]?.companies[0]?.audit?.status).toBe('blocked');
    expect(report.waves[0]?.backfillError).toBe('Projection unavailable');
    expect(report.waves[1]?.companies[0]?.audit?.status).toBe('failed');
    expect(report.waves[2]?.companies[0]?.sources[0]?.status).toBe('succeeded');
    expect(test.audits.verify.mock.calls[0]?.[3]).toEqual(new Map());
  });

  it('audits every board of a company together and reports unconfigured companies', async () => {
    const test = setup();
    const second = { ...sources[2]!, id: 'a-second', board: 'second' };
    const report = await test.create([sources[2]!, second]).execute('cycle', ['B', 'A']);

    expect(test.events).toEqual(['sync:a', 'sync:a-second', 'audit:a', 'backfill', 'backfill']);

    expect(test.audits.verify.mock.calls[0]?.[3]).toEqual(
      new Map([
        ['a', extraction],
        ['a-second', extraction],
      ]),
    );

    expect(report.waves.map((wave) => wave.wave)).toEqual(['A', 'B']);

    expect(report.waves[1]?.companies[0]?.audit?.blockers).toEqual([
      'No configured source for this company',
    ]);

    expect(report.status).toBe('completed_with_issues');
  });

  it('stops if durable progress cannot be saved and records a failed cycle', async () => {
    const test = setup();

    test.reports.save.mockResolvedValueOnce().mockRejectedValueOnce(new Error('Disk unavailable'));

    await expect(test.create().execute('cycle')).rejects.toThrow('Disk unavailable');
    expect(test.sync.executeWithEvidence).not.toHaveBeenCalled();
    expect(test.saved.at(-1)?.status).toBe('failed');
  });

  it('stops the cycle when its queue job is cancelled instead of starting the next source', async () => {
    const test = setup();
    const controller = new AbortController();

    test.audits.verify.mockImplementationOnce(async () => {
      controller.abort(new Error('Queue job cancelled'));

      return { status: 'passed', blockers: [], reportPath: 'ignored/report.json' };
    });

    await expect(test.create().execute('cycle', undefined, controller.signal)).rejects.toThrow(
      'Queue job cancelled',
    );

    expect(test.sync.executeWithEvidence.mock.calls.map(([source]) => source.id)).toEqual(['a']);
    expect(test.saved.at(-1)?.status).toBe('failed');
  });
});
