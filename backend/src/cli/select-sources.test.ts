import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../infrastructure/registry.js';
import { selectSources } from './select-sources.js';

const { companies, sources } = loadRegistry();

describe('manual source selection', () => {
  it('retains all scheduled sources in company priority and board registry order', () => {
    const selected = selectSources(companies, [...sources].reverse(), { 'all-enabled': true });

    expect(selected).toHaveLength(sources.filter((source) => source.scheduled).length);

    expect(selected.map((source) => source.id)).toEqual(
      companies.flatMap((company) =>
        [...sources]
          .reverse()
          .filter((source) => source.companySlug === company.slug && source.scheduled)
          .map((source) => source.id),
      ),
    );
  });

  it('includes every board of a manually selected company even when disabled', () => {
    const registry = sources.map((source) => ({ ...source, scheduled: false }));

    expect(selectSources(companies, registry, { company: 'radix-trading' })).toHaveLength(2);
  });

  it('includes a source onboarded to a formerly deferred company', () => {
    const source = { ...sources[0]!, companySlug: 'microsoft' };

    expect(selectSources(companies, [source], { 'all-enabled': true })).toEqual([source]);
  });

  it('rejects conflicting, empty and missing selections', () => {
    for (const selection of [
      {},
      { company: 'figma', 'all-enabled': true },
      { company: 'missing' },
    ]) {
      expect(() => selectSources(companies, sources, selection)).toThrow();
    }
  });
});
