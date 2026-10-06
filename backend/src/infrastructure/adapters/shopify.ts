import { load } from 'cheerio';
import { z } from 'zod';
import type { Extraction, Source } from '../../domain/model.js';
import type { HtmlTransport, SourceAdapter } from '../../ports/ingestion.js';
import { htmlPreparation } from '../html.js';
import { decode, httpsUrl, text, vacancyExcluded, workplace } from './schemas.js';

const endpoint = 'https://www.shopify.com/careers';
const reference = z.number().int().nonnegative();
const uuid = z.uuid();

const headerSchema = z.object({
  id: uuid,
  jobId: uuid,
  title: text,
  status: z.literal('Published'),
  isListed: z.boolean(),
  departmentName: text.optional(),
  teamName: text.optional(),
  locationName: text,
  workplaceType: text.optional(),
  employmentType: text.optional(),
  publishedDate: z.iso.date().optional(),
  externalLink: httpsUrl,
  applyLink: httpsUrl,
  primaryLocationId: uuid,
  secondaryLocationIds: z.array(uuid),
});

type Header = z.infer<typeof headerSchema>;

const headerFields = [
  'id',
  'jobId',
  'title',
  'status',
  'isListed',
  'departmentName',
  'teamName',
  'locationName',
  'workplaceType',
  'employmentType',
  'publishedDate',
  'externalLink',
  'applyLink',
] as const;

/** Read only selected public fields from the literal reference table, never execute scripts. */
class ShopifyPage {
  private readonly cells: unknown[];
  private readonly fields = new Map<number, ReadonlyMap<string, number>>();

  constructor(html: string) {
    const document = load(html);

    const matches = document('script')
      .toArray()
      .flatMap((script) => [
        ...document(script)
          .text()
          .matchAll(
            /window\.__reactRouterContext\.streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g,
          ),
      ]);

    if (matches.length !== 1) {
      throw new Error('Shopify page lacks unambiguous public hydration data');
    }

    const encoded = decode(z.string(), JSON.parse(matches[0]![1]!));

    this.cells = decode(z.array(z.unknown()).min(1).max(100_000), JSON.parse(encoded));
  }

  value(index: number): unknown {
    if (!Number.isInteger(index) || index < 0 || index >= this.cells.length) {
      throw new Error('Shopify hydration contains an invalid public-field reference');
    }

    return this.cells[index];
  }

  field(index: number, name: string): number | undefined {
    const cached = this.fields.get(index);

    if (cached) {
      return cached.get(name);
    }

    const record = decode(
      z.record(z.string().regex(/^_\d+$/), z.number().int()),
      this.value(index),
    );

    const fields = new Map<string, number>();

    if (Object.keys(record).length > 128) {
      throw new Error('Shopify hydration public record exceeds its field budget');
    }

    for (const [key, target] of Object.entries(record)) {
      const property = decode(text, this.value(Number(key.slice(1))));

      if (fields.has(property)) {
        throw new Error('Shopify hydration contains duplicate property names');
      }

      fields.set(property, target);
    }

    this.fields.set(index, fields);

    return fields.get(name);
  }

  required(index: number, name: string): number {
    const target = this.field(index, name);

    if (target === undefined) {
      throw new Error(`Shopify hydration is missing ${name}`);
    }

    return target;
  }

  scalar(index: number, name: string): unknown {
    const target = this.field(index, name);

    return target === undefined ? undefined : this.value(target);
  }

  array(index: number): number[] {
    return decode(z.array(reference).max(2_000), this.value(index));
  }

  route(name: string): number {
    return this.required(this.required(0, 'loaderData'), name);
  }

  header(index: number): Header {
    const locations = this.required(index, 'locationIds');

    return decode(headerSchema, {
      ...Object.fromEntries(headerFields.map((field) => [field, this.scalar(index, field)])),
      primaryLocationId: this.scalar(locations, 'primaryLocationId'),
      secondaryLocationIds: this.array(this.required(locations, 'secondaryLocationIds')).map((id) =>
        this.value(id),
      ),
    });
  }
}

function validateLinks(job: Header): void {
  for (const link of [job.externalLink, job.applyLink]) {
    if (link !== `${endpoint}?ashby_jid=${job.id}`) {
      throw new Error(`Shopify posting ${job.id} has an inconsistent employer link`);
    }
  }
}

