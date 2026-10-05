import { describe, expect, it } from 'vitest';
import type { Company, Extraction, Source } from '../../domain/model.js';
import { SourceAuditor } from './auditor.js';
import { assertAuditEvidence, auditPlanSchema, hash } from './model.js';
import { compareIdentities, inspectOfficialPage } from './reconcile.js';

const now = new Date('2026-09-30T12:00:00.000Z');

const company: Company = {
  slug: 'example',
  name: 'Example',
  careersUrl: 'https://example.com/careers',
  logoUrl: '/logos/default.svg',
  wave: 'A',
};

const source: Source = {
  id: 'example',
  companySlug: 'example',
  provider: 'greenhouse',
  board: 'example',
  auditStatus: 'candidate',
  scheduled: false,
};

const approved = {
  status: 'approved',
  reviewer: 'operator',
  reviewedAt: now.toISOString(),
  notes: 'All linked channels inspected; private-use access conditions reviewed.',
  evidenceUrls: [company.careersUrl],
};

const policyBody = '<main>Private automated API use and full descriptions allowed.</main>';

const plan = auditPlanSchema.parse({
  companySlug: company.slug,
  scope: approved,
  access: {
    ...approved,
    display: 'private_full_descriptions',
    evidenceUrls: ['https://example.com/terms'],
    reviewedDocuments: [
      {
        url: 'https://example.com/terms',
        sha256: hash('Private automated API use and full descriptions allowed.'),
      },
    ],
  },
  channels: [
    {
      url: company.careersUrl,
      disposition: 'included',
      sourceIds: [source.id],
      reason: 'Official employer inventory',
    },
  ],
  pages: [{ url: company.careersUrl, role: 'listings', sourceIds: [source.id], complete: true }],
});

const posting = {
  sourcePostingId: '1',
  title: 'Engineer',
  url: 'https://job-boards.greenhouse.io/example/jobs/1',
  applyUrl: 'https://job-boards.greenhouse.io/example/jobs/1',
  descriptionHtml: '<p>Full role description</p>',
  departments: ['Engineering'],
  locations: ['London'],
  workplace: 'unknown' as const,
  employment: 'unknown',
  publishedAt: null,
};

const extraction: Extraction = {
  postings: [posting],
  enumerationComplete: true,
  excluded: 0,
  rawResponses: [
    {
      url: 'https://boards-api.greenhouse.io/v1/boards/example/jobs',
      fetchedAt: now.toISOString(),
      body: { jobs: [{ id: 1, internal_job_id: 123 }] },
    },
  ],
};

function audit(
  html: string | ((url: string) => string) = `<a href="${posting.url}">Engineer</a>`,
  feed = extraction,
  auditPlan = plan,
  snapshots?: ReadonlyMap<string, Extraction>,
  automaticCoverage = false,
) {
  const adapter = {
    extract: async () => {
      if (snapshots) {
        throw new Error('Automatic audit must not fetch this feed again');
      }

      return feed;
    },
  };

  return new SourceAuditor(
    company,
    [source],
    auditPlan,
    {
      get: async (url) => ({
        url,
        body: url.endsWith('/terms') ? policyBody : typeof html === 'function' ? html(url) : html,
        robotsUrl: 'https://example.com/robots.txt',
        robotsBody: 'User-agent: *\nAllow: /',
        fetchedAt: now.toISOString(),
      }),
    },
    {
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
    },
    () => now,
  ).run('ignored/raw-evidence', undefined, snapshots, automaticCoverage);
}

