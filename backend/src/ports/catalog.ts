import type { Job, SourceRun } from '../domain/model.js';

export interface CoverageSnapshot {
  counts: Record<string, number>;
  runs: SourceRun[];
}

export interface CatalogFilter {
  q?: string;
  company?: string;
  category?: string;
  workplace?: string;
}

export type CatalogEntry = Pick<
  Job,
  'id' | 'companySlug' | 'locations' | 'workplace' | 'lastSeenAt'
> & {
  category: string;
};

export interface CatalogSnapshot {
  version: number;
  jobs: CatalogEntry[];
}

export interface CatalogLookups {
  findJob(id: string): Promise<Job | null>;
  searchCatalog(query: CatalogFilter): Promise<CatalogSnapshot>;
  findJobs(ids: string[], version: number): Promise<Job[] | null>;
  coverageSnapshot(companySlugs: string[], sourceIds: string[]): Promise<CoverageSnapshot>;
}
