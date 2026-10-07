import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../api/app.js';
import { JobCatalog } from '../application/catalog.js';
import { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { MatchJobs } from '../application/resume/match-jobs.js';
import { MemoryJobFeatures } from '../infrastructure/storage/feature-memory.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { loadRegistry } from '../infrastructure/registry.js';
import { renderAccountEmail } from '../infrastructure/accounts/account-email-template.js';

const repository = new MemoryJobRepository();
const { companies, sources } = loadRegistry();

const app = await createApp({
  repository,
  renderAccountEmail,
  catalog: new JobCatalog(repository, companies, sources, 'demo'),
  resume: new AnalyzeResume(companies),
  matcher: new MatchJobs(
    new MemoryJobFeatures(() => repository.read()),
    companies,
    sources,
    'demo',
  ),
});

const directory = new URL('../../../contracts/', import.meta.url);

await mkdir(directory, { recursive: true });
await writeFile(new URL('openapi.json', directory), JSON.stringify(app.swagger(), null, 2) + '\n');
await app.close();
