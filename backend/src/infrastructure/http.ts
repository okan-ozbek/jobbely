import type { JsonTransport } from '../ports/ingestion.js';
import type { RawResponse } from '../domain/model.js';

const allowedHosts = new Set([
  'boards-api.greenhouse.io',
  'api.ashbyhq.com',
  'api.lever.co',
  'api.eu.lever.co',
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

export class PublicJsonTransport implements JsonTransport {
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly nextRequest = new Map<string, number>();

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly minIntervalMs = 1000,
  ) {}

  async get(url: string): Promise<RawResponse> {
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
    const current = previous.catch(() => undefined).then(() => this.request(url, parsed.hostname));

    this.tails.set(parsed.hostname, current);

    return current;
  }

  private async request(url: string, host: string): Promise<RawResponse> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await sleep(Math.max(0, (this.nextRequest.get(host) ?? 0) - Date.now()));
      this.nextRequest.set(host, Date.now() + this.minIntervalMs);

      try {
        const response = await this.fetcher(url, {
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
          headers: {
            Accept: 'application/json',
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

        if (!response.headers.get('content-type')?.includes('json')) {
          await response.body?.cancel();

          throw new Error('Expected JSON; possible challenge or error page');
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

        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));

        return { url, fetchedAt: new Date().toISOString(), body };
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
