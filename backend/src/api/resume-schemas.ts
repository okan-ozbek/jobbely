import { signalSemantics, signalReviewSchema } from './semantic-schemas.js';
import { Type } from '@sinclair/typebox';
import { categories } from '../domain/taxonomy.js';

const strict = { additionalProperties: false };
const field = Type.String({ maxLength: 200 });
const category = Type.Union(categories.map((item) => Type.Literal(item.slug)));

const kind = Type.Union(
  (['employment', 'internship', 'project', 'volunteering'] as const).map((value) =>
    Type.Literal(value),
  ),
);

const relationship = Type.Union(
  (['direct', 'client', 'unknown'] as const).map((value) => Type.Literal(value)),
);

const names = Type.Array(Type.String({ minLength: 1, maxLength: 100 }), {
  maxItems: 100,
  uniqueItems: true,
});

export const resumeInputSchema = Type.Object(
  {
    text: Type.String({ minLength: 1, maxLength: 100_000 }),
    analysisDate: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
    corrections: Type.Optional(
      Type.Object(
        {
          signalReviews: Type.Optional(Type.Array(signalReviewSchema, { maxItems: 100 })),
          addSkills: Type.Optional(names),
          removeSkills: Type.Optional(names),
          addCompetencies: Type.Optional(names),
          removeCompetencies: Type.Optional(names),
          location: Type.Optional(field),
          employment: Type.Optional(
            Type.Array(
              Type.Object(
                {
                  id: Type.String({ minLength: 1, maxLength: 100 }),
                  removed: Type.Optional(Type.Boolean()),
                  employer: Type.Optional(field),
                  title: Type.Optional(field),
                  category: Type.Optional(category),
                  kind: Type.Optional(kind),
                  relationship: Type.Optional(relationship),
                  start: Type.Optional(Type.String({ maxLength: 40 })),
                  end: Type.Optional(Type.String({ maxLength: 40 })),
                },
                strict,
              ),
              { maxItems: 100 },
            ),
          ),
        },
        strict,
      ),
    ),
  },
  strict,
);

const evidence = Type.Array(
  Type.Object({
    lineId: Type.String(),
    excerpt: Type.String(),
    rule: Type.String(),
    start: Type.Optional(Type.Integer()),
    end: Type.Optional(Type.Integer()),
  }),
);

const signal = Type.Object({
  ...signalSemantics,
  id: Type.String(),
  name: Type.String(),
  status: Type.Union(
    (['mentioned', 'work_evidenced', 'learning', 'negated', 'user_confirmed'] as const).map(
      (value) => Type.Literal(value),
    ),
  ),
  evidence,
});

const duration = Type.Object({
  minimumMonths: Type.Integer(),
  maximumMonths: Type.Integer(),
  unknownEntries: Type.Integer(),
});

export const resumeAnalysisSchema = Type.Object({
  version: Type.String(),
  vocabularyVersion: Type.String(),
  analysisDate: Type.String(),
  document: Type.Object({
    text: Type.String(),
    lines: Type.Array(
      Type.Object({
        id: Type.String(),
        number: Type.Integer(),
        start: Type.Integer(),
        end: Type.Integer(),
        text: Type.String(),
        section: Type.Union(
          (
            [
              'header',
              'summary',
              'experience',
              'skills',
              'education',
              'projects',
              'volunteering',
              'other',
            ] as const
          ).map((value) => Type.Literal(value)),
        ),
        heading: Type.Boolean(),
      }),
    ),
  }),
  skills: Type.Array(signal),
  competencies: Type.Array(signal),
  employment: Type.Array(
    Type.Object({
      id: Type.String(),
      employer: Type.String(),
      recognizedCompany: Type.Union([Type.String(), Type.Null()]),
      title: Type.String(),
      category,
      kind,
      relationship,
      start: Type.String(),
      end: Type.String(),
      status: Type.Union(
        (['extracted', 'uncertain', 'user_confirmed'] as const).map((value) => Type.Literal(value)),
      ),
      evidence,
    }),
  ),
  location: Type.Object({
    value: Type.String(),
    status: Type.Union(
      (['extracted', 'uncertain', 'unknown', 'user_confirmed'] as const).map((value) =>
        Type.Literal(value),
      ),
    ),
    evidence,
  }),
  experience: Type.Object({
    professional: duration,
    internships: duration,
    relevant: Type.Array(Type.Object({ category: Type.String(), duration })),
  }),
  warnings: Type.Array(Type.String()),
  supportedSkills: Type.Array(Type.Object({ id: Type.String(), name: Type.String() })),
});
