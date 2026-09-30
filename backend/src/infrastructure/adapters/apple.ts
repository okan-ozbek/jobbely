import { z } from 'zod';
import type { ExtractedPosting, Extraction, RawResponse, Source } from '../../domain/model.js';
import type { HtmlTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, text, vacancyExcluded } from './schemas.js';

const location = z.object({ name: text });

const listing = z.object({
  id: z.string().regex(/^(?:PIPE-)?\d+(?:-\d+)?$/),
  positionId: z.string().regex(/^\d+(?:-\d+)?$/),
  reqId: text,
  jobPositionId: text,
  transformedPostingTitle: text,
  postExternal: z.literal(true),
});

const search = z.object({
  searchResults: z.array(listing),
  totalRecords: z.number().int().nonnegative().max(10_000),
  page: z.coerce.number().int().positive(),
  filters: z.record(z.string(), z.unknown()),
  sort: z.string(),
});

const detail = z.object({
  id: text,
  positionId: text,
  reqId: text,
  jobNumber: text,
  postingTitle: text,
  jobSummary: text,
  description: z.string().nullable().optional(),
  minimumQualifications: z.string().nullable().optional(),
  preferredQualifications: z.string().nullable().optional(),
  educationAndExperience: z.string().nullable().optional(),
  additionalRequirements: z.string().nullable().optional(),
  postingFooters: z
    .array(
      z.object({
        localizations: z.record(
          z.string(),
          z.array(z.object({ name: text, content: z.string(), displayOrder: z.number() })),
        ),
      }),
    )
    .default([]),
  teamNames: z.array(text),
  locations: z.array(location).min(1),
  homeOffice: z.boolean(),
  postDateInGMT: z.string().optional(),
  selectedLocale: text.default('en_US'),
});

/** Parse only the literal JSON hydration data; never evaluate upstream JavaScript. */
export function applePageData(html: string): Record<string, unknown> {
  const matches = [
    ...html.matchAll(
      /window\.__staticRouterHydrationData\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/g,
    ),
  ];

  if (matches.length !== 1) {
    throw new Error('Apple page lacks unambiguous public hydration data');
  }

  const encoded: unknown = JSON.parse(matches[0]![1]!);

  if (typeof encoded !== 'string') {
    throw new Error('Apple hydration is not a JSON string');
  }

  const state = decode(
    z.object({ loaderData: z.record(z.string(), z.unknown()) }),
    JSON.parse(encoded),
  );

  return state.loaderData;
}

const section = (heading: string, value?: string | null) =>
  value?.trim() ? `<h2>${heading}</h2>${value.replaceAll('\n', '<br/>')}` : '';

/** Apple's unauthenticated server-rendered pages carry structured search and complete detail data. */
export class AppleAdapter implements SourceAdapter {
  constructor(private readonly http: HtmlTransport) {}

  async enumerate(source: Source) {
    if (!source.endpoint) {
      throw new Error('Apple requires the public search endpoint');
    }

    const rawResponses: RawResponse[] = [];
    const listings = new Map<string, z.infer<typeof listing>>();
    const deadline = Date.now() + 2 * 60 * 60_000;
    let expected: number | undefined;

    const fetchPage = async (page: number) => {
      const url = new URL(source.endpoint!);

      // An omitted location silently redirects to USA; an explicitly empty filter requests all locations.
      url.searchParams.set('location', '');
      url.searchParams.set('page', String(page));
      url.searchParams.set('sort', 'locationAsc');

      const raw = await this.http.getHtml(url.href);

      rawResponses.push(raw);

      const result = decode(search, applePageData(raw.body).search);

      if (
        result.page !== page ||
        result.sort !== 'locationAsc' ||
        Object.keys(result.filters).length
      ) {
        throw new Error('Apple ignored pagination or applied a default filter');
      }

      return result;
    };

    let first: z.infer<typeof search> | undefined;

    for (let page = 1; page <= 1_000; page++) {
      if (Date.now() > deadline) {
        throw new Error('Apple search budget exhausted');
      }

      const result = await fetchPage(page);

      first ??= result;
      expected ??= result.totalRecords;

      if (
        result.totalRecords !== expected ||
        (!result.searchResults.length && listings.size < expected)
      ) {
        throw new Error(
          `Apple inventory changed or pagination ended early: page=${page}, expected=${expected}, actual=${result.totalRecords}, pageSize=${result.searchResults.length}`,
        );
      }

      for (const job of result.searchResults) {
        if (listings.has(job.id)) {
          throw new Error(`Apple repeated a posting during pagination: page=${page}, id=${job.id}`);
        }

        listings.set(job.id, job);
      }

      if (listings.size > expected) {
        throw new Error('Apple exceeded the advertised total');
      }

      if (listings.size === expected) {
        break;
      }
    }

    if (listings.size !== expected) {
      throw new Error('Apple page budget exhausted');
    }

    const final = await fetchPage(1);

    if (
      final.totalRecords !== expected ||
      JSON.stringify(final.searchResults.map((job) => job.id)) !==
        JSON.stringify(first!.searchResults.map((job) => job.id))
    ) {
      throw new Error('Apple search inventory changed during traversal');
    }

    return { listings, rawResponses, deadline };
  }

  async hydrate(source: Source, job: z.infer<typeof listing>) {
    const url = new URL(
      `/en-us/details/${job.id.replace(/^PIPE-/, '')}/${encodeURIComponent(job.transformedPostingTitle)}`,
      source.endpoint,
    );

    const raw = await this.http.getHtml(url.href);

    const data = decode(
      z.object({ jobsData: detail }),
      applePageData(raw.body).jobDetails,
    ).jobsData;

    if (
      data.id !== job.jobPositionId ||
      data.reqId !== job.jobPositionId ||
      data.positionId !== job.positionId ||
      data.jobNumber !== job.id.replace(/^PIPE-/, '')
    ) {
      throw new Error('Apple detail identity differs from the advertised posting');
    }

    const posting: ExtractedPosting = {
      sourcePostingId: job.id,
      title: data.postingTitle,
      url: url.href,
      applyUrl: url.href,
      descriptionHtml: [
        section('Summary', data.jobSummary),
        section('Description', data.description),
        section('Minimum qualifications', data.minimumQualifications),
        section('Preferred qualifications', data.preferredQualifications),
        section('Education and experience', data.educationAndExperience),
        section('Additional requirements', data.additionalRequirements),
        ...data.postingFooters
          .flatMap((footer) => footer.localizations[data.selectedLocale] ?? [])
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((footer) => section(footer.name, footer.content)),
      ].join(''),
      departments: data.teamNames,
      locations: data.locations.map((place) => place.name),
      workplace: data.homeOffice ? 'remote' : 'unknown',
      employment: 'unknown',
      publishedAt:
        data.postDateInGMT && Number.isFinite(Date.parse(data.postDateInGMT))
          ? new Date(data.postDateInGMT).toISOString()
          : null,
    };

    return { posting, raw };
  }

  async extract(source: Source): Promise<Extraction> {
    const { listings, rawResponses, deadline } = await this.enumerate(source);
    const postings: ExtractedPosting[] = [];
    let excluded = 0;

    for (const job of listings.values()) {
      if (Date.now() > deadline) {
        throw new Error('Apple detail budget exhausted');
      }

      const { posting, raw } = await this.hydrate(source, job);

      rawResponses.push(raw);

      if (vacancyExcluded(posting.title)) {
        excluded++;
        continue;
      }

      postings.push(posting);
    }

    return { postings, rawResponses, excluded, enumerationComplete: true };
  }
}
