import type { ResumeAnalysis } from '../../api/client.js';

export const matchingFunctions = [
  { id: 'engineering', name: 'Engineering' },
  { id: 'data-ai', name: 'Data & AI' },
  { id: 'product', name: 'Product' },
  { id: 'sales', name: 'Sales' },
  { id: 'people', name: 'People' },
] as const;

export function inferMatchingFunction(analysis: ResumeAnalysis) {
  const candidates = matchingFunctions
    .map((item) => ({
      ...item,
      months:
        analysis.experience.relevant.find((entry) => entry.category === item.id)?.duration
          .minimumMonths ?? 0,
      roles: analysis.employment.filter(
        (role) =>
          role.category === item.id && (role.kind === 'employment' || role.kind === 'internship'),
      ).length,
    }))
    .filter((item) => item.months > 0 || item.roles > 0);

  return (
    candidates.sort(
      (a, b) => b.months - a.months || b.roles - a.roles || a.id.localeCompare(b.id),
    )[0] ?? null
  );
}
