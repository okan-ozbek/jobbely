import { z } from 'zod';
import type { Extraction, RawResponse, Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { htmlPreparation } from '../html.js';
import { decode, httpsUrl, text, vacancyExcluded } from './schemas.js';

const postingId = z.string().regex(/^\d{1,30}$/);
const label = z.object({ label: text.optional() }).nullish();

const header = z.object({
  id: postingId,
  uuid: z.uuid(),
  name: text,
  company: z.object({ identifier: text }),
  releasedDate: z.iso.datetime({ offset: true }).optional(),
  location: z.object({
    fullLocation: text.optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    remote: z.boolean().optional(),
    hybrid: z.boolean().optional(),
  }),
  department: label,
  function: label,
  typeOfEmployment: label,
});

const summary = header.extend({ ref: httpsUrl });

const inventorySchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(100),
  totalFound: z.number().int().nonnegative().max(10_000),
  content: z.array(summary).max(100),
});

const section = z.object({ title: text, text: z.string() });

const compensation = z
  .object({
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    period: text,
  })
  .strict()
  .refine(
    (value) =>
      (value.min !== undefined || value.max !== undefined) &&
      (value.min === undefined || value.max === undefined || value.min <= value.max),
    'Compensation must have a valid advertised amount or range',
  );

const detailSchema = header.extend({
  postingUrl: httpsUrl,
  applyUrl: httpsUrl,
  active: z.literal(true),
  visibility: z.literal('PUBLIC'),
  jobAd: z.object({
    sections: z
      .object({
        companyDescription: section.optional(),
        jobDescription: section,
        qualifications: section.optional(),
        additionalInformation: section.optional(),
        videos: z.object({ title: text, urls: z.array(httpsUrl).max(20) }).optional(),
      })
      .strict(),
  }),
  compensation: compensation.nullish(),
});

