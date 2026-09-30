import { describe, expect, it } from 'vitest';
import type { RawResponse, Source } from '../../domain/model.js';
import type { JsonSearchTransport } from '../../ports/ingestion.js';
import { WorkdayAdapter } from './workday.js';
import { IcimsAdapter } from './icims.js';
import { LinkedInAdapter } from './linkedin.js';
import { loadRegistry } from '../registry.js';
import { loadAuditPlans } from '../audits/registry.js';
import { configurationHash } from '../audits/model.js';
import { officialIdentity, resolveOfficialIds } from '../audits/reconcile.js';

const at = '2026-09-30T12:00:00.000Z';

const response = (url: string, body: unknown): RawResponse => ({ url, body, fetchedAt: at });

const source: Source = {
  id: 'test',
  companySlug: 'test',
  provider: 'workday',
  board: 'Slack',
  endpoint: 'https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/Slack/jobs',
  auditStatus: 'candidate',
  scheduled: false,
};

const listing = (id: string) => ({ title: 'Engineer', externalPath: `/job/London/Engineer_${id}` });

const detail = (id: string) => ({
  jobPostingInfo: {
    id: `stable-${id}`,
    jobPostingId: `Engineer_${id}`,
    title: 'Engineer',
    jobDescription: '<p>Build software.</p>',
    location: 'London',
    additionalLocations: ['Amsterdam'],
    externalUrl: `https://salesforce.wd12.myworkdayjobs.com/Slack/job/London/Engineer_${id}`,
    posted: true,
    canApply: true,
    startDate: '2026-09-30',
    timeType: 'Full time',
  },
});

function workday(
  search: (body: unknown) => unknown,
  hydrate = (id: string): unknown => detail(id),
): JsonSearchTransport {
  return {
    post: async (url, body) => response(url, search(body)),
    get: async (url) => response(url, hydrate(url.split('_').at(-1)!)),
  };
}

