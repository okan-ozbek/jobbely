import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Job = { id: string; data: { sourceId: string }; signal?: AbortSignal };

const test = vi.hoisted(() => {
  const handlers = new Map<string, (jobs: Job[]) => Promise<void>>();

  const sources = [
    { id: 'candidate', scheduled: true, auditStatus: 'candidate' },
    { id: 'disabled', scheduled: false, auditStatus: 'candidate' },
  ];

  const config = { DATA_MODE: 'postgres', DATABASE_URL: 'unused', INGESTION_WAVE_SYNC: false };

  const dependencies = {
    sources,
    sync: { execute: vi.fn() },
    backfill: { execute: vi.fn() },
    refreshWaves: { execute: vi.fn() },
    closeFeatures: vi.fn(),
    closeAccounts: vi.fn(),
    repository: { close: vi.fn() },
  };

  const boss = {
    on: vi.fn(),
    start: vi.fn(),
    createQueue: vi.fn(),
    updateQueue: vi.fn(),
    getSchedules: vi.fn(),
    unschedule: vi.fn(),
    schedule: vi.fn(),
    send: vi.fn(),
    stop: vi.fn(),
    work: vi.fn(
      async (name: string, _options: unknown, handler: (jobs: Job[]) => Promise<void>) => {
        handlers.set(name, handler);
      },
    ),
  };

  return { handlers, config, dependencies, boss };
});

vi.mock('../bootstrap.js', () => ({
  config: test.config,
  bootstrap: async () => test.dependencies,
}));

vi.mock('pg-boss', () => ({
  PgBoss: class {
    constructor() {
      return test.boss;
    }
  },
}));

let listeners: Map<'SIGINT' | 'SIGTERM', ReturnType<typeof process.listeners>>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  test.handlers.clear();
  test.config.INGESTION_WAVE_SYNC = false;

  test.boss.getSchedules.mockResolvedValue([
    { key: 'candidate' },
    { key: 'disabled' },
    { key: 'removed' },
  ]);

  listeners = new Map(
    (['SIGINT', 'SIGTERM'] as const).map((signal) => [signal, process.listeners(signal)]),
  );
});

afterEach(() => {
  for (const [signal, previous] of listeners) {
    for (const listener of process.listeners(signal)) {
      if (!previous.includes(listener)) {
        process.removeListener(signal, listener);
      }
    }
  }
});

describe('ingestion worker scheduling', () => {
  it('schedules and dispatches an enabled candidate while removing disabled and orphaned cron entries', async () => {
    await import('./main.js');

    expect(test.boss.unschedule).toHaveBeenCalledWith('sync-source', 'disabled');
    expect(test.boss.unschedule).toHaveBeenCalledWith('sync-source', 'removed');
    expect(test.boss.unschedule).not.toHaveBeenCalledWith('sync-source', 'candidate');

    expect(test.boss.schedule).toHaveBeenCalledWith(
      'sync-source',
      '0 */12 * * *',
      { sourceId: 'candidate' },
      expect.objectContaining({ key: 'candidate', tz: 'UTC' }),
    );

    await test.handlers.get('sync-source')!([{ id: 'job', data: { sourceId: 'candidate' } }]);

    expect(test.dependencies.sync.execute).toHaveBeenCalledWith(test.dependencies.sources[0]);
    expect(test.dependencies.backfill.execute).toHaveBeenCalledOnce();
    expect(test.dependencies.sources[0]?.auditStatus).toBe('candidate');
  });

  it('rejects queued disabled sources and does not project failed imports', async () => {
    await import('./main.js');

    await expect(
      test.handlers.get('sync-source')!([{ id: 'job', data: { sourceId: 'disabled' } }]),
    ).rejects.toThrow('not enabled');

    expect(test.dependencies.sync.execute).not.toHaveBeenCalled();

    test.dependencies.sync.execute.mockRejectedValueOnce(new Error('Publication blocked'));

    await expect(
      test.handlers.get('sync-source')!([{ id: 'job', data: { sourceId: 'candidate' } }]),
    ).rejects.toThrow('Publication blocked');

    expect(test.dependencies.backfill.execute).not.toHaveBeenCalled();
  });

  it('uses enabled-only UTC wave cycles and discards competing per-source jobs', async () => {
    test.config.INGESTION_WAVE_SYNC = true;

    await import('./main.js');

    expect(test.boss.schedule).toHaveBeenCalledWith('sync-waves', '0 */12 * * *', null, {
      tz: 'UTC',
    });

    expect(test.boss.unschedule).toHaveBeenCalledWith('sync-source', 'candidate');

    const signal = new AbortController().signal;

    await test.handlers.get('sync-waves')!([{ id: 'cycle', data: { sourceId: '' }, signal }]);

    expect(test.dependencies.refreshWaves.execute).toHaveBeenCalledWith(
      'cycle',
      undefined,
      signal,
      { scheduledOnly: true },
    );

    await test.handlers.get('sync-source')!([{ id: 'old', data: { sourceId: 'candidate' } }]);

    expect(test.dependencies.sync.execute).not.toHaveBeenCalled();
  });
});