function inventory(html: string) {
  const page = new ShopifyPage(html);
  const route = page.route('($locale)/careers');
  const rows = page.array(page.required(route, 'jobPostingsWithJobs'));
  const jobs = new Map<string, Header>();
  const locations = new Map<string, string>();

  if (!rows.length || page.scalar(route, 'canonicalUrl') !== endpoint) {
    throw new Error('Shopify has an empty or filtered public inventory');
  }

  for (const index of page.array(page.required(route, 'atsLocations'))) {
    const location = decode(z.object({ id: uuid, name: text }), {
      id: page.scalar(index, 'id'),
      name: page.scalar(index, 'name'),
    });

    if (locations.has(location.id)) {
      throw new Error('Shopify has duplicate location IDs');
    }

    locations.set(location.id, location.name);
  }

  for (const index of rows) {
    const job = page.header(page.required(index, 'jobPosting'));

    validateLinks(job);

    if (jobs.has(job.id) || page.scalar(page.required(index, 'job'), 'id') !== job.jobId) {
      throw new Error(`Shopify posting ${job.id} has a duplicate or mismatched job identity`);
    }

    for (const locationId of [job.primaryLocationId, ...job.secondaryLocationIds]) {
      if (!locations.has(locationId)) {
        throw new Error(`Shopify posting ${job.id} references an unknown location`);
      }
    }

    jobs.set(job.id, job);
  }

  return { jobs, locations };
}

// This is the canonical title-to-path transformation used by Shopify's public listing component.
function detailUrl(job: Header): string {
  const slug = job.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) {
    throw new Error(`Shopify posting ${job.id} lacks a usable public title slug`);
  }

  return `${endpoint}/${slug}_${job.id}`;
}

/** Shopify's public HTML embeds the full list and separate complete posting descriptions. */
export class ShopifyAdapter implements SourceAdapter {
  constructor(private readonly http: HtmlTransport) {}

  async extract(source: Source): Promise<Extraction> {
    if (
      source.provider !== 'shopify' ||
      source.companySlug !== 'shopify' ||
      source.board !== 'shopify' ||
      source.endpoint !== endpoint
    ) {
      throw new Error('Shopify requires its exact public employer endpoint and board');
    }

    const deadline = Date.now() + 2 * 60 * 60_000;
    const first = await this.http.getHtml(endpoint);
    const initial = inventory(first.body);
    const rawResponses: Extraction['rawResponses'] = [first];
    const postings: Extraction['postings'] = [];
    let excluded = 0;

    for (const job of initial.jobs.values()) {
      if (!job.isListed || vacancyExcluded(job.title)) {
        excluded++;
        continue;
      }

      if (Date.now() > deadline) {
        throw new Error('Shopify extraction budget exhausted');
      }

      const url = detailUrl(job);
      const raw = await this.http.getHtml(url);
      const page = new ShopifyPage(raw.body);
      const route = page.route('($locale)/careers/$posting');
      const index = page.required(route, 'jobPosting');
      const header = page.header(index);

      if (
        page.scalar(route, 'canonicalUrl') !== url ||
        JSON.stringify(header) !== JSON.stringify(job)
      ) {
        throw new Error(`Shopify posting ${job.id} changed or returned a mismatched detail`);
      }

      const descriptionHtml = decode(text, page.scalar(index, 'descriptionHtml'));

      if (!htmlPreparation.prepare(descriptionHtml).text) {
        throw new Error(`Shopify posting ${job.id} has no readable job description`);
      }

      rawResponses.push(raw);

      postings.push({
        sourcePostingId: job.id,
        title: job.title,
        url,
        applyUrl: job.applyLink,
        descriptionHtml,
        departments: [
          ...new Set(
            [job.departmentName, job.teamName].filter((item): item is string => Boolean(item)),
          ),
        ],
        locations: [
          ...new Set([
            job.locationName,
            ...[job.primaryLocationId, ...job.secondaryLocationIds].map((id) =>
              initial.locations.get(id)!,
            ),
          ]),
        ],
        workplace: workplace(job.workplaceType),
        employment: job.employmentType ?? 'unknown',
        publishedAt: job.publishedDate ?? null,
      });
    }

    if (Date.now() > deadline) {
      throw new Error('Shopify extraction budget exhausted');
    }

    const final = await this.http.getHtml(endpoint);
    const checked = inventory(final.body);

    if (
      checked.jobs.size !== initial.jobs.size ||
      [...initial.jobs].some(
        ([id, job]) => JSON.stringify(checked.jobs.get(id)) !== JSON.stringify(job),
      ) ||
      checked.locations.size !== initial.locations.size ||
      [...initial.locations].some(([id, name]) => checked.locations.get(id) !== name)
    ) {
      throw new Error('Shopify inventory changed during extraction; retry later');
    }

    rawResponses.push(final);

    return { postings, rawResponses, excluded, enumerationComplete: true };
  }
}
