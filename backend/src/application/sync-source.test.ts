import { describe, expect, it, vi } from 'vitest';
import { SyncSource } from './sync-source.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { htmlPreparation } from '../infrastructure/html.js';
import { LabelMappingStrategy } from '../domain/classification.js';
import type { ExtractedPosting, Provider, Source } from '../domain/model.js';
import type { PostingValidation, SourceAdapter } from '../ports/ingestion.js';

const source: Source = {
  id: 'test',
  companySlug: 'test',
  provider: 'greenhouse',
  board: 'test',
  auditStatus: 'verified',
  scheduled: false,
};

const posting = (id: string): ExtractedPosting => ({
  sourcePostingId: id,
  title: 'Engineer',
  url: `https://example.com/${id}`,
  applyUrl: `https://example.com/${id}`,
  descriptionHtml: '<p>A real description</p>',
  departments: ['Engineering'],
  locations: ['Amsterdam'],
  workplace: 'unknown',
  employment: 'unknown',
  publishedAt: null,
});

function setup(validation?: PostingValidation) {
  const repository = new MemoryJobRepository();
  let records = [posting('1'), posting('2'), posting('3'), posting('4')];
  let failure = false;
  let complete = true;
  let at = new Date('2026-09-30T12:00:00.000Z');

  const adapter: SourceAdapter = {
    extract: async () => {
      if (failure) {
        throw new Error('upstream error');
      }

      return {
        postings: records,
        excluded: 0,
        rawResponses: [],
        enumerationComplete: complete,
      };
    },
  };

  const adapters: Record<Provider, SourceAdapter> = {
    greenhouse: adapter,
    ashby: adapter,
    lever: adapter,
    workday: adapter,
    icims: adapter,
    linkedin: adapter,
    apple: adapter,
    amazon: adapter,
    eightfold: adapter,
    meta: adapter,
    google: adapter,
  };

  return {
    adapter,
    repository,
    sync: new SyncSource(
      repository,
      adapters,
      htmlPreparation,
      [new LabelMappingStrategy()],
      () => at,
      validation,
    ),
    records: (value: ExtractedPosting[]) => {
      records = value;
    },
    fail: () => {
      failure = true;
    },
    partial: () => {
      complete = false;
    },
    time: (value: string) => {
      at = new Date(value);
    },
  };
}

