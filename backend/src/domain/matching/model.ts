import type { CandidateEvidenceRef } from '../semantics/propositions.js';
import type { Job } from '../model.js';
import type { ResumeEmployment, ResumeLocation, ResumeSignal } from '../resume/model.js';
import type { JobRequirements } from './requirements.js';
import type { SkillMatch } from './skill-relations.js';

export interface MatchProfile {
  analysisDate: string;
  skills: Pick<
    ResumeSignal,
    | 'id'
    | 'status'
    | 'facets'
    | 'deniedFacets'
    | 'uncertainFacets'
    | 'interpretation'
    | 'evidenceRefs'
  >[];
  competencies?: Pick<
    ResumeSignal,
    | 'id'
    | 'status'
    | 'facets'
    | 'deniedFacets'
    | 'uncertainFacets'
    | 'interpretation'
    | 'evidenceRefs'
  >[];
  employment: (Pick<
    ResumeEmployment,
    'employer' | 'category' | 'kind' | 'relationship' | 'start' | 'end'
  > & { id?: string })[];
  location: Pick<ResumeLocation, 'value' | 'status'>;
}

export interface MatchInput {
  profile: MatchProfile;
  categories: string[];
  employerContext: boolean;
  limit: number;
  cursor?: string;
}

export interface FeatureJob {
  id: string;
  sourceId: string;
  companySlug: string;
  title: string;
  url: string;
  applyUrl: string;
  lastSeenAt: string;
  requirements: JobRequirements;
}

export interface MatchExplanation {
  job: FeatureJob;
  baseScore: number;
  completeness: number;
  band: 'strong' | 'possible' | 'exploratory' | 'review';
  requiredGaps: number;
  unresolvedRequirements: number;
  skills: (SkillMatch & {
    requirementId?: string;
    evidenceRefs: CandidateEvidenceRef[];
    unresolvedAlternatives: string[];
    logic: 'single' | 'any-of';
    names: string[];
    importance: string;
    status: 'matched' | 'claim_only' | 'not_evidenced';
    matchedId: string | null;
    excerpt: string;
  })[];
  experience: {
    minimumMonths: number;
    maximumMonths?: number;
    importance: string;
    candidateMinimumMonths: number;
    candidateMaximumMonths: number;
    status: 'met' | 'below' | 'uncertain';
    scope: string;
    excerpt: string;
  }[];
  uncertainties: string[];
  location: string;
  employerAdjustment: { points: number; reasons: string[]; version: string };
}

export type FeatureInput = Pick<
  Job,
  'id' | 'contentHash' | 'descriptionText' | 'classification' | 'locations' | 'workplace'
> &
  Partial<Pick<Job, 'descriptionHtml'>>;

export interface StoredFeature {
  postingId: string;
  requirements: JobRequirements;
}
