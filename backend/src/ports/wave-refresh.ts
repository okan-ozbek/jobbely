import type { Company, Extraction, Source, SourceRun } from '../domain/model.js';

export type RefreshWave = 'A' | 'B' | 'C';

export interface WaveCompanyAudit {
  status: 'passed' | 'blocked' | 'failed';
  blockers: string[];
  reportPath: string | null;
}

export interface WaveRefreshReport {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'succeeded' | 'completed_with_issues' | 'failed';
  current: {
    wave: RefreshWave;
    company: string | null;
    source: string | null;
    stage: 'sync' | 'audit' | 'backfill';
  } | null;
  waves: {
    wave: RefreshWave;
    companies: {
      company: string;
      sources: {
        source: string;
        status: 'succeeded' | 'failed';
        runId: string | null;
        listings: number;
        error: string | null;
      }[];
      audit: WaveCompanyAudit | null;
    }[];
    backfillError: string | null;
  }[];
  error: string | null;
}

export interface WaveSourceSync {
  executeWithEvidence(
    source: Source,
    signal?: AbortSignal,
  ): Promise<{ run: SourceRun; extraction: Extraction }>;
}

export interface WaveAudits {
  verify(
    runId: string,
    company: Company,
    sources: Source[],
    snapshots: ReadonlyMap<string, Extraction>,
    sourceRunIds: ReadonlyMap<string, string>,
  ): Promise<WaveCompanyAudit>;
}

export interface WaveRefreshReports {
  save(report: WaveRefreshReport): Promise<void>;
}
