import { z } from 'zod';
import type { ExtractedPosting, Extraction, RawResponse, Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, identifier, text, vacancyExcluded, workplace } from './schemas.js';

const position = z.object({
  id: identifier,
  name: text,
  locations: z.array(text).min(1),
  department: text,
  canonicalPositionUrl: httpsUrl,
  isPrivate: z.boolean(),
  work_location_option: z.string().nullable().optional(),
  t_create: z.number().int().nonnegative().optional(),
});

const inventory = z.object({
  positions: z.array(position),
  count: z.number().int().nonnegative().max(10_000),
});

const detail = position.extend({
  job_description: text,
  custom_JD: z
    .object({ data_fields: z.object({ work_type: z.array(z.string()).optional() }) })
    .optional(),
});

/** Eightfold's public Netflix search provides an explicit total and separate full-detail records. */
export class EightfoldAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}

  async extract(source: Source): Promise<Extraction> {
    if (!source.endpoint || source.board !== 'netflix') {
      throw new Error('Eightfold requires the configured Netflix public endpoint');
    }

    const rawResponses: RawResponse[] = [];
    const listings = new Map<string, z.infer<typeof position>>();
    const deadline = Date.now() + 2 * 60 * 60_000;
    let expected: number | undefined;

    const search = async (start: number) => {
      const url = new URL(source.endpoint!);

      url.searchParams.set('domain', 'netflix.com');
      url.searchParams.set('start', String(start));
      url.searchParams.set('num', '100');

      const raw = await this.http.get(url.href);

      rawResponses.push(raw);

      return decode(inventory, raw.body);
    };

    for (let page = 0; page < 1_000; page++) {
      if (Date.now() > deadline) {
        throw new Error('Eightfold elapsed-time budget exhausted');
      }

      const result = await search(listings.size);

      expected ??= result.count;

      if (result.count !== expected || (!result.positions.length && listings.size < expected)) {
        throw new Error('Eightfold inventory changed or pagination ended early');
      }

      for (const job of result.positions) {
        if (listings.has(job.id) || job.isPrivate) {
          throw new Error('Eightfold repeated or returned a private posting');
        }

        this.validateUrl(job.canonicalPositionUrl, source.endpoint, job.id);
        listings.set(job.id, job);
      }

      if (listings.size > expected) {
        throw new Error('Eightfold exceeds the advertised total');
      }

      if (listings.size === expected) {
        break;
      }
    }

    if (listings.size !== expected) {
      throw new Error('Eightfold page budget exhausted');
    }

    const postings: ExtractedPosting[] = [];
    let excluded = 0;

    for (const [id] of listings) {
      if (Date.now() > deadline) {
        throw new Error('Eightfold detail budget exhausted');
      }

      const url = new URL(`${source.endpoint}/${id}`);

      url.searchParams.set('domain', 'netflix.com');

      const raw = await this.http.get(url.href);

      rawResponses.push(raw);

      const job = decode(detail, raw.body);

      if (job.id !== id || job.isPrivate) {
        throw new Error('Eightfold detail identity/private state changed');
      }

      this.validateUrl(job.canonicalPositionUrl, source.endpoint, id);

      if (vacancyExcluded(job.name)) {
        excluded++;
        continue;
      }

      postings.push({
        sourcePostingId: id,
        title: job.name,
        url: job.canonicalPositionUrl,
        applyUrl: job.canonicalPositionUrl,
        descriptionHtml: job.job_description,
        departments: [job.department],
        locations: job.locations,
        workplace: workplace(job.work_location_option ?? job.custom_JD?.data_fields.work_type?.[0]),
        employment: 'unknown',
        publishedAt: job.t_create ? new Date(job.t_create * 1_000).toISOString() : null,
      });
    }

    const final = await search(0);

    if (final.count !== expected || final.positions.some((job) => !listings.has(job.id))) {
      throw new Error('Eightfold inventory changed during detail retrieval');
    }

    return { postings, rawResponses, excluded, enumerationComplete: true };
  }

  private validateUrl(value: string, endpoint: string, id: string) {
    const url = new URL(value);

    if (url.origin !== new URL(endpoint).origin || url.pathname !== `/careers/job/${id}`) {
      throw new Error('Eightfold returned a foreign posting link');
    }
  }
}
