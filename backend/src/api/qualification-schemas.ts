import { Type } from '@sinclair/typebox';

export const degreeLevelSchema = Type.Union(
  (['bachelor', 'master', 'doctorate'] as const).map((value) => Type.Literal(value)),
);

export const degreeFieldSchema = Type.Union(
  (
    [
      'computer-science',
      'engineering',
      'mathematics',
      'physics',
      'business',
      'other',
      'unknown',
    ] as const
  ).map((value) => Type.Literal(value)),
);

export const educationSchema = Type.Array(
  Type.Object(
    {
      level: degreeLevelSchema,
      field: degreeFieldSchema,
      completion: Type.Union(
        (['completed', 'in-progress', 'unknown'] as const).map((value) => Type.Literal(value)),
      ),
    },
    { additionalProperties: false },
  ),
  { maxItems: 20, uniqueItems: true },
);

export const skillTenureSchema = Type.Array(
  Type.Object(
    {
      skillId: Type.String({ minLength: 1, maxLength: 200 }),
      months: Type.Integer({ minimum: 0, maximum: 600 }),
    },
    { additionalProperties: false },
  ),
  { maxItems: 100 },
);
