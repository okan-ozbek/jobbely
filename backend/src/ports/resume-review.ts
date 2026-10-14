import type {
  AiReviewFinding,
  ResumeReviewInput,
  writingSegments,
} from '../domain/resume/review.js';

export interface ResumeWritingReviewer {
  review(
    input: {
      segments: ReturnType<typeof writingSegments>;
      language: ResumeReviewInput['language'];
      targetCountry: string;
      jobDescription: string;
    },
    signal: AbortSignal,
  ): Promise<AiReviewFinding[]>;
}
