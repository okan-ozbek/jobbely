import type { CandidateEvidenceRef } from './propositions.js';

export type SkillFacet = 'general' | 'usage' | 'development';

export type Interpretation = 'explicit' | 'interpreted' | 'ambiguous' | 'contextual';

export type ConceptKind = 'language' | 'tool' | 'platform' | 'capability' | 'method' | 'competency';

export interface Concept {
  id: string;
  name: string;
  aliases: readonly string[];
  kind: ConceptKind;
  family: string;
  definition: string;
  facets: readonly SkillFacet[];
  provenance: 'reviewed-local';
}

export interface ConceptMention {
  id: string;
  name: string;
  position: number;
  length: number;
  facet: SkillFacet;
  interpretation: Interpretation;
  rule: string;
}

export interface SignalSemantics {
  evidenceRefs?: CandidateEvidenceRef[];
  facets?: SkillFacet[];
  deniedFacets?: SkillFacet[];
  uncertainFacets?: SkillFacet[];
  interpretation?: Interpretation;
}

export interface SignalReview {
  id: string;
  facet: SkillFacet;
  answer: 'confirmed' | 'denied' | 'unsure';
}
