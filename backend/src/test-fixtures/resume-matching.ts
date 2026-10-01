import { extractRequirements } from '../domain/matching/requirements.js';
import type { FeatureJob, MatchProfile } from '../domain/matching/model.js';
import type { Job } from '../domain/model.js';

export function featureJob(
  text = 'Requirements\nTypeScript required.\n2+ years professional experience.',
  category = 'engineering',
  id = 'job',
): FeatureJob {
  return {
    id,
    sourceId: 'source',
    companySlug: 'meta',
    title: 'Synthetic role',
    url: 'https://example.invalid/job',
    applyUrl: 'https://example.invalid/apply',
    lastSeenAt: '2026-10-01T00:00:00.000Z',
    requirements: extractRequirements({
      descriptionText: text,
      contentHash: 'hash',
      classification: {
        category,
        method: 'source_mapping',
        rule: 'test',
        evidence: '',
        version: '1',
      },
      locations: ['Amsterdam, Netherlands'],
      workplace: 'hybrid',
    }),
  };
}

export function candidate(): MatchProfile {
  return {
    analysisDate: '2026-10-01',
    skills: [
      { id: 'typescript', status: 'work_evidenced' },
      { id: 'kotlin', status: 'user_confirmed' },
    ],
    employment: [
      {
        employer: 'Meta',
        category: 'engineering',
        kind: 'employment',
        relationship: 'direct',
        start: 'Jan 2020',
        end: 'Dec 2023',
      },
    ],
    location: { value: 'Amsterdam, Netherlands', status: 'user_confirmed' },
  };
}

export function storedJob(
  id: string,
  text = 'Requirements\nTypeScript required.\n2 years professional experience.',
): Job {
  return {
    id,
    sourceId: 'source',
    companySlug: 'meta',
    sourcePostingId: id,
    title: 'Synthetic role',
    url: 'https://example.invalid/job',
    applyUrl: 'https://example.invalid/apply',
    descriptionHtml: `<p>${text}</p>`,
    descriptionText: text,
    contentHash: `hash-${id}`,
    classification: {
      category: 'engineering',
      method: 'source_mapping',
      rule: 'test',
      evidence: '',
      version: '1',
    },
    departments: [],
    locations: ['Amsterdam, Netherlands'],
    workplace: 'hybrid',
    employment: 'full time',
    publishedAt: null,
    status: 'active',
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    lastSeenAt: '2026-10-01T00:00:00.000Z',
    missingSince: null,
    missingCount: 0,
    lastMissingAt: null,
    closedAt: null,
  };
}
