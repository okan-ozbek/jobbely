import { signalSemantics, facetSchema, interpretationSchema } from './semantic-schemas.js';
import { Type } from '@sinclair/typebox';
import { categories } from '../domain/taxonomy.js';
import { supportedFunctions } from '../domain/matching/requirements.js';

const strict = { additionalProperties: false };
const field = Type.String({ maxLength: 200 });

const importance = Type.Union(
  ['required', 'preferred', 'contextual'].map((value) => Type.Literal(value)),
);

const evidence = Type.Object({
  start: Type.Optional(Type.Integer()),
  end: Type.Optional(Type.Integer()),
  excerpt: Type.String(),
  line: Type.Integer(),
  rule: Type.String(),
});

export const requirementsSchema = Type.Object({
  version: Type.String(),
  contentHash: Type.String(),
  category: Type.String(),
  skills: Type.Array(
    Type.Object({
      alternatives: Type.Array(
        Type.Object({
          id: Type.String(),
          name: Type.String(),
          facet: Type.Optional(facetSchema),
          interpretation: Type.Optional(interpretationSchema),
        }),
      ),
      importance,
      evidence,
    }),
  ),
  experience: Type.Array(
    Type.Object({
      minimumMonths: Type.Integer(),
      scope: Type.Union(['professional', 'function', 'skill'].map((value) => Type.Literal(value))),
      skillId: Type.Union([Type.String(), Type.Null()]),
      importance,
      evidence,
    }),
  ),
  constraints: Type.Array(
    Type.Object({
      kind: Type.Union(
        ['location', 'authorization', 'qualification', 'language'].map((value) =>
          Type.Literal(value),
        ),
      ),
      importance,
      evidence,
    }),
  ),
  unparsed: Type.Array(Type.Object({ importance, evidence })),
  locations: Type.Array(Type.String()),
  workplace: Type.Union(
    ['remote', 'hybrid', 'onsite', 'unknown'].map((value) => Type.Literal(value)),
  ),
  warnings: Type.Array(Type.String()),
  truncated: Type.Boolean(),
});

export const matchProfileSchema = Type.Object(
  {
    analysisDate: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
    skills: Type.Array(
      Type.Object(
        {
          ...signalSemantics,
          id: Type.String({ maxLength: 200, minLength: 1 }),
          status: Type.Union(
            (['mentioned', 'work_evidenced', 'learning', 'negated', 'user_confirmed'] as const).map(
              (value) => Type.Literal(value),
            ),
          ),
        },
        strict,
      ),
      { maxItems: 200 },
    ),
    competencies: Type.Optional(
      Type.Array(
        Type.Object(
          {
            ...signalSemantics,
            id: Type.String({ maxLength: 200, minLength: 1 }),
            status: Type.Union(
              (
                ['mentioned', 'work_evidenced', 'learning', 'negated', 'user_confirmed'] as const
              ).map((value) => Type.Literal(value)),
            ),
          },
          strict,
        ),
        { maxItems: 100 },
      ),
    ),
    employment: Type.Array(
      Type.Object(
        {
          employer: field,
          category: Type.Union(categories.map((item) => Type.Literal(item.slug))),
          kind: Type.Union(
            (['employment', 'internship', 'project', 'volunteering'] as const).map((value) =>
              Type.Literal(value),
            ),
          ),
          relationship: Type.Union(
            (['direct', 'client', 'unknown'] as const).map((value) => Type.Literal(value)),
          ),
          start: Type.String({ maxLength: 40 }),
          end: Type.String({ maxLength: 40 }),
        },
        strict,
      ),
      { maxItems: 100 },
    ),
    location: Type.Object(
      {
        value: field,
        status: Type.Union(
          (['extracted', 'uncertain', 'unknown', 'user_confirmed'] as const).map((value) =>
            Type.Literal(value),
          ),
        ),
      },
      strict,
    ),
  },
  strict,
);

export const matchInputSchema = Type.Object(
  {
    profile: matchProfileSchema,
    categories: Type.Array(Type.Union(supportedFunctions.map((value) => Type.Literal(value))), {
      minItems: 1,
      maxItems: 5,
      uniqueItems: true,
    }),
    employerContext: Type.Boolean(),
    limit: Type.Integer({ minimum: 1, maximum: 50 }),
    cursor: Type.Optional(Type.String({ maxLength: 3_000 })),
  },
  strict,
);

