import type { SignalReview, SignalSemantics } from '../semantics/model.js';
import type { categories } from '../taxonomy.js';

export type ResumeCategory = (typeof categories)[number]['slug'];

export type ResumeSection =
  | 'header'
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'volunteering'
  | 'other';

export interface ResumeLine {
  id: string;
  number: number;
  start: number;
  end: number;
  text: string;
  section: ResumeSection;
  heading: boolean;
}

export interface ResumeEvidence {
  start?: number;
  end?: number;
  lineId: string;
  excerpt: string;
  rule: string;
}

export interface ResumeSignal extends SignalSemantics {
  id: string;
  name: string;
  status: 'mentioned' | 'work_evidenced' | 'learning' | 'negated' | 'user_confirmed';
  evidence: ResumeEvidence[];
}

export interface ResumeEmployment {
  id: string;
  employer: string;
  recognizedCompany: string | null;
  title: string;
  category: ResumeCategory;
  kind: 'employment' | 'internship' | 'project' | 'volunteering';
  relationship: 'direct' | 'client' | 'unknown';
  start: string;
  end: string;
  status: 'extracted' | 'uncertain' | 'user_confirmed';
  evidence: ResumeEvidence[];
}

export interface ResumeLocation {
  value: string;
  status: 'extracted' | 'uncertain' | 'unknown' | 'user_confirmed';
  evidence: ResumeEvidence[];
}

export interface ExperienceRange {
  minimumMonths: number;
  maximumMonths: number;
  unknownEntries: number;
}

export interface ResumeAnalysis {
  version: string;
  vocabularyVersion: string;
  analysisDate: string;
  document: { text: string; lines: ResumeLine[] };
  skills: ResumeSignal[];
  competencies: ResumeSignal[];
  employment: ResumeEmployment[];
  location: ResumeLocation;
  experience: {
    professional: ExperienceRange;
    internships: ExperienceRange;
    relevant: { category: string; duration: ExperienceRange }[];
  };
  warnings: string[];
  supportedSkills: { id: string; name: string }[];
}

export interface EmploymentCorrection {
  id: string;
  removed?: boolean;
  employer?: string;
  title?: string;
  category?: ResumeCategory;
  kind?: ResumeEmployment['kind'];
  relationship?: ResumeEmployment['relationship'];
  start?: string;
  end?: string;
}

export interface ResumeCorrections {
  signalReviews?: SignalReview[];
  addSkills?: string[];
  removeSkills?: string[];
  addCompetencies?: string[];
  removeCompetencies?: string[];
  location?: string;
  employment?: EmploymentCorrection[];
}

export interface ResumeInput {
  text: string;
  analysisDate?: string;
  corrections?: ResumeCorrections;
}

export interface EmployerIdentity {
  slug: string;
  name: string;
}
