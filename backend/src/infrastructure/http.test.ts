import { describe, expect, it, vi, afterEach } from 'vitest';
import { PublicJsonTransport } from './http.js';

afterEach(() => vi.useRealTimers());

const url = 'https://boards-api.greenhouse.io/v1/boards/test/jobs';

describe('bounded transport', () => {
  it('rejects arbitrary/internal hosts before issuing a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const http = new PublicJsonTransport(fetcher, 0);

    await expect(http.get('http://127.0.0.1/jobs')).rejects.toThrow(/allowlist/);
    await expect(http.get('https://api.ashbyhq.com:8443/jobs')).rejects.toThrow(/allowlist/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('suspends on long Retry-After rather than hammering the source', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '3600' } }));

    await expect(new PublicJsonTransport(fetcher, 0).get(url)).rejects.toThrow(/retry later/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not mistake a challenge page for JSON', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>challenge</html>', {
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(new PublicJsonTransport(fetcher, 0).get(url)).rejects.toThrow(/Expected JSON/);
  });

  it('retries transient failures and preserves response provenance', async () => {
    vi.useFakeTimers();

    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('network failure'))
      .mockResolvedValue(
        new Response('{"jobs":[]}', {
          headers: { 'content-type': 'application/json' },
        }),
      );

    const result = new PublicJsonTransport(fetcher, 0).get(url);

    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ url, body: { jobs: [] } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
