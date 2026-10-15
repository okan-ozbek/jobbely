import type { Company, Extraction, Source, SourceRun } from '../domain/model.js';

export interface CompanyAudit {
  status: 'passed' | 'blocked' | 'failed';
  blockers: string[];
  reportPath: string | null;
}

export interface SourceRefreshReport {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'succeeded' | 'completed_with_issues' | 'failed';
  current: {
    company: string | null;
    source: string | null;
    stage: 'sync' | 'audit' | 'backfill';
  } | null;
  companies: {
    company: string;
    sources: {
      source: string;
      status: 'succeeded' | 'failed';
      runId: string | null;
      listings: number;
      error: string | null;
    }[];
    audit: CompanyAudit | null;
  }[];
  backfillError: string | null;
  error: string | null;
}

export interface SourceSync {
  executeWithEvidence(
    source: Source,
    signal?: AbortSignal,
  ): Promise<{ run: SourceRun; extraction: Extraction }>;
}

export interface CompanyAudits {
  verify(
    runId: string,
    company: Company,
    sources: Source[],
    snapshots: ReadonlyMap<string, Extraction>,
    sourceRunIds: ReadonlyMap<string, string>,
  ): Promise<CompanyAudit>;
}

export interface SourceRefreshReports {
  save(report: SourceRefreshReport): Promise<void>;
}
