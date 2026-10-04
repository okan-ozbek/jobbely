import { conceptsById } from '../semantics/concepts.js';
import type {
  ExtractionIdentity,
  RequirementExpression,
  SemanticDraft,
  SemanticJobExtraction,
  SemanticJobInput,
  SourceQuote,
} from './semantic-model.js';

export const semanticValidationVersion = 'semantic-validation-1';

export class SemanticValidationError extends Error {
  constructor() {
    super('The semantic interpretation has invalid structure or source evidence.');
  }
}

function statedMinimumMonths(text: string): number[] {
  const numbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };

  return [
    ...text
      .toLowerCase()
      .matchAll(
        /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*(?:[-–]|to)\s*\d{1,3})?\s*\+?\s*(years?|months?)\b/g,
      ),
  ].map(
    (match) => (numbers[match[1]!] ?? Number(match[1])) * (match[2]!.startsWith('year') ? 12 : 1),
  );
}

export function validateSemanticDraft(
  draft: SemanticDraft,
  input: SemanticJobInput,
  identity: ExtractionIdentity,
): SemanticJobExtraction {
  const reject = () => {
    throw new SemanticValidationError();
  };

  const blocks = new Map(input.document.blocks.map((block) => [block.id, block]));
  const atoms = new Map(draft.atoms.map((atom) => [atom.id, atom]));
  const obligations = new Map(draft.obligations.map((item) => [item.id, item]));
  const dispositions = new Map(draft.blocks.map((block) => [block.blockId, block]));

  if (
    draft.atoms.length > 400 ||
    draft.obligations.length > 200 ||
    atoms.size !== draft.atoms.length ||
    obligations.size !== draft.obligations.length ||
    dispositions.size !== draft.blocks.length ||
    blocks.size !== input.document.blocks.length
  ) {
    reject();
  }

  const sourceValid = (source: SourceQuote) => {
    const block = blocks.get(source.blockId);

    return (
      !!block &&
      block.kind !== 'heading' &&
      Number.isSafeInteger(source.start) &&
      Number.isSafeInteger(source.end) &&
      source.start >= 0 &&
      source.end > source.start &&
      source.end <= block.text.length &&
      source.quote.length <= 2000 &&
      block.text.slice(source.start, source.end) === source.quote
    );
  };

  for (const atom of draft.atoms) {
    if (
      !sourceValid(atom.source) ||
      atom.capability.canonicalIds.some((id) => !conceptsById.has(id)) ||
      [
        atom.capability.action,
        atom.capability.object,
        ...(atom.capability.domain ? [atom.capability.domain] : []),
        ...(atom.capability.scope ? [atom.capability.scope] : []),
        ...atom.capability.tools,
      ].some((label) => !label.trim() || label.length > 200) ||
      (atom.kind === 'experience'
        ? atom.minimumMonths === null ||
          atom.minimumMonths <= 0 ||
          !Number.isSafeInteger(atom.minimumMonths) ||
          atom.minimumMonths > 1200 ||
          atom.durationScope === 'none' ||
          !statedMinimumMonths(atom.source.quote).includes(atom.minimumMonths)
        : atom.minimumMonths !== null || atom.durationScope !== 'none')
    ) {
      reject();
    }
  }

  const used = new Set<string>();
  let nodes = 0;

  const walk = (expression: RequirementExpression, source: SourceQuote, depth: number): void => {
    if (++nodes > 1600 || depth > 8) {
      reject();
    }

    const reference = (id: string) => {
      const atom = atoms.get(id);

      if (
        !atom ||
        atom.source.blockId !== source.blockId ||
        atom.source.start < source.start ||
        atom.source.end > source.end
      ) {
        reject();
      }

      used.add(id);
    };

    if (expression.kind === 'atom') {
      reference(expression.atomId);
    } else if (expression.kind === 'conditional') {
      reference(expression.conditionId);
      walk(expression.then, source, depth + 1);
    } else {
      if (expression.children.length < 2 || expression.children.length > 20) {
        reject();
      }

      for (const child of expression.children) {
        walk(child, source, depth + 1);
      }
    }
  };

  for (const obligation of draft.obligations) {
    if (!sourceValid(obligation.source)) {
      reject();
    }

    walk(obligation.expression, obligation.source, 0);
  }

  if (used.size !== atoms.size) {
    reject();
  }

  const referenced = new Set<string>();

  for (const disposition of draft.blocks) {
    const block = blocks.get(disposition.blockId);

    if (
      !block ||
      block.kind === 'heading' ||
      new Set(disposition.obligationIds).size !== disposition.obligationIds.length ||
      (disposition.interpretation === 'qualification' && disposition.obligationIds.length === 0)
    ) {
      reject();
    }

    for (const id of disposition.obligationIds) {
      const obligation = obligations.get(id);

      if (
        !obligation ||
        obligation.source.blockId !== disposition.blockId ||
        referenced.has(id) ||
        (disposition.interpretation === 'contextual' && obligation.importance !== 'contextual')
      ) {
        reject();
      }

      referenced.add(id);
    }
  }

  if (
    referenced.size !== obligations.size ||
    input.document.blocks.some((block) => block.kind !== 'heading' && !dispositions.has(block.id))
  ) {
    reject();
  }

  return {
    ...draft,
    identity,
    documentVersion: input.document.version,
    contentHash: input.contentHash,
    state:
      input.document.truncated ||
      draft.blocks.some((block) => block.interpretation === 'unknown') ||
      draft.atoms.some((atom) => atom.kind === 'unknown' || atom.polarity === 'unknown')
        ? 'needs-review'
        : 'interpreted',
  };
}
