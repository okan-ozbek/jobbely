import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Extraction, Source } from '../../domain/model.js';
import { AuditedPostingValidation } from './validation.js';
import { loadAuditPlans } from './registry.js';
import { auditPlanSchema } from './model.js';
import { createAdapters } from '../adapters/factory.js';
import { PublicJsonTransport } from '../http.js';
import { SyncSource } from '../../application/sync-source.js';
import { MemoryJobRepository } from '../storage/memory.js';
import { htmlPreparation } from '../html.js';

vi.mock('./registry.js', () => ({ loadAuditPlans: vi.fn(), requireVerifiedEvidence: vi.fn() }));

afterEach(() => vi.resetAllMocks());

const source: Source = {
  id: 'example',
  companySlug: 'example',
  provider: 'ashby',
  board: 'example',
  auditStatus: 'candidate',
  scheduled: false,
};

const extraction: Extraction = {
  postings: [],
  rawResponses: [],
  excluded: 0,
  enumerationComplete: true,
};

const review = {
  status: 'pending',
  notes: 'Review pending',
  evidenceUrls: ['https://example.com/terms'],
};

const plan = auditPlanSchema.parse({
  companySlug: 'example',
  scope: review,
  access: { ...review, display: 'pending' },
  channels: [
    {
      url: 'https://example.com/careers',
      disposition: 'included',
      sourceIds: ['example'],
      reason: 'Official board',
    },
  ],
  pages: [
    {
      url: 'https://example.com/careers',
      role: 'listings',
      sourceIds: ['example'],
      complete: false,
    },
  ],
});

describe('candidate publication access gates', () => {
  it('preserves prior candidate listings, absence counters and publication version when display is blocked', async () => {
    const repository = new MemoryJobRepository();
    const adapters = createAdapters(new PublicJsonTransport());
    const adapter = adapters.ashby;

    const posting = {
      sourcePostingId: '1',
      title: 'Engineer',
      url: 'https://example.com/job',
      applyUrl: 'https://example.com/apply',
      descriptionHtml: '<p>A complete synthetic role description.</p>',
      departments: [],
      locations: ['Paris'],
      workplace: 'unknown' as const,
      employment: 'FullTime',
      publishedAt: null,
    };

    vi.spyOn(adapter, 'extract').mockResolvedValue({ ...extraction, postings: [posting] });
    vi.mocked(loadAuditPlans).mockReturnValue([plan]);

    const validation = new AuditedPostingValidation([], [source], adapters);

    const sync = new SyncSource(
      repository,
      adapters,
      htmlPreparation,
      [],
      () => new Date('2026-10-06T12:00:00Z'),
      validation,
    );

    await sync.execute(source);

    const before = await repository.read();
    const commit = vi.spyOn(repository, 'commitSnapshot');

    vi.mocked(loadAuditPlans).mockReturnValue([
      { ...plan, access: { ...plan.access, display: 'blocked', notes: 'Permission required' } },
    ]);

    await expect(sync.execute(source)).rejects.toThrow('Full-description publication blocked');

    const after = await repository.read();

    expect(after.version).toBe(before.version);
    expect(after.jobs).toEqual(before.jobs);
    expect(after.runs.at(-1)?.status).toBe('failed');
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(['status', 'display'] as const)(
    'blocks publication for an explicitly blocked access %s',
    async (field) => {
      vi.mocked(loadAuditPlans).mockReturnValue([
        {
          ...plan,
          access: { ...plan.access, [field]: 'blocked', notes: 'Publication permission required' },
        },
      ]);

      const validation = new AuditedPostingValidation(
        [],
        [source],
        createAdapters(new PublicJsonTransport()),
      );

      await expect(validation.validate(source, extraction)).rejects.toThrow(
        'Full-description publication blocked for example: Publication permission required',
      );
    },
  );

  it('keeps pending candidates investigable without imposing another employer publication block', async () => {
    vi.mocked(loadAuditPlans).mockReturnValue([
      plan,
      {
        ...plan,
        companySlug: 'other',
        access: { ...plan.access, status: 'blocked', display: 'blocked' },
      },
    ]);

    const validation = new AuditedPostingValidation(
      [],
      [source],
      createAdapters(new PublicJsonTransport()),
    );

    await expect(validation.validate(source, extraction)).resolves.toEqual([]);
  });
});
