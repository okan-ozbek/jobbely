import { z } from 'zod';
import type { Extraction, RawResponse, Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, text, vacancyExcluded } from './schemas.js';

const jobSchema = z.object({
  id_icims: z.string().regex(/^(?:\d+|SF\d+)$/),
  id: text,
  source_system: text,
  title: text,
  job_path: text,
  url_next_step: httpsUrl,
  description: text,
  basic_qualifications: z.string().nullable(),
  preferred_qualifications: z.string().nullable(),
  job_category: text,
  job_family: z.string().nullable(),
  location: text,
  locations: z.array(z.string()).default([]),
  job_schedule_type: z.string().nullable(),
  posted_date: z.string().optional(),
});

const resultSchema = z.object({
  error: z.null(),
  hits: z.number().int().nonnegative().max(10_000),
  jobs: z.array(jobSchema),
  facets: z.object({
    category_facet: z.array(z.record(z.string(), z.number().int().nonnegative())).optional(),
  }),
});

const locationSchema = z.object({ location: text, type: z.string().optional() });

/** Amazon caps hits at 10,000; native, single-valued job-category facets partition the full inventory. */
export class AmazonAdapter implements SourceAdapter {
  constructor(
    private readonly http: JsonTransport,
    private readonly cap = 10_000,
  ) {}

  async extract(source: Source): Promise<Extraction> {
    if (!source.endpoint) {
      throw new Error('Amazon requires the native public search endpoint');
    }

    const rawResponses: RawResponse[] = [];
    const jobs = new Map<string, z.infer<typeof jobSchema>>();
    const deadline = Date.now() + 2 * 60 * 60_000;
    let requests = 0;

    const search = async (offset: number, category?: string) => {
      if (++requests > 2_000 || Date.now() > deadline) {
        throw new Error('Amazon search budget exhausted');
      }

      const url = new URL(source.endpoint!);

      url.searchParams.set('offset', String(offset));
      url.searchParams.set('result_limit', '100');
      url.searchParams.set('sort', 'recent');
      url.searchParams.append('facets[]', 'category');

      if (category) {
        url.searchParams.append('category[]', category);
      }

      const raw = await this.http.get(url.href);

      rawResponses.push(raw);

      return decode(resultSchema, raw.body);
    };

    const first = await search(0);
    const facets = first.facets.category_facet?.flatMap((entry) => Object.entries(entry));

    if (
      facets?.some((entry) => entry[0].trim() === '' || entry[1] >= this.cap) ||
      (facets && new Set(facets.map((entry) => entry[0])).size !== facets.length)
    ) {
      throw new Error('Amazon category facets are invalid or capped');
    }

    if (first.hits >= this.cap && !facets?.length) {
      throw new Error('Amazon capped inventory lacks exhaustive category partitions');
    }

    const total = facets?.reduce((sum, entry) => sum + entry[1], 0) ?? first.hits;

    if (Math.min(total, this.cap) !== first.hits) {
      throw new Error('Amazon facets do not cover the advertised total');
    }

    const partitions =
      first.hits >= this.cap
        ? facets!.map(([category, count]) => ({ category, count }))
        : [{ category: undefined, count: first.hits }];

    for (const partition of partitions) {
      let received = 0;
      let page = partition.category ? await search(0, partition.category) : first;
      const firstIds = page.jobs.map((job) => job.id_icims);

      for (;;) {
        if (page.hits !== partition.count || (!page.jobs.length && received < partition.count)) {
          throw new Error(
            `Amazon count changed or pagination ended early: category=${partition.category ?? 'all'}, offset=${received}, expected=${partition.count}, actual=${page.hits}, pageSize=${page.jobs.length}`,
          );
        }

        for (const job of page.jobs) {
          if (
            jobs.has(job.id_icims) ||
            (partition.category && job.job_category !== partition.category)
          ) {
            throw new Error('Amazon duplicate, overlapping or unfiltered partition');
          }

          if (!new RegExp(`^/en/jobs/${job.id_icims}(?:/[^/?#]*)?$`).test(job.job_path)) {
            throw new Error(
              `Amazon returned an invalid native posting path for ${job.id_icims}: ${job.job_path}`,
            );
          }

          const apply = new URL(job.url_next_step);

          const accountLink =
            ['account.amazon.jobs', 'account.amazon.com', 'www.amazon.jobs'].includes(
              apply.hostname,
            ) && new RegExp(`^/(?:en/)?jobs/${job.id_icims}/apply/?$`).test(apply.pathname);

          const hiringLink =
            job.source_system === 'HVH' &&
            /^SF\d+$/.test(job.id_icims) &&
            apply.hostname === 'hvr-amazon.my.site.com' &&
            apply.pathname === '/JobDetails' &&
            apply.searchParams.get('reqid') === job.id &&
            apply.searchParams.get('isapply') === '1';

          if (!accountLink && !hiringLink) {
            throw new Error('Amazon returned a foreign application link');
          }

          jobs.set(job.id_icims, job);
        }

        received += page.jobs.length;

        if (received > partition.count) {
          throw new Error('Amazon exceeded partition count');
        }

        if (received === partition.count) {
          break;
        }

        page = await search(received, partition.category);
      }

      if (received > firstIds.length) {
        const final = await search(0, partition.category);

        if (
          final.hits !== partition.count ||
          JSON.stringify(final.jobs.map((job) => job.id_icims)) !== JSON.stringify(firstIds)
        ) {
          throw new Error('Amazon first page changed during traversal');
        }
      }
    }

    const final = await search(0);

    const fingerprint = (values: Record<string, number>[] | undefined) =>
      JSON.stringify(
        values?.flatMap((value) => Object.entries(value)).sort((a, b) => a[0].localeCompare(b[0])),
      );

    if (
      final.hits !== first.hits ||
      fingerprint(final.facets.category_facet) !== fingerprint(first.facets.category_facet) ||
      jobs.size !== total
    ) {
      throw new Error('Amazon facet inventory changed during traversal');
    }

    const vacancies = [...jobs.values()].filter((job) => !vacancyExcluded(job.title));

    return {
      rawResponses,
      excluded: jobs.size - vacancies.length,
      enumerationComplete: true,
      postings: vacancies.map((job) => {
        const places = job.locations.map((value) => decode(locationSchema, JSON.parse(value)));
        const types = new Set(places.map((place) => place.type));

        return {
          sourcePostingId: job.id_icims,
          title: job.title,
          url: new URL(job.job_path, source.endpoint).href,
          applyUrl: job.url_next_step,
          descriptionHtml: [
            job.description,
            job.basic_qualifications
              ? `<h2>Basic qualifications</h2>${job.basic_qualifications}`
              : '',
            job.preferred_qualifications
              ? `<h2>Preferred qualifications</h2>${job.preferred_qualifications}`
              : '',
          ].join(''),
          departments: [job.job_category, ...(job.job_family ? [job.job_family] : [])],
          locations: [...new Set([job.location, ...places.map((place) => place.location)])],
          workplace:
            types.size === 1 && types.has('REMOTE')
              ? ('remote' as const)
              : types.size === 1 && types.has('HYBRID')
                ? ('hybrid' as const)
                : types.size === 1 && types.has('ONSITE')
                  ? ('onsite' as const)
                  : ('unknown' as const),
          employment: job.job_schedule_type ?? 'unknown',
          publishedAt:
            job.posted_date && Number.isFinite(Date.parse(job.posted_date))
              ? new Date(job.posted_date).toISOString()
              : null,
        };
      }),
    };
  }
}