describe('Workday exhaustive extraction', () => {
  it('accepts the native regional Workday link only for the configured tenant and site', async () => {
    const canonical = detail('1');

    canonical.jobPostingInfo.externalUrl =
      'https://wd12.myworkdaysite.com/recruiting/salesforce/Slack/job/London/Engineer_1';

    const result = await new WorkdayAdapter(
      workday(
        () => ({ total: 1, jobPostings: [listing('1')] }),
        () => canonical,
      ),
    ).extract(source);

    expect(result.postings[0]?.url).toBe(canonical.jobPostingInfo.externalUrl);
    expect(officialIdentity(result.postings[0]!.applyUrl)?.board).toBe('workday:Slack');

    canonical.jobPostingInfo.externalUrl =
      'https://wd12.myworkdaysite.com/recruiting/another-tenant/Slack/job/London/Engineer_1';

    await expect(
      new WorkdayAdapter(
        workday(
          () => ({ total: 1, jobPostings: [listing('1')] }),
          () => canonical,
        ),
      ).extract(source),
    ).rejects.toThrow(/different board/);
  });

  it('paginates by actual page size, hydrates every detail and preserves immutable identities', async () => {
    const offsets: number[] = [];

    const http = workday((body) => {
      const { offset } = body as { offset: number };

      offsets.push(offset);

      return {
        total: offset === 0 ? 3 : 0,
        jobPostings: offset === 0 ? [listing('1'), listing('2')] : [listing('3')],
      };
    });

    const result = await new WorkdayAdapter(http).extract(source);

    expect(offsets).toEqual([0, 2, 0]);
    expect(result.postings).toHaveLength(3);

    expect(result.postings[0]).toMatchObject({
      sourcePostingId: 'stable-1',
      locations: ['London', 'Amsterdam'],
      workplace: 'unknown',
      publishedAt: '2026-09-30T00:00:00.000Z',
      descriptionHtml: '<p>Build software.</p>',
    });

    expect(result.enumerationComplete).toBe(true);
    expect(result.rawResponses).toHaveLength(6);
    expect(officialIdentity(result.postings[0]!.applyUrl)?.board).toBe('workday:Slack');
    expect([...resolveOfficialIds(source, result, new Set(['Engineer_1']))]).toEqual(['stable-1']);
  });

  it('recovers capped results through complete non-overlapping category partitions', async () => {
    const http = workday((body) => {
      const { appliedFacets } = body as { appliedFacets: Record<string, string[]> };

      if (!appliedFacets.jobFamilyGroup) {
        return {
          total: 3,
          jobPostings: [listing('1')],
          facets: [
            {
              facetParameter: 'jobFamilyGroup',
              values: [
                { id: 'engineering', count: 2 },
                { id: 'sales', count: 2 },
              ],
            },
          ],
        };
      }

      return {
        total: 2,
        jobPostings:
          appliedFacets.jobFamilyGroup[0] === 'engineering'
            ? [listing('1'), listing('2')]
            : [listing('3'), listing('4')],
      };
    });

    const result = await new WorkdayAdapter(http, 3).extract(source);

    expect(result.postings).toHaveLength(4);
    expect(result.enumerationComplete).toBe(true);
  });

  it('rejects a cap without a provably complete partition', async () => {
    const http = workday(() => ({ total: 2_000, jobPostings: [listing('1')] }));

    await expect(new WorkdayAdapter(http).extract(source)).rejects.toThrow(/partitioned/);
  });

  it('rejects overlapping supposedly single-valued partitions', async () => {
    const http = workday((body) => {
      const { appliedFacets } = body as { appliedFacets: Record<string, string[]> };

      return Object.keys(appliedFacets).length
        ? { total: 2, jobPostings: [listing('1'), listing('2')] }
        : {
            total: 3,
            jobPostings: [],
            facets: [
              {
                facetParameter: 'jobFamilyGroup',
                values: [
                  { id: 'a', count: 2 },
                  { id: 'b', count: 2 },
                ],
              },
            ],
          };
    });

    await expect(new WorkdayAdapter(http, 3).extract(source)).rejects.toThrow(/overlap/);
  });

  it('fails on repeated pages and drifting totals', async () => {
    await expect(
      new WorkdayAdapter(workday(() => ({ total: 2, jobPostings: [listing('1')] }))).extract(
        source,
      ),
    ).rejects.toThrow(/repeated/);

    let total = 2;

    await expect(
      new WorkdayAdapter(workday(() => ({ total: total++, jobPostings: [listing('1')] }))).extract(
        source,
      ),
    ).rejects.toThrow(/total changed/);
  });

  it('fails the entire run if a detail disappears, is malformed or belongs to another site', async () => {
    for (const invalid of [
      { jobPostingInfo: { ...detail('1').jobPostingInfo, posted: false } },
      { jobPostingInfo: { ...detail('1').jobPostingInfo, jobDescription: '' } },
      {
        jobPostingInfo: {
          ...detail('1').jobPostingInfo,
          externalUrl: 'https://example.com/Slack/job/Engineer_1',
        },
      },
    ]) {
      await expect(
        new WorkdayAdapter(
          workday(
            () => ({ total: 1, jobPostings: [listing('1')] }),
            () => invalid,
          ),
        ).extract(source),
      ).rejects.toThrow();
    }
  });

  it('accepts an explicit empty JSON inventory but rejects an HTML challenge', async () => {
    expect(
      (await new WorkdayAdapter(workday(() => ({ total: 0, jobPostings: [] }))).extract(source))
        .postings,
    ).toEqual([]);

    await expect(
      new WorkdayAdapter(workday(() => '<html>challenge</html>')).extract(source),
    ).rejects.toThrow(/schema/);
  });
});

const icimsSource: Source = {
  ...source,
  provider: 'icims',
  board: 'amd',
  endpoint: 'https://careers.amd.com/api/jobs',
};

const icimsJob = (id: string) => ({
  data: {
    slug: id,
    title: 'Software Engineer',
    description: '<p>Full description</p>',
    apply_url: `https://careers-amd.icims.com/jobs/${id}/login`,
    meta_data: { canonical_url: `https://careers.amd.com/jobs/${id}?lang=en-us` },
    categories: [{ name: 'Engineering' }],
    full_location: 'London',
    searchable: true,
    applyable: true,
  },
});

