import type {
  Dataset,
  Extraction,
  NormalizedPosting,
  RawResponse,
  Source,
  SourceRun,
} from '../domain/model.js';

export interface JsonTransport {
  get(url: string): Promise<RawResponse>;
}

export interface JsonSearchTransport extends JsonTransport {
  post(url: string, body: unknown): Promise<RawResponse>;
}

export interface HtmlTransport {
  getHtml(url: string): Promise<RawResponse & { body: string }>;
}

export interface SourceAdapter {
  extract(source: Source): Promise<Extraction>;
}

export interface PostingValidation {
  validate(source: Source, extraction: Extraction): Promise<RawResponse[]>;
}

export interface HtmlPreparation {
  prepare(html: string): { html: string; text: string };
}

export interface SnapshotCommit {
  source: Source;
  runId: string;
  observedAt: string;
  postings: NormalizedPosting[];
  rawResponses: RawResponse[];
  excluded: number;
  enumerationComplete: boolean;
}

export interface JobRepository {
  read(): Promise<Dataset>;
  startRun(source: Source, at: string): Promise<SourceRun | null>;
  renewRun(sourceId: string, runId: string, at: string): Promise<boolean>;
  commitSnapshot(commit: SnapshotCommit): Promise<SourceRun>;
  failRun(runId: string, at: string, error: string): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