function escaped(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function metadata(value: unknown) {
  const job = header.parse(value);

  return {
    id: job.id,
    uuid: job.uuid,
    name: job.name,
    company: job.company.identifier,
    releasedDate: job.releasedDate ?? null,
    location: job.location,
    department: job.department?.label ?? null,
    function: job.function?.label ?? null,
    typeOfEmployment: job.typeOfEmployment?.label ?? null,
  };
}

function validatePostingLink(value: string, board: string, id: string): URL {
  const url = new URL(value);
  const parts = url.pathname.split('/').filter(Boolean);

  if (
    url.hostname !== 'jobs.smartrecruiters.com' ||
    parts.length !== 2 ||
    parts[0]?.toLowerCase() !== board.toLowerCase() ||
    !new RegExp(`^${id}(?:-[^/]+)?$`).test(parts[1] ?? '') ||
    url.hash
  ) {
    throw new Error('SmartRecruiters returned a foreign or inconsistent posting link');
  }

  return url;
}

/** Public postings only; list records are never substituted for full advertisements. */
export class SmartRecruitersAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}

  async extract(source: Source): Promise<Extraction> {
    const endpoint = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.board)}/postings`;

    if (source.provider !== 'smartrecruiters' || source.endpoint !== endpoint) {
      throw new Error('SmartRecruiters requires its exact configured public postings endpoint');
    }

    const rawResponses: RawResponse[] = [];
    const deadline = Date.now() + 2 * 60 * 60_000;

    const request = async (url: string) => {
      if (Date.now() > deadline) {
        throw new Error('SmartRecruiters elapsed-time budget exhausted');
      }

      const raw = await this.http.get(url);

      rawResponses.push(raw);

      return raw;
    };

    const inventory = async () => {
      const jobs = new Map<string, z.infer<typeof summary>>();
      const uuids = new Set<string>();
      let total: number | undefined;

      for (let page = 0; page < 100; page++) {
        const url = new URL(endpoint);

        url.searchParams.set('limit', '100');
        url.searchParams.set('offset', String(jobs.size));
        url.searchParams.set('destination', 'PUBLIC');

        const response = decode(inventorySchema, (await request(url.href)).body);

        total ??= response.totalFound;

        if (
          response.totalFound !== total ||
          response.offset !== jobs.size ||
          response.limit !== 100 ||
          (!response.content.length && jobs.size < total)
        ) {
          throw new Error('SmartRecruiters totals, pagination or inventory changed');
        }

        for (const job of response.content) {
          if (
            job.company.identifier !== source.board ||
            job.ref !== `${endpoint}/${job.id}` ||
            jobs.has(job.id) ||
            uuids.has(job.uuid)
          ) {
            throw new Error('SmartRecruiters repeated an identity or returned another company');
          }

          jobs.set(job.id, job);
          uuids.add(job.uuid);
        }

        if (jobs.size > total) {
          throw new Error('SmartRecruiters exceeded the advertised total');
        }

        if (jobs.size === total) {
          return jobs;
        }
      }

      throw new Error('SmartRecruiters page budget exhausted');
    };

    const jobs = await inventory();
    const postings: Extraction['postings'] = [];
    let excluded = 0;

    for (const job of jobs.values()) {
      const detail = decode(detailSchema, (await request(job.ref)).body);

      if (JSON.stringify(metadata(detail)) !== JSON.stringify(metadata(job))) {
        throw new Error(`SmartRecruiters detail metadata changed for posting ${job.id}`);
      }

      const postingUrl = validatePostingLink(detail.postingUrl, source.board, job.id);
      const applyUrl = validatePostingLink(detail.applyUrl, source.board, job.id);

      if (
        postingUrl.search ||
        applyUrl.pathname !== postingUrl.pathname ||
        (applyUrl.search !== '' && applyUrl.search !== '?oga=true')
      ) {
        throw new Error('SmartRecruiters posting and application links disagree');
      }

      if (vacancyExcluded(detail.name)) {
        excluded++;
        continue;
      }

      const sections = detail.jobAd.sections;

      if (!htmlPreparation.prepare(sections.jobDescription.text).text) {
        throw new Error(`SmartRecruiters posting ${job.id} has no readable role description`);
      }

      const description = [
        sections.companyDescription,
        sections.jobDescription,
        sections.qualifications,
        sections.additionalInformation,
      ]
        .filter((value) => value !== undefined)
        .map((value) => `<h2>${escaped(value.title)}</h2>${value.text}`);

      if (sections.videos) {
        description.push(
          `<h2>${escaped(sections.videos.title)}</h2>` +
            sections.videos.urls
              .map(
                (url) =>
                  `<p><a href="${escaped(url).replaceAll('"', '&quot;')}">${escaped(url)}</a></p>`,
              )
              .join('\n'),
        );
      }

      if (detail.compensation) {
        const salary = detail.compensation;

        const amounts = [
          salary.min === undefined ? null : `Minimum: ${salary.min}`,
          salary.max === undefined ? null : `Maximum: ${salary.max}`,
        ].filter(Boolean);

        description.push(
          `<h2>Compensation</h2><p>Currency: ${escaped(salary.currency)}; Period: ${escaped(salary.period)}; ${amounts.join('; ')}</p>`,
        );
      }

      postings.push({
        sourcePostingId: job.id,
        title: detail.name,
        url: detail.postingUrl,
        applyUrl: detail.applyUrl,
        descriptionHtml: description.join('\n'),
        departments: [
          ...new Set(
            [detail.department?.label, detail.function?.label].filter(
              (value) => value !== undefined,
            ),
          ),
        ],
        locations: [
          detail.location.fullLocation ??
            [detail.location.city, detail.location.region, detail.location.country]
              .filter(Boolean)
              .join(', '),
        ].filter(Boolean),
        workplace:
          detail.location.remote === true
            ? 'remote'
            : detail.location.hybrid === true
              ? 'hybrid'
              : 'unknown',
        employment: detail.typeOfEmployment?.label ?? 'unknown',
        publishedAt: detail.releasedDate ?? null,
      });
    }

    const checked = await inventory();

    if (
      checked.size !== jobs.size ||
      [...jobs].some(([id, job]) => JSON.stringify(checked.get(id)) !== JSON.stringify(job))
    ) {
      throw new Error('SmartRecruiters inventory changed during detail retrieval; retry later');
    }

    return { postings, excluded, rawResponses, enumerationComplete: true };
  }
}
