import { describe, expect, it, vi } from 'vitest';
import type { Source } from '../../domain/model.js';
import { WorkableAdapter } from './workable.js';
import { officialIdentity, inspectOfficialPage } from '../audits/reconcile.js';
import { SourceAuditor } from '../audits/auditor.js';
import { auditPlanSchema } from '../audits/model.js';
import { createAdapters } from './factory.js';
import { PublicJsonTransport } from '../http.js';

const source: Source = {
  id: 'hugging-face',
  companySlug: 'hugging-face',
  provider: 'workable',
  board: 'huggingface',
  auditStatus: 'candidate',
  scheduled: false,
};

const job = {
  shortcode: 'ABCDEF1234',
  title: 'Engineer',
  url: 'https://apply.workable.com/j/ABCDEF1234',
  application_url: 'https://apply.workable.com/j/ABCDEF1234/apply',
  description: '<p>Complete synthetic role, requirements and benefits.</p>',
  department: 'Engineering',
  function: 'Software',
  employment_type: 'Full-time',
  telecommuting: true,
  published_on: '2026-10-06',
  country: 'France',
  city: 'Paris',
  state: 'Île-de-France',
  locations: [
    { country: 'France', city: 'Paris', region: 'Île-de-France', hidden: false },
    { country: 'United States', city: 'Hidden city', region: 'Hidden region', hidden: true },
  ],
};

const wild = {
  ...job,
  shortcode: '0000000000',
  title: 'Wild Card',
  url: 'https://apply.workable.com/j/0000000000',
  application_url: 'https://apply.workable.com/j/0000000000/apply',
};

const feed = { name: 'Hugging Face', jobs: [job, wild] };
const inventoryUrl = 'https://apply.workable.com/huggingface/jobs.md';

const markdown =
  '# Hugging Face — All Open Positions\n\n| Title | Department | Location | Type | Salary | Posted | Details |\n|-------|-----------|----------|------|--------|--------|---------|\n| Engineer | Engineering | France | Full-time | — | 2026-10-06 | [View](https://apply.workable.com/huggingface/jobs/view/ABCDEF1234.md) |\n| Wild Card | Wild Card | France | Full-time | — | 2026-10-06 | [View](https://apply.workable.com/huggingface/jobs/view/0000000000.md) |\n';

const page = {
  url: inventoryUrl,
  role: 'listings' as const,
  sourceIds: [source.id],
  complete: true,
  selector: 'a[href]',
};

function adapter(first: unknown = feed, second: unknown = first) {
  const get = vi
    .fn()
    .mockResolvedValueOnce({
      url: 'https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true',
      fetchedAt: '2026-10-06T00:00:00.000Z',
      body: first,
    })
    .mockResolvedValueOnce({
      url: 'https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true',
      fetchedAt: '2026-10-06T00:00:01.000Z',
      body: second,
    });

  return { client: new WorkableAdapter({ get }), get };
}

