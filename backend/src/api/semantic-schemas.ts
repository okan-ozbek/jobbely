import { evidenceRefSchema } from './document-schemas.js';
import { Type } from '@sinclair/typebox';

export const facetSchema = Type.Union(
  (['general', 'usage', 'development'] as const).map((value) => Type.Literal(value)),
);

export const interpretationSchema = Type.Union(
  (['explicit', 'interpreted', 'ambiguous', 'contextual'] as const).map((value) =>
    Type.Literal(value),
  ),
);

const facets = Type.Array(facetSchema, { maxItems: 3, uniqueItems: true });

export const signalSemantics = {
  evidenceRefs: Type.Optional(Type.Array(evidenceRefSchema, { maxItems: 5 })),
  facets: Type.Optional(facets),
  deniedFacets: Type.Optional(facets),
  uncertainFacets: Type.Optional(facets),
  interpretation: Type.Optional(interpretationSchema),
};

export const signalReviewSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 200 }),
    facet: facetSchema,
    answer: Type.Union(
      (['confirmed', 'denied', 'unsure'] as const).map((value) => Type.Literal(value)),
    ),
  },
  { additionalProperties: false },
);
