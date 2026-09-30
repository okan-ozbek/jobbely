import { z } from 'zod';
import type { Extraction, RawResponse, Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, text, vacancyExcluded } from './schemas.js';

const jobSchema = z.object({
  slug: text,
  title: text,
  description: text,
  apply_url: httpsUrl,
  meta_data: z.object({ canonical_url: httpsUrl }),
  categories: z.array(z.object({ name: text })).default([]),
  full_location: z.string().optional(),
  employment_type: text.optional(),
  posted_date: z.string().optional(),
  searchable: z.boolean(),
  applyable: z.boolean(),
  brand: z.string().optional(),
  hiring_organization: z.string().optional(),
});

const responseSchema = z.object({
  jobs: z.array(z.object({ data: jobSchema })),
  totalCount: z.number().int().nonnegative().max(20_000),
});

/** The public iCIMS/Jibe search returns complete descriptions and explicit totals. */
export class IcimsAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}

  async extract(source: Source): Promise<Extraction> {
    if (!source.endpoint) {
      throw new Error('iCIMS requires a configured public jobs endpoint');
    }

    const endpoint = new URL(source.endpoint);
    const jobs: z.infer<typeof jobSchema>[] = [];
    const rawResponses: RawResponse[] = [];
    const ids = new Set<string>();
    let total: number | undefined;

    for (let page = 1; page <= 2_000; page++) {
      const url = new URL(endpoint);

      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '100');

      const raw = await this.http.get(url.href);

      rawResponses.push(raw);

      const response = decode(responseSchema, raw.body);

      total ??= response.totalCount;

      if (response.totalCount !== total || (!response.jobs.length && ids.size < total)) {
        throw new Error('iCIMS total changed or pagination ended early');
      }

      for (const { data: job } of response.jobs) {
        if (ids.has(job.slug)) {
          throw new Error('iCIMS repeated a posting during pagination');
        }

        const employer = source.employerFilter ? job[source.employerFilter.field] : undefined;

        if (source.employerFilter && employer === undefined) {
          throw new Error('iCIMS employer membership field is missing');
        }

        const included = !source.employerFilter || source.employerFilter.values.includes(employer!);
        const canonical = new URL(job.meta_data.canonical_url);

        if (
          included &&
          ((canonical.origin !== endpoint.origin &&
            !source.postingHosts?.includes(canonical.hostname)) ||
            !canonical.pathname.endsWith(`/jobs/${job.slug}`))
        ) {
          throw new Error('iCIMS returned a posting from another employer board');
        }

        ids.add(job.slug);
        jobs.push(job);
      }

      if (ids.size > total) {
        throw new Error('iCIMS count exceeds advertised total');
      }

      if (ids.size === total) {
        const vacancies = jobs.filter(
          (job) =>
            job.searchable &&
            job.applyable &&
            !vacancyExcluded(job.title) &&
            (!source.employerFilter ||
              source.employerFilter.values.includes(job[source.employerFilter.field]!)),
        );

        return {
          rawResponses,
          excluded: jobs.length - vacancies.length,
          enumerationComplete: true,
          postings: vacancies.map((job) => ({
            sourcePostingId: job.slug,
            title: job.title,
            url: job.meta_data.canonical_url,
            applyUrl: job.apply_url,
            descriptionHtml: job.description,
            departments: job.categories.map((category) => category.name),
            locations: job.full_location ? [job.full_location] : [],
            workplace: 'unknown' as const,
            employment: job.employment_type ?? 'unknown',
            publishedAt:
              job.posted_date && Number.isFinite(Date.parse(job.posted_date))
                ? new Date(job.posted_date).toISOString()
                : null,
          })),
        };
      }
    }

    throw new Error('iCIMS page budget exhausted');
  }
}
