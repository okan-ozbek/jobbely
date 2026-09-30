import { describe, expect, it, vi } from 'vitest';
import type { Source } from '../../domain/model.js';
import { AmazonAdapter } from './amazon.js';
import { AppleAdapter, applePageData } from './apple.js';
import { EightfoldAdapter } from './eightfold.js';
import { createAdapters } from './factory.js';
import { officialIdentity, resolveOfficialIds } from '../audits/reconcile.js';

const source = (provider: Source['provider'], board: string, endpoint: string): Source => ({
  id: board,
  companySlug: board,
  provider,
  board,
  endpoint,
  auditStatus: 'candidate',
  scheduled: false,
});

const apple = source('apple', 'apple', 'https://jobs.apple.com/en-us/search');
const amazon = source('amazon', 'amazon', 'https://www.amazon.jobs/en/search.json');

const netflix = source(
  'eightfold',
  'netflix',
  'https://explore.jobs.netflix.net/api/apply/v2/jobs',
);

const raw = (url: string, body: unknown) => ({ url, body, fetchedAt: '2026-10-01T00:00:00.000Z' });

const html = (loaderData: unknown) =>
  `<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify({ loaderData }))});</script>`;

const appleListing = {
  id: '100-01',
  positionId: '100',
  reqId: '100-01',
  jobPositionId: 'REQ-100',
  transformedPostingTitle: 'engineer',
  postExternal: true,
};

const appleDetail = {
  id: appleListing.jobPositionId,
  positionId: appleListing.positionId,
  reqId: appleListing.jobPositionId,
  jobNumber: appleListing.id,
  postingTitle: 'Engineer',
  jobSummary: 'Summary',
  description: 'Full duties',
  minimumQualifications: 'Required skills',
  teamNames: ['Software and Services'],
  locations: [{ name: 'London' }],
  homeOffice: false,
  postingFooters: [
    {
      localizations: {
        en_US: [{ name: 'Pay and benefits', content: 'Salary range', displayOrder: 1 }],
      },
    },
  ],
};

const appleSearch = {
  searchResults: [appleListing],
  totalRecords: 1,
  page: 1,
  filters: {},
  sort: 'locationAsc',
};

const amazonJob = (id: string, category = 'Engineering') => ({
  id_icims: id,
  id: `native-${id}`,
  source_system: 'JobCreator',
  title: 'Engineer',
  job_path: `/en/jobs/${id}/engineer`,
  url_next_step: `https://account.amazon.jobs/jobs/${id}/apply`,
  description: 'Complete description',
  basic_qualifications: 'Required skills',
  preferred_qualifications: 'Preferred skills',
  job_category: category,
  job_family: null,
  location: 'London',
  locations: [],
  job_schedule_type: 'full-time',
});

const amazonPage = (
  jobs: ReturnType<typeof amazonJob>[],
  hits = jobs.length,
  facets?: Record<string, number>[],
) => ({ error: null, hits, jobs, facets: facets ? { category_facet: facets } : {} });

const netflixJob = {
  id: 123,
  name: 'Engineer',
  locations: ['Amsterdam'],
  department: 'Engineering',
  canonicalPositionUrl: 'https://explore.jobs.netflix.net/careers/job/123',
  isPrivate: false,
};

