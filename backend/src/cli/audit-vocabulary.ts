import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { auditPublicVocabulary } from '../infrastructure/audits/vocabulary.js';

if (process.env.DATA_MODE !== 'postgres' || !process.env.DATABASE_URL) {
  throw new Error('Vocabulary audit requires DATA_MODE=postgres and DATABASE_URL.');
}

const report = await auditPublicVocabulary(process.env.DATABASE_URL);

await mkdir('data', { recursive: true });
await writeFile('data/vocabulary-audit.json', JSON.stringify(report, null, 2));

// Do not print descriptions, connection settings or candidate data to logs.
console.log(
  JSON.stringify({
    postings: report.postings,
    companies: report.companies,
    recurringCandidates: report.recurringCandidates,
    reportedCandidates: report.reportedCandidates,
    truncatedDescriptions: report.truncatedDescriptions,
    output: 'data/vocabulary-audit.json',
  }),
);
