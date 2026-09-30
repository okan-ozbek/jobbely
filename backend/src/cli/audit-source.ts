import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { loadRegistry } from '../infrastructure/registry.js';
import { PublicJsonTransport } from '../infrastructure/http.js';
import { createAdapters } from '../infrastructure/adapters/factory.js';
import { loadAuditPlans, requireVerifiedEvidence } from '../infrastructure/audits/registry.js';
import { SourceAuditor, officialHosts } from '../infrastructure/audits/auditor.js';
import { OfficialPageTransport } from '../infrastructure/audits/official-http.js';
import { assertAuditEvidence } from '../infrastructure/audits/model.js';
import { selectSources } from './select-sources.js';

const { values } = parseArgs({
  options: {
    company: { type: 'string' },
    wave: { type: 'string' },
    activate: { type: 'boolean' },
  },
});

const { companies, sources } = loadRegistry({ validateAudits: false });
const selected = selectSources(companies, sources, values);
const plans = loadAuditPlans();
const transport = new PublicJsonTransport();

const adapters = createAdapters(transport);

const evidenceDirectory = new URL('../../config/audit-evidence/', import.meta.url);
const passedCompanies = new Set<string>();

await mkdir(evidenceDirectory, { recursive: true });

for (const companySlug of new Set(selected.map((source) => source.companySlug))) {
  try {
    const company = companies.find((entry) => entry.slug === companySlug)!;
    const plan = plans.find((entry) => entry.companySlug === companySlug);

    if (!plan) {
      throw new Error(`Missing audit plan: ${companySlug}`);
    }

    const matching = sources.filter((source) => source.companySlug === companySlug);
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const artifactDirectory = `backend/data/audits/${companySlug}/${stamp}/`;
    const directory = new URL(`../../data/audits/${companySlug}/${stamp}/`, import.meta.url);

    await mkdir(directory, { recursive: true });

    const auditor = new SourceAuditor(
      company,
      matching,
      plan,
      new OfficialPageTransport(officialHosts(company, plan)),
      adapters,
    );

    const { report, rawPages, rawResponses, blockers } = await auditor.run(artifactDirectory);

    await writeFile(
      new URL('raw-evidence.json', directory),
      JSON.stringify({ rawPages, rawResponses }, null, 2),
    );

    await writeFile(new URL('report.json', directory), JSON.stringify(report, null, 2));

    await writeFile(
      new URL(`${companySlug}.json`, evidenceDirectory),
      `${JSON.stringify(report, null, 2)}\n`,
    );

    console.log(
      JSON.stringify({
        company: companySlug,
        passed: blockers.length === 0,
        sources: report.sources.map((source) => ({
          source: source.sourceId,
          feed: source.feedCount,
          official: source.officialCount,
          matched: source.matchedCount,
          linkedLocationVariants: source.coveredVariants.length,
          missingFromFeed: source.missingFromFeed.length,
          missingFromOfficial: source.missingFromOfficial.length,
        })),
        blockers,
        artifactDirectory,
      }),
    );

    if (blockers.length) {
      process.exitCode = 1;
    } else {
      assertAuditEvidence(report, plan, matching);
      passedCompanies.add(companySlug);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        company: companySlug,
        error: error instanceof Error ? error.message : 'Audit failed',
      }),
    );

    process.exitCode = 1;
  }
}

if (values.activate) {
  // Batch activation is all-or-nothing. Failed companies never get promoted by a partial run.
  if (process.exitCode || !passedCompanies.size) {
    throw new Error('Activation refused: every selected company must pass its audit first.');
  }

  const file = new URL('../../config/sources.json', import.meta.url);
  const current = JSON.parse(await readFile(file, 'utf8')) as typeof sources;

  if (JSON.stringify(current) !== JSON.stringify(sources)) {
    throw new Error('Source configuration changed during the audit; rerun before activation.');
  }

  const updated = current.map((source) =>
    passedCompanies.has(source.companySlug)
      ? { ...source, auditStatus: 'verified' as const, scheduled: true }
      : source,
  );

  requireVerifiedEvidence(updated);

  const temporary = new URL('../../config/sources.json.audit-tmp', import.meta.url);

  await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`);
  await rename(temporary, file);
  console.log('Audit passed; selected sources verified and scheduled. Restart the API and worker.');
}