describe('source synchronization', () => {
  it('renews long-running ownership and refuses publication after renewal failure', async () => {
    vi.useFakeTimers();

    const test = setup();
    const renew = vi.spyOn(test.repository, 'renewRun').mockResolvedValue(false);
    const commit = vi.spyOn(test.repository, 'commitSnapshot');
    let release!: () => void;

    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });

    const extract = test.adapter.extract.bind(test.adapter);

    vi.spyOn(test.adapter, 'extract').mockImplementation(async (item) => {
      await wait;

      return extract(item);
    });

    const running = test.sync.execute(source);
    const rejected = expect(running).rejects.toThrow(/lease lost/);

    try {
      await vi.advanceTimersByTimeAsync(60_000);
      expect(renew).toHaveBeenCalledWith(source.id, expect.any(String), expect.any(String));
      release();
      await rejected;
      expect(commit).not.toHaveBeenCalled();
      expect((await test.repository.read()).runs[0]?.status).toBe('failed');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      release();
      vi.useRealTimers();
    }
  });

  it('reruns idempotently and sanitizes executable HTML', async () => {
    const test = setup();

    test.records([
      {
        ...posting('1'),
        descriptionHtml:
          '<p onclick="bad()">Hello</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>',
      },
    ]);

    await test.sync.execute(source);

    const first = (await test.repository.read()).jobs[0];

    await test.sync.execute(source);

    const second = (await test.repository.read()).jobs[0];

    expect(second?.id).toBe(first?.id);
    expect(second?.firstSeenAt).toBe(first?.firstSeenAt);
    expect(second?.descriptionHtml).not.toMatch(/script|onclick|javascript/);
    expect((await test.repository.read()).jobs).toHaveLength(1);
  });

  it('never closes jobs or changes dataset publication on upstream failure', async () => {
    const test = setup();

    await test.sync.execute(source);

    const version = (await test.repository.read()).version;

    test.fail();
    await expect(test.sync.execute(source)).rejects.toThrow('upstream error');

    const dataset = await test.repository.read();

    expect(dataset.version).toBe(version);
    expect(dataset.jobs.every((job) => job.status === 'active')).toBe(true);
  });

  it('rejects duplicate IDs atomically', async () => {
    const test = setup();

    test.records([posting('1'), posting('1')]);
    await expect(test.sync.execute(source)).rejects.toThrow('Duplicate');
    expect((await test.repository.read()).jobs).toHaveLength(0);
  });

  it('closes only after two complete snapshots across 24 hours and reopens same ID', async () => {
    const test = setup();

    await test.sync.execute(source);

    const id = (await test.repository.read()).jobs.find((job) => job.sourcePostingId === '4')?.id;

    test.records([posting('1'), posting('2'), posting('3')]);
    test.time('2026-10-01T12:00:00.000Z');
    await test.sync.execute(source);
    expect((await test.repository.read()).jobs.find((job) => job.id === id)?.status).toBe('active');
    test.time('2026-10-02T12:00:00.000Z');
    await test.sync.execute(source);
    expect((await test.repository.read()).jobs.find((job) => job.id === id)?.status).toBe('closed');
    test.records([posting('1'), posting('2'), posting('3'), posting('4')]);
    await test.sync.execute(source);

    expect((await test.repository.read()).jobs.find((job) => job.id === id)).toMatchObject({
      status: 'active',
      missingCount: 0,
    });
  });

  it('quarantines repeated count collapses against the last trusted baseline', async () => {
    const test = setup();

    await test.sync.execute(source);
    test.records([]);
    test.time('2026-10-01T12:00:00.000Z');
    expect((await test.sync.execute(source)).removalsQuarantined).toBe(true);
    test.time('2026-10-02T12:00:00.000Z');
    expect((await test.sync.execute(source)).removalsQuarantined).toBe(true);

    expect(
      (await test.repository.read()).jobs.every(
        (job) => job.status === 'active' && job.missingCount === 0,
      ),
    ).toBe(true);
  });

  it('does not increment absences for unaudited or incomplete sources', async () => {
    const test = setup();

    await test.sync.execute(source);
    test.records([posting('1'), posting('2'), posting('3')]);
    await test.sync.execute({ ...source, auditStatus: 'candidate' });
    test.partial();
    await test.sync.execute(source);

    expect(
      (await test.repository.read()).jobs.find((job) => job.sourcePostingId === '4')?.missingCount,
    ).toBe(0);
  });

  it('refuses overlapping source leases', async () => {
    const test = setup();

    await test.repository.startRun(source, '2026-09-30T12:00:00.000Z');
    await expect(test.sync.execute(source)).rejects.toThrow('already');
  });

  it('preserves all prior listings and publication version when official reconciliation fails', async () => {
    let reject = false;

    const test = setup({
      validate: async () => {
        if (reject) {
          throw new Error('Official reconciliation failed');
        }

        return [];
      },
    });

    await test.sync.execute(source);

    const before = await test.repository.read();

    reject = true;
    test.records([posting('1')]);
    await expect(test.sync.execute(source)).rejects.toThrow('Official reconciliation failed');

    const after = await test.repository.read();

    expect(after.version).toBe(before.version);
    expect(after.jobs).toEqual(before.jobs);
    expect(after.runs.at(-1)?.status).toBe('failed');
  });

  it('persists official reconciliation evidence with the successful snapshot', async () => {
    const evidence = {
      url: 'https://example.com/careers',
      fetchedAt: '2026-09-30T12:00:00.000Z',
      body: { matched: true },
    };

    const test = setup({ validate: async () => [evidence] });
    const commit = vi.spyOn(test.repository, 'commitSnapshot');

    await test.sync.execute(source);
    expect(commit.mock.calls[0]?.[0].rawResponses).toContainEqual(evidence);
  });
});
