import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { JobCatalog } from '../application/catalog.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { loadRegistry } from '../infrastructure/registry.js';
import { seedDemo } from '../infrastructure/demo.js';
import type { FastifyInstance } from 'fastify';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const repository = new MemoryJobRepository();
  const { companies, sources } = loadRegistry();

  await seedDemo(repository, sources);

  const app = await createApp({
    repository,
    catalog: new JobCatalog(repository, companies, sources, 'demo'),
  });

  apps.push(app);

  return { app, repository, sources };
}

describe('read API and contract', () => {
  it('serves directory, catalog, facets and details without reading full repository snapshots', async () => {
    const { app, repository } = await setup();

    vi.spyOn(repository, 'read').mockRejectedValue(new Error('Full snapshot should not be read'));

    expect((await app.inject('/api/v1/companies')).statusCode).toBe(200);
    expect((await app.inject('/api/v1/jobs/facets')).statusCode).toBe(200);

    const list = await app.inject('/api/v1/jobs?limit=1');

    expect(list.statusCode).toBe(200);
    expect((await app.inject(`/api/v1/jobs/${list.json().items[0].id}`)).statusCode).toBe(200);
    expect(repository.read).not.toHaveBeenCalled();
  });

  it('lists all registered companies and explicitly labels demo data', async () => {
    const { app } = await setup();

    const companies = (await app.inject('/api/v1/companies')).json();

    expect(companies).toHaveLength(loadRegistry().companies.length);

    expect(companies.map((company: { logoUrl: string }) => company.logoUrl)).toEqual(
      loadRegistry().companies.map((company) => company.logoUrl),
    );

    expect((await app.inject('/api/v1/companies/meta')).json()).toMatchObject({
      logoUrl: '/logos/meta.svg',
    });

    expect((await app.inject('/api/v1/companies/atlassian')).json()).toMatchObject({
      name: 'Atlassian',
      logoUrl: '/logos/default.svg',
    });

    expect((await app.inject('/api/v1/companies/shopify')).json()).toMatchObject({
      name: 'Shopify',
      logoUrl: '/logos/default.svg',
    });

    expect((await app.inject('/api/v1/companies/hubspot')).json()).toMatchObject({
      name: 'HubSpot',
      careersUrl: 'https://www.hubspot.com/careers/jobs',
      logoUrl: '/logos/default.svg',
    });

    expect((await app.inject('/api/v1/companies/servicenow')).json()).toMatchObject({
      name: 'ServiceNow',
      careersUrl: 'https://careers.servicenow.com/jobs/',
      logoUrl: '/logos/default.svg',
    });

    expect((await app.inject('/api/v1/companies/adyen')).json()).toMatchObject({
      name: 'Adyen',
      careersUrl: 'https://careers.adyen.com/vacancies',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'adyen', provider: 'greenhouse', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/asml')).json()).toMatchObject({
      name: 'ASML',
      careersUrl: 'https://www.asml.com/en/careers/find-your-job',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'asml', provider: 'asml', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/canva')).json()).toMatchObject({
      name: 'Canva',
      careersUrl: 'https://www.lifeatcanva.com/en/jobs/',
      logoUrl: '/logos/default.svg',
      sources: [
        { id: 'canva', provider: 'smartrecruiters', auditStatus: 'candidate', scheduled: true },
      ],
    });

    expect((await app.inject('/api/v1/companies/notion')).json()).toMatchObject({
      name: 'Notion',
      careersUrl: 'https://www.notion.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'notion', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/vercel')).json()).toMatchObject({
      name: 'Vercel',
      careersUrl: 'https://vercel.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [
        { id: 'vercel', provider: 'greenhouse', auditStatus: 'candidate', scheduled: true },
      ],
    });

    expect((await app.inject('/api/v1/companies/mistral-ai')).json()).toMatchObject({
      name: 'Mistral AI',
      careersUrl: 'https://mistral.ai/careers/',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'mistral-ai', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/cohere')).json()).toMatchObject({
      name: 'Cohere',
      careersUrl: 'https://cohere.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'cohere', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/hugging-face')).json()).toMatchObject({
      name: 'Hugging Face',
      careersUrl: 'https://huggingface.co/',
      logoUrl: '/logos/default.svg',
      sources: [
        { id: 'hugging-face', provider: 'workable', auditStatus: 'candidate', scheduled: true },
      ],
    });

    expect((await app.inject('/api/v1/companies/perplexity')).json()).toMatchObject({
      name: 'Perplexity',
      careersUrl: 'https://www.perplexity.ai/hub/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'perplexity', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/anysphere')).json()).toMatchObject({
      name: 'Anysphere (Cursor)',
      careersUrl: 'https://cursor.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'anysphere', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/replit')).json()).toMatchObject({
      name: 'Replit',
      careersUrl: 'https://replit.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'replit', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/lovable')).json()).toMatchObject({
      name: 'Lovable',
      careersUrl: 'https://lovable.dev/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'lovable', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/elevenlabs')).json()).toMatchObject({
      name: 'ElevenLabs',
      careersUrl: 'https://elevenlabs.io/careers/positions',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'elevenlabs', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/runway')).json()).toMatchObject({
      name: 'Runway',
      careersUrl: 'https://runway.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'runway', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/supabase')).json()).toMatchObject({
      name: 'Supabase',
      careersUrl: 'https://supabase.com/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'supabase', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/linear')).json()).toMatchObject({
      name: 'Linear',
      careersUrl: 'https://linear.app/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'linear', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/companies/synthesia')).json()).toMatchObject({
      name: 'Synthesia',
      careersUrl: 'https://www.synthesia.io/careers',
      logoUrl: '/logos/default.svg',
      sources: [{ id: 'synthesia', provider: 'ashby', auditStatus: 'candidate', scheduled: true }],
    });

    expect((await app.inject('/api/v1/jobs')).json()).toMatchObject({
      mode: 'demo',
      total: 6,
    });
  });

  it('combines filters and exposes sanitized full details without internal hashes', async () => {
    const { app } = await setup();
    const list = (await app.inject('/api/v1/jobs?company=openai&category=product')).json();

    expect(list.total).toBe(1);
    expect(list.items[0]).not.toHaveProperty('contentHash');

    const detail = (await app.inject(`/api/v1/jobs/${list.items[0].id}`)).json();

    expect(detail.descriptionHtml).toContain('Synthetic');
  });

  it('validates page sizes and unsupported query parameters', async () => {
    const { app } = await setup();

    expect((await app.inject('/api/v1/jobs?limit=1000')).statusCode).toBe(400);
    expect((await app.inject('/api/v1/jobs?arbitrary=true')).statusCode).toBe(400);
    expect((await app.inject('/api/v1/jobs?workplace=spaceship')).statusCode).toBe(400);
  });

  it('filters country and city from the same label, exposes facets and binds cursors to locations', async () => {
    const { app } = await setup();
    const facetResponse = await app.inject('/api/v1/jobs/facets');

    expect(facetResponse.statusCode).toBe(200);

    const facets = facetResponse.json();

    expect(facets.countries.length).toBeGreaterThan(0);

    const country = facets.countries[0].value;
    const countryFacets = (await app.inject(`/api/v1/jobs/facets?country=${country}`)).json();
    const city = countryFacets.cities[0].value;

    const list = await app.inject(
      `/api/v1/jobs?country=${country}&city=${encodeURIComponent(city)}`,
    );

    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBeGreaterThan(0);
    expect((await app.inject('/api/v1/jobs?country=XX&city=Atlantis')).json().total).toBe(0);

    const first = (await app.inject('/api/v1/jobs?limit=1')).json();

    expect(
      (await app.inject(`/api/v1/jobs?limit=1&country=${country}&cursor=${first.nextCursor}`))
        .statusCode,
    ).toBe(400);
  });

  it('paginates without overlaps and rejects cursors after publication', async () => {
    const { app, repository, sources } = await setup();
    const first = (await app.inject('/api/v1/jobs?limit=2')).json();
    const second = (await app.inject(`/api/v1/jobs?limit=2&cursor=${first.nextCursor}`)).json();

    expect(
      second.items.every(
        (job: { id: string }) => !first.items.some((other: { id: string }) => other.id === job.id),
      ),
    ).toBe(true);

    const source = sources[0]!;
    const run = await repository.startRun(source, new Date().toISOString());

    await repository.commitSnapshot({
      source,
      runId: run!.id,
      observedAt: new Date().toISOString(),
      postings: [],
      rawResponses: [],
      excluded: 0,
      enumerationComplete: false,
    });

    expect((await app.inject(`/api/v1/jobs?limit=2&cursor=${first.nextCursor}`)).statusCode).toBe(
      409,
    );
  });

  it('returns a 404 for missing records and does not expose crawl endpoints', async () => {
    const { app } = await setup();

    expect((await app.inject('/api/v1/jobs/missing')).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/v1/sync' })).statusCode).toBe(404);
  });
});