describe('automatic technical coverage', () => {
  const pending = auditPlanSchema.parse({
    ...plan,
    scope: { ...plan.scope, status: 'pending' },
    access: { ...plan.access, status: 'pending', display: 'pending' },
    pages: plan.pages.map((page) => ({ ...page, complete: false })),
  });

  it('verifies exact official identities without manual approvals, while keeping access unapproved', async () => {
    const result = await audit(undefined, extraction, pending, undefined, true);

    expect(result.technicalBlockers).toEqual([]);

    expect(result.blockers.some((reason) => reason.includes('access review is pending'))).toBe(
      true,
    );

    expect(() => assertAuditEvidence(result.report, pending, [source], now)).toThrow();
  });

  it('automatically follows same-origin pagination and compares the full inventory', async () => {
    const feed = {
      ...extraction,
      postings: [
        posting,
        {
          ...posting,
          sourcePostingId: '2',
          url: posting.url.replace('/1', '/2'),
          applyUrl: posting.applyUrl.replace('/1', '/2'),
        },
      ],
    };

    const result = await audit(
      (url) =>
        url.endsWith('?page=2')
          ? `<a href="${posting.url.replace('/1', '/2')}">Engineer two</a>`
          : `<a href="${posting.url}">Engineer</a><a rel="next" href="?page=2">Next</a>`,
      feed,
      pending,
      undefined,
      true,
    );

    expect(result.technicalBlockers).toEqual([]);
    expect(result.report.sources[0]?.matchedCount).toBe(2);
    expect(result.report.pages).toHaveLength(2);
  });

  it.each([
    ['interactive pagination', `<a href="${posting.url}">Engineer</a><button>Load more</button>`],
    ['missing official job', '<a href="https://job-boards.greenhouse.io/example/jobs/2">Other</a>'],
    [
      'new unconfigured board',
      `<a href="${posting.url}">Engineer</a><a href="https://jobs.lever.co/other">More jobs</a>`,
    ],
    ['empty JavaScript shell', '<div id="app"></div>'],
  ])('withholds verification for %s', async (_name, html) => {
    expect(
      (await audit(html, extraction, pending, undefined, true)).technicalBlockers.length,
    ).toBeGreaterThan(0);
  });

  it('does not verify a filtered inventory even when its IDs happen to match', async () => {
    const filtered = {
      ...pending,
      pages: [{ ...pending.pages[0]!, url: `${company.careersUrl}?country=NL` }],
    };

    expect(
      (await audit(undefined, extraction, filtered, undefined, true)).technicalBlockers.some(
        (reason) => reason.includes('Filtered'),
      ),
    ).toBe(true);
  });
});

