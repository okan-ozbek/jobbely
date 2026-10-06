import type { HtmlTransport, JsonSearchTransport } from '../ports/ingestion.js';
import type { RawResponse } from '../domain/model.js';

const allowedHosts = new Set([
  'boards-api.greenhouse.io',
  'api.ashbyhq.com',
  'api.lever.co',
  'api.eu.lever.co',
  'nvidia.wd5.myworkdayjobs.com',
  'salesforce.wd12.myworkdayjobs.com',
  'adobe.wd5.myworkdayjobs.com',
  'workday.wd5.myworkdayjobs.com',
  'paypal.wd1.myworkdayjobs.com',
  'intel.wd1.myworkdayjobs.com',
  'ing.wd3.myworkdayjobs.com',
  'zoom.wd5.myworkdayjobs.com',
  'xboxgaming.wd1.myworkdayjobs.com',
  'careers.amd.com',
  'jobs.booking.com',
  'www.github.careers',
  'www.amazon.jobs',
  'explore.jobs.netflix.net',
  'jobs.apple.com',
  'www.atlassian.com',
  'www.shopify.com',
]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpFailure extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class PublicJsonTransport implements JsonSearchTransport, HtmlTransport {
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly nextRequest = new Map<string, number>();

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly minIntervalMs = 1000,
  ) {}

  async get(url: string): Promise<RawResponse> {
    return this.enqueue(url);
  }

  async post(url: string, body: unknown): Promise<RawResponse> {
    return this.enqueue(url, JSON.stringify(body));
  }

  async getHtml(url: string): Promise<RawResponse & { body: string }> {
    const result = await this.enqueue(url, undefined, 'html');

    if (typeof result.body !== 'string') {
      throw new Error('Expected an HTML response body');
    }

    return { ...result, body: result.body };
  }

  private async enqueue(
    url: string,
    body?: string,
    format: 'json' | 'html' = 'json',
  ): Promise<RawResponse> {
    const parsed = new URL(url);

    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      !allowedHosts.has(parsed.hostname)
    ) {
      throw new Error('Destination is outside the public ATS allowlist');
    }

    const previous = this.tails.get(parsed.hostname) ?? Promise.resolve();

    const nativePaths: Record<string, boolean> = {
      'www.shopify.com':
        format === 'html' &&
        /^\/careers(?:\/[a-z0-9-]+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/.test(
          parsed.pathname,
        ) &&
        !parsed.search &&
        !parsed.hash,
      'www.atlassian.com':
        format === 'json' &&
        parsed.pathname === '/endpoint/careers/listings' &&
        !parsed.search &&
        !parsed.hash,
      'www.amazon.jobs': format === 'json' && parsed.pathname === '/en/search.json',
      'explore.jobs.netflix.net':
        format === 'json' && /^\/api\/apply\/v2\/jobs(?:\/\d+)?$/.test(parsed.pathname),
      'jobs.apple.com':
        format === 'html' &&
        /^\/en-us\/(?:search|details\/\d+(?:-\d+)?\/[^/?#]+)$/.test(parsed.pathname),
    };

    if (
      nativePaths[parsed.hostname] === false ||
      (format === 'html' && !['jobs.apple.com', 'www.shopify.com'].includes(parsed.hostname))
    ) {
      throw new Error('Destination is outside the read-only native career routes');
    }

    if (
      body !== undefined &&
      (!parsed.hostname.endsWith('.myworkdayjobs.com') ||
        !/^\/wday\/cxs\/[^/]+\/[^/]+\/jobs$/.test(parsed.pathname))
    ) {
      throw new Error('POST is restricted to read-only Workday job searches');
    }

    const current = previous
      .catch(() => undefined)
      .then(() => this.request(url, parsed.hostname, body, format));

    this.tails.set(parsed.hostname, current);

    return current;
  }

  private async request(
    url: string,
    host: string,
    requestBody?: string,
    format: 'json' | 'html' = 'json',
  ): Promise<RawResponse> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await sleep(Math.max(0, (this.nextRequest.get(host) ?? 0) - Date.now()));
      this.nextRequest.set(host, Date.now() + this.minIntervalMs);

      try {
        const response = await this.fetcher(url, {
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
          ...(requestBody === undefined ? {} : { method: 'POST', body: requestBody }),
          headers: {
            Accept: format === 'json' ? 'application/json' : 'text/html',
            ...(requestBody === undefined ? {} : { 'Content-Type': 'application/json' }),
            'User-Agent': 'Jobbely/0.1 (public employer job-board reader)',
          },
        });

        if (response.status === 429 || response.status >= 500) {
          const header = response.headers.get('retry-after');
          const seconds = header && /^\d+$/.test(header) ? Number(header) : null;

          const waitMs =
            seconds !== null
              ? seconds * 1000
              : header
                ? Math.max(0, Date.parse(header) - Date.now())
                : 1000 * 2 ** attempt;

          await response.body?.cancel();

          // Respect long delays by failing this run; never retry sooner than requested.
          if (attempt === 3 || waitMs > 30_000 || !Number.isFinite(waitMs)) {
            throw new HttpFailure(response.status, `Upstream ${response.status}; retry later`);
          }

          await sleep(waitMs + Math.random() * 250);
          continue;
        }

        if (!response.ok) {
          await response.body?.cancel();

          throw new HttpFailure(response.status, `Upstream HTTP ${response.status}`);
        }

        if (
          !response.headers.get('content-type')?.includes(format === 'json' ? 'json' : 'text/html')
        ) {
          await response.body?.cancel();

          throw new Error(
            `Expected ${format === 'json' ? 'JSON' : 'HTML'}; possible challenge or error page`,
          );
        }

        if (!response.body) {
          throw new Error('Empty upstream response');
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;

        for (;;) {
          const chunk = await reader.read();

          if (chunk.done) {
            break;
          }

          length += chunk.value.length;

          if (length > 32 * 1024 * 1024) {
            await reader.cancel();

            throw new Error('Response exceeds the 32 MiB limit');
          }

          chunks.push(chunk.value);
        }

        const content = Buffer.concat(chunks).toString('utf8');
        const body: unknown = format === 'json' ? JSON.parse(content) : content;

        return {
          url,
          fetchedAt: new Date().toISOString(),
          body,
          ...(requestBody === undefined
            ? {}
            : { request: { method: 'POST' as const, body: JSON.parse(requestBody) as unknown } }),
        };
      } catch (error) {
        if (
          error instanceof HttpFailure ||
          error instanceof SyntaxError ||
          !(
            error instanceof TypeError ||
            (error instanceof Error && error.name === 'TimeoutError')
          ) ||
          attempt === 3
        ) {
          throw error;
        }

        await sleep(1000 * 2 ** attempt);
      }
    }

    throw new Error('Request budget exhausted');
  }
}
