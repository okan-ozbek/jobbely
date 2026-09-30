import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Company, Source } from '../domain/model.js';
import { requireVerifiedEvidence } from './audits/registry.js';

const companySchema = z.object({
  slug: z.string(),
  name: z.string(),
  careersUrl: z.url(),
  logoUrl: z
    .string()
    .regex(/^\/logos\/[a-z0-9-]+\.(png|jpg|svg)$/)
    .default('/logos/default.svg'),
  wave: z.enum(['A', 'B', 'C']),
});

const sourceSchema = z
  .object({
    id: z.string(),
    companySlug: z.string(),
    provider: z.enum([
      'greenhouse',
      'ashby',
      'lever',
      'workday',
      'icims',
      'linkedin',
      'apple',
      'amazon',
      'eightfold',
      'meta',
      'google',
    ]),
    board: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    auditStatus: z.enum(['candidate', 'verified']),
    scheduled: z.boolean(),
    endpoint: z.url().optional(),
    postingHosts: z
      .array(z.string().regex(/^[a-z0-9.-]+$/))
      .min(1)
      .max(5)
      .optional(),
    employerFilter: z
      .object({
        field: z.enum(['brand', 'hiring_organization']),
        values: z.array(z.string().trim().min(1)).min(1).max(5),
      })
      .optional(),
  })
  .superRefine((source, context) => {
    if (source.provider !== 'icims' && (source.postingHosts || source.employerFilter)) {
      context.addIssue({
        code: 'custom',
        message: 'Employer membership and posting host aliases are iCIMS settings',
      });
    }

    const nativeEndpoints: Record<string, { board: string; endpoint: string }> = {
      apple: { board: 'apple', endpoint: 'https://jobs.apple.com/en-us/search' },
      amazon: { board: 'amazon', endpoint: 'https://www.amazon.jobs/en/search.json' },
      eightfold: {
        board: 'netflix',
        endpoint: 'https://explore.jobs.netflix.net/api/apply/v2/jobs',
      },
    };

    const native = nativeEndpoints[source.provider];

    if (native) {
      if (
        source.endpoint !== native.endpoint ||
        source.board !== native.board ||
        source.companySlug !== native.board
      ) {
        context.addIssue({ code: 'custom', message: 'Invalid native employer endpoint or board' });
      }

      return;
    }

    if (source.provider !== 'workday' && source.provider !== 'icims') {
      if (source.endpoint) {
        context.addIssue({ code: 'custom', message: 'This provider does not accept an endpoint' });
      }

      return;
    }

    if (!source.endpoint) {
      context.addIssue({ code: 'custom', message: 'Enterprise providers require an endpoint' });

      return;
    }

    const url = new URL(source.endpoint);

    const validPath =
      source.provider === 'workday'
        ? new RegExp(`^/wday/cxs/[a-zA-Z0-9_-]+/${source.board}/jobs$`).test(url.pathname) &&
          /^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/.test(url.hostname)
        : url.pathname === '/api/jobs';

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !validPath
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid public enterprise endpoint' });
    }
  });

export function loadRegistry(options: { validateAudits?: boolean } = {}): {
  companies: Company[];
  sources: Source[];
} {
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

  if (options.validateAudits !== false) {
    requireVerifiedEvidence(sources);
  }

  return { companies, sources };
}
