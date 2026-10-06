export type Provider =
  | 'greenhouse'
  | 'ashby'
  | 'lever'
  | 'workday'
  | 'icims'
  | 'linkedin'
  | 'apple'
  | 'amazon'
  | 'eightfold'
  | 'atlassian'
  | 'shopify'
  | 'hubspot'
  | 'meta'
  | 'google';

export type AuditStatus = 'candidate' | 'verified';

export interface Source {
  id: string;
  companySlug: string;
  provider: Provider;
  board: string;
  auditStatus: AuditStatus;
  scheduled: boolean;
  endpoint?: string | undefined;
  postingHosts?: string[] | undefined;
  employerFilter?: { field: 'brand' | 'hiring_organization'; values: string[] } | undefined;
}

export interface Company {
  slug: string;
  name: string;
  careersUrl: string;
  logoUrl: string;
  wave: 'A' | 'B' | 'C' | 'D';
}

export interface ExtractedPosting {
  sourcePostingId: string;
  title: string;
  url: string;
  applyUrl: string;
  descriptionHtml: string;
  departments: string[];
  locations: string[];
  workplace: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  employment: string;
  publishedAt: string | null;
}

export interface Classification {
  category: string;
  method: 'source_mapping' | 'title_rule' | 'unclassified';
  rule: string;
  evidence: string;
  version: string;
}

export interface NormalizedPosting extends Omit<ExtractedPosting, 'descriptionHtml'> {
  descriptionHtml: string;
  descriptionText: string;
  classification: Classification;
  contentHash: string;
}

export interface Job extends NormalizedPosting {
  id: string;
  sourceId: string;
  companySlug: string;
  status: 'active' | 'closed';
  firstSeenAt: string;
  lastSeenAt: string;
  missingSince: string | null;
  missingCount: number;
  lastMissingAt: string | null;
  closedAt: string | null;
}

export interface RawResponse {
  url: string;
  fetchedAt: string;
  body: unknown;
  request?: { method: 'POST'; body: unknown };
}

export interface Extraction {
  postings: ExtractedPosting[];
  rawResponses: RawResponse[];
  excluded: number;
  enumerationComplete: boolean;
}

export interface SourceRun {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'succeeded' | 'failed';
  listingCount: number;
  excludedCount: number;
  enumerationComplete: boolean;
  removalsQuarantined: boolean;
  error: string | null;
}

export interface Dataset {
  version: number;
  jobs: Job[];
  runs: SourceRun[];
}
