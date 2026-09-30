import { z } from 'zod';
import type { Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, text, vacancyExcluded, workplace } from './schemas.js';

const responseSchema = z.object({
  apiVersion: z.string(),
  jobs: z.array(
    z.object({
      id: text.optional(),
      title: text,
      jobUrl: httpsUrl,
      applyUrl: httpsUrl,
      descriptionHtml: text,
      department: z.string().optional(),
      team: z.string().optional(),
      location: z.string(),
      secondaryLocations: z.array(z.object({ location: z.string() })).default([]),
      isListed: z.boolean(),
      isRemote: z.boolean().nullish(),
      workplaceType: z.string().nullish(),
      employmentType: z.string().optional(),
      publishedAt: z.iso.datetime({ offset: true }).optional(),
    }),
  ),
});

export class AshbyAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}

  async extract(source: Source) {
    const raw = await this.http.get(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.board)}?includeCompensation=true`,
    );

    const response = decode(responseSchema, raw.body);

    if (response.apiVersion !== '1') {
      throw new Error(`Unsupported Ashby API version: ${response.apiVersion}`);
    }

    const vacancies = response.jobs.filter((job) => job.isListed && !vacancyExcluded(job.title));

    return {
      rawResponses: [raw],
      excluded: response.jobs.length - vacancies.length,
      enumerationComplete: true,
      postings: vacancies.map((job) => ({
        sourcePostingId: job.id ?? job.jobUrl,
        title: job.title,
        url: job.jobUrl,
        applyUrl: job.applyUrl,
        descriptionHtml: job.descriptionHtml,
        departments: [job.department, job.team].filter((item): item is string => Boolean(item)),
        locations: [
          ...new Set(
            [job.location, ...job.secondaryLocations.map((item) => item.location)].filter(Boolean),
          ),
        ],
        workplace: workplace(job.workplaceType ?? job.isRemote ?? undefined),
        employment: job.employmentType ?? 'unknown',
        publishedAt: job.publishedAt ?? null,
      })),
    };
  }
}
