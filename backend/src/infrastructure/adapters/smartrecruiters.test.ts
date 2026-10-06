import { describe, expect, it, vi } from 'vitest';
import type { Source } from '../../domain/model.js';
import { SmartRecruitersAdapter } from './smartrecruiters.js';
import { officialIdentity } from '../audits/reconcile.js';
import { loadRegistry } from '../registry.js';

const endpoint = 'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings';

const source: Source = {
  id: 'servicenow',
  companySlug: 'servicenow',
  provider: 'smartrecruiters',
  board: 'ServiceNow',
  endpoint,
  auditStatus: 'candidate',
  scheduled: false,
};

function summary(id: string) {
  return {
    id,
    uuid: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
    name: `Engineer ${id}`,
    company: { identifier: 'ServiceNow' },
    releasedDate: '2026-10-06T12:00:00.000Z',
    location: { fullLocation: 'Amsterdam, Netherlands', remote: false, hybrid: true },
    department: {},
    function: { label: 'Engineering' },
    typeOfEmployment: { label: 'Full-time' },
    ref: `${endpoint}/${id}`,
  };
}

function detail(id: string) {
  const header = summary(id);

  return {
    ...header,
    active: true,
    visibility: 'PUBLIC',
    postingUrl: `https://jobs.smartrecruiters.com/ServiceNow/${id}-engineer`,
    applyUrl: `https://jobs.smartrecruiters.com/ServiceNow/${id}-engineer?oga=true`,
    jobAd: {
      sections: {
        companyDescription: { title: 'Company', text: '<p>Company context</p>' },
        jobDescription: { title: 'Role', text: '<p>Build reliable software.</p>' },
        qualifications: {
          title: 'Qualifications',
          text: '<p>Python experience. Salary €90,000.</p>',
        },
        additionalInformation: {
          title: 'Additional',
          text: '<p>Advertised benefits and conditions.</p>',
        },
        videos: { title: 'Videos', urls: ['https://www.youtube.com/watch?v=example'] },
      },
    },
  };
}

function transport(
  listing: (offset: number, pass: number) => unknown = (offset) => ({
    offset,
    limit: 100,
    totalFound: 3,
    content: (offset === 0 ? ['1', '2'] : ['3']).map(summary),
  }),
  posting: (id: string) => unknown = detail,
) {
  let pass = 0;

  const get = vi.fn(async (value: string) => {
    const url = new URL(value);
    const id = url.pathname.match(/\/postings\/(\d+)$/)?.[1];
    const offset = Number(url.searchParams.get('offset'));

    if (!id && offset === 0) {
      pass++;
    }

    return {
      url: value,
      fetchedAt: '2026-10-06T12:00:00.000Z',
      body: id ? posting(id) : listing(offset, pass),
    };
  });

  return { get };
}

