import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../api/app.js';
import { JobCatalog } from '../application/catalog.js';
import { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { loadRegistry } from '../infrastructure/registry.js';

const repository = new MemoryJobRepository();
const { companies, sources } = loadRegistry();

const app = await createApp({
  repository,
  catalog: new JobCatalog(repository, companies, sources, 'demo'),
  resume: new AnalyzeResume(companies),
});

const directory = new URL('../../../contracts/', import.meta.url);

await mkdir(directory, { recursive: true });
await writeFile(new URL('openapi.json', directory), JSON.stringify(app.swagger(), null, 2) + '\n');
await app.close();