export const skillMatchSchema = Type.Object({
  decision: Type.Union(
    ['full', 'partial', 'suggested', 'none'].map((value) => Type.Literal(value)),
  ),
  targetId: Type.String(),
  facet: facetSchema,
  suggestion: Type.Union([
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      facet: facetSchema,
      question: Type.String(),
    }),
    Type.Null(),
  ]),
  confidence: Type.Union(['green', 'yellow', 'purple', 'red'].map((value) => Type.Literal(value))),
  credit: Type.Number(),
  sourceId: Type.Union([Type.String(), Type.Null()]),
  sourceName: Type.Union([Type.String(), Type.Null()]),
  path: Type.Array(
    Type.Object({
      kind: Type.Union(
        ['transferable', 'specialization', 'possible-tool', 'ecosystem'].map((value) =>
          Type.Literal(value),
        ),
      ),
      mode: Type.Union([Type.Literal('partial'), Type.Literal('suggestion')]),
      from: Type.String(),
      to: Type.String(),
      weight: Type.Number(),
      reason: Type.String(),
    }),
  ),
  reason: Type.String(),
});

export const jobMatchInputSchema = Type.Object({ profile: matchProfileSchema }, strict);

export const jobMatchResponseSchema = Type.Object({
  descriptionText: Type.String(),
  skills: Type.Array(
    Type.Object({
      ...skillMatchSchema.properties,
      id: Type.String(),
      name: Type.String(),
      interpretation: interpretationSchema,
      rule: Type.String(),
      position: Type.Integer(),
      length: Type.Integer(),
    }),
  ),
  comparison: Type.Object({
    baseScore: Type.Integer(),
    requiredGaps: Type.Integer(),
    skills: Type.Array(
      Type.Object({
        ...skillMatchSchema.properties,
        names: Type.Array(Type.String()),
        importance: Type.String(),
        status: Type.String(),
        matchedId: Type.Union([Type.String(), Type.Null()]),
        excerpt: Type.String(),
      }),
    ),
    experience: Type.Array(
      Type.Object({
        minimumMonths: Type.Integer(),
        importance: Type.String(),
        candidateMinimumMonths: Type.Integer(),
        candidateMaximumMonths: Type.Integer(),
        status: Type.String(),
        scope: Type.String(),
        excerpt: Type.String(),
      }),
    ),
    uncertainties: Type.Array(Type.String()),
  }),
  recommendationEligible: Type.Boolean(),
  availability: Type.String(),
  lastSeenAt: Type.String(),
  relationsVersion: Type.String(),
});

export const matchItemSchema = Type.Object({
  job: Type.Object({
    id: Type.String(),
    sourceId: Type.String(),
    companySlug: Type.String(),
    title: Type.String(),
    url: Type.String(),
    applyUrl: Type.String(),
    lastSeenAt: Type.String(),
    requirements: requirementsSchema,
  }),
  baseScore: Type.Integer(),
  completeness: Type.Integer(),
  band: Type.Union(
    ['strong', 'possible', 'exploratory', 'review'].map((value) => Type.Literal(value)),
  ),
  requiredGaps: Type.Integer(),
  skills: Type.Array(
    Type.Object({
      ...skillMatchSchema.properties,
      names: Type.Array(Type.String()),
      importance: Type.String(),
      status: Type.Union(
        ['matched', 'claim_only', 'not_evidenced'].map((value) => Type.Literal(value)),
      ),
      matchedId: Type.Union([Type.String(), Type.Null()]),
      excerpt: Type.String(),
    }),
  ),
  experience: Type.Array(
    Type.Object({
      minimumMonths: Type.Integer(),
      candidateMinimumMonths: Type.Integer(),
      importance: Type.String(),
      candidateMaximumMonths: Type.Integer(),
      status: Type.Union(['met', 'below', 'uncertain'].map((value) => Type.Literal(value))),
      scope: Type.String(),
      excerpt: Type.String(),
    }),
  ),
  uncertainties: Type.Array(Type.String()),
  location: Type.String(),
  coverage: Type.String(),
  companyName: Type.String(),
  logoUrl: Type.Union([Type.String(), Type.Null()]),
  employerAdjustment: Type.Object({
    points: Type.Integer(),
    reasons: Type.Array(Type.String()),
    version: Type.String(),
  }),
});

export const matchResponseSchema = Type.Object({
  items: Type.Array(matchItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  evaluated: Type.Integer(),
  eligible: Type.Integer(),
  unenriched: Type.Integer(),
  datasetVersion: Type.Integer(),
  featureGeneration: Type.Integer(),
  asOf: Type.String(),
  freshnessHours: Type.Integer(),
  excludedSources: Type.Integer(),
  mode: Type.String(),
  versions: Type.Object({
    features: Type.String(),
    scoring: Type.String(),
    employerContext: Type.String(),
  }),
});
