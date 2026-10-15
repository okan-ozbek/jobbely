import { describe, expect, it, vi } from 'vitest';
import { ReviewResume } from './review-resume.js';
import type { ResumeReviewInput } from '../../domain/resume/review.js';
import type { ResumeWritingReviewer } from '../../ports/resume-review.js';

const input: ResumeReviewInput = {
  text: 'Synthetic Candidate\nExperience\n- Built reports.',
  aiConsent: false,
  language: 'en-GB',
  targetCountry: '',
  jobDescription: '',
};

describe('hybrid review workflow', () => {
  it('never calls a model without consent and works without configuration', async () => {
    const review = vi.fn(async () => []);

    expect(
      (await new ReviewResume({ review }).execute(input, 'user', new AbortController().signal))
        .aiStatus,
    ).toBe('not_requested');

    expect(review).not.toHaveBeenCalled();

    expect(
      (
        await new ReviewResume().execute(
          { ...input, aiConsent: true },
          'user',
          new AbortController().signal,
        )
      ).aiStatus,
    ).toBe('unavailable');
  });

  it('keeps document findings when a provider fails or invents evidence', async () => {
    for (const writer of [
      {
        review: async () => {
          throw new Error('private payload');
        },
      },
      {
        review: async () => [
          {
            category: 'clarity' as const,
            title: 'Title',
            explanation: 'Explanation',
            suggestion: 'Suggestion',
            quote: 'Invented',
            line: 3,
            rewrite: null,
          },
        ],
      },
    ]) {
      const result = await new ReviewResume(writer).execute(
        { ...input, aiConsent: true },
        'user',
        new AbortController().signal,
      );

      expect(result.aiStatus).toBe('failed');
      expect(result.findings.some((finding) => finding.id === 'contact-email')).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/private payload|Invented/);
    }
  });

  it('limits paid model spending per account and releases the window after an hour', async () => {
    let now = new Date('2026-10-14T12:00:00Z');
    const review = vi.fn(async () => []);
    const service = new ReviewResume({ review }, () => now);

    for (let index = 0; index < 5; index++) {
      await service.execute({ ...input, aiConsent: true }, 'user', new AbortController().signal);
    }

    await expect(
      service.execute({ ...input, aiConsent: true }, 'user', new AbortController().signal),
    ).rejects.toThrow('hourly');

    expect((await service.execute(input, 'user', new AbortController().signal)).aiStatus).toBe(
      'not_requested',
    );

    now = new Date('2026-10-14T13:00:01Z');
    await service.execute({ ...input, aiConsent: true }, 'user', new AbortController().signal);
    expect(review).toHaveBeenCalledTimes(6);
  });

  it('rejects concurrent requests for one account and permits retry after cancellation', async () => {
    const writer: ResumeWritingReviewer = {
      review: (_input, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }),
        ),
    };

    const service = new ReviewResume(writer);
    const controller = new AbortController();
    const request = service.execute({ ...input, aiConsent: true }, 'user', controller.signal);

    await expect(
      service.execute({ ...input, aiConsent: true }, 'user', controller.signal),
    ).rejects.toThrow('busy');

    controller.abort();
    await expect(request).rejects.toThrow();

    expect((await service.execute(input, 'user', new AbortController().signal)).aiStatus).toBe(
      'not_requested',
    );
  });
});
