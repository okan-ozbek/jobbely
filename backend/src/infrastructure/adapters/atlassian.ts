import { z } from 'zod';
import type { Extraction, Source } from '../../domain/model.js';
import type { JsonTransport, SourceAdapter } from '../../ports/ingestion.js';
import { htmlPreparation } from '../html.js';
import { decode, httpsUrl, text, vacancyExcluded } from './schemas.js';

const endpoint = 'https://www.atlassian.com/endpoint/careers/listings';

export const atlassianPortalHosts: Readonly<Record<number, string>> = {
  17: 'globalcareers-atlassian.icims.com',
  242: 'careers-apac-atlassian.icims.com',
  111: 'careers-americas.icims.com',
  250: 'campus-globalcareers-atlassian.icims.com',
  251: 'campus-americas.icims.com',
  193343: 'globalmobility-careers-atlassian.icims.com',
};

const jobSchema = z.object({
  id: z.number().int().positive(),
  portalId: z.number().int().positive(),
  portalJobPost: z.object({
    id: z.number().int().positive(),
    portalId: z.number().int().positive(),
    portalUrl: httpsUrl,
  }),
  title: text,
  type: text.nullish(),
  locations: z.array(text),
  category: text,
  overview: z.string().nullish(),
  responsibilities: z.string().nullish(),
  qualifications: z.string().nullish(),
  compensation: z.string().nullish(),
  payRanges: z.string().nullish(),
  applyUrl: httpsUrl,
});

type Job = z.infer<typeof jobSchema>;

function inventory(body: unknown): Map<number, Job> {
  // The official site consumes this entire array without server-side pagination.
  // An empty array has no independent total and cannot establish a complete inventory.
  const rows = decode(z.array(jobSchema).min(1).max(10_000), body);
  const jobs = new Map<number, Job>();

  for (const job of rows) {
    const previous = jobs.get(job.id);

    if (previous && JSON.stringify(previous) !== JSON.stringify(job)) {
      throw new Error(`Atlassian has conflicting records for posting ${job.id}`);
    }

    jobs.set(job.id, job);
  }

  return jobs;
}

function validateLinks(job: Job): void {
  const posting = new URL(job.portalJobPost.portalUrl);
  const application = new URL(job.applyUrl);

  if (
    job.portalJobPost.id !== job.id ||
    job.portalJobPost.portalId !== job.portalId ||
    posting.hostname !== atlassianPortalHosts[job.portalId] ||
    !new RegExp(`^/jobs/${job.id}/[^/]+/job$`).test(posting.pathname) ||
    posting.search ||
    posting.hash ||
    application.origin !== posting.origin ||
    application.pathname !== posting.pathname ||
    application.search !== '?mode=apply' ||
    application.hash
  ) {
    throw new Error(`Atlassian posting ${job.id} has inconsistent identity or employer links`);
  }
}

/** Native employer aggregate; iCIMS Jibe search payloads are a different adapter. */
export class AtlassianAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}

  async extract(source: Source): Promise<Extraction> {
    if (
      source.provider !== 'atlassian' ||
      source.companySlug !== 'atlassian' ||
      source.board !== 'atlassian' ||
      source.endpoint !== endpoint
    ) {
      throw new Error('Atlassian requires its exact native employer endpoint and board');
    }

    const first = await this.http.get(endpoint);
    const jobs = inventory(first.body);
    const postings: Extraction['postings'] = [];
    let excluded = 0;

    for (const job of jobs.values()) {
      validateLinks(job);

      if (vacancyExcluded(job.title)) {
        excluded++;
        continue;
      }

      const sections = [
        ['Overview', job.overview],
        ['Responsibilities', job.responsibilities],
        ['Qualifications', job.qualifications],
        ['Compensation', job.compensation],
        ['Pay ranges', job.payRanges],
      ] as const;

      if (
        !sections.slice(0, 3).some(([, content]) => htmlPreparation.prepare(content ?? '').text)
      ) {
        throw new Error(`Atlassian posting ${job.id} has no readable job description`);
      }

      postings.push({
        sourcePostingId: String(job.id),
        title: job.title,
        url: job.portalJobPost.portalUrl,
        applyUrl: job.applyUrl,
        descriptionHtml: sections
          .filter(([, content]) => content)
          .map(([heading, content]) => `<h2>${heading}</h2>${content}`)
          .join('\n'),
        departments: [job.category],
        locations: job.locations,
        workplace: 'unknown',
        employment: job.type ?? 'unknown',
        publishedAt: null,
      });
    }

    const second = await this.http.get(endpoint);
    const checked = inventory(second.body);

    if (
      jobs.size !== checked.size ||
      [...jobs].some(([id, job]) => JSON.stringify(checked.get(id)) !== JSON.stringify(job))
    ) {
      throw new Error('Atlassian inventory changed during extraction; retry later');
    }

    return { postings, rawResponses: [first, second], excluded, enumerationComplete: true };
  }
}
