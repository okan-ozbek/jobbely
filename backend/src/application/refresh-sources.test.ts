import { describe, expect, it, vi } from 'vitest';
import type { Company, Extraction, Source, SourceRun } from '../domain/model.js';
import type { CompanyAudits, SourceRefreshReport } from '../ports/source-refresh.js';
import { RefreshSources } from './refresh-sources.js';
import { orderCompanies } from '../domain/source-order.js';

const companies: Company[] = ['d', 'b', 'a'].map((slug) => ({
  slug,
  name: slug,
  wave: slug.toUpperCase() as Company['wave'],
  careersUrl: `https://${slug}.example/careers`,
  logoUrl: '/logos/default.svg',
}));

const sources: Source[] = companies.map((company) => ({
  id: company.slug,
  companySlug: company.slug,
  provider: 'ashby',
  board: company.slug,
  auditStatus: 'candidate',
  scheduled: true,
}));

const extraction: Extraction = {
  postings: [],
  rawResponses: [],
  excluded: 0,
  enumerationComplete: true,
};

function setup(registry = sources) {
  const events: string[] = [];
  const saved: SourceRefreshReport[] = [];

  const sync = {
    executeWithEvidence: vi.fn(async (source: Source) => {
      events.push(`sync:${source.id}`);

      const run: SourceRun = {
        id: `run-${source.id}`,
        sourceId: source.id,
        startedAt: '2026-10-15T00:00:00Z',
        finishedAt: '2026-10-15T00:01:00Z',
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
    verify: vi.fn<CompanyAudits['verify']>(async (_id, company) => {
      events.push(`audit:${company.slug}`);

      return { status: 'passed', blockers: [], reportPath: 'ignored/report.json' };
    }),
  };

  const reports = {
    save: vi.fn(async (report: SourceRefreshReport) => {
      saved.push(structuredClone(report));
    }),
  };

  const backfill = {
    execute: vi.fn(async () => {
      events.push('backfill');
    }),
  };

  const workflow = new RefreshSources(
    orderCompanies(companies, ['b', 'd']),
    registry,
    sync,
    audits,
    reports,
    backfill,
  );

  return { events, saved, sync, audits, reports, backfill, workflow };
}

describe('one ordered source refresh', () => {
  it('awaits each company and board in manual order, including former D, and backfills once', async () => {
    const second = { ...sources[1]!, id: 'b-second' };
    const test = setup([...sources, second]);
    const report = await test.workflow.execute('cycle');

    expect(test.events).toEqual([
      'sync:b',
      'sync:b-second',
      'audit:b',
      'sync:d',
      'audit:d',
      'sync:a',
      'audit:a',
      'backfill',
    ]);

    expect(test.audits.verify.mock.calls[0]?.slice(2)).toEqual([
      [sources[1], second],
      new Map([
        ['b', extraction],
        ['b-second', extraction],
      ]),
      new Map([
        ['b', 'run-b'],
        ['b-second', 'run-b-second'],
      ]),
    ]);

    expect(report.status).toBe('succeeded');
    expect(report.companies.map((company) => company.company)).toEqual(['b', 'd', 'a']);
  });

  it('skips disabled imports but audits all configured boards, preserving scope gaps', async () => {
    const disabled = { ...sources[1]!, id: 'b-disabled', scheduled: false };
    const test = setup([sources[1]!, disabled, { ...sources[0]!, scheduled: false }]);

    await test.workflow.execute('cycle', undefined, { scheduledOnly: true });
    expect(test.events).toEqual(['sync:b', 'audit:b', 'backfill']);
    expect(test.audits.verify.mock.calls[0]?.[2]).toEqual([sources[1], disabled]);
    expect(test.audits.verify.mock.calls[0]?.[3]).toEqual(new Map([['b', extraction]]));
  });

  it('continues after individual source, audit and projection failures with separate outcomes', async () => {
    const test = setup();

    test.sync.executeWithEvidence.mockRejectedValueOnce(new Error('Feed unavailable'));
    test.audits.verify.mockRejectedValueOnce(new Error('Audit unavailable'));
    test.backfill.execute.mockRejectedValueOnce(new Error('Projection unavailable'));

    const report = await test.workflow.execute('cycle');

    expect(report.status).toBe('completed_with_issues');
    expect(report.companies[0]?.sources[0]?.error).toBe('Feed unavailable');
    expect(report.companies[0]?.audit?.status).toBe('failed');
    expect(report.companies[2]?.sources[0]?.status).toBe('succeeded');
    expect(report.backfillError).toBe('Projection unavailable');
    expect(test.audits.verify.mock.calls[0]?.[3].size).toBe(0);
  });

  it('reports missing source configuration in manual cycles', async () => {
    const test = setup([sources[1]!]);
    const report = await test.workflow.execute('cycle');

    expect(report.companies[1]?.audit?.blockers).toEqual(['No configured source for this company']);
    expect(report.status).toBe('completed_with_issues');
  });

  it('stops before further work when progress storage fails', async () => {
    const test = setup();

    test.reports.save.mockResolvedValueOnce().mockRejectedValueOnce(new Error('Disk unavailable'));
    await expect(test.workflow.execute('cycle')).rejects.toThrow('Disk unavailable');
    expect(test.sync.executeWithEvidence).not.toHaveBeenCalled();
    expect(test.saved.at(-1)?.status).toBe('failed');
  });

  it('stops after cancellation without starting the next company', async () => {
    const test = setup();
    const controller = new AbortController();

    test.audits.verify.mockImplementationOnce(async () => {
      controller.abort(new Error('Cancelled'));

      return { status: 'passed', blockers: [], reportPath: null };
    });

    await expect(test.workflow.execute('cycle', controller.signal)).rejects.toThrow('Cancelled');
    expect(test.sync.executeWithEvidence.mock.calls.map(([source]) => source.id)).toEqual(['b']);
    expect(test.saved.at(-1)?.status).toBe('failed');
  });
});
