import { mkdir, rename, writeFile } from 'node:fs/promises';
import type { Company, Extraction, Provider, Source } from '../../domain/model.js';
import type { SourceAdapter } from '../../ports/ingestion.js';
import type {
  WaveAudits,
  WaveRefreshReport,
  WaveRefreshReports,
} from '../../ports/wave-refresh.js';
import { SourceAuditor, officialHosts } from './auditor.js';
import { OfficialPageTransport } from './official-http.js';
import { loadAuditPlans } from './registry.js';

function segment(value: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(value)) {
    throw new Error('Invalid refresh artifact identifier');
  }

  return value;
}

async function atomicJson(file: URL, value: unknown) {
  const temporary = new URL(`${file.href}.tmp`);

  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

export class FileWaveRefreshReports implements WaveRefreshReports {
  constructor(private readonly directory = new URL('../../../data/wave-sync/', import.meta.url)) {}

  async save(report: WaveRefreshReport) {
    await mkdir(this.directory, { recursive: true });
    await atomicJson(new URL(`${segment(report.id)}.json`, this.directory), report);
    await atomicJson(new URL('latest.json', this.directory), report);

    console.log(
      JSON.stringify({
        event: 'wave-refresh',
        id: report.id,
        status: report.status,
        current: report.current,
      }),
    );
  }
}

export class FileWaveAudits implements WaveAudits {
  constructor(
    private readonly adapters: Readonly<Record<Provider, SourceAdapter>>,
    private readonly directory = new URL('../../../data/wave-sync/', import.meta.url),
  ) {}

  async verify(
    runId: string,
    company: Company,
    sources: Source[],
    snapshots: ReadonlyMap<string, Extraction>,
  ) {
    const plan = loadAuditPlans().find((entry) => entry.companySlug === company.slug);

    if (!plan) {
      throw new Error(`Missing audit plan: ${company.slug}`);
    }

    const directory = new URL(`${segment(runId)}/${segment(company.slug)}/`, this.directory);

    await mkdir(directory, { recursive: true });

    const auditor = new SourceAuditor(
      company,
      sources,
      plan,
      new OfficialPageTransport(officialHosts(company, plan)),
      this.adapters,
    );

    const artifactDirectory = `data/wave-sync/${runId}/${company.slug}/`;
    const reportPath = `${artifactDirectory}report.json`;

    const { report, rawPages, blockers } = await auditor.run(
      artifactDirectory,
      undefined,
      snapshots,
    );

    // Feed evidence is already stored atomically with its successful source run.
    await atomicJson(new URL('raw-pages.json', directory), rawPages);
    await atomicJson(new URL('report.json', directory), report);

    return {
      status: blockers.length ? ('blocked' as const) : ('passed' as const),
      blockers,
      reportPath,
    };
  }
}
