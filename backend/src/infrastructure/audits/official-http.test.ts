import { describe, expect, it, vi } from 'vitest';
import { OfficialPageTransport, isPublicAddress } from './official-http.js';

const resolvePublic = async () => [{ address: '93.184.216.34', family: 4 }];

const hosts = new Set(['example.com']);

function transport(robots: string, status = 200) {
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith('/robots.txt')
      ? new Response(robots, { status, headers: { 'content-type': 'text/plain' } })
      : new Response('<a href="/jobs/1">Role</a>', { headers: { 'content-type': 'text/html' } }),
  );

  return { client: new OfficialPageTransport(hosts, fetcher, resolvePublic, 0), fetcher };
}

describe('bounded official-site transport', () => {
  it('accepts Markdown only for the exact public Workable inventory, retaining robots and request limits', async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith('/robots.txt')
        ? new Response('User-agent: *\nAllow: /', { headers: { 'content-type': 'text/plain' } })
        : new Response('# Synthetic inventory', {
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
          }),
    );

    const client = new OfficialPageTransport(
      new Set(['apply.workable.com']),
      fetcher,
      resolvePublic,
      0,
    );

    const url = 'https://apply.workable.com/huggingface/jobs.md';

    expect((await client.get(url)).body).toBe('# Synthetic inventory');

    await expect(client.get('https://apply.workable.com/other/jobs.md')).rejects.toThrow(
      'content type',
    );

    await expect(client.get(url + '?country=FR')).rejects.toThrow('content type');
    expect(fetcher.mock.calls[1]?.[1]?.redirect).toBe('error');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Accept: 'text/markdown' });
  });

  it('rejects private, loopback, mapped and non-address destinations but accepts real public IPv4/IPv6', () => {
    for (const address of [
      '127.0.0.1',
      '10.2.3.4',
      '169.254.1.2',
      '192.168.0.1',
      '100.64.0.1',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      'invalid',
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }

    expect(isPublicAddress('18.239.36.36')).toBe(true);
    expect(isPublicAddress('2a04:4e42:30::787')).toBe(true);
  });

  it('reads and retains robots once per origin, and disables redirects', async () => {
    const { client, fetcher } = transport('User-agent: *\nAllow: /');
    const snapshot = await client.get('https://example.com/careers');

    await client.get('https://example.com/jobs');
    expect(snapshot.robotsBody).toContain('Allow: /');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
  });

  it('respects specific agent rules and longest matching allow/disallow paths', async () => {
    const { client, fetcher } = transport(
      'User-agent: *\nAllow: /\nUser-agent: Jobbely\nDisallow: /careers\nAllow: /careers/public',
    );

    await expect(client.get('https://example.com/careers')).rejects.toThrow('disallows');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(client.get('https://example.com/careers/public')).resolves.toBeDefined();
  });

  it('fails closed on unavailable robots and accepts only genuine absent robots responses', async () => {
    await expect(
      transport('failure', 403).client.get('https://example.com/careers'),
    ).rejects.toThrow('HTTP 403');

    await expect(
      transport('not found', 404).client.get('https://example.com/careers'),
    ).resolves.toBeDefined();

    await expect(
      transport('User-agent: *\nCrawl-delay: 60').client.get('https://example.com/careers'),
    ).rejects.toThrow('crawl delay');
  });

  it('rejects unsafe URLs before any request and non-public DNS before fetch', async () => {
    const { client, fetcher } = transport('');

    for (const url of [
      'http://example.com/careers',
      'https://example.com:123/careers',
      'https://user@example.com/careers',
      'https://other.com/',
      'https://127.0.0.1/',
    ]) {
      await expect(client.get(url)).rejects.toThrow('allowlist');
    }

    expect(fetcher).not.toHaveBeenCalled();

    const privateDns = new OfficialPageTransport(
      hosts,
      fetcher,
      async () => [{ address: '10.0.0.1', family: 4 }],
      0,
    );

    await expect(privateDns.get('https://example.com/careers')).rejects.toThrow('non-public');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects challenge pages and oversized responses', async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith('/robots.txt')
        ? new Response('User-agent: *\nAllow: /', { headers: { 'content-type': 'text/plain' } })
        : new Response('<h1>Verify you are human</h1>', {
            headers: { 'content-type': 'text/html' },
          }),
    );

    await expect(
      new OfficialPageTransport(hosts, fetcher, resolvePublic, 0).get(
        'https://example.com/careers',
      ),
    ).rejects.toThrow('Challenge page');

    const huge = vi.fn<typeof fetch>(
      async () =>
        new Response('x'.repeat(1024 * 1024 + 1), { headers: { 'content-type': 'text/plain' } }),
    );

    await expect(
      new OfficialPageTransport(hosts, huge, resolvePublic, 0).get('https://example.com/careers'),
    ).rejects.toThrow('byte budget');
  });
});
