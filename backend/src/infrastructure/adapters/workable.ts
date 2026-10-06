import { z } from 'zod';
import type { Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { htmlPreparation } from '../html.js';
import { decode, httpsUrl, text, vacancyExcluded, workplace } from './schemas.js';

const shortcode = z.string().regex(/^[A-F0-9]{10}$/);

const responseSchema = z.object({
  name: text,
  jobs: z
    .array(
      z.object({
        shortcode,
        title: text,
        url: httpsUrl,
        application_url: httpsUrl,
        description: text,
        department: z.string().nullish(),
        function: z.string().nullish(),
        employment_type: z.string().nullish(),
        telecommuting: z.boolean().nullish(),
        published_on: z.iso.date().nullish(),
        country: z.string().nullish(),
        city: z.string().nullish(),
        state: z.string().nullish(),
        locations: z
          .array(
            z.object({
              country: z.string(),
              city: z.string().nullish(),
              region: z.string().nullish(),
              hidden: z.boolean(),
            }),
          )
          .default([]),
      }),
    )
    .max(10_000),
});

export function workableVacancyExcluded(board: string, title: string): boolean {
  return vacancyExcluded(title) || (board === 'huggingface' && /^wild card$/i.test(title.trim()));
}

export class WorkableAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}

  async extract(source: Source) {
    if (source.board !== 'huggingface' || source.companySlug !== 'hugging-face') {
      throw new Error('Unsupported public Workable employer board');
    }

    const url = 'https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true';
    const raw = await this.http.get(url);
    const response = this.validate(raw.body);
    const recheck = await this.http.get(url);
    const current = this.validate(recheck.body);

    const stable = (jobs: typeof response.jobs) =>
      JSON.stringify([...jobs].sort((a, b) => a.shortcode.localeCompare(b.shortcode)));

    if (stable(response.jobs) !== stable(current.jobs)) {
      throw new Error('Workable published inventory changed during extraction');
    }

    const vacancies = response.jobs.filter(
      (job) => !workableVacancyExcluded(source.board, job.title),
    );

    return {
      rawResponses: [raw, recheck],
      excluded: response.jobs.length - vacancies.length,
      enumerationComplete: true,
      postings: vacancies.map((job) => ({
        sourcePostingId: job.shortcode,
        title: job.title,
        url: job.url,
        applyUrl: job.application_url,
        descriptionHtml: job.description,
        departments: [
          ...new Set(
            [job.department, job.function].filter((label): label is string => Boolean(label)),
          ),
        ],
        locations: [
          ...new Set(
            (job.locations.length
              ? job.locations.map((location) =>
                  (location.hidden
                    ? [location.country]
                    : [location.city, location.region, location.country]
                  )
                    .filter(Boolean)
                    .join(', '),
                )
              : [[job.city, job.state, job.country].filter(Boolean).join(', ')]
            ).filter(Boolean),
          ),
        ],
        workplace: workplace(job.telecommuting ?? undefined),
        employment: job.employment_type || 'unknown',
        publishedAt: job.published_on ? `${job.published_on}T00:00:00.000Z` : null,
      })),
    };
  }

  private validate(body: unknown) {
    const response = decode(responseSchema, body);

    if (response.name !== 'Hugging Face') {
      throw new Error('Workable employer name does not match the configured account');
    }

    const seen = new Set<string>();

    for (const job of response.jobs) {
      if (seen.has(job.shortcode)) {
        throw new Error('Workable returned duplicate posting shortcodes');
      }

      seen.add(job.shortcode);

      for (const [value, apply] of [
        [job.url, false],
        [job.application_url, true],
      ] as const) {
        const url = new URL(value);
        const path = new RegExp(`^/(?:huggingface/)?j/${job.shortcode}${apply ? '/apply' : ''}/?$`);

        if (
          url.hostname !== 'apply.workable.com' ||
          !path.test(url.pathname) ||
          url.search ||
          url.hash
        ) {
          throw new Error('Workable posting link does not match its native identity');
        }
      }

      if (!htmlPreparation.prepare(job.description).text) {
        throw new Error('Workable posting has no readable full description');
      }
    }

    return response;
  }
}
