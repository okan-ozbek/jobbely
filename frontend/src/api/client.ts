import createClient from 'openapi-fetch';
import type { paths } from './generated/schema.js';

export type Job =
  paths['/api/v1/jobs/{id}']['get']['responses'][200]['content']['application/json'];

export type Company =
  paths['/api/v1/companies']['get']['responses'][200]['content']['application/json'][number];

export type JobsQuery = NonNullable<paths['/api/v1/jobs']['get']['parameters']['query']>;

export type ResumeAnalysis =
  paths['/api/v1/resume-analysis']['post']['responses'][200]['content']['application/json'];

export type ResumeInput =
  paths['/api/v1/resume-analysis']['post']['requestBody']['content']['application/json'];

export type ResumeCorrections = NonNullable<ResumeInput['corrections']>;

export type EmploymentCorrection = NonNullable<ResumeCorrections['employment']>[number];

export type JobRequirements =
  paths['/api/v1/jobs/{id}/requirements']['get']['responses'][200]['content']['application/json'];

export type MatchInput =
  paths['/api/v1/resume-matches']['post']['requestBody']['content']['application/json'];

export type MatchResponse =
  paths['/api/v1/resume-matches']['post']['responses'][200]['content']['application/json'];

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
});

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'request_failed',
  ) {
    super(message);
  }
}

export async function listJobs(query: JobsQuery, signal?: AbortSignal) {
  const result = await client.GET('/api/v1/jobs', {
    params: { query },
    ...(signal ? { signal } : {}),
  });

  if (!result.data) {
    throw new ApiError(result.error?.message ?? 'Could not load listings.', result.error?.code);
  }

  return result.data;
}

export async function listCompanies(signal?: AbortSignal) {
  const result = await client.GET('/api/v1/companies', signal ? { signal } : {});

  if (!result.data) {
    throw new ApiError('Could not load companies.');
  }

  return result.data;
}

export async function listCategories(signal?: AbortSignal) {
  const result = await client.GET('/api/v1/categories', signal ? { signal } : {});

  if (!result.data) {
    throw new ApiError('Could not load categories.');
  }

  return result.data;
}

export async function getJob(id: string, signal?: AbortSignal) {
  const result = await client.GET('/api/v1/jobs/{id}', {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  });

  if (!result.data) {
    throw new ApiError(result.error?.message ?? 'Could not load this listing.');
  }

  return result.data;
}

export async function analyzeResume(body: ResumeInput, signal?: AbortSignal) {
  const result = await client.POST('/api/v1/resume-analysis', {
    body,
    ...(signal ? { signal } : {}),
    cache: 'no-store',
  });

  if (!result.data) {
    throw new ApiError(
      result.error?.message ?? 'Could not analyze this resume.',
      result.error?.code,
    );
  }

  return result.data;
}

export async function getRequirements(id: string, signal?: AbortSignal) {
  const result = await client.GET('/api/v1/jobs/{id}/requirements', {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  });

  if (!result.data) {
    throw new ApiError('Could not load job requirements.');
  }

  return result.data;
}

export async function matchResume(body: MatchInput, signal?: AbortSignal) {
  const result = await client.POST('/api/v1/resume-matches', {
    body,
    ...(signal ? { signal } : {}),
    cache: 'no-store',
  });

  if (!result.data) {
    throw new ApiError(
      result.error?.message ?? 'Could not match this profile.',
      result.error?.code,
    );
  }

  return result.data;
}
