import { describe, expect, it, vi, afterEach } from 'vitest';
import { PublicJsonTransport } from './http.js';

afterEach(() => vi.useRealTimers());

const url = 'https://boards-api.greenhouse.io/v1/boards/test/jobs';

describe('bounded transport', () => {
  it('allows only the complete read-only Atlassian feed', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('[]', { headers: { 'content-type': 'application/json' } }));

    const http = new PublicJsonTransport(fetcher, 0);
    const endpoint = 'https://www.atlassian.com/endpoint/careers/listings';

    expect((await http.get(endpoint)).body).toEqual([]);

    for (const target of [
      `${endpoint}?location=US`,
      `${endpoint}#filtered`,
      'https://www.atlassian.com/endpoint/account',
    ]) {
      await expect(http.get(target)).rejects.toThrow(/native career routes/);
    }

    await expect(http.getHtml(endpoint)).rejects.toThrow(/native career routes/);
    await expect(http.post(endpoint, {})).rejects.toThrow(/read-only/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('limits native requests to public listing/detail routes and returns raw Apple HTML', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>public detail</html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    const http = new PublicJsonTransport(fetcher, 0);
    const target = 'https://jobs.apple.com/en-us/details/100-01/engineer';

    expect(await http.getHtml(target)).toMatchObject({
      url: target,
      body: '<html>public detail</html>',
    });

    await expect(http.getHtml('https://jobs.apple.com/api/v1/jobDetails/100')).rejects.toThrow(
      /native career routes/,
    );

    await expect(http.getHtml('https://www.amazon.jobs/en/search.json')).rejects.toThrow(
      /native career routes/,
    );

    await expect(
      http.get('https://explore.jobs.netflix.net/api/apply/v2/candidate'),
    ).rejects.toThrow(/native career routes/);

    await expect(http.get('https://www.amazon.jobs/en/internal/search.json')).rejects.toThrow(
      /native career routes/,
    );

    await expect(
      http.get('https://www.google.com/about/careers/applications/jobs/results/?page=2'),
    ).rejects.toThrow(/allowlist/);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects JSON/challenge content in Apple HTML mode', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }));

    await expect(
      new PublicJsonTransport(fetcher, 0).getHtml('https://jobs.apple.com/en-us/search?location='),
    ).rejects.toThrow(/Expected HTML/);
  });

  it('allows only read-only Workday search POSTs and preserves their JSON request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"total":0,"jobPostings":[]}', {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const http = new PublicJsonTransport(fetcher, 0);

    const search =
      'https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs';

    const result = await http.post(search, { offset: 20, limit: 20 });

    expect(result.request).toEqual({ method: 'POST', body: { offset: 20, limit: 20 } });

    expect(fetcher).toHaveBeenCalledWith(
      search,
      expect.objectContaining({
        method: 'POST',
        body: '{"offset":20,"limit":20}',
        redirect: 'error',
      }),
    );

    await expect(http.post('https://nvidia.wd5.myworkdayjobs.com/apply', {})).rejects.toThrow(
      /read-only/,
    );

    await expect(
      http.post('https://boards-api.greenhouse.io/wday/cxs/a/b/jobs', {}),
    ).rejects.toThrow(/read-only/);

    await expect(
      http.post('https://untrusted.wd5.myworkdayjobs.com/wday/cxs/a/b/jobs', {}),
    ).rejects.toThrow(/allowlist/);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

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
