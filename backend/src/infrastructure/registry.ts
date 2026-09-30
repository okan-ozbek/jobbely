import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Company, Source } from '../domain/model.js';

const companySchema = z.object({
  slug: z.string(),
  name: z.string(),
  careersUrl: z.url(),
  wave: z.enum(['A', 'B', 'C']),
});

const sourceSchema = z.object({
  id: z.string(),
  companySlug: z.string(),
  provider: z.enum(['greenhouse', 'ashby', 'lever']),
  board: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  auditStatus: z.enum(['candidate', 'verified']),
  scheduled: z.boolean(),
});

export function loadRegistry(): { companies: Company[]; sources: Source[] } {
  const companies = z
    .array(companySchema)
    .parse(
      JSON.parse(readFileSync(new URL('../../config/companies.json', import.meta.url), 'utf8')),
    );

  const sources = z
    .array(sourceSchema)
    .parse(JSON.parse(readFileSync(new URL('../../config/sources.json', import.meta.url), 'utf8')));

  if (
    new Set(companies.map((company) => company.slug)).size !== companies.length ||
    new Set(sources.map((source) => source.id)).size !== sources.length
  ) {
    throw new Error('Duplicate registry IDs');
  }

  for (const source of sources) {
    if (!companies.some((company) => company.slug === source.companySlug)) {
      throw new Error(`Unknown company: ${source.companySlug}`);
    }

    if (source.scheduled && source.auditStatus !== 'verified') {
      throw new Error(`Unaudited source cannot be scheduled: ${source.id}`);
    }
  }

  return { companies, sources };
}