describe('evidence-backed source audits', () => {
  it('checks the exact imported snapshot without refetching, including failed-source gaps', async () => {
    const passed = await audit(undefined, undefined, undefined, new Map([[source.id, extraction]]));
    const failed = await audit(undefined, undefined, undefined, new Map());

    expect(passed.blockers).toEqual([]);
    expect(passed.report.sources[0]?.matchedCount).toBe(1);
    expect(failed.report.sources[0]?.error).toContain('No successful snapshot');
    expect(failed.blockers.length).toBeGreaterThan(0);
  });

  it('passes reviewed, exhaustive exact identities and valid details', async () => {
    const { report, blockers } = await audit();

    expect(blockers).toEqual([]);
    expect(report.sources[0]?.matchedCount).toBe(1);
    expect(() => assertAuditEvidence(report, plan, [source], now)).not.toThrow();
  });

  it('detects different posting sets even when counts are identical', async () => {
    const { report, blockers } = await audit(
      '<a href="https://job-boards.greenhouse.io/example/jobs/2">Engineer</a>',
    );

    expect(report.sources[0]?.missingFromFeed).toEqual(['2']);
    expect(report.sources[0]?.missingFromOfficial).toEqual(['1']);
    expect(blockers).toHaveLength(2);
    expect(() => assertAuditEvidence(report, plan, [source], now)).toThrow('Audit has not passed');
  });

  it('fails pending approvals, unreviewed traversal and unresolved channels', async () => {
    const pending = structuredClone(plan);

    pending.scope.status = 'pending';
    pending.access.status = 'pending';
    pending.pages[0]!.complete = false;
    pending.channels[0]!.disposition = 'pending';

    const { blockers } = await audit(undefined, undefined, pending);

    expect(blockers.some((reason) => reason.includes('scope review'))).toBe(true);
    expect(blockers.some((reason) => reason.includes('access review'))).toBe(true);
    expect(blockers.some((reason) => reason.includes('Unresolved hiring channel'))).toBe(true);
    expect(blockers.some((reason) => reason.includes('traversal not reviewed'))).toBe(true);
  });

  it('does not authorize a board using only its own hosted page', async () => {
    const hosted = structuredClone(plan);

    hosted.pages[0]!.url = 'https://job-boards.greenhouse.io/example';

    const { blockers } = await audit(undefined, undefined, hosted);

    expect(blockers).toContain('example: no official employer link to this board');
  });

  it('detects unexpected linked boards and incomplete/duplicate feeds', async () => {
    const { blockers } = await audit(
      `<a href="${posting.url}">Engineer</a><a href="https://jobs.lever.co/other">Other channel</a>`,
      { ...extraction, enumerationComplete: false, postings: [posting, posting] },
    );

    expect(blockers.some((reason) => reason.includes('Unregistered board'))).toBe(true);
    expect(blockers.some((reason) => reason.includes('Duplicate feed'))).toBe(true);
  });

  it('rejects empty prepared descriptions and application links on another board', async () => {
    const { report, blockers } = await audit(undefined, {
      ...extraction,
      postings: [
        {
          ...posting,
          descriptionHtml: '<script>not a description</script>',
          applyUrl: 'https://job-boards.greenhouse.io/other/jobs/1',
        },
      ],
    });

    expect(report.sources[0]?.invalidDetails).toEqual(['1']);
    expect(blockers.some((reason) => reason.includes('invalid details'))).toBe(true);
  });

  it('accounts for explicitly audited location variants only using native requisition IDs', async () => {
    const variants = {
      ...extraction,
      postings: [
        posting,
        {
          ...posting,
          sourcePostingId: '2',
          url: 'https://job-boards.greenhouse.io/example/jobs/2',
          applyUrl: 'https://job-boards.greenhouse.io/example/jobs/2',
        },
      ],
      rawResponses: [
        {
          ...extraction.rawResponses[0]!,
          body: {
            jobs: [
              { id: 1, internal_job_id: 123 },
              { id: 2, internal_job_id: 123 },
            ],
          },
        },
      ],
    };

    const variantPlan = { ...plan, reconciliation: 'greenhouse_requisition_variants' as const };
    const { report, blockers } = await audit(undefined, variants, variantPlan);

    expect(blockers).toEqual([]);

    expect(report.sources[0]?.coveredVariants).toEqual([
      { feedId: '2', officialId: '1', requisitionId: '123' },
    ]);

    expect(report.sources[0]?.feedCount).toBe(2);
    expect(report.sources[0]?.officialCount).toBe(1);

    const strict = await audit(undefined, variants);

    expect(strict.report.sources[0]?.missingFromOfficial).toEqual(['2']);

    const unrelated = {
      ...variants,
      rawResponses: [
        {
          ...variants.rawResponses[0]!,
          body: {
            jobs: [
              { id: 1, internal_job_id: 123 },
              { id: 2, internal_job_id: 456 },
            ],
          },
        },
      ],
    };

    expect(
      (await audit(undefined, unrelated, variantPlan)).report.sources[0]?.missingFromOfficial,
    ).toEqual(['2']);
  });

  it('does not interpret an empty JavaScript shell as a complete inventory', async () => {
    const { blockers } = await audit('<div id="jobs"></div>', { ...extraction, postings: [] });

    expect(blockers).toContain('example: official listing traversal not reviewed');
  });

  it('fails when an official inventory gains untraversed pagination', async () => {
    const { blockers } = await audit(
      `<a href="${posting.url}">Engineer</a><button>Load more</button>`,
    );

    expect(blockers.some((reason) => reason.includes('Untraversed official pagination'))).toBe(
      true,
    );
  });

  it('accepts zero vacancies only with a reviewed explicit empty-state marker', async () => {
    const emptyPlan = structuredClone(plan);

    emptyPlan.pages[0]!.emptySelector = '.no-jobs';

    const html =
      '<a href="https://job-boards.greenhouse.io/example">Official board</a><p class="no-jobs">No open roles</p>';

    expect((await audit(html, { ...extraction, postings: [] }, emptyPlan)).blockers).toEqual([]);
  });

  it('binds evidence to configuration, all sources and a 30-day expiry', async () => {
    const { report } = await audit();

    expect(() => assertAuditEvidence(report, plan, [{ ...source, board: 'other' }], now)).toThrow(
      'configuration',
    );

    expect(() => assertAuditEvidence({ ...report, sources: [] }, plan, [source], now)).toThrow(
      'every configured',
    );

    expect(() =>
      assertAuditEvidence(report, plan, [source], new Date('2026-11-01T12:00:00Z')),
    ).toThrow('expired');

    expect(() =>
      assertAuditEvidence(report, plan, [source], new Date('2026-09-29T12:00:00Z')),
    ).toThrow('future');
  });

  it('requires reviewer attribution for manual approvals', () => {
    expect(() =>
      auditPlanSchema.parse({ ...plan, access: { ...approved, reviewer: undefined } }),
    ).toThrow();
  });

  it('blocks changed policy text and permissions that allow links only', async () => {
    const changed = structuredClone(plan);

    changed.access.reviewedDocuments[0]!.sha256 = '0'.repeat(64);

    expect(
      (await audit(undefined, undefined, changed)).blockers.some((reason) =>
        reason.includes('policy is unreviewed or changed'),
      ),
    ).toBe(true);

    const linksOnly = structuredClone(plan);

    linksOnly.access.display = 'links_only';

    expect(
      (await audit(undefined, undefined, linksOnly)).blockers.some((reason) =>
        reason.includes('full-description display'),
      ),
    ).toBe(true);
  });

  it('reports failed official access instead of passing based on feed counts', async () => {
    const adapter = { extract: async () => extraction };

    const auditor = new SourceAuditor(
      company,
      [source],
      plan,
      {
        get: async () => {
          throw new Error('robots denied');
        },
      },
      {
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
      },
      () => now,
    );

    const { report, blockers } = await auditor.run('ignored');

    expect(report.pages[0]?.error).toBe('robots denied');
    expect(blockers.some((reason) => reason.includes('robots denied'))).toBe(true);
  });
});

