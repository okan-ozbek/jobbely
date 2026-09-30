import { z } from 'zod';
import type { ExtractedPosting, RawResponse, Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, text, vacancyExcluded, workplace } from './schemas.js';

const responseSchema = z.array(
  z.object({
    id: text,
    text: text,
    hostedUrl: httpsUrl,
    applyUrl: httpsUrl,
    description: z.string(),
    lists: z.array(z.object({ text: z.string(), content: z.string() })).default([]),
    additional: z.string().default(''),
    salaryDescription: z.string().default(''),
    categories: z.object({
      location: z.string().optional(),
      allLocations: z.array(z.string()).optional(),
      team: z.string().optional(),
      department: z.string().optional(),
      commitment: z.string().optional(),
    }),
    workplaceType: z.string().optional(),
  }),
);

export class LeverAdapter implements SourceAdapter {
  constructor(
    private readonly http: JsonTransport,
    private readonly pageSize = 100,
  ) {}

  async extract(source: Source) {
    const postings: ExtractedPosting[] = [];
    const rawResponses: RawResponse[] = [];
    const seen = new Set<string>();
    let excluded = 0;

    for (let page = 0; page < 100; page++) {
      const raw = await this.http.get(
        `https://api.lever.co/v0/postings/${encodeURIComponent(source.board)}?mode=json&skip=${page * this.pageSize}&limit=${this.pageSize}`,
      );

      rawResponses.push(raw);

      const jobs = decode(responseSchema, raw.body);

      for (const job of jobs) {
        if (seen.has(job.id)) {
          throw new Error('Lever returned repeated IDs; pagination cannot be trusted');
        }

        seen.add(job.id);

        if (vacancyExcluded(job.text)) {
          excluded++;
          continue;
        }

        postings.push({
          sourcePostingId: job.id,
          title: job.text,
          url: job.hostedUrl,
          applyUrl: job.applyUrl,
          descriptionHtml: [
            job.description,
            ...job.lists.map((list) => `<h3>${escapeHtml(list.text)}</h3>${list.content}`),
            job.additional,
            job.salaryDescription,
          ].join('\n'),
          departments: [job.categories.department, job.categories.team].filter(
            (item): item is string => Boolean(item),
          ),
          locations: [
            ...new Set(
              [...(job.categories.allLocations ?? []), job.categories.location ?? ''].filter(
                Boolean,
              ),
            ),
          ],
          workplace: workplace(job.workplaceType),
          employment: job.categories.commitment ?? 'unknown',
          publishedAt: null,
        });
      }

      if (jobs.length < this.pageSize) {
        return { postings, rawResponses, excluded, enumerationComplete: true };
      }
    }

    throw new Error('Lever pagination exceeded the 100-page budget');
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
