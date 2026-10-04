import { expect, it } from 'vitest';
import { inferMatchingFunction } from './matching-function.js';
import type { ResumeAnalysis } from '../../api/client.js';

function profile(
  roles: ResumeAnalysis['employment'],
  relevant: ResumeAnalysis['experience']['relevant'] = [],
) {
  return { employment: roles, experience: { relevant } } as ResumeAnalysis;
}

it('infers the dominant supported function from unioned experience rather than forcing engineering', () => {
  const analysis = profile(
    [],
    [
      {
        category: 'engineering',
        duration: { minimumMonths: 12, maximumMonths: 12, unknownEntries: 0 },
      },
      {
        category: 'product',
        duration: { minimumMonths: 36, maximumMonths: 36, unknownEntries: 0 },
      },
    ],
  );

  expect(inferMatchingFunction(analysis)?.id).toBe('product');
});

it('uses undated professional/internship roles and falls back to all functions for unsupported profiles', () => {
  const roles = [
    { category: 'sales', kind: 'employment' },
    { category: 'engineering', kind: 'project' },
  ] as ResumeAnalysis['employment'];

  expect(inferMatchingFunction(profile(roles))?.id).toBe('sales');

  expect(
    inferMatchingFunction(
      profile([{ category: 'design', kind: 'employment' }] as ResumeAnalysis['employment']),
    ),
  ).toBeNull();
});
