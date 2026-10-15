import {
  reviewerVersion,
  reviewRules,
  writingSegments,
  verifiedAiFindings,
  ResumeReviewError,
} from '../../domain/resume/review.js';
import type { ResumeReview, ResumeReviewInput } from '../../domain/resume/review.js';
import type { ResumeWritingReviewer } from '../../ports/resume-review.js';
import type { ResumeRoleAssessor } from '../../ports/resume-role-assessment.js';
import type { JobDocumentReader } from '../../ports/job-document.js';
import type { Job } from '../../domain/model.js';
import {
  groundedRoleAssessment,
  unavailableRoleAssessment,
} from '../../domain/resume/role-assessment.js';

export class ReviewResume {
  private readonly active = new Set<string>();
  private readonly windows = new Map<string, { count: number; end: number }>();

  constructor(
    private readonly writer?: ResumeWritingReviewer & Partial<ResumeRoleAssessor>,
    private readonly clock: () => Date = () => new Date(),
    private readonly documents?: JobDocumentReader,
  ) {}

  get aiAvailable() {
    return !!this.writer;
  }

  get aiProvider() {
    return this.writer ? (this.writer.provider ?? 'openai-api') : null;
  }

  async assessRole(text: string, job: Job, userId: string, signal: AbortSignal) {
    signal.throwIfAborted();

    if (!this.writer?.assess) {
      return unavailableRoleAssessment('unavailable');
    }

    if (!text.trim() || text.split(/\r?\n/).length > 2_000) {
      throw new ResumeReviewError('invalid_review', 'Use bounded resume text.');
    }

    const release = this.admit(userId);

    try {
      const segments = writingSegments(text);
      const originalJob = this.documents?.read(job).text ?? job.descriptionText;

      const minimized = writingSegments(`Job description\n${originalJob}`)
        .map((item) => item.text)
        .join('\n');

      const jobDescription = minimized.slice(0, 24_000);

      const response = await this.writer.assess(
        { segments, jobTitle: job.title, jobDescription },
        signal,
      );

      signal.throwIfAborted();

      return groundedRoleAssessment(
        response.evidence,
        segments,
        jobDescription,
        minimized.length > jobDescription.length,
        response.coverage,
      );
    } catch {
      signal.throwIfAborted();

      return unavailableRoleAssessment('failed');
    } finally {
      release();
    }
  }

  private admit(userId: string) {
    const now = this.clock().getTime();

    for (const [id, window] of this.windows) {
      if (window.end <= now) {
        this.windows.delete(id);
      }
    }

    const window = this.windows.get(userId) ?? { count: 0, end: now + 3_600_000 };

    if (
      this.active.has(userId) ||
      this.active.size >= 4 ||
      window.count >= 5 ||
      (!this.windows.has(userId) && this.windows.size >= 1_000)
    ) {
      throw new ResumeReviewError(
        'review_busy',
        'AI review is busy or your hourly limit was reached. Try document checks or return later.',
      );
    }

    window.count++;
    this.windows.set(userId, window);
    this.active.add(userId);

    return () => this.active.delete(userId);
  }

  async execute(
    input: ResumeReviewInput,
    userId: string,
    signal: AbortSignal,
  ): Promise<ResumeReview> {
    signal.throwIfAborted();

    const result: ResumeReview = {
      version: reviewerVersion,
      findings: reviewRules(input),
      aiStatus: 'not_requested',
      limitations: [
        'Findings describe this document, not your employability or an ATS pass score.',
        'Layout checks use local extraction hints; images, clipping, colors and exact margins are not assessed.',
        'Missing evidence is not proof that you lack a skill. Gaps, photos, length and education dates are not automatic errors.',
      ],
    };

    if (!input.aiConsent) {
      return result;
    }

    if (!this.writer) {
      return { ...result, aiStatus: 'unavailable' };
    }

    const release = this.admit(userId);

    try {
      const segments = writingSegments(input.text);

      const findings = await this.writer.review(
        {
          segments,
          language: input.language,
          targetCountry: input.targetCountry,
          jobDescription: writingSegments(`Job description\n${input.jobDescription}`)
            .map((item) => item.text)
            .join('\n'),
        },
        signal,
      );

      signal.throwIfAborted();
      result.findings.push(...verifiedAiFindings(findings, segments));
      result.aiStatus = 'completed';

      result.limitations.push(
        'AI suggestions can be wrong. Verify every rewrite; never add achievements or metrics you cannot support.',
      );
    } catch {
      signal.throwIfAborted();
      result.aiStatus = 'failed';

      result.limitations.push(
        'AI feedback was unavailable or could not be verified. Document checks are still shown.',
      );
    } finally {
      release();
    }

    return result;
  }
}
