import { describe, expect, it, vi } from 'vitest';
import type { Source } from '../../domain/model.js';
import type { HtmlTransport } from '../../ports/ingestion.js';
import { officialIdentity } from '../audits/reconcile.js';
import { ShopifyAdapter } from './shopify.js';

const endpoint = 'https://www.shopify.com/careers';
const id = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const jobId = '10000000-0000-4000-8000-000000000001';
const locationId = '20000000-0000-4000-8000-000000000001';
const secondaryId = '20000000-0000-4000-8000-000000000002';
const detailUrl = `${endpoint}/software-engineer_${id}`;

const source: Source = {
  id: 'shopify',
  companySlug: 'shopify',
  provider: 'shopify',
  board: 'shopify',
  endpoint,
  auditStatus: 'candidate',
  scheduled: false,
};

function job(postingId = id) {
  return {
    id: postingId,
    jobId,
    title: 'Software Engineer',
    status: 'Published',
    isListed: true,
    departmentName: 'Shopify',
    teamName: 'Engineering',
    locationName: 'Americas',
    workplaceType: 'Remote',
    employmentType: 'FullTime',
    publishedDate: '2026-10-06',
    externalLink: `${endpoint}?ashby_jid=${postingId}`,
    applyLink: `${endpoint}?ashby_jid=${postingId}`,
    locationIds: { primaryLocationId: locationId, secondaryLocationIds: [secondaryId] },
  };
}

function page(route: string, value: unknown, mutate?: (cells: unknown[]) => void) {
  const cells: unknown[] = [];

  const encode = (value: unknown): number => {
    const index = cells.length;

    cells.push(null);

    cells[index] = Array.isArray(value)
      ? value.map(encode)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, item]) => item !== undefined)
              .map(([key, item]) => [`_${encode(key)}`, encode(item)]),
          )
        : value;

    return index;
  };

  encode({ loaderData: { [route]: value } });
  mutate?.(cells);

  return `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(cells))});</script>`;
}

const locations = [
  { id: locationId, name: 'Americas' },
  { id: secondaryId, name: 'Canada' },
];

function listing(
  jobs: ReturnType<typeof job>[] = [job()],
  options: { canonicalUrl?: string; mutate?: (cells: unknown[]) => void } = {},
) {
  return page(
    '($locale)/careers',
    {
      canonicalUrl: options.canonicalUrl ?? endpoint,
      jobPostingsWithJobs: jobs.map((jobPosting) => ({
        jobPosting,
        job: { id: jobPosting.jobId },
      })),
      atsLocations: locations,
    },
    options.mutate,
  );
}

function detail(
  options: { job?: ReturnType<typeof job>; description?: string; canonicalUrl?: string } = {},
) {
  return page('($locale)/careers/$posting', {
    canonicalUrl: options.canonicalUrl ?? detailUrl,
    jobPosting: {
      ...(options.job ?? job()),
      descriptionHtml:
        options.description ??
        '<p>Build commerce systems.</p><h2>Qualifications</h2><p>TypeScript experience.</p>',
    },
  });
}

function setup(responses: string[]) {
  const getHtml = vi.fn<HtmlTransport['getHtml']>();

  for (const body of responses) {
    getHtml.mockImplementationOnce(async (url) => ({
      url,
      fetchedAt: '2026-10-06T12:00:00Z',
      body,
    }));
  }

  return { adapter: new ShopifyAdapter({ getHtml }), getHtml };
}