describe('public Workable account widget', () => {
  it('retains full descriptions and native metadata, respects hidden locations and excludes only the employer open application', async () => {
    const { client, get } = adapter();
    const result = await client.extract(source);

    expect(result).toMatchObject({ excluded: 1, enumerationComplete: true });
    expect(result.rawResponses).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);

    expect(result.postings).toEqual([
      {
        sourcePostingId: job.shortcode,
        title: job.title,
        url: job.url,
        applyUrl: job.application_url,
        descriptionHtml: job.description,
        departments: ['Engineering', 'Software'],
        locations: ['Paris, Île-de-France, France', 'United States'],
        workplace: 'remote',
        employment: 'Full-time',
        publishedAt: '2026-10-06T00:00:00.000Z',
      },
    ]);
  });

  it('accepts reordered inventories and preserves unknown optional fields without guessing onsite or remote eligibility', async () => {
    const optional = {
      ...job,
      telecommuting: null,
      department: null,
      function: null,
      employment_type: null,
      published_on: null,
      locations: [],
    };

    const result = await adapter(
      { name: 'Hugging Face', jobs: [optional, wild] },
      { name: 'Hugging Face', jobs: [wild, optional] },
    ).client.extract(source);

    expect(result.postings[0]).toMatchObject({
      workplace: 'unknown',
      employment: 'unknown',
      publishedAt: null,
      departments: [],
      locations: ['Paris, Île-de-France, France'],
    });
  });

  it('does not mistake a role containing Wild Card for an open application', async () => {
    const result = await adapter({
      name: 'Hugging Face',
      jobs: [{ ...job, title: 'Wild Card Systems Engineer' }],
    }).client.extract(source);

    expect(result.postings).toHaveLength(1);
  });

  it.each([
    { name: 'Another employer', jobs: [job] },
    { name: 'Hugging Face', jobs: [job, job] },
    { name: 'Hugging Face', jobs: [{ ...job, description: '<p></p>' }] },
    { name: 'Hugging Face', jobs: [{ ...job, shortcode: 'bad/id' }] },
    {
      name: 'Hugging Face',
      jobs: [{ ...job, application_url: 'https://evil.example/j/ABCDEF1234/apply' }],
    },
    {
      name: 'Hugging Face',
      jobs: [{ ...job, url: 'https://apply.workable.com/other/j/ABCDEF1234' }],
    },
    {
      name: 'Hugging Face',
      jobs: [{ ...job, application_url: 'https://apply.workable.com/j/1234567890/apply' }],
    },
    { name: 'Hugging Face', jobs: [{ ...job, url: job.url + '?tracking=1' }] },
    { name: 'Hugging Face', jobs: [{ ...job, published_on: '2026-02-30' }] },
  ])(
    'fails the whole snapshot for malformed identity, ownership, description or date (%#)',
    async (body) => {
      await expect(adapter(body).client.extract(source)).rejects.toThrow();
    },
  );

  it('fails if a description or inventory changes during the recheck', async () => {
    await expect(
      adapter(feed, {
        ...feed,
        jobs: [{ ...job, description: 'Changed description' }, wild],
      }).client.extract(source),
    ).rejects.toThrow('changed during extraction');

    await expect(adapter(feed, { ...feed, jobs: [job] }).client.extract(source)).rejects.toThrow(
      'changed during extraction',
    );
  });

  it('rejects unconfigured accounts before requesting a feed', async () => {
    const { client, get } = adapter();

    await expect(client.extract({ ...source, board: 'other' })).rejects.toThrow('Unsupported');
    expect(get).not.toHaveBeenCalled();
  });

  it('recognizes only exact employer or native shortcode public URLs', () => {
    for (const url of [
      job.url,
      job.application_url,
      'https://apply.workable.com/huggingface/j/ABCDEF1234/',
      'https://apply.workable.com/huggingface/jobs/view/ABCDEF1234.md',
    ]) {
      expect(officialIdentity(url)).toEqual({ board: 'workable:huggingface', id: job.shortcode });
    }

    for (const url of [
      'https://apply.workable.com/other/j/ABCDEF1234/',
      job.url + '?id=other',
      job.url + '#fragment',
      'https://apply.workable.com/huggingface/jobs/view/bad.md',
      'https://apply.workable.com:8443/j/ABCDEF1234',
    ]) {
      expect(officialIdentity(url)).toBeNull();
    }
  });

  it('reads native titles from the public Markdown table without treating embedded HTML as links', () => {
    const inspected = inspectOfficialPage(
      markdown.replace('| Engineer |', '| <img src=x>Engineer |'),
      page,
      [source],
    );

    expect([...inspected.ids.get('workable:huggingface')!]).toEqual([
      job.shortcode,
      wild.shortcode,
    ]);

    expect(inspected.titles.get('workable:huggingface:' + job.shortcode)).toBe(
      '<img src=x>Engineer',
    );
  });

  it('rejects conflicting duplicate identities in the official Markdown inventory', () => {
    const duplicate =
      '| Different role | Product | France | Full-time | — | 2026-10-06 | [View](https://apply.workable.com/huggingface/jobs/view/ABCDEF1234.md) |\n';

    expect(() => inspectOfficialPage(markdown + duplicate, page, [source])).toThrow(
      'repeats a posting identity',
    );
  });

  it.each([
    'changed format',
    '# Hugging Face — All Open Positions\nNo jobs found',
    markdown.replace('[View]', '[Changed]'),
    markdown.replace('/ABCDEF1234.md', '/invalid.md'),
  ])('rejects malformed or unproven empty official Markdown (%#)', (body) => {
    expect(() => inspectOfficialPage(body, page, [source])).toThrow();
  });

  it('reconciles exact captured vacancies independently while keeping employer review pending', async () => {
    const extraction = await adapter().client.extract(source);

    const employer = {
      slug: 'hugging-face',
      name: 'Hugging Face',
      careersUrl: 'https://huggingface.co/',
      logoUrl: '/logos/default.svg',
      wave: 'C' as const,
    };

    const pending = {
      status: 'pending',
      notes: 'Review pending',
      evidenceUrls: [employer.careersUrl],
    };

    const plan = auditPlanSchema.parse({
      companySlug: employer.slug,
      scope: pending,
      access: { ...pending, display: 'pending' },
      channels: [
        {
          url: inventoryUrl,
          disposition: 'included',
          sourceIds: [source.id],
          reason: 'Official public inventory',
        },
      ],
      pages: [
        { url: employer.careersUrl, role: 'discovery', sourceIds: [source.id], complete: false },
        page,
      ],
    });

    const result = await new SourceAuditor(
      employer,
      [source],
      plan,
      {
        get: async (url) => ({
          url,
          body:
            url === inventoryUrl
              ? markdown
              : '<a href="https://apply.workable.com/huggingface/">Careers</a>',
          robotsUrl: new URL('/robots.txt', url).href,
          robotsBody: 'User-agent: *\nAllow: /',
          fetchedAt: '2026-10-06T00:00:00.000Z',
        }),
      },
      createAdapters(new PublicJsonTransport()),
    ).run('ignored/workable', undefined, new Map([[source.id, extraction]]), true);

    expect(result.technicalBlockers).toEqual([]);

    expect(result.report.sources[0]).toMatchObject({
      feedCount: 1,
      officialCount: 1,
      matchedCount: 1,
      excludedCount: 1,
      missingFromFeed: [],
      missingFromOfficial: [],
      invalidDetails: [],
    });

    expect(result.blockers.some((reason) => reason.includes('review is pending'))).toBe(true);
  });
});
