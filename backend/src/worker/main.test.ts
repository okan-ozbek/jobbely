import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Job = {
  id: string;
  signal?: AbortSignal;
  data?: { cycleId: string; companySlug: string; registryHash: string };
};

const test = vi.hoisted(() => {
  const handlers = new Map<string, (jobs: Job[]) => Promise<void>>();

  const dependencies = {
    refreshSources: { executeCompany: vi.fn() },
    companies: [],
    sources: [],
    backfill: { execute: vi.fn() },
    sync: { execute: vi.fn() },
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

  return { handlers, dependencies, boss, coordinate: vi.fn() };
});

vi.mock('../bootstrap.js', () => ({
  config: { DATA_MODE: 'postgres', DATABASE_URL: 'unused' },
  bootstrap: async () => test.dependencies,
}));

vi.mock('pg-boss', () => ({
  PgBoss: class {
    constructor() {
      return test.boss;
    }
  },
}));

vi.mock('../infrastructure/company-refresh-queue.js', () => ({
  refreshRegistryHash: () => 'same-registry',
  CompanyRefreshQueue: class {
    execute = test.coordinate;
  },
}));

let listeners: Map<'SIGINT' | 'SIGTERM', ReturnType<typeof process.listeners>>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  test.handlers.clear();
  test.boss.getSchedules.mockResolvedValue([{ key: 'enabled' }, { key: 'removed' }]);

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

describe('single ingestion scheduler', () => {
  it('retires per-source schedules and routes startup, manual and cron work through one exclusive cycle', async () => {
    await import('./main.js');

    expect(test.boss.unschedule.mock.calls).toEqual([
      ['sync-source', 'enabled'],
      ['sync-source', 'removed'],
    ]);

    expect(test.boss.schedule).toHaveBeenCalledWith('sync-waves', '0 */12 * * *', null, {
      tz: 'UTC',
    });

    expect(test.boss.send).toHaveBeenCalledWith('sync-waves');

    const signal = new AbortController().signal;

    await test.handlers.get('sync-waves')!([{ id: 'cycle', signal }]);

    expect(test.coordinate).toHaveBeenCalledWith('cycle', signal);

    await test.handlers.get('sync-company')!([
      {
        id: 'company',
        signal,
        data: { cycleId: 'cycle', companySlug: 'example', registryHash: 'same-registry' },
      },
    ]);

    expect(test.dependencies.refreshSources.executeCompany).toHaveBeenCalledWith(
      'company',
      'example',
      signal,
    );

    await expect(
      test.handlers.get('sync-company')!([
        {
          id: 'mismatch',
          data: { cycleId: 'cycle', companySlug: 'example', registryHash: 'wrong' },
        },
      ]),
    ).rejects.toThrow('configuration changed');

    await test.handlers.get('sync-source')!([{ id: 'legacy' }]);
    expect(test.dependencies.sync.execute).not.toHaveBeenCalled();
  });
});