describe('iCIMS public employer feeds', () => {
  it('excludes other brands explicitly and fails when employer membership is unknown', async () => {
    const scoped = {
      ...icimsSource,
      employerFilter: { field: 'brand' as const, values: ['Booking.com'] },
    };

    const own = { data: { ...icimsJob('1').data, brand: 'Booking.com' } };

    const other = {
      data: {
        ...icimsJob('2').data,
        brand: 'Booking Holdings',
        meta_data: { canonical_url: 'https://example.com/jobs/2' },
      },
    };

    const result = await new IcimsAdapter({
      get: async (url) => response(url, { totalCount: 2, jobs: [own, other] }),
    }).extract(scoped);

    expect(result.postings.map((posting) => posting.sourcePostingId)).toEqual(['1']);
    expect(result.excluded).toBe(1);

    await expect(
      new IcimsAdapter({
        get: async (url) => response(url, { totalCount: 1, jobs: [icimsJob('1')] }),
      }).extract(scoped),
    ).rejects.toThrow(/membership field/);
  });

  it('accepts only explicitly configured canonical host aliases', async () => {
    const alias = {
      data: {
        ...icimsJob('1').data,
        meta_data: { canonical_url: 'https://githubinc.jibeapply.com/jobs/1' },
      },
    };

    const http = { get: async (url: string) => response(url, { totalCount: 1, jobs: [alias] }) };

    expect(
      (
        await new IcimsAdapter(http).extract({
          ...icimsSource,
          postingHosts: ['githubinc.jibeapply.com'],
        })
      ).postings,
    ).toHaveLength(1);

    await expect(new IcimsAdapter(http).extract(icimsSource)).rejects.toThrow(/another employer/);
  });

  it('traverses all pages with complete descriptions and original categories', async () => {
    const pages: string[] = [];

    const result = await new IcimsAdapter({
      get: async (url) => {
        const page = new URL(url).searchParams.get('page')!;

        pages.push(page);

        return response(url, {
          totalCount: 3,
          jobs: page === '1' ? [icimsJob('1'), icimsJob('2')] : [icimsJob('3')],
        });
      },
    }).extract(icimsSource);

    expect(pages).toEqual(['1', '2']);
    expect(result.postings).toHaveLength(3);
    expect(result.postings[0]?.departments).toEqual(['Engineering']);
    expect(result.enumerationComplete).toBe(true);
  });

  it('rejects duplicate pages, premature end and another employer identity', async () => {
    for (const body of [
      { totalCount: 2, jobs: [icimsJob('1')] },
      { totalCount: 1, jobs: [] },
      {
        totalCount: 1,
        jobs: [
          {
            data: {
              ...icimsJob('1').data,
              meta_data: { canonical_url: 'https://example.com/jobs/1' },
            },
          },
        ],
      },
    ]) {
      await expect(
        new IcimsAdapter({ get: async (url) => response(url, body) }).extract(icimsSource),
      ).rejects.toThrow();
    }
  });
});

describe('Wave B wiring and audit gates', () => {
  it('accounts for all 31 companies without silently enabling them', () => {
    const { companies, sources } = loadRegistry();
    const plans = loadAuditPlans();
    const wave = companies.filter((company) => company.wave === 'B');

    expect(wave).toHaveLength(31);

    for (const company of wave) {
      expect(sources.some((entry) => entry.companySlug === company.slug)).toBe(true);
      expect(plans.some((entry) => entry.companySlug === company.slug)).toBe(true);

      expect(
        sources
          .filter((entry) => entry.companySlug === company.slug)
          .every((entry) => entry.auditStatus === 'candidate' && !entry.scheduled),
      ).toBe(true);
    }
  });

  it('binds audit evidence to the enterprise endpoint', () => {
    const plan = loadAuditPlans()[0]!;

    expect(configurationHash(plan, [source])).not.toBe(
      configurationHash(plan, [{ ...source, endpoint: 'https://example.com/jobs' }]),
    );
  });

  it('blocks LinkedIn until an authorized feed is available', async () => {
    await expect(new LinkedInAdapter().extract()).rejects.toThrow(/express permission/);
  });
});
