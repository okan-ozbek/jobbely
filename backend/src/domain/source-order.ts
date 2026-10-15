import type { Company } from './model.js';

// Newly configured employers remain eligible even before the priority list is edited.
export function orderCompanies(companies: Company[], priority: string[]): Company[] {
  const bySlug = new Map(companies.map((company) => [company.slug, company]));

  if (new Set(priority).size !== priority.length || priority.some((slug) => !bySlug.has(slug))) {
    throw new Error('Refresh order contains duplicate or unknown company slugs');
  }

  const selected = new Set(priority);

  return [
    ...priority.map((slug) => bySlug.get(slug)!),
    ...companies
      .filter((company) => !selected.has(company.slug))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  ];
}
