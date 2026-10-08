import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JobMatchResponse } from '../../api/client.js';
import { MatchMetrics } from './MatchMetrics.js';

function render(fitScore: number | null, total = 2) {
  const comparison: JobMatchResponse['comparison'] = {
    baseScore: 100,
    fitScore,
    assessmentCoverage: {
      assessed: fitScore === null ? 1 : total,
      total,
      percentage: 50,
      limited: false,
    },
    band: 'review',
    requiredGaps: 0,
    unresolvedRequirements: 1,
    skills: [],
    experience: [],
    education: [],
    roleRelevancePoints: 5,
    uncertainties: [],
  };

  return renderToStaticMarkup(createElement(MatchMetrics, { comparison }));
}

describe('fit presentation', () => {
  it('withholds a sparse perfect ranking score when comparison is unresolved', () => {
    const html = render(null);

    expect(html).toContain('<dd>Needs review</dd>');
    expect(html).not.toContain('<dd>100%</dd>');
  });

  it('uses qualification fit rather than the ranking score and cannot round a gap into perfection', () => {
    expect(render(80)).toContain('<dd>80%</dd>');
    expect(render(99.99)).toContain('<dd>99.9%</dd>');
    expect(render(100)).toContain('<dd>100%</dd>');
  });

  it('describes a job with no identified criteria as insufficient information', () => {
    expect(render(null, 0)).toContain('<dd>Not enough information</dd>');
  });
});
