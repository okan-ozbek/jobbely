import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JobMatchResponse } from '../../api/client.js';
import { MatchMetrics } from './MatchMetrics.js';

function render(fitScore: number | null, total = 2, limited = false) {
  const comparison: JobMatchResponse['comparison'] = {
    baseScore: 100,
    fitScore,
    assessmentCoverage: {
      assessed: total ? total - 1 : 0,
      total,
      percentage: 50,
      limited,
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
  it('shows weighted qualification fit and an unassessable count instead of needs review', () => {
    const html = render(62.5);

    expect(html).toContain('<dd>62.5%</dd>');
    expect(html).toContain('1 unassessable');
    expect(html).toContain('yellow or unassessable qualifications 25%');
    expect(html).not.toContain('Needs review');
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

  it('withholds percentages for truncated analysis without presenting it as a review task', () => {
    const html = render(null, 2, true);

    expect(html).toContain('<dd>Analysis incomplete</dd>');
    expect(html).not.toContain('<dd>100%</dd>');
  });
});
