import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Source } from '../../domain/model.js';

const url = z.url().refine((value) => {
  const parsed = new URL(value);

  return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port;
}, 'Audit URLs must use HTTPS without credentials or a custom port');

const review = z
  .object({
    status: z.enum(['pending', 'approved', 'blocked']),
    reviewer: z.string().trim().min(1).optional(),
    reviewedAt: z.iso.datetime().optional(),
    notes: z.string().trim().min(1),
    evidenceUrls: z.array(url).min(1).max(10),
  })
  .superRefine((value, context) => {
    if (value.status === 'approved' && (!value.reviewer || !value.reviewedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Approval requires a reviewer and review timestamp',
      });
    }
  });

export const auditPlanSchema = z.object({
  companySlug: z.string().regex(/^[a-z0-9-]+$/),
  scope: review,
  access: review.safeExtend({
    display: z
      .enum([
        'pending',
        'private_full_descriptions',
        'public_full_descriptions',
        'links_only',
        'blocked',
      ])
      .default('pending'),
    reviewedDocuments: z
      .array(z.object({ url, sha256: z.string().regex(/^[a-f0-9]{64}$/) }))
      .default([]),
  }),
  reconciliation: z.enum(['posting_ids', 'greenhouse_requisition_variants']).default('posting_ids'),
  channels: z
    .array(
      z.object({
        url,
        disposition: z.enum(['included', 'excluded', 'pending']),
        sourceIds: z.array(z.string()),
        reason: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(20),
  pages: z
    .array(
      z.object({
        url,
        role: z.enum(['discovery', 'listings']),
        sourceIds: z.array(z.string()),
        complete: z.boolean(),
        selector: z.string().min(1).default('a[href]'),
        emptySelector: z.string().min(1).optional(),
        boardArray: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export type AuditPlan = z.infer<typeof auditPlanSchema>;

export const auditReportSchema = z.object({
  version: z.literal(1),
  companySlug: z.string(),
  observedAt: z.iso.datetime(),
  configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
  artifactDirectory: z.string(),
  blockers: z.array(z.string()),
  policies: z.array(
    z.object({
      url: z.string(),
      textSha256: z.string(),
      rawSha256: z.string(),
      robotsUrl: z.string(),
      robotsSha256: z.string(),
      error: z.string().nullable(),
    }),
  ),
  pages: z.array(
    z.object({
      url: z.string(),
      sha256: z.string(),
      robotsUrl: z.string(),
      robotsSha256: z.string(),
      links: z.array(z.string()),
      discoveredBoards: z.array(z.string()),
      paginationHints: z.array(z.string()),
      error: z.string().nullable(),
    }),
  ),
  sources: z.array(
    z.object({
      sourceId: z.string(),
      feedCount: z.number().int().nonnegative(),
      officialCount: z.number().int().nonnegative(),
      excludedCount: z.number().int().nonnegative(),
      matchedCount: z.number().int().nonnegative(),
      missingFromFeed: z.array(z.string()),
      missingFromOfficial: z.array(z.string()),
      coveredVariants: z.array(
        z.object({
          feedId: z.string(),
          officialId: z.string(),
          requisitionId: z.string(),
        }),
      ),
      invalidDetails: z.array(z.string()),
      enumerationComplete: z.boolean(),
      officialEnumerationReviewed: z.boolean(),
      officiallyLinked: z.boolean(),
      feedHashes: z.array(z.string()),
      samples: z.array(
        z.object({ id: z.string(), title: z.string(), url: z.string(), applyUrl: z.string() }),
      ),
      error: z.string().nullable(),
    }),
  ),
});

export type AuditReport = z.infer<typeof auditReportSchema>;

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function configurationHash(plan: AuditPlan, sources: Source[]): string {
  return hash(
    JSON.stringify({
      plan,
      sources: sources
        .map(({ id, companySlug, provider, board, endpoint, postingHosts, employerFilter }) => ({
          id,
          companySlug,
          provider,
          board,
          ...(endpoint ? { endpoint } : {}),
          ...(postingHosts ? { postingHosts } : {}),
          ...(employerFilter ? { employerFilter } : {}),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  );
}

export function auditBlockers(report: AuditReport): string[] {
  return [
    ...report.blockers,
    ...report.pages.filter((page) => page.error).map((page) => `${page.url}: ${page.error}`),
    ...report.policies
      .filter((policy) => policy.error)
      .map((policy) => `${policy.url}: ${policy.error}`),
    ...report.sources.flatMap((source) => {
      const reasons: string[] = [];

      if (source.error) {
        reasons.push(source.error);
      }

      if (!source.enumerationComplete) {
        reasons.push('feed traversal incomplete');
      }

      if (!source.officialEnumerationReviewed) {
        reasons.push('official listing traversal not reviewed');
      }

      if (!source.officiallyLinked) {
        reasons.push('no official employer link to this board');
      }

      if (source.missingFromFeed.length) {
        reasons.push(`${source.missingFromFeed.length} official IDs missing from feed`);
      }

      if (source.missingFromOfficial.length) {
        reasons.push(
          `${source.missingFromOfficial.length} feed IDs absent from official inventory`,
        );
      }

      if (source.invalidDetails.length) {
        reasons.push(`${source.invalidDetails.length} invalid details/application links`);
      }

      if (
        !source.error &&
        (source.feedCount !==
          source.matchedCount + source.missingFromOfficial.length + source.coveredVariants.length ||
          source.officialCount !== source.matchedCount + source.missingFromFeed.length)
      ) {
        reasons.push('identity counts do not reconcile');
      }

      return reasons.map((reason) => `${source.sourceId}: ${reason}`);
    }),
  ].filter((value, index, all) => all.indexOf(value) === index);
}

export function assertAuditEvidence(
  input: unknown,
  plan: AuditPlan,
  sources: Source[],
  now = new Date(),
): void {
  const report = auditReportSchema.parse(input);
  const age = now.getTime() - Date.parse(report.observedAt);

  if (
    report.companySlug !== plan.companySlug ||
    report.configurationHash !== configurationHash(plan, sources)
  ) {
    throw new Error('Audit evidence does not match current company/source configuration');
  }

  if (age < 0 || age > 30 * 24 * 60 * 60_000) {
    throw new Error('Audit evidence is expired or future-dated; run a new audit');
  }

  if (
    report.sources.length !== sources.length ||
    new Set(report.sources.map((source) => source.sourceId)).size !== sources.length ||
    sources.some((source) => !report.sources.some((result) => result.sourceId === source.id))
  ) {
    throw new Error('Audit evidence must include every configured company source');
  }

  const blockers = auditBlockers(report);

  for (const url of plan.access.evidenceUrls) {
    const policy = report.policies.find((entry) => entry.url === url && !entry.error);

    if (
      !policy ||
      !plan.access.reviewedDocuments.some(
        (document) => document.url === url && document.sha256 === policy.textSha256,
      )
    ) {
      blockers.push(`Access policy is unreviewed or changed: ${url}`);
    }
  }

  if (!['private_full_descriptions', 'public_full_descriptions'].includes(plan.access.display)) {
    blockers.push('Full-description display is not approved');
  }

  if (plan.scope.status !== 'approved' || plan.access.status !== 'approved' || blockers.length) {
    throw new Error(
      `Audit has not passed: ${blockers.join('; ') || 'scope/access approval pending'}`,
    );
  }
}
