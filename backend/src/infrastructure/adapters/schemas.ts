import { z } from 'zod';

export const text = z.string().trim().min(1);

export const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);

  return url.protocol === 'https:' && !url.username && !url.password && !url.port;
}, 'Expected a public HTTPS URL');

export const identifier = z.union([text, z.number().int()]).transform(String);

export function decode<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Upstream schema mismatch (${result.error.issues.length} issues): ${details}`);
}

export function workplace(value?: string | boolean): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  if (value === true || value === 'Remote' || value === 'remote') {
    return 'remote';
  }

  if (value === 'Hybrid' || value === 'hybrid') {
    return 'hybrid';
  }

  if (value === 'OnSite' || value === 'on-site') {
    return 'onsite';
  }

  return 'unknown';
}

export function vacancyExcluded(title: string): boolean {
  return /\b(talent (?:community|pool|network)|general application|expression of interest)\b/i.test(
    title,
  );
}
