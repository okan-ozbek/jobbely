import type { SourceRun } from '../domain/model.js';
import type { FeatureInput, FeatureJob, StoredFeature } from '../domain/matching/model.js';

export interface FeatureFilter {
  sourceIds: string[];
  cutoff: string;
  categories: string[];
}

export interface FeatureSnapshot {
  datasetVersion: number;
  generation: number;
  eligible: number;
  unenriched: number;
}

export interface JobFeatureRepository {
  pendingFeatures(after: string, limit: number): Promise<FeatureInput[]>;
  saveFeatures(features: StoredFeature[]): Promise<number>;
  latestRuns(): Promise<SourceRun[]>;
  featureSnapshot(filter: FeatureFilter): Promise<FeatureSnapshot>;
  featureJobs(filter: FeatureFilter, after: string, limit: number): Promise<FeatureJob[]>;
}
