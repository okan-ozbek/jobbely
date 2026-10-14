import createClient from 'openapi-fetch';
import type { paths } from './generated/schema.js';
import { ApiError } from './client.js';

export type ResumeReview =
  paths['/api/v1/resume-review']['post']['responses'][200]['content']['application/json'];

export type ResumeReviewInput =
  paths['/api/v1/resume-review']['post']['requestBody']['content']['application/json'];

export type ReviewAvailability =
  paths['/api/v1/resume-review']['get']['responses'][200]['content']['application/json'];

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  credentials: 'include',
});

export async function reviewAvailability(signal: AbortSignal) {
  const result = await client.GET('/api/v1/resume-review', { signal, cache: 'no-store' });

  if (!result.data) {
    throw new ApiError(
      'Could not verify reviewer access. Refresh your account and try again.',
      result.error?.code,
    );
  }

  return result.data;
}

export async function reviewResume(body: ResumeReviewInput, csrf: string, signal: AbortSignal) {
  const result = await client.POST('/api/v1/resume-review', {
    body,
    headers: { 'x-csrf-token': csrf },
    signal,
    cache: 'no-store',
  });

  if (!result.data) {
    throw new ApiError(
      result.error?.message ?? 'Could not review your resume.',
      result.error?.code,
    );
  }

  return result.data;
}
