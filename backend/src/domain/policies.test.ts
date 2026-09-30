import { describe, expect, it } from 'vitest';
import { classify, LabelMappingStrategy, TitleRuleStrategy } from './classification.js';
import { markMissing } from './lifecycle.js';
import type { ExtractedPosting, Job } from './model.js';
const posting: ExtractedPosting = {
  sourcePostingId: '1',
  title: 'Program Manager',
  url: 'https://example.com/1',
  applyUrl: 'https://example.com/1',
  descriptionHtml: '<p>work</p>',
  departments: [],
  locations: [],
  workplace: 'unknown',
  employment: 'unknown',
  publishedAt: null,
};
const strategies = [new LabelMappingStrategy(), new TitleRuleStrategy()];
describe('explainable classification', () => {
  it('maps original labels and retains evidence', () => {
    expect(classify({ ...posting, departments: ['People'] }, 'test', strategies)).toMatchObject({
      category: 'people',
      evidence: 'people',
      method: 'source_mapping',
    });
  });
  it('handles specific commercial titles and leaves ambiguous roles unknown', () => {
    expect(
      classify({ ...posting, title: 'Senior Sales Engineer' }, 'test', strategies).category,
    ).toBe('sales');
    expect(classify(posting, 'test', strategies).category).toBe('unclassified');
    expect(
      classify({ ...posting, title: 'Sales Engineer / Software Engineer' }, 'test', strategies)
        .category,
    ).toBe('unclassified');
  });
  it('does not arbitrarily pick between conflicting source departments', () => {
    expect(
      classify({ ...posting, departments: ['Engineering', 'People'] }, 'test', strategies).category,
    ).toBe('unclassified');
  });
  it('lets explicit company mappings outrank global labels', () => {
    expect(
      classify({ ...posting, departments: ['Core Services'] }, 'test', [
        new LabelMappingStrategy({ test: { 'core services': 'engineering' } }),
        ...strategies,
      ]).category,
    ).toBe('engineering');
  });
});
describe('absence policy', () => {
  const job: Job = {
    ...posting,
    id: 'id',
    sourceId: 'source',
    companySlug: 'test',
    status: 'active',
    firstSeenAt: '2026-09-30T00:00:00.000Z',
    lastSeenAt: '2026-09-30T00:00:00.000Z',
    descriptionText: 'work',
    classification: classify(posting, 'test', strategies),
    contentHash: 'hash',
    missingCount: 0,
    missingSince: null,
    lastMissingAt: null,
    closedAt: null,
  };
  it('requires multiple observations spanning at least 24 hours', () => {
    const first = markMissing(job, '2026-10-01T00:00:00.000Z');
    expect(first.status).toBe('active');
    expect(markMissing(first, '2026-10-01T12:00:00.000Z').status).toBe('active');
    expect(markMissing(first, '2026-10-02T00:00:00.000Z').status).toBe('closed');
  });
});
