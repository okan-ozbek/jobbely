import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { JobCatalog } from '../application/catalog.js';
import { loadRegistry } from '../infrastructure/registry.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const repository = new MemoryJobRepository();
  const { companies, sources } = loadRegistry();

  const app = await createApp({
    repository,
    catalog: new JobCatalog(repository, companies, sources, 'demo'),
    resume: new AnalyzeResume(companies, () => new Date('2026-10-01T00:00:00Z')),
  });

  apps.push(app);

  return { app, repository };
}

describe('transient resume analysis API', () => {
  it('returns evidence and durations without changing the repository or exposing retrieval routes', async () => {
    const { app, repository } = await setup();
    const before = await repository.read();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      payload: {
        text: 'Location: Amsterdam, Netherlands\nExperience\nSoftware Engineer | Meta\nJan 2020 - Dec 2022\nBuilt services using TypeScript.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    expect(response.json()).toMatchObject({
      version: 'text-4',
      analysisDate: '2026-10-01',
      experience: { professional: { minimumMonths: 36 } },
      skills: [{ id: 'typescript', status: 'work_evidenced' }],
    });

    expect(await repository.read()).toEqual(before);
    expect((await app.inject('/api/v1/resume-analysis')).statusCode).toBe(404);
  });

  it('validates corrections and rejects extra private input fields with generic non-echoing errors', async () => {
    const { app } = await setup();

    for (const payload of [
      { text: ' ' },
      { text: 'Skills\nPython', contact: 'private@example.invalid' },
      {
        text: 'Skills\nPython',
        corrections: { employment: [{ id: 'manual-1', category: 'invented' }] },
      },
      { text: 'a'.repeat(100_001) },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/resume-analysis',
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).not.toContain('private@example.invalid');
    }
  });

  it('recalculates a confirmed manual role and keeps corrected values private', async () => {
    const { app } = await setup();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      payload: {
        text: 'Skills\nPython',
        corrections: {
          location: 'Berlin, Germany',
          employment: [
            {
              id: 'manual-1',
              title: 'Developer',
              employer: 'Local Studio',
              start: 'Jan 2020',
              end: 'Dec 2020',
              category: 'engineering',
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      location: { value: 'Berlin, Germany', status: 'user_confirmed' },
      experience: { professional: { minimumMonths: 12 } },
    });
  });

  it('rejects unexpected browser origins and unsupported/oversized request formats without caching errors', async () => {
    const { app } = await setup();

    const origin = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      headers: { origin: 'https://unrelated.invalid' },
      payload: { text: 'Skills\nPython' },
    });

    const file = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      headers: { 'content-type': 'application/pdf' },
      payload: 'not a document',
    });

    const oversized = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ text: 'x'.repeat(800_000) }),
    });

    expect(origin.statusCode).toBe(403);
    expect(file.statusCode).toBe(415);
    expect(oversized.statusCode).toBe(413);

    expect(
      [origin, file, oversized].every(
        (response) => response.headers['cache-control'] === 'no-store',
      ),
    ).toBe(true);
  });

  it('bounds anonymous analysis admission per IP without trusting forwarded identity', async () => {
    const { app } = await setup();

    for (let index = 0; index < 60; index++) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/resume-analysis',
        payload: { text: 'Skills\nPython' },
      });

      expect(response.statusCode).toBe(200);
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      headers: { 'x-forwarded-for': '203.0.113.77' },
      payload: { text: 'Skills\nPython' },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('includes the POST input and evidence-bearing response in the generated contract', async () => {
    const { app } = await setup();

    expect(app.swagger().paths?.['/api/v1/resume-analysis']?.post?.operationId).toBe(
      'analyzeResume',
    );
  });

  it('rejects malformed JSON without reflecting private fragments', async () => {
    const { app } = await setup();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      headers: { 'content-type': 'application/json' },
      payload: '{"text":"private fragment"',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain('private fragment');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
