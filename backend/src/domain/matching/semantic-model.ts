import type { JobDocument } from './document.js';

export const semanticSchemaVersion = 'semantic-extraction-1';

export interface SourceQuote {
  blockId: string;
  start: number;
  end: number;
  quote: string;
}

export interface Capability {
  action: string;
  object: string;
  domain: string | null;
  scope: string | null;
  tools: string[];
  canonicalIds: string[];
}

export interface RequirementAtom {
  id: string;
  kind: 'capability' | 'experience' | 'eligibility' | 'unknown';
  capability: Capability;
  minimumMonths: number | null;
  durationScope: 'none' | 'professional' | 'function' | 'activity';
  polarity: 'positive' | 'negative' | 'unknown';
  source: SourceQuote;
}

export type RequirementExpression =
  | { kind: 'atom'; atomId: string }
  | { kind: 'all-of' | 'any-of'; children: RequirementExpression[] }
  | { kind: 'conditional'; conditionId: string; then: RequirementExpression };

export interface SemanticObligation {
  id: string;
  importance: 'required' | 'preferred' | 'contextual';
  expression: RequirementExpression;
  source: SourceQuote;
}

export interface BlockDisposition {
  blockId: string;
  interpretation: 'qualification' | 'contextual' | 'unknown';
  obligationIds: string[];
}

export interface SemanticDraft {
  atoms: RequirementAtom[];
  obligations: SemanticObligation[];
  blocks: BlockDisposition[];
}

export interface ExtractionIdentity {
  engine: 'rules' | 'ollama';
  schema: string;
  prompt: string;
  ontology: string;
  validation: string;
  model: { name: string; digest: string; quantization: string } | null;
}

export interface SemanticJobExtraction extends SemanticDraft {
  identity: ExtractionIdentity;
  documentVersion: string;
  contentHash: string;
  state: 'interpreted' | 'needs-review';
}

export interface SemanticJobInput {
  contentHash: string;
  category: string;
  document: JobDocument;
}

export type EvidenceDecision =
  'supported' | 'partial' | 'not-evidenced' | 'contradicted' | 'unknown' | 'suggested';

export interface AtomAssessment {
  atomId: string;
  decision: EvidenceDecision;
  evidenceIds: string[];
}

// Candidate statements stay distinct by activity; dates are never inferred from a concept.
export interface CandidateProposition {
  id: string;
  capability: Capability;
  assertion: 'performed' | 'assisted' | 'observed' | 'learning' | 'negated' | 'listed' | 'reviewed';
  source: 'employment' | 'project' | 'volunteering' | 'summary' | 'skills' | 'other';
  blockId: string;
  roleId: string | null;
  provenance: 'explicit' | 'interpreted' | 'reviewed';
  activityIntervals: { start: string; end: string; status: 'reviewed' }[];
}
