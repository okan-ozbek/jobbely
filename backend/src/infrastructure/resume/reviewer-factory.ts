import { isAbsolute } from 'node:path';
import type { ResumeWritingReviewer } from '../../ports/resume-review.js';
import type { ResumeRoleAssessor } from '../../ports/resume-role-assessment.js';
import { CodexResumeReviewer } from './codex-review.js';
import { OpenAiResumeReviewer } from './openai-review.js';

interface Settings {
  RESUME_REVIEW_PROVIDER: 'openai-api' | 'codex-local';
  RESUME_REVIEW_OPENAI_KEY?: string | undefined;
  RESUME_REVIEW_MODEL?: string | undefined;
  RESUME_REVIEW_CODEX_COMMAND?: string | undefined;
  NODE_ENV: string;
  HOST: string;
  FRONTEND_ORIGIN: string;
}

export function reviewConfigurationError(value: Settings): string | null {
  if (value.RESUME_REVIEW_PROVIDER === 'codex-local') {
    if (
      value.NODE_ENV === 'production' ||
      !['127.0.0.1', 'localhost', '::1'].includes(value.HOST) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value.FRONTEND_ORIGIN).hostname)
    ) {
      return 'Codex resume review is restricted to non-production loopback development.';
    }

    if (
      !value.RESUME_REVIEW_MODEL ||
      !value.RESUME_REVIEW_CODEX_COMMAND ||
      !isAbsolute(value.RESUME_REVIEW_CODEX_COMMAND)
    ) {
      return 'Codex resume review requires an explicit model and an absolute CLI executable path.';
    }
  } else if (!!value.RESUME_REVIEW_OPENAI_KEY !== !!value.RESUME_REVIEW_MODEL) {
    return 'AI resume review requires both a backend API key and an explicit model.';
  }

  return null;
}

export function createResumeWritingReviewer(
  value: Settings,
): (ResumeWritingReviewer & ResumeRoleAssessor) | undefined {
  const error = reviewConfigurationError(value);

  if (error) {
    throw new Error(error);
  }

  if (value.RESUME_REVIEW_PROVIDER === 'codex-local') {
    return new CodexResumeReviewer(value.RESUME_REVIEW_CODEX_COMMAND!, value.RESUME_REVIEW_MODEL!);
  }

  return value.RESUME_REVIEW_OPENAI_KEY && value.RESUME_REVIEW_MODEL
    ? new OpenAiResumeReviewer(value.RESUME_REVIEW_OPENAI_KEY, value.RESUME_REVIEW_MODEL)
    : undefined;
}
