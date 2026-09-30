import { z } from 'zod';
import type { ExtractedPosting, Extraction, RawResponse, Source } from '../../domain/model.js';
import type { JsonSearchTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, text, vacancyExcluded, workplace } from './schemas.js';

const facetSchema = z.object({
  facetParameter: text,
  values: z
    .array(
      z.object({ id: text, descriptor: text.optional(), count: z.number().int().nonnegative() }),
    )
    .optional(),
});

const searchSchema = z.object({
  total: z.number().int().nonnegative().max(20_000),
  jobPostings: z.array(z.object({ title: text, externalPath: text })),
  facets: z.array(z.unknown()).default([]),
});

const detailSchema = z.object({
  jobPostingInfo: z.object({
    id: text,
    jobPostingId: text,
    title: text,
    jobDescription: text,
    externalUrl: httpsUrl,
    location: text,
    additionalLocations: z.array(text).default([]),
    timeType: text.optional(),
    remoteType: text.optional(),
    startDate: z.string().optional(),
    jobFamily: z.object({ descriptor: text }).optional(),
    posted: z.boolean(),
    canApply: z.boolean(),
  }),
});

type Search = z.infer<typeof searchSchema>;

/** Workday's public career-site search is capped; single-valued facets prove partition coverage. */
export class WorkdayAdapter implements SourceAdapter {
  constructor(
    private readonly http: JsonSearchTransport,
    private readonly searchCap = 2_000,
  ) {}

  async enumerate(source: Source) {
    if (!source.endpoint) {
      throw new Error('Workday requires a configured CXS jobs endpoint');
    }

    const endpoint = new URL(source.endpoint);
    const basePath = endpoint.pathname.replace(/\/jobs$/, '');
    const site = basePath.split('/').at(-1)!;
    const rawResponses: RawResponse[] = [];
    const listings = new Map<string, Search['jobPostings'][number]>();
    const categories = new Map<string, string[]>();
    const deadline = Date.now() + 2 * 60 * 60_000;
    let requests = 0;

    const search = async (offset: number, appliedFacets: Record<string, string[]>) => {
      if (++requests > 2_000 || Date.now() > deadline) {
        throw new Error('Workday search request budget exhausted');
      }

      const raw = await this.http.post(endpoint.href, {
        limit: 20,
        offset,
        searchText: '',
        appliedFacets,
      });

      rawResponses.push(raw);

      return decode(searchSchema, raw.body);
    };

    const traverse = async (
      filters: Record<string, string[]>,
      expected?: number,
      departments: string[] = [],
    ): Promise<Set<string>> => {
      const first = await search(0, filters);

      if (expected !== undefined && first.total !== Math.min(expected, this.searchCap)) {
        throw new Error('Workday partition count changed during traversal');
      }

      const facets = first.facets.map((value) => facetSchema.safeParse(value));

      const nativeCategory = facets.find(
        (result) =>
          result.success &&
          result.data.facetParameter === 'jobFamilyGroup' &&
          result.data.values?.length &&
          result.data.values.reduce((sum, value) => sum + value.count, 0) === first.total,
      );

      if (
        first.total >= this.searchCap ||
        (!Object.keys(filters).length && nativeCategory?.success)
      ) {
        // These dimensions have exactly one value per posting. Do not partition by overlapping locations.

        const partition = ['jobFamilyGroup', 'workerSubType', 'timeType']
          .flatMap((parameter) => {
            const facet = facets.find(
              (result) => result.success && result.data.facetParameter === parameter,
            );

            return facet?.success && !filters[parameter] && facet.data.values?.length
              ? [facet.data]
              : [];
          })
          .find(
            (facet) =>
              facet.values!.length >= 1 &&
              facet.values!.every((value) => value.count < this.searchCap),
          );

        if (
          !partition?.values ||
          new Set(partition.values.map((value) => value.id)).size !== partition.values.length
        ) {
          throw new Error('Workday capped search cannot be exhaustively partitioned');
        }

        const total = partition.values.reduce((count, value) => count + value.count, 0);

        if (total < first.total || (expected !== undefined && total !== expected)) {
          throw new Error('Workday facet counts do not cover the search');
        }

        const ids = new Set<string>();

        for (const value of partition.values) {
          const child = await traverse(
            { ...filters, [partition.facetParameter]: [value.id] },
            value.count,
            partition.facetParameter === 'jobFamilyGroup' && value.descriptor
              ? [value.descriptor]
              : departments,
          );

          for (const id of child) {
            if (ids.has(id)) {
              throw new Error('Workday single-valued partitions overlap');
            }

            ids.add(id);
          }
        }

        if (ids.size !== total) {
          throw new Error('Workday partition identities do not match their counts');
        }

        const final = await search(0, filters);

        const refreshed = final.facets
          .map((value) => facetSchema.safeParse(value))
          .find(
            (result) => result.success && result.data.facetParameter === partition.facetParameter,
          );

        const fingerprint = (values: NonNullable<z.infer<typeof facetSchema>['values']>) =>
          JSON.stringify(
            values.map(({ id, count }) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id)),
          );

        if (
          final.total !== first.total ||
          !refreshed?.success ||
          !refreshed.data.values ||
          fingerprint(refreshed.data.values) !== fingerprint(partition.values)
        ) {
          throw new Error('Workday partition inventory changed during traversal');
        }

        return ids;
      }

      const ids = new Set<string>();
      let page = first;

      let offset = 0;

      for (;;) {
        // Workday returns total: 0 on later nonempty pages; it is a sentinel, not an empty inventory.
        if (
          (page.total !== first.total && !(offset > 0 && page.total === 0)) ||
          (!page.jobPostings.length && ids.size < first.total)
        ) {
          throw new Error('Workday total changed or pagination ended early');
        }

        for (const listing of page.jobPostings) {
          if (
            !/^\/job\/[^?#]+$/.test(listing.externalPath) ||
            listing.externalPath.includes('..')
          ) {
            throw new Error('Workday returned an invalid detail path');
          }

          if (ids.has(listing.externalPath)) {
            throw new Error('Workday repeated a posting during pagination');
          }

          ids.add(listing.externalPath);
          listings.set(listing.externalPath, listing);
          categories.set(listing.externalPath, departments);
        }

        if (ids.size > first.total) {
          throw new Error('Workday count exceeds advertised total');
        }

        if (ids.size === first.total) {
          break;
        }

        offset += page.jobPostings.length;
        page = await search(offset, filters);
      }

      if (first.total > first.jobPostings.length) {
        const final = await search(0, filters);

        if (
          final.total !== first.total ||
          final.jobPostings.length !== first.jobPostings.length ||
          final.jobPostings.some(
            (job, index) => job.externalPath !== first.jobPostings[index]?.externalPath,
          )
        ) {
          throw new Error('Workday first page changed during traversal');
        }
      }

      return ids;
    };

    await traverse({});

    return { endpoint, basePath, site, rawResponses, listings, categories, deadline };
  }

