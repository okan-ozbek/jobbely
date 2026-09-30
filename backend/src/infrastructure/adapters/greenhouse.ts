import { z } from "zod";
import type { Source } from "../../domain/model.js";
import type { JsonTransport, SourceAdapter } from "../../ports/ingestion.js";
import {
  decode,
  httpsUrl,
  identifier,
  text,
  vacancyExcluded,
} from "./schemas.js";
const responseSchema = z.object({
  jobs: z.array(
    z.object({
      id: identifier,
      internal_job_id: z.union([z.number(), z.null()]).optional(),
      title: text,
      absolute_url: httpsUrl,
      content: text,
      location: z.object({ name: z.string() }),
      departments: z.array(z.object({ name: text })).default([]),
      offices: z
        .array(z.object({ name: z.string(), location: z.string().nullish() }))
        .default([]),
    }),
  ),
  meta: z.object({ total: z.number().int().nonnegative() }),
});
export class GreenhouseAdapter implements SourceAdapter {
  constructor(private readonly http: JsonTransport) {}
  async extract(source: Source) {
    const raw = await this.http.get(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`,
    );
    const response = decode(responseSchema, raw.body);
    if (response.jobs.length !== response.meta.total)
      throw new Error("Greenhouse count does not match advertised total");
    const vacancies = response.jobs.filter(
      (job) => job.internal_job_id !== null && !vacancyExcluded(job.title),
    );
    return {
      rawResponses: [raw],
      excluded: response.jobs.length - vacancies.length,
      enumerationComplete: true,
      postings: vacancies.map((job) => ({
        sourcePostingId: job.id,
        title: job.title,
        url: job.absolute_url,
        applyUrl: job.absolute_url,
        descriptionHtml: job.content,
        departments: job.departments.map((item) => item.name),
        locations: [
          ...new Set(
            [
              job.location.name,
              ...job.offices.map((office) => office.location ?? office.name),
            ].filter(Boolean),
          ),
        ],
        workplace: "unknown" as const,
        employment: "unknown",
        publishedAt: null,
      })),
    };
  }
}