describe('SmartRecruiters public postings', () => {
  it.each([
    'complete',
    'employment_label',
    'function_label',
    'empty',
    'foreign_summary',
    'foreign_detail',
    'changed_inventory',
    'changed_summary_label',
    'changed_location',
    'foreign_link',
  ])('validates Canva whole-advertisement layout and identity: %s', async (mode) => {
    const canva = loadRegistry().sources.find((entry) => entry.id === 'canva')!;

    const advertisement =
      '<p>Build design tools.</p><p>Required TypeScript skills.</p><p>Benefits and salary conditions.</p>';

    const company = { identifier: 'Canva' };
    const header = { ...summary('1'), company, ref: `${canva.endpoint}/1` };
    let pass = 0;

    const http = {
      get: vi.fn(async (url: string) => {
        const isDetail = new URL(url).pathname.endsWith('/1');

        if (!isDetail) {
          pass++;
        }

        return {
          url,
          fetchedAt: '2026-10-06T12:00:00.000Z',
          body: isDetail
            ? {
                ...detail('1'),
                ...header,
                company: mode === 'foreign_detail' ? { identifier: 'ServiceNow' } : company,
                typeOfEmployment:
                  mode === 'employment_label' ? { label: 'Contract' } : header.typeOfEmployment,
                function:
                  mode === 'function_label' ? { label: 'Customer Support' } : header.function,
                location: mode === 'changed_location' ? { city: 'Paris' } : header.location,
                postingUrl:
                  mode === 'foreign_link'
                    ? 'https://jobs.smartrecruiters.com/Other/1-engineer'
                    : 'https://jobs.smartrecruiters.com/Canva/1-engineer',
                applyUrl: 'https://jobs.smartrecruiters.com/Canva/1-engineer?oga=true',
                jobAd: {
                  sections: {
                    companyDescription: {
                      title: 'Company Description',
                      text: mode === 'empty' ? '<script>bad()</script>' : advertisement,
                    },
                    jobDescription: { title: 'Job Description', text: '' },
                    qualifications: { title: 'Qualifications', text: '' },
                    additionalInformation: { title: 'Additional Information', text: '' },
                  },
                },
              }
            : {
                offset: 0,
                limit: 100,
                totalFound: 1,
                content: [
                  {
                    ...header,
                    company: mode === 'foreign_summary' ? { identifier: 'ServiceNow' } : company,
                    name: mode === 'changed_inventory' && pass > 1 ? 'Changed role' : header.name,
                    function:
                      mode === 'changed_summary_label' && pass > 1
                        ? { label: 'Changed' }
                        : header.function,
                  },
                ],
              },
        };
      }),
    };

    if (!['complete', 'employment_label', 'function_label'].includes(mode)) {
      await expect(new SmartRecruitersAdapter(http).extract(canva)).rejects.toThrow();

      return;
    }

    const result = await new SmartRecruitersAdapter(http).extract(canva);

    expect(result).toMatchObject({ enumerationComplete: true, excluded: 0 });
    expect(result.rawResponses).toHaveLength(3);
    expect(result.postings[0]?.descriptionHtml).toContain(advertisement);
    expect(result.postings[0]?.sourcePostingId).toBe('1');

    expect(result.postings[0]?.departments).toEqual([
      mode === 'function_label' ? 'Customer Support' : 'Engineering',
    ]);

    expect(result.postings[0]?.employment).toBe(
      mode === 'employment_label' ? 'Contract' : 'Full-time',
    );

    expect(result.postings[0]?.applyUrl).toBe(
      'https://jobs.smartrecruiters.com/Canva/1-engineer?oga=true',
    );
  });

  it('traverses every page, hydrates every detail and rechecks the complete identity inventory', async () => {
    const http = transport();
    const result = await new SmartRecruitersAdapter(http).extract(source);

    expect(result.postings.map((job) => job.sourcePostingId)).toEqual(['1', '2', '3']);
    expect(result).toMatchObject({ excluded: 0, enumerationComplete: true });
    expect(result.rawResponses).toHaveLength(7);

    expect(result.postings[0]).toMatchObject({
      departments: ['Engineering'],
      locations: ['Amsterdam, Netherlands'],
      workplace: 'hybrid',
      employment: 'Full-time',
      publishedAt: '2026-10-06T12:00:00.000Z',
      applyUrl: detail('1').applyUrl,
      url: detail('1').postingUrl,
    });

    expect(result.postings[0]?.descriptionHtml).toContain('Salary €90,000');
    expect(result.postings[0]?.descriptionHtml).toContain('Advertised benefits');

    expect(result.postings[0]?.descriptionHtml).toContain(
      'https://www.youtube.com/watch?v=example',
    );

    expect(
      http.get.mock.calls
        .filter(([url]) => !/\/postings\//.test(new URL(url).pathname))
        .map(([url]) => new URL(url).searchParams.get('offset')),
    ).toEqual(['0', '2', '0', '2']);

    expect(
      http.get.mock.calls
        .filter(([url]) => !/\/postings\//.test(new URL(url).pathname))
        .every(([url]) => new URL(url).searchParams.get('destination') === 'PUBLIC'),
    ).toBe(true);
  });

  it.each([
    'duplicate_id',
    'duplicate_uuid',
    'foreign_company',
    'foreign_ref',
    'wrong_offset',
    'wrong_limit',
    'changed_total',
    'early_empty',
    'overflow',
  ])('rejects %s listing evidence', async (mode) => {
    const http = transport((offset) => {
      const job = summary(offset === 0 ? '1' : '2');

      if (offset > 0 && mode === 'duplicate_id') {
        job.id = '1';
        job.ref = `${endpoint}/1`;
      }

      if (offset > 0 && mode === 'duplicate_uuid') {
        job.uuid = summary('1').uuid;
      }

      if (mode === 'foreign_company') {
        job.company.identifier = 'Other';
      }

      if (mode === 'foreign_ref') {
        job.ref = 'https://example.com/postings/1';
      }

      return {
        offset: mode === 'wrong_offset' ? 999 : offset,
        limit: mode === 'wrong_limit' ? 10 : 100,
        totalFound: mode === 'overflow' ? 0 : offset > 0 && mode === 'changed_total' ? 3 : 2,
        content: mode === 'early_empty' && offset > 0 ? [] : [job],
      };
    });

    await expect(new SmartRecruitersAdapter(http).extract(source)).rejects.toThrow();
  });

  it.each([
    'wrong_id',
    'wrong_uuid',
    'changed_name',
    'changed_function',
    'changed_employment',
    'private',
    'inactive',
    'foreign_link',
    'wrong_application',
    'missing_description',
    'unreadable_description',
    'unknown_section',
    'unsupported_compensation',
  ])('aborts the whole extraction for %s detail', async (mode) => {
    const http = transport(undefined, (id) => {
      const job = detail(id);

      if (id !== '3') {
        return job;
      }

      switch (mode) {
        case 'wrong_id':
          return { ...job, id: '999' };
        case 'wrong_uuid':
          return { ...job, uuid: summary('999').uuid };
        case 'changed_name':
          return { ...job, name: 'Changed title' };
        case 'changed_function':
          return { ...job, function: { label: 'Sales' } };
        case 'changed_employment':
          return { ...job, typeOfEmployment: { label: 'Contract' } };
        case 'private':
          return { ...job, visibility: 'INTERNAL' };
        case 'inactive':
          return { ...job, active: false };
        case 'foreign_link':
          return { ...job, postingUrl: 'https://jobs.smartrecruiters.com/Other/3-engineer' };
        case 'wrong_application':
          return { ...job, applyUrl: 'https://jobs.smartrecruiters.com/ServiceNow/999-engineer' };
        case 'missing_description':
          return {
            ...job,
            jobAd: { sections: { companyDescription: job.jobAd.sections.companyDescription } },
          };
        case 'unreadable_description':
          return {
            ...job,
            jobAd: {
              sections: {
                ...job.jobAd.sections,
                jobDescription: { title: 'Role', text: '<script>bad()</script>' },
              },
            },
          };
        case 'unknown_section':
          return {
            ...job,
            jobAd: {
              sections: {
                ...job.jobAd.sections,
                extra: { title: 'New', text: 'Cannot silently omit' },
              },
            },
          };
        case 'unsupported_compensation':
          return { ...job, compensation: { amount: 90000 } };
      }

      return job;
    });

    await expect(new SmartRecruitersAdapter(http).extract(source)).rejects.toThrow();
  });

  it.each(['replaced_id', 'changed_metadata'])(
    'detects %s on later recheck pages',
    async (mode) => {
      const http = transport((offset, pass) => ({
        offset,
        limit: 100,
        totalFound: 3,
        content:
          offset === 0
            ? ['1', '2'].map(summary)
            : [
                mode === 'replaced_id' && pass > 1
                  ? summary('4')
                  : { ...summary('3'), name: pass > 1 ? 'Changed' : summary('3').name },
              ],
      }));

      await expect(new SmartRecruitersAdapter(http).extract(source)).rejects.toThrow(
        /inventory changed/,
      );
    },
  );

  it('accepts stable explicit zero totals only after a second complete listing', async () => {
    const http = transport((offset) => ({ offset, limit: 100, totalFound: 0, content: [] }));
    const result = await new SmartRecruitersAdapter(http).extract(source);

    expect(result).toMatchObject({ postings: [], enumerationComplete: true });
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    { max: 37.56, currency: 'USD', period: 'HOURLY' },
    { min: 80000, max: 100000, currency: 'EUR', period: 'YEARLY' },
  ])('preserves structured compensation without inventing absent bounds: %j', async (salary) => {
    const http = transport(undefined, (id) => ({ ...detail(id), compensation: salary }));
    const result = await new SmartRecruitersAdapter(http).extract(source);

    expect(result.postings[0]?.descriptionHtml).toContain(`Currency: ${salary.currency}`);
    expect(result.postings[0]?.descriptionHtml).toContain(`Period: ${salary.period}`);
    expect(result.postings[0]?.descriptionHtml).toContain(`Maximum: ${salary.max}`);

    if (salary.min === undefined) {
      expect(result.postings[0]?.descriptionHtml).not.toContain('Minimum:');
    } else {
      expect(result.postings[0]?.descriptionHtml).toContain(`Minimum: ${salary.min}`);
    }
  });

  it.each([
    { min: 100000, max: 80000, currency: 'EUR', period: 'YEARLY' },
    { max: -1, currency: 'USD', period: 'HOURLY' },
    { currency: 'USD', period: 'HOURLY' },
  ])('rejects invalid compensation rather than losing it: %j', async (salary) => {
    const http = transport(undefined, (id) => ({ ...detail(id), compensation: salary }));

    await expect(new SmartRecruitersAdapter(http).extract(source)).rejects.toThrow(
      /Compensation|compensation/,
    );
  });

  it('treats an empty department summary and absent detail label as the same unknown value', async () => {
    const http = transport(undefined, (id) => {
      const job = detail(id);

      Reflect.deleteProperty(job, 'department');

      return job;
    });

    const result = await new SmartRecruitersAdapter(http).extract(source);

    expect(result.postings).toHaveLength(3);
    expect(result.postings[0]?.departments).toEqual(['Engineering']);
  });

  it('keeps absent optional labels and workplace unknown and counts explicit talent-pool exclusions', async () => {
    const http = transport(
      (offset) => ({
        offset,
        limit: 100,
        totalFound: 2,
        content: [
          { ...summary('1'), name: 'Talent Community' },
          {
            ...summary('2'),
            department: undefined,
            function: undefined,
            typeOfEmployment: undefined,
            releasedDate: undefined,
            location: { city: 'Paris' },
          },
        ],
      }),
      (id) =>
        id === '1'
          ? { ...detail(id), name: 'Talent Community' }
          : {
              ...detail(id),
              department: undefined,
              function: undefined,
              typeOfEmployment: undefined,
              releasedDate: undefined,
              location: { city: 'Paris' },
            },
    );

    const result = await new SmartRecruitersAdapter(http).extract(source);

    expect(result.excluded).toBe(1);

    expect(result.postings[0]).toMatchObject({
      workplace: 'unknown',
      employment: 'unknown',
      publishedAt: null,
      departments: [],
      locations: ['Paris'],
    });
  });

  it('rejects an unconfigured endpoint before any network request', async () => {
    const http = transport();

    await expect(
      new SmartRecruitersAdapter(http).extract({ ...source, endpoint: 'https://example.com/' }),
    ).rejects.toThrow(/configured/);

    expect(http.get).not.toHaveBeenCalled();
  });

  it('recognizes hosted board case variants and immutable numeric posting IDs', () => {
    expect(officialIdentity('https://www.lifeatcanva.com/en/jobs/123/engineer/')).toEqual({
      board: 'smartrecruiters:Canva',
      id: '123',
    });

    expect(
      officialIdentity('https://www.lifeatcanva.com/en/jobs/123/engineer/apply')?.id,
    ).toBeNull();

    expect(officialIdentity('https://jobs.smartrecruiters.com/canva/123-title')).toEqual({
      board: 'smartrecruiters:Canva',
      id: '123',
    });

    expect(
      officialIdentity('https://jobs.smartrecruiters.com/servicenow/123-title?oga=true'),
    ).toEqual({ board: 'smartrecruiters:ServiceNow', id: '123' });

    expect(officialIdentity('https://careers.smartrecruiters.com/ServiceNow')).toEqual({
      board: 'smartrecruiters:ServiceNow',
      id: null,
    });

    expect(officialIdentity('https://jobs.smartrecruiters.com/other/123-title')?.board).toBe(
      'smartrecruiters:other',
    );

    expect(
      officialIdentity('https://jobs.smartrecruiters.com/ServiceNow/123-title/apply')?.id,
    ).toBeNull();
  });
});
