import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../infrastructure/registry.js';
import { selectSources } from './select-sources.js';

const { companies, sources } = loadRegistry();

describe('manual sync source selection', () => {
  it('selects all ten Wave A companies and both Radix boards without enabling scheduling', () => {
    const matching = selectSources(companies, sources, { wave: 'A' });

    expect(new Set(matching.map((source) => source.companySlug))).toEqual(
      new Set([
        'openai',
        'anthropic',
        'figma',
        'discord',
        'reddit',
        'palantir',
        'five-rings',
        'radix-trading',
        'headlands',
        'mozilla',
      ]),
    );

    expect(matching).toHaveLength(13);

    expect(
      matching
        .filter((source) => source.companySlug === 'radix-trading')
        .map((source) => source.board),
    ).toEqual(['radixuniversity', 'radixexperienced']);

    expect(matching.every((source) => !source.scheduled)).toBe(true);
  });

  it('selects every source for an individual company', () => {
    expect(selectSources(companies, sources, { company: 'radix-trading' })).toHaveLength(2);
  });

  it('keeps scheduled selection separate from manual wave selection', () => {
    const scheduled = sources.map((source, index) => ({ ...source, scheduled: index === 0 }));

    expect(selectSources(companies, scheduled, { 'all-enabled': true })).toEqual([scheduled[0]]);
  });

  it('rejects missing, conflicting, invalid and empty selections', () => {
    for (const selection of [
      {},
      { company: 'figma', wave: 'A' },
      { wave: 'A', 'all-enabled': true },
      { wave: 'D' },
      { company: 'missing' },
      { wave: 'B' },
      { 'all-enabled': true },
    ]) {
      expect(() => selectSources(companies, sources, selection)).toThrow();
    }
  });
});
