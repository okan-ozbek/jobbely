import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../infrastructure/registry.js';
import { selectSources } from './select-sources.js';

const { companies, sources } = loadRegistry();

describe('manual sync source selection', () => {
  it('selects all ten Wave A companies and both Radix boards with scheduling independent of verification', () => {
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

    expect(matching.every((source) => source.scheduled && source.auditStatus === 'candidate')).toBe(
      true,
    );
  });

  it('selects every source for an individual company', () => {
    expect(selectSources(companies, sources, { company: 'radix-trading' })).toHaveLength(2);
  });

  it('selects all 31 Wave B integrations, including the explicitly restricted LinkedIn source', () => {
    const matching = selectSources(companies, sources, { wave: 'B' });

    expect(matching).toHaveLength(31);

    expect(new Set(matching.map((source) => source.companySlug))).toEqual(
      new Set(companies.filter((company) => company.wave === 'B').map((company) => company.slug)),
    );
  });

  it('keeps scheduled selection separate from manual wave selection', () => {
    const scheduled = sources.map((source, index) => ({ ...source, scheduled: index === 0 }));

    expect(selectSources(companies, scheduled, { 'all-enabled': true })).toEqual([scheduled[0]]);
  });

  it('selects the scheduled Wave C priorities and backlog expansions without verifying them', () => {
    const matching = selectSources(companies, sources, { wave: 'C' });

    expect(matching.map((source) => source.companySlug)).toEqual([
      'meta',
      'apple',
      'netflix',
      'google',
      'amazon',
      'atlassian',
      'shopify',
      'hubspot',
      'servicenow',
      'adyen',
      'asml',
      'canva',
      'notion',
      'vercel',
      'mistral-ai',
      'cohere',
      'hugging-face',
      'perplexity',
      'anysphere',
      'replit',
      'lovable',
      'elevenlabs',
      'runway',
      'supabase',
      'linear',
      'synthesia',
    ]);

    expect(matching.every((source) => source.auditStatus === 'candidate' && source.scheduled)).toBe(
      true,
    );
  });

  it('keeps the seven deferred Wave D employers registered without configuring sources', () => {
    const deferred = companies.filter((company) => company.wave === 'D');

    expect(deferred.map((company) => company.slug)).toEqual([
      'microsoft',
      'oracle',
      'x',
      'ibm',
      'jpmorgan',
      'goldman-sachs',
      'abn-amro',
    ]);

    expect(() => selectSources(companies, sources, { wave: 'D' })).toThrow(
      'No matching sources for the requested selection.',
    );
  });

  it('selects a Wave D source when one is onboarded', () => {
    const candidate = { ...sources[0]!, companySlug: 'microsoft' };

    expect(selectSources(companies, [candidate], { wave: 'D' })).toEqual([candidate]);
  });

  it('rejects missing, conflicting, invalid and empty selections', () => {
    for (const selection of [
      {},
      { company: 'figma', wave: 'A' },
      { wave: 'A', 'all-enabled': true },
      { wave: 'E' },
      { company: 'missing' },
    ]) {
      expect(() => selectSources(companies, sources, selection)).toThrow();
    }

    expect(() =>
      selectSources(
        companies,
        sources.map((source) => ({ ...source, scheduled: false })),
        { 'all-enabled': true },
      ),
    ).toThrow('No matching sources');
  });
});
