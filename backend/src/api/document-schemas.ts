import { Type } from '@sinclair/typebox';

export const actionSchema = Type.Union(
  (
    [
      'build',
      'operate',
      'optimize',
      'design',
      'deliver',
      'learn',
      'observe',
      'list',
      'other',
    ] as const
  ).map((item) => Type.Literal(item)),
);

export const outcomeSchema = Type.Union(
  (['latency', 'throughput', 'reliability', 'consistency', 'delivery', 'unspecified'] as const).map(
    (item) => Type.Literal(item),
  ),
);

export const sourceSchema = Type.Union(
  (['employment', 'project', 'volunteering', 'summary', 'skills', 'other'] as const).map((item) =>
    Type.Literal(item),
  ),
);

export const evidenceRefSchema = Type.Object(
  {
    blockId: Type.String({ pattern: '^(?:resume-block|line)-[0-9]+$', maxLength: 40 }),
    lineIds: Type.Array(Type.String({ pattern: '^line-[0-9]+$', maxLength: 40 }), {
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    }),
    source: sourceSchema,
    roleId: Type.Optional(
      Type.String({ pattern: '^(?:employment|manual)-[0-9]+$', maxLength: 40 }),
    ),
    action: actionSchema,
    objectId: Type.String({ minLength: 1, maxLength: 200 }),
    outcome: outcomeSchema,
    assertion: Type.Union(
      (
        [
          'performed',
          'assisted',
          'observed',
          'learning',
          'negated',
          'listed',
          'reviewed',
          'contextual',
        ] as const
      ).map((item) => Type.Literal(item)),
    ),
  },
  { additionalProperties: false },
);

export const jobBlockSchema = Type.Object({
  id: Type.String(),
  kind: Type.Union(
    (['heading', 'paragraph', 'list-item'] as const).map((item) => Type.Literal(item)),
  ),
  headingPath: Type.Array(Type.String()),
  role: Type.Union(
    (
      [
        'overview',
        'role',
        'responsibilities',
        'qualifications',
        'benefits',
        'compensation',
        'application',
        'legal',
        'unknown',
      ] as const
    ).map((item) => Type.Literal(item)),
  ),
  importance: Type.Union(
    (['required', 'preferred', 'contextual'] as const).map((item) => Type.Literal(item)),
  ),
  start: Type.Integer(),
  end: Type.Integer(),
  line: Type.Integer(),
  text: Type.String(),
});

export const jobDocumentSchema = Type.Object({
  version: Type.String(),
  text: Type.String(),
  blocks: Type.Array(jobBlockSchema),
  truncated: Type.Boolean(),
});
