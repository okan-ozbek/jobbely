import { Type } from '@sinclair/typebox';

const strict = { additionalProperties: false };
const nullableText = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Integer(), Type.Null()]);

const pages = Type.Array(Type.Integer({ minimum: 1, maximum: 20 }), {
  maxItems: 20,
  uniqueItems: true,
});

export const resumeReviewInputSchema = Type.Object(
  {
    text: Type.String({ minLength: 1, maxLength: 40_000 }),
    aiConsent: Type.Boolean(),
    language: Type.Union([Type.Literal('en-US'), Type.Literal('en-GB'), Type.Literal('nl-NL')]),
    targetCountry: Type.String({ maxLength: 80 }),
    jobDescription: Type.String({ maxLength: 12_000 }),
    layout: Type.Optional(
      Type.Object(
        {
          format: Type.Union([Type.Literal('pdf'), Type.Literal('docx')]),
          pages: Type.Union([Type.Integer({ minimum: 1, maximum: 20 }), Type.Null()]),
          columnPages: pages,
          smallTextPages: pages,
          tableRows: Type.Integer({ minimum: 0, maximum: 2_000 }),
          contactInHeaderFooter: Type.Boolean(),
        },
        strict,
      ),
    ),
  },
  strict,
);

export const resumeReviewSchema = Type.Object(
  {
    version: Type.Literal('review-1'),
    aiStatus: Type.Union([
      Type.Literal('not_requested'),
      Type.Literal('unavailable'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ]),
    findings: Type.Array(
      Type.Object(
        {
          id: Type.String(),
          source: Type.Union([Type.Literal('rule'), Type.Literal('ai')]),
          severity: Type.Union([
            Type.Literal('error'),
            Type.Literal('risk'),
            Type.Literal('suggestion'),
          ]),
          category: Type.String(),
          title: Type.String(),
          explanation: Type.String(),
          suggestion: Type.String(),
          quote: nullableText,
          line: nullableNumber,
          page: nullableNumber,
          rewrite: nullableText,
        },
        strict,
      ),
      { maxItems: 42 },
    ),
    limitations: Type.Array(Type.String()),
  },
  strict,
);