describe('priority native integrations', () => {
  it('reads Apple literal hydration safely and includes qualifications and advertised footer content', async () => {
    const getHtml = vi.fn(
      async (url: string) =>
        raw(
          url,
          html(
            new URL(url).pathname.includes('/details/')
              ? { jobDetails: { jobsData: appleDetail } }
              : { search: appleSearch },
          ),
        ) as ReturnType<typeof raw> & { body: string },
    );

    const result = await new AppleAdapter({ getHtml }).extract(apple);

    expect(result.postings[0]).toMatchObject({
      sourcePostingId: appleListing.id,
      employment: 'unknown',
      workplace: 'unknown',
    });

    expect(result.postings[0]!.descriptionHtml).toContain('Salary range');
    expect(result.postings[0]!.descriptionHtml).toContain('Required skills');
    expect(new URL(getHtml.mock.calls[0]![0]).searchParams.get('location')).toBe('');

    expect(resolveOfficialIds(apple, result, new Set(['100-01']))).toEqual(
      new Set([appleListing.id]),
    );
  });

  it('rejects Apple JavaScript expressions instead of evaluating them', () => {
    expect(() =>
      applePageData('<script>window.__staticRouterHydrationData = JSON.parse(alert(1));</script>'),
    ).toThrow(/hydration/);

    expect(() => applePageData(html({}) + html({}))).toThrow(/unambiguous/);
  });

  it('keeps Apple location postings distinct and safely encodes international title slugs', async () => {
    const variants = [
      { ...appleListing, id: '100-01', reqId: '100-01', transformedPostingTitle: 'ingénieur' },
      { ...appleListing, id: '100-02', reqId: '100-02', transformedPostingTitle: 'ingénieur' },
    ];

    const getHtml = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;

      const body = path.includes('/details/')
        ? html({
            jobDetails: {
              jobsData: { ...appleDetail, jobNumber: path.split('/')[3] },
            },
          })
        : html({ search: { ...appleSearch, searchResults: variants, totalRecords: 2 } });

      return { ...raw(url, body), body };
    });

    const result = await new AppleAdapter({ getHtml }).extract(apple);

    expect(result.postings.map((job) => job.sourcePostingId)).toEqual(['100-01', '100-02']);
    expect(result.postings[0]!.url).toContain('/100-01/ing%C3%A9nieur');
  });

  it('maps Apple managed retail PIPE IDs through their public numeric URL', async () => {
    const job = { ...appleListing, id: 'PIPE-100', reqId: 'PIPE-100', jobPositionId: 'PIPE-100' };

    const getHtml = vi.fn(async (url: string) => ({
      ...raw(url, ''),
      body: html(
        new URL(url).pathname.includes('/details/')
          ? {
              jobDetails: {
                jobsData: { ...appleDetail, id: job.id, reqId: job.reqId, jobNumber: '100' },
              },
            }
          : { search: { ...appleSearch, searchResults: [job] } },
      ),
    }));

    const result = await new AppleAdapter({ getHtml }).extract(apple);

    expect(result.postings[0]!.url).toContain('/details/100/');
    expect(resolveOfficialIds(apple, result, new Set(['100']))).toEqual(new Set(['PIPE-100']));
  });

  it.each(['filtered', 'repeated', 'detail_changed', 'ignored_sort'])(
    'fails Apple extraction for %s inventories',
    async (mode) => {
      const search =
        mode === 'filtered'
          ? { ...appleSearch, filters: { location: 'USA' } }
          : mode === 'ignored_sort'
            ? { ...appleSearch, sort: 'newest' }
            : mode === 'repeated'
              ? { ...appleSearch, totalRecords: 2 }
              : appleSearch;

      const getHtml = vi.fn(
        async (url: string) =>
          raw(
            url,
            html(
              new URL(url).pathname.includes('/details/')
                ? { jobDetails: { jobsData: { ...appleDetail, id: 'different' } } }
                : { search: { ...search, page: Number(new URL(url).searchParams.get('page')) } },
            ),
          ) as ReturnType<typeof raw> & { body: string },
      );

      await expect(new AppleAdapter({ getHtml }).extract(apple)).rejects.toThrow();
    },
  );

  it('exhausts Amazon capped categories and preserves the native posting ID and all qualifications', async () => {
    const facets = [{ Engineering: 1 }, { Sales: 1 }];
    let roots = 0;

    const get = vi.fn(async (url: string) => {
      const category = new URL(url).searchParams.get('category[]');

      if (!category) {
        roots++;
      }

      return raw(
        url,
        category
          ? amazonPage([amazonJob(category === 'Engineering' ? '1' : '2', category)], 1, [
              { [category]: 1 },
            ])
          : amazonPage([amazonJob('1')], 2, roots === 1 ? facets : facets.toReversed()),
      );
    });

    const result = await new AmazonAdapter({ get }, 2).extract(amazon);

    expect(result.postings.map((job) => job.sourcePostingId)).toEqual(['1', '2']);
    expect(result.postings[0]!.descriptionHtml).toContain('Preferred skills');
    expect(result.enumerationComplete).toBe(true);
  });

  it('accepts a native Amazon URL without a title slug and its observed account.amazon.com apply host', async () => {
    const job = {
      ...amazonJob('1'),
      job_path: '/en/jobs/1/',
      url_next_step: 'https://account.amazon.com/jobs/1/apply',
    };

    const get = vi.fn(async (url: string) => raw(url, amazonPage([job])));
    const result = await new AmazonAdapter({ get }).extract(amazon);

    expect(result.postings[0]).toMatchObject({
      url: 'https://www.amazon.jobs/en/jobs/1/',
      applyUrl: job.url_next_step,
    });
  });

  it('validates Amazon SF hiring links against the exact native requisition and retains the public SF ID', async () => {
    const job = {
      ...amazonJob('SF123'),
      id: 'a0Rar000002zAvlEAE',
      source_system: 'HVH',
      url_next_step: 'https://hvr-amazon.my.site.com/JobDetails?reqid=a0Rar000002zAvlEAE&isapply=1',
    };

    const get = vi.fn(async (url: string) => raw(url, amazonPage([job])));
    const result = await new AmazonAdapter({ get }).extract(amazon);

    expect(result.postings[0]!.sourcePostingId).toBe('SF123');
    expect(resolveOfficialIds(amazon, result, new Set([job.id]))).toEqual(new Set(['SF123']));

    const invalid = {
      get: async (url: string) =>
        raw(
          url,
          amazonPage([{ ...job, url_next_step: job.url_next_step.replace(job.id, 'unrelated') }]),
        ),
    };

    await expect(new AmazonAdapter(invalid).extract(amazon)).rejects.toThrow(
      /foreign application link/,
    );
  });

  it.each(['overlap', 'foreign_link', 'capped_partition', 'drift', 'schema'])(
    'rejects invalid Amazon %s evidence',
    async (mode) => {
      let calls = 0;

      const get = vi.fn(async (url: string) => {
        calls++;

        const category = new URL(url).searchParams.get('category[]');
        const job = amazonJob('1', category ?? 'Engineering');

        if (mode === 'foreign_link') {
          job.url_next_step = 'https://example.com/jobs/1/apply';
        }

        if (mode === 'schema') {
          job.description = '';
        }

        const facets =
          mode === 'capped_partition' ? [{ Engineering: 2 }] : [{ Engineering: 1 }, { Sales: 1 }];

        return raw(
          url,
          mode === 'overlap' || mode === 'capped_partition'
            ? category
              ? amazonPage([job], 1, [{ [category]: 1 }])
              : amazonPage([job], 2, facets)
            : amazonPage([job], mode === 'drift' && calls > 1 ? 2 : 1),
        );
      });

      await expect(new AmazonAdapter({ get }, 2).extract(amazon)).rejects.toThrow();
    },
  );

  it('hydrates every Eightfold detail without substituting a search summary', async () => {
    const get = vi.fn(async (url: string) =>
      raw(
        url,
        new URL(url).pathname.endsWith('/123')
          ? {
              ...netflixJob,
              job_description: 'Full Netflix description',
              custom_JD: { data_fields: { work_type: ['Onsite'] } },
            }
          : { positions: [netflixJob], count: 1 },
      ),
    );

    const result = await new EightfoldAdapter({ get }).extract(netflix);

    expect(result.postings[0]).toMatchObject({
      descriptionHtml: 'Full Netflix description',
      workplace: 'onsite',
    });

    expect(get.mock.calls.some(([url]) => new URL(url).pathname.endsWith('/123'))).toBe(true);
  });

  it.each(['repeated', 'private', 'wrong_detail', 'foreign', 'missing_description'])(
    'fails Eightfold for %s data',
    async (mode) => {
      const job = {
        ...netflixJob,
        isPrivate: mode === 'private',
        canonicalPositionUrl:
          mode === 'foreign'
            ? 'https://example.com/careers/job/123'
            : netflixJob.canonicalPositionUrl,
      };

      const get = vi.fn(async (url: string) =>
        raw(
          url,
          new URL(url).pathname.endsWith('/123')
            ? {
                ...job,
                id: mode === 'wrong_detail' ? 124 : 123,
                job_description: mode === 'missing_description' ? '' : 'Complete',
              }
            : { positions: [job], count: mode === 'repeated' ? 2 : 1 },
        ),
      );

      await expect(new EightfoldAdapter({ get }).extract(netflix)).rejects.toThrow();
    },
  );

  it('reports Meta and Google access blockers without requesting restricted feeds', async () => {
    const http = { get: vi.fn(), post: vi.fn(), getHtml: vi.fn() };
    const adapters = createAdapters(http);

    await expect(adapters.meta.extract({ ...apple, provider: 'meta' })).rejects.toThrow(
      /written permission/,
    );

    await expect(adapters.google.extract({ ...apple, provider: 'google' })).rejects.toThrow(
      /paginated/,
    );

    expect(http.get).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(http.getHtml).not.toHaveBeenCalled();
  });

  it('recognizes native URLs without treating title slugs as job identities', () => {
    expect(officialIdentity('https://jobs.apple.com/en-us/details/100-01/new-title')).toEqual({
      board: 'apple:apple',
      id: '100-01',
    });

    expect(officialIdentity('https://account.amazon.jobs/jobs/123/apply')).toEqual({
      board: 'amazon:amazon',
      id: '123',
    });

    expect(officialIdentity(netflixJob.canonicalPositionUrl)).toEqual({
      board: 'eightfold:netflix',
      id: '123',
    });
  });
});
