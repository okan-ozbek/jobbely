import { Type } from '@sinclair/typebox';

const strict = { additionalProperties: false };

const alignment = Type.Object(
  {
    alignment: Type.Union(
      ['strong', 'partial', 'limited', 'unknown'].map((value) => Type.Literal(value)),
    ),
    confidence: Type.Union(['high', 'moderate', 'low'].map((value) => Type.Literal(value))),
    evidenceCount: Type.Integer({ minimum: 0, maximum: 24 }),
    requiredGaps: Type.Integer({ minimum: 0, maximum: 24 }),
    screening: Type.Union(
      [
        'potential_fit',
        'needs_clarification',
        'requirements_not_demonstrated',
        'insufficient_context',
      ].map((value) => Type.Literal(value)),
    ),
  },
  strict,
);

export const roleAssessmentInputSchema = Type.Object(
  { text: Type.String({ minLength: 1, maxLength: 40_000 }), aiConsent: Type.Literal(true) },
  strict,
);

export const roleAssessmentSchema = Type.Object(
  {
    aiStatus: Type.Union([
      Type.Literal('completed'),
      Type.Literal('failed'),
      Type.Literal('unavailable'),
    ]),
    ats: alignment,
    recruiter: alignment,
    coverage: Type.Union([Type.Literal('all_identified'), Type.Literal('partial')]),
    evidence: Type.Array(
      Type.Object(
        {
          area: Type.Union([Type.Literal('ats'), Type.Literal('recruiter')]),
          status: Type.Union([
            Type.Literal('supported'),
            Type.Literal('partial'),
            Type.Literal('not_evidenced'),
            Type.Literal('contradicted'),
          ]),
          priority: Type.Union([
            Type.Literal('required'),
            Type.Literal('preferred'),
            Type.Literal('responsibility'),
          ]),
          jobQuote: Type.String({ minLength: 1, maxLength: 600 }),
          resumeQuote: Type.Union([Type.String({ minLength: 1, maxLength: 600 }), Type.Null()]),
          line: Type.Union([Type.Integer({ minimum: 1, maximum: 2000 }), Type.Null()]),
          explanation: Type.String({ maxLength: 600 }),
          suggestion: Type.String({ maxLength: 600 }),
          rewrite: Type.Union([Type.String({ minLength: 1, maxLength: 600 }), Type.Null()]),
        },
        strict,
      ),
      { maxItems: 24 },
    ),
    limitations: Type.Array(Type.String()),
  },
  strict,
);
