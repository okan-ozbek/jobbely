import { conceptsById, registryVersion } from '../semantics/concepts.js';
import { extractRequirements, featureVersion } from './requirements.js';
import { semanticSchemaVersion } from './semantic-model.js';
import type {
  RequirementAtom,
  RequirementExpression,
  SemanticJobInput,
  SemanticObligation,
  SourceQuote,
} from './semantic-model.js';
import { semanticValidationVersion, validateSemanticDraft } from './semantic-validation.js';

export const rulesExtractionIdentity = {
  engine: 'rules' as const,
  schema: semanticSchemaVersion,
  prompt: featureVersion,
  ontology: registryVersion,
  validation: semanticValidationVersion,
  model: null,
};

export function rulesSemanticExtraction(input: SemanticJobInput) {
  const requirements = extractRequirements(
    {
      descriptionText: input.document.text,
      contentHash: input.contentHash,
      classification: {
        category: input.category,
        method: 'unclassified',
        rule: '',
        evidence: '',
        version: '',
      },
      locations: [],
      workplace: 'unknown',
    },
    input.document,
  );

  const atoms: RequirementAtom[] = [];
  const obligations: SemanticObligation[] = [];

  for (const clause of requirements.clauses) {
    const block = input.document.blocks.find((item) => item.id === clause.blockId)!;
    const start = (clause.evidence.start ?? block.start) - block.start;
    const end = (clause.evidence.end ?? block.end) - block.start;

    const source: SourceQuote = {
      blockId: block.id,
      start,
      end,
      quote: block.text.slice(start, end),
    };

    const children: RequirementExpression[] = [];

    const atom = (
      object: string,
      kind: RequirementAtom['kind'],
      extra: Partial<RequirementAtom> = {},
      canonicalIds: string[] = [],
      scope: string | null = null,
    ): { kind: 'atom'; atomId: string } => {
      const id = `atom-${atoms.length}`;

      atoms.push({
        id,
        kind,
        capability: {
          action: clause.action,
          object: object.slice(0, 200),
          domain: null,
          scope,
          tools: canonicalIds
            .filter((key) =>
              ['language', 'tool', 'platform'].includes(conceptsById.get(key)?.kind ?? ''),
            )
            .map((key) => conceptsById.get(key)!.name),
          canonicalIds,
        },
        minimumMonths: null,
        durationScope: 'none',
        polarity:
          kind === 'unknown' || kind === 'eligibility'
            ? 'unknown'
            : clause.polarity === 'negated'
              ? 'negative'
              : clause.polarity === 'uncertain'
                ? 'unknown'
                : 'positive',
        source,
        ...extra,
      });

      return { kind: 'atom', atomId: id };
    };

    for (const group of requirements.skills.filter((group) =>
      clause.groupIds.includes(group.id!),
    )) {
      const alternatives = group.alternatives.map((skill) =>
        atom(skill.name, 'capability', {}, [skill.id], skill.facet ?? null),
      );

      alternatives.push(
        ...(group.unresolvedAlternatives ?? []).map((label) => atom(label, 'unknown')),
      );

      children.push(
        alternatives.length === 1 ? alternatives[0]! : { kind: 'any-of', children: alternatives },
      );
    }

    for (const threshold of requirements.experience.filter(
      (item) => item.evidence.clauseId === clause.id,
    )) {
      children.push(
        atom(threshold.evidence.excerpt, 'experience', {
          minimumMonths: threshold.minimumMonths,
          durationScope: threshold.scope === 'skill' ? 'activity' : threshold.scope,
        }),
      );
    }

    for (const constraint of requirements.constraints.filter(
      (item) => item.evidence.clauseId === clause.id,
    )) {
      children.push(atom(constraint.kind, 'eligibility'));
    }

    if (
      requirements.unparsed.some((item) => item.evidence.clauseId === clause.id) ||
      (!children.length && clause.importance !== 'contextual')
    ) {
      children.push(atom('Unresolved candidate qualification', 'unknown'));
    }

    if (!children.length) {
      continue;
    }

    let expression: RequirementExpression =
      children.length === 1 ? children[0]! : { kind: 'all-of', children };

    if (clause.modality === 'conditional') {
      const condition = atom('Unresolved condition', 'unknown');

      expression = { kind: 'conditional', conditionId: condition.atomId, then: expression };
    }

    obligations.push({ id: clause.id, importance: clause.importance, source, expression });
  }

  return validateSemanticDraft(
    {
      atoms,
      obligations,
      blocks: input.document.blocks
        .filter((block) => block.kind !== 'heading')
        .map((block) => {
          const entries = obligations.filter((item) => item.source.blockId === block.id);

          return {
            blockId: block.id,
            interpretation: entries.some((item) => item.importance !== 'contextual')
              ? 'qualification'
              : block.importance !== 'contextual'
                ? 'unknown'
                : 'contextual',
            obligationIds: entries.map((item) => item.id),
          };
        }),
    },
    input,
    rulesExtractionIdentity,
  );
}
