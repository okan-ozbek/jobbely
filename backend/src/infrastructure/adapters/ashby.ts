import { z } from 'zod';
import type { Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { decode, httpsUrl, text, vacancyExcluded, workplace } from './schemas.js';

export const ashbyBoardPattern = /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/;

const compensationSchema = z.object({
  compensationTierSummary: z.string().nullish(),
  scrapeableCompensationSalarySummary: z.string().nullish(),
  compensationTiers: z
    .array(
      z.object({
        title: z.string().nullish(),
        tierSummary: z.string().nullish(),
        additionalInformation: z.string().nullish(),
        components: z
          .array(
            z.object({
              summary: text,
              interval: z.string().nullish(),
              currencyCode: z.string().nullish(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

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
      shouldDisplayCompensationOnJobPostings: z.boolean().optional(),
      compensation: compensationSchema.nullish(),
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
        descriptionHtml:
          job.descriptionHtml +
          compensationHtml(job.compensation, job.shouldDisplayCompensationOnJobPostings),
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

function compensationHtml(
  compensation: z.infer<typeof compensationSchema> | null | undefined,
  display: boolean | undefined,
): string {
  if (!compensation || display === false) {
    return '';
  }

  const summary =
    compensation.compensationTierSummary || compensation.scrapeableCompensationSalarySummary;

  const tiers = compensation.compensationTiers
    .map((tier) =>
      [
        tier.title ? `<h4>${escapeText(tier.title)}</h4>` : '',
        tier.tierSummary ? `<p>${escapeText(tier.tierSummary)}</p>` : '',
        ...tier.components.map((component) => {
          const labels = [
            component.interval === 'NONE' ? null : component.interval,
            component.currencyCode,
          ].filter(Boolean);

          return `<p>${escapeText(component.summary)}${labels.length ? ` (${escapeText(labels.join(', '))})` : ''}</p>`;
        }),
        tier.additionalInformation ? `<p>${escapeText(tier.additionalInformation)}</p>` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);

  if (!summary && !tiers.length) {
    return '';
  }

  return (
    '\n<h3>Compensation</h3>\n' +
    [summary ? `<p>${escapeText(summary)}</p>` : '', ...tiers].filter(Boolean).join('\n')
  );
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