describe('Shopify public HTML integration', () => {
  it('hydrates every listing without visible anchors, preserves metadata and rechecks the inventory', async () => {
    const test = setup([listing(), detail(), listing()]);
    const result = await test.adapter.extract(source);

    expect(test.getHtml.mock.calls).toEqual([[endpoint], [detailUrl], [endpoint]]);
    expect(result).toMatchObject({ enumerationComplete: true, excluded: 0 });
    expect(result.rawResponses).toHaveLength(3);

    expect(result.postings).toEqual([
      {
        sourcePostingId: id,
        title: 'Software Engineer',
        url: detailUrl,
        applyUrl: `${endpoint}?ashby_jid=${id}`,
        descriptionHtml:
          '<p>Build commerce systems.</p><h2>Qualifications</h2><p>TypeScript experience.</p>',
        departments: ['Shopify', 'Engineering'],
        locations: ['Americas', 'Canada'],
        workplace: 'remote',
        employment: 'FullTime',
        publishedAt: '2026-10-06',
      },
    ]);
  });

  it('retains unknown optional metadata instead of inferring employment or workplace from locations', async () => {
    const unknown = {
      ...job(),
      workplaceType: undefined,
      employmentType: undefined,
      publishedDate: undefined,
    };

    const index = page('($locale)/careers', {
      canonicalUrl: endpoint,
      jobPostingsWithJobs: [{ jobPosting: unknown, job: { id: jobId } }],
      atsLocations: locations,
    });

    const full = page('($locale)/careers/$posting', {
      canonicalUrl: detailUrl,
      jobPosting: { ...unknown, descriptionHtml: '<p>Real duties.</p>' },
    });

    const result = await setup([index, full, index]).adapter.extract(source);

    expect(result.postings[0]).toMatchObject({
      workplace: 'unknown',
      employment: 'unknown',
      publishedAt: null,
    });
  });

  it('rejects missing, ambiguous and malformed hydration without executing scripts', async () => {
    const invalid = [
      '<script>globalThis.shopifyExecuted = true;</script>',
      listing() + listing(),
      listing([job()], {
        mutate: (cells) => {
          cells[0] = { _999999: 1 };
        },
      }),
      listing([job()], {
        mutate: (cells) => {
          cells[0] = { _1: 999999 };
        },
      }),
      listing([job()], {
        mutate: (cells) => {
          cells[0] = { _1: -5 };
        },
      }),
      listing([job()], {
        mutate: (cells) => {
          const root = cells[0] as Record<string, number>;

          for (let index = 0; index < 128; index++) {
            root[`_${cells.length}`] = 1;
            cells.push(`extraField${index}`);
          }
        },
      }),
      '<script>window.__reactRouterContext.streamController.enqueue("not json");</script>',
    ];

    for (const html of invalid) {
      await expect(setup([html]).adapter.extract(source)).rejects.toThrow();
    }
  });

  it('rejects duplicate IDs, filtered/empty inventories and unknown location references', async () => {
    for (const html of [
      listing([job(), job()]),
      listing([]),
      listing([job()], { canonicalUrl: `${endpoint}?location=US` }),
      listing([{ ...job(), locationIds: { primaryLocationId: jobId, secondaryLocationIds: [] } }]),
      listing([{ ...job(), applyLink: 'https://example.com/apply' }]),
    ]) {
      await expect(setup([html]).adapter.extract(source)).rejects.toThrow();
    }
  });

  it('fails a mismatched or unreadable detail instead of returning a partial extraction', async () => {
    for (const html of [
      detail({ job: job(secondId) }),
      detail({ canonicalUrl: `${detailUrl}?filtered=1` }),
      detail({ description: '<script>fake description</script>' }),
      detail({ description: '<p>&nbsp;</p>' }),
      detail({ job: { ...job(), title: 'Changed title' } }),
    ]) {
      await expect(setup([listing(), html]).adapter.extract(source)).rejects.toThrow();
    }
  });

  it('rejects inventory drift after full hydration and excludes explicit non-vacancies', async () => {
    await expect(
      setup([listing(), detail(), listing([job(), job(secondId)])]).adapter.extract(source),
    ).rejects.toThrow(/inventory changed/);

    const rows = [job(), { ...job(secondId), title: 'Talent Community' }];
    const test = setup([listing(rows), detail(), listing(rows)]);
    const result = await test.adapter.extract(source);

    expect(result.excluded).toBe(1);
    expect(result.postings).toHaveLength(1);
    expect(test.getHtml).toHaveBeenCalledTimes(3);
  });

  it('maps canonical and application URLs to stable audit IDs and rejects conflicting query IDs', () => {
    for (const url of [detailUrl, `${endpoint}?ashby_jid=${id}`]) {
      expect(officialIdentity(url)).toEqual({ board: 'shopify:shopify', id });
    }

    expect(officialIdentity(`${detailUrl}?ashby_jid=${secondId}`)).toBeNull();
    expect(officialIdentity(`${endpoint}?ashby_jid=not-a-posting`)).toBeNull();
    expect(officialIdentity(`https://shopify.example/careers/software-engineer_${id}`)).toBeNull();
  });

  it('rejects non-native configuration before making a request', async () => {
    const test = setup([]);

    await expect(
      test.adapter.extract({ ...source, endpoint: `${endpoint}?search=engineer` }),
    ).rejects.toThrow(/exact public employer/);

    expect(test.getHtml).not.toHaveBeenCalled();
  });
});