describe('official identity reconciliation', () => {
  it('deduplicates references without conflating different posting IDs', () => {
    expect(compareIdentities(['1', '1', '2'], ['1', '1', '3'])).toEqual({
      matchedCount: 1,
      missingFromFeed: ['3'],
      missingFromOfficial: ['2'],
    });
  });

  it('discovers Discord boards in the official script without treating them as job enumeration', () => {
    const page = {
      ...plan.pages[0]!,
      role: 'discovery' as const,
      boardArray: 'DISCORD_JOB_BOARDS',
    };

    const result = inspectOfficialPage(
      't.DISCORD_JOB_BOARDS=["discord","discordinternational","internationaleor"]',
      page,
      [],
    );

    expect([...result.boards]).toEqual([
      'greenhouse:discord',
      'greenhouse:discordinternational',
      'greenhouse:internationaleor',
    ]);

    expect(result.ids.size).toBe(0);
    expect(() => inspectOfficialPage('changed script', page, [])).toThrow('no longer exposes');
  });

  it('extracts native Mozilla IDs and keeps embedded JSON links as discovery only', () => {
    const page = { ...plan.pages[0]!, url: 'https://www.mozilla.org/en-US/careers/listings/' };

    const result = inspectOfficialPage(
      '<a href="/en-US/careers/position/gh/7137777/">Data Scientist</a><script>{"url":"https://jobs.lever.co/other/abc"}</script>',
      page,
      [source],
    );

    expect([...result.ids.get('greenhouse:example')!]).toEqual(['7137777']);
    expect(result.ids.has('lever:other')).toBe(false);
    expect(result.boards.has('lever:other')).toBe(true);
  });
});
