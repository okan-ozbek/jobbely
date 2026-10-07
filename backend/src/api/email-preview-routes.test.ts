import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { JobCatalog } from '../application/catalog.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { renderAccountEmail } from '../infrastructure/accounts/account-email-template.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const repository = new MemoryJobRepository();
  const read = vi.spyOn(repository, 'read');
  const render = vi.fn(renderAccountEmail);

  const app = await createApp({
    repository,
    catalog: new JobCatalog(repository, [], [], 'demo'),
    renderAccountEmail: render,
  });

  apps.push(app);

  return { app, read, render };
}

describe('public account email previews', () => {
  it.each([
    ['register', 'Confirm your email', 'Welcome to Jobbely'],
    ['reset', 'Reset your password', 'set a new password'],
    ['change-email', 'Confirm your new email', 'confirm your new email address'],
  ])(
    'renders the %s template without a session or database reads',
    async (purpose, heading, copy) => {
      const { app, read, render } = await setup();
      const response = await app.inject(`/api/v1/email-preview/${purpose}`);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(response.body).toContain(`<h1`);
      expect(response.body).toContain(heading);
      expect(response.body).toContain(copy);
      expect(response.body).toContain('012345');
      expect(response.body).toContain('href="/fonts/galdeano.css"');
      expect(response.headers['content-security-policy']).toContain("font-src 'self'");
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(response.cookies).toHaveLength(0);
      expect(read).not.toHaveBeenCalled();

      expect(render).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'example@jobbely.com', code: '012345', purpose }),
      );
    },
  );

  it.each([
    '/api/v1/email-preview/other',
    '/api/v1/email-preview/register?code=654321',
    '/api/v1/email-preview/register?email=synthetic%40example.invalid',
    '/api/v1/email-preview/reset?challenge=synthetic',
  ])('rejects unsupported purpose or input in %s without rendering', async (url) => {
    const { app, render } = await setup();
    const response = await app.inject(url);

    expect(response.statusCode).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(render).not.toHaveBeenCalled();
  });
});
