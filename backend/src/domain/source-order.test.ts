import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../infrastructure/registry.js';
import { orderCompanies } from './source-order.js';

describe('manual refresh order', () => {
  const { companies } = loadRegistry();

  it('uses listed priorities then appends every unlisted company deterministically', () => {
    const ordered = orderCompanies([...companies].reverse(), ['microsoft', 'figma']);

    expect(ordered.slice(0, 2).map((company) => company.slug)).toEqual(['microsoft', 'figma']);
    expect(new Set(ordered.map((company) => company.slug)).size).toBe(companies.length);

    expect(ordered.slice(2).map((company) => company.slug)).toEqual(
      companies
        .map((company) => company.slug)
        .filter((slug) => !['microsoft', 'figma'].includes(slug))
        .sort(),
    );
  });

  it('rejects unknown and duplicate priorities', () => {
    expect(() => orderCompanies(companies, ['figma', 'figma'])).toThrow('duplicate or unknown');
    expect(() => orderCompanies(companies, ['nonexistent'])).toThrow('duplicate or unknown');
  });
});
