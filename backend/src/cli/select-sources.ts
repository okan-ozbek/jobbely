import type { Company, Source } from '../domain/model.js';

interface SyncSelection {
  company?: string;
  'all-enabled'?: boolean;
}

export function selectSources(
  companies: Company[],
  sources: Source[],
  selection: SyncSelection,
): Source[] {
  const selectors = [selection.company !== undefined, selection['all-enabled'] === true].filter(
    Boolean,
  ).length;

  if (selectors !== 1) {
    throw new Error('Specify exactly one of --company <slug> or --all-enabled.');
  }

  const matching = sources.filter((source) => {
    if (selection.company !== undefined) {
      return source.companySlug === selection.company;
    }

    return source.scheduled;
  });

  if (!matching.length) {
    throw new Error('No matching sources for the requested selection.');
  }

  return companies.flatMap((company) =>
    matching.filter((source) => source.companySlug === company.slug),
  );
}
