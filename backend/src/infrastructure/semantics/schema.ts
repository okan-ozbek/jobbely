import { z } from 'zod';
import type { RequirementExpression } from '../../domain/matching/semantic-model.js';

const id = z.string().min(1).max(100);
const label = z.string().trim().min(1).max(200);

const sourceSchema = z.strictObject({
  blockId: id,
  start: z.number().int().min(0).max(8000),
  end: z.number().int().min(1).max(8000),
  quote: z.string().min(1).max(2000),
});

export const expressionSchema: z.ZodType<RequirementExpression> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('atom'), atomId: id }),
    z.strictObject({
      kind: z.enum(['all-of', 'any-of']),
      children: z.array(expressionSchema).min(2).max(20),
    }),
    z.strictObject({ kind: z.literal('conditional'), conditionId: id, then: expressionSchema }),
  ]),
);

export const semanticDraftSchema = z.strictObject({
  atoms: z
    .array(
      z.strictObject({
        id,
        kind: z.enum(['capability', 'experience', 'eligibility', 'unknown']),
        capability: z.strictObject({
          action: label,
          object: label,
          domain: label.nullable(),
          scope: label.nullable(),
          tools: z.array(label).max(20),
          canonicalIds: z.array(id).max(20),
        }),
        minimumMonths: z.number().int().min(1).max(1200).nullable(),
        durationScope: z.enum(['none', 'professional', 'function', 'activity']),
        polarity: z.enum(['positive', 'negative', 'unknown']),
        source: sourceSchema,
      }),
    )
    .max(400),
  obligations: z
    .array(
      z.strictObject({
        id,
        importance: z.enum(['required', 'preferred', 'contextual']),
        expression: expressionSchema,
        source: sourceSchema,
      }),
    )
    .max(200),
  blocks: z
    .array(
      z.strictObject({
        blockId: id,
        interpretation: z.enum(['qualification', 'contextual', 'unknown']),
        obligationIds: z.array(id).max(200),
      }),
    )
    .max(400),
});
