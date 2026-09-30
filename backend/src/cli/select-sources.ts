import type { Company, Source } from '../domain/model.js';

interface SyncSelection {
  company?: string;
  wave?: string;
  'all-enabled'?: boolean;
}

export function selectSources(
  companies: Company[],
  sources: Source[],
  selection: SyncSelection,
): Source[] {
  const selectors = [
    selection.company !== undefined,
    selection.wave !== undefined,
    selection['all-enabled'] === true,
  ].filter(Boolean).length;

  if (selectors !== 1) {
    throw new Error('Specify exactly one of --company <slug>, --wave <A|B|C> or --all-enabled.');
  }

  if (selection.wave !== undefined && !['A', 'B', 'C'].includes(selection.wave)) {
    throw new Error('Wave must be A, B or C.');
  }

  const waveCompanies = new Set(
    companies.filter((company) => company.wave === selection.wave).map((company) => company.slug),
  );

  const matching = sources.filter((source) => {
    if (selection.company !== undefined) {
      return source.companySlug === selection.company;
    }

    if (selection.wave !== undefined) {
      return waveCompanies.has(source.companySlug);
    }

    return source.scheduled;
  });

  if (!matching.length) {
    throw new Error('No matching sources for the requested selection.');
  }

  return matching;
}
