import type { RoleEvidence } from '../domain/resume/role-assessment.js';
import type { writingSegments } from '../domain/resume/review.js';

export interface ResumeRoleAssessor {
  assess(
    input: {
      segments: ReturnType<typeof writingSegments>;
      jobTitle: string;
      jobDescription: string;
    },
    signal: AbortSignal,
  ): Promise<{ evidence: RoleEvidence[]; coverage: 'all_identified' | 'partial' }>;
}