  async extract(source: Source): Promise<Extraction> {
    const { endpoint, basePath, site, rawResponses, listings, categories, deadline } =
      await this.enumerate(source);

    const postings: ExtractedPosting[] = [];
    const identities = new Set<string>();
    let excluded = 0;

    for (const path of listings.keys()) {
      if (Date.now() > deadline || postings.length + excluded >= 10_000) {
        throw new Error('Workday detail request or elapsed-time budget exhausted');
      }

      const raw = await this.http.get(`${endpoint.origin}${basePath}${path}`);

      rawResponses.push(raw);

      const { jobPostingInfo: job } = decode(detailSchema, raw.body);
      const advertisedUrl = new URL(job.externalUrl);
      const tenant = basePath.split('/')[3]!;
      const canonicalPath = advertisedUrl.pathname.replace(/^\/[a-z]{2}-[a-z]{2}\//i, '/');
      const regionalOrigin = `https://${endpoint.hostname.split('.').slice(1).join('.').replace('myworkdayjobs.com', 'myworkdaysite.com')}`;

      const sameBoard =
        (advertisedUrl.origin === endpoint.origin && canonicalPath.startsWith(`/${site}/job/`)) ||
        (advertisedUrl.origin === regionalOrigin &&
          canonicalPath.startsWith(`/recruiting/${tenant}/${site}/job/`));

      if (
        !sameBoard ||
        advertisedUrl.pathname.split('/').at(-1) !== job.jobPostingId ||
        path.split('/').at(-1) !== job.jobPostingId
      ) {
        throw new Error('Workday detail belongs to a different board or posting');
      }

      if (identities.has(job.id)) {
        throw new Error('Workday repeated a stable detail ID');
      }

      identities.add(job.id);

      if (!job.posted || !job.canApply) {
        throw new Error('Workday listing became unavailable during hydration; retry the run');
      }

      if (vacancyExcluded(job.title)) {
        excluded++;
        continue;
      }

      postings.push({
        sourcePostingId: job.id,
        title: job.title,
        url: job.externalUrl,
        applyUrl: `${job.externalUrl}/apply`,
        descriptionHtml: job.jobDescription,
        departments: [
          ...new Set([
            ...(categories.get(path) ?? []),
            ...(job.jobFamily ? [job.jobFamily.descriptor] : []),
          ]),
        ],
        locations: [...new Set([job.location, ...job.additionalLocations])],
        workplace: workplace(job.remoteType),
        employment: job.timeType ?? 'unknown',
        publishedAt:
          job.startDate && /^\d{4}-\d{2}-\d{2}$/.test(job.startDate)
            ? new Date(job.startDate).toISOString()
            : null,
      });
    }

    return { postings, rawResponses, excluded, enumerationComplete: true };
  }
}
