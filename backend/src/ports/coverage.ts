export interface CoverageAssessment {
  companySlug: string;
  configurationHash: string;
  checkedAt: string;
  status: 'verified' | 'partial';
  sourceRunIds: Record<string, string>;
  blockers: string[];
  accessStatus: 'approved' | 'unreviewed' | 'blocked';
}

export interface CoverageRepository {
  read(): Promise<CoverageAssessment[]>;
  save(assessment: CoverageAssessment): Promise<void>;
  close(): Promise<void>;
}
