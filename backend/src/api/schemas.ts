import { Type } from '@sinclair/typebox';

/**
 * SUMMARY: This file contains the TypeBox schemas used for validating and typing the API requests and responses.
 * DESCRIPTION: Each schema defines the structure and constraints for the corresponding API entity or request parameter.
 * USAGE: Import the required schemas from this file to validate and type your API requests and responses.
 */

const nullableString = Type.Union([Type.String(), Type.Null()]);

export const classificationSchema = Type.Object({
  category: Type.String(),
  method: Type.String(),
  rule: Type.String(),
  evidence: Type.String(),
  version: Type.String(),
});

export const jobSchema = Type.Object({
  id: Type.String(),
  sourceId: Type.String(),
  companySlug: Type.String(),
  sourcePostingId: Type.String(),
  title: Type.String(),
  url: Type.String(),
  applyUrl: Type.String(),
  descriptionHtml: Type.String(),
  descriptionText: Type.String(),
  departments: Type.Array(Type.String()),
  locations: Type.Array(Type.String()),
  workplace: Type.Union([
    Type.Literal('remote'),
    Type.Literal('hybrid'),
    Type.Literal('onsite'),
    Type.Literal('unknown'),
  ]),
  employment: Type.String(),
  publishedAt: nullableString,
  classification: classificationSchema,
  status: Type.Union([Type.Literal('active'), Type.Literal('closed')]),
  firstSeenAt: Type.String(),
  lastSeenAt: Type.String(),
  missingSince: nullableString,
});

export const companySchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  careersUrl: Type.String(),
  logoUrl: Type.String(),
  wave: Type.String(),
  status: Type.Union(
    ['not_onboarded', 'partial', 'stale', 'blocked', 'healthy', 'demo'].map((value) =>
      Type.Literal(value),
    ),
  ),
  jobs: Type.Integer(),
  lastCheckedAt: nullableString,
  verification: Type.Optional(
    Type.Object({
      status: Type.Union(['verified', 'partial', 'pending'].map((value) => Type.Literal(value))),
      checkedAt: nullableString,
      accessStatus: Type.Union(
        ['approved', 'unreviewed', 'blocked'].map((value) => Type.Literal(value)),
      ),
      blockers: Type.Array(Type.String()),
    }),
  ),
  sources: Type.Array(
    Type.Object({
      id: Type.String(),
      provider: Type.String(),
      auditStatus: Type.String(),
      scheduled: Type.Boolean(),
      lastRunStatus: nullableString,
    }),
  ),
});

export const filterSchema = Type.Object(
  {
    q: Type.Optional(Type.String({ maxLength: 200 })),
    company: Type.Optional(Type.String({ maxLength: 500 })),
    category: Type.Optional(Type.String({ maxLength: 500 })),
    country: Type.Optional(Type.String({ pattern: '^[A-Za-z]{2}$' })),
    city: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    workplace: Type.Optional(
      Type.String({
        pattern: '^(remote|hybrid|onsite|unknown)(,(remote|hybrid|onsite|unknown))*$',
      }),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    cursor: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false },
);

export const errorSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

export const listSchema = Type.Object({
  items: Type.Array(jobSchema),
  total: Type.Integer(),
  nextCursor: nullableString,
  datasetVersion: Type.Integer(),
  mode: Type.Union([Type.Literal('demo'), Type.Literal('postgres')]),
});

const facet = Type.Array(Type.Object({ value: Type.String(), count: Type.Integer() }));

export const facetsSchema = Type.Object({
  companies: facet,
  categories: facet,
  workplaces: facet,
  countries: Type.Array(
    Type.Object({ value: Type.String(), name: Type.String(), count: Type.Integer() }),
  ),
  cities: facet,
});
