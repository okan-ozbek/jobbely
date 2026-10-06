import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import { createRequire } from 'node:module';

// robots-parser ships CommonJS with declarations that do not model NodeNext's default import.
const robotsParser = createRequire(import.meta.url)('robots-parser') as (
  url: string,
  body: string,
) => {
  isAllowed(url: string, userAgent: string): boolean | undefined;
  getCrawlDelay(userAgent: string): number | undefined;
};

const userAgent = 'Jobbely/0.1 (public employer job-board reader)';
const blocked = new BlockList();
const blockedV6 = new BlockList();

for (const [network, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['192.0.0.0', 24],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, bits, 'ipv4');
}

blockedV6.addSubnet('::', 128, 'ipv6');
blockedV6.addSubnet('::1', 128, 'ipv6');
blockedV6.addSubnet('fc00::', 7, 'ipv6');
blockedV6.addSubnet('fe80::', 10, 'ipv6');
blockedV6.addSubnet('ff00::', 8, 'ipv6');
blockedV6.addSubnet('::ffff:0:0', 96, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);

  return family === 4
    ? !blocked.check(address, 'ipv4')
    : family === 6 && !blockedV6.check(address, 'ipv6');
}

export interface OfficialSnapshot {
  url: string;
  body: string;
  robotsUrl: string;
  robotsBody: string;
  fetchedAt: string;
}

export class OfficialPageTransport {
  private readonly robots = new Map<string, Promise<{ body: string; status: number }>>();
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly nextRequest = new Map<string, number>();
  private readonly deadline = Date.now() + 4 * 60_000;

  constructor(
    private readonly hosts: ReadonlySet<string>,
    private readonly fetcher: typeof fetch = fetch,
    private readonly resolver: (
      host: string,
      options: { all: true },
    ) => Promise<{ address: string; family: number }[]> = lookup,
    private readonly intervalMs = 1000,
  ) {}

  async get(url: string): Promise<OfficialSnapshot> {
    const parsed = this.validateUrl(url);
    const robotsUrl = `${parsed.origin}/robots.txt`;
    let policy = this.robots.get(parsed.origin);

    if (!policy) {
      policy = this.request(robotsUrl, true);
      this.robots.set(parsed.origin, policy);
    }

    const robots = await policy;
    const rules = robotsParser(robotsUrl, robots.body);

    if (rules.isAllowed(url, 'Jobbely') === false) {
      throw new Error(`robots.txt disallows Jobbely access to ${url}`);
    }

    const delay = rules.getCrawlDelay('Jobbely');

    if (delay !== undefined && (!Number.isFinite(delay) || delay > 30)) {
      throw new Error('robots.txt crawl delay exceeds this audit request budget');
    }

    this.nextRequest.set(
      parsed.hostname,
      Math.max(this.nextRequest.get(parsed.hostname) ?? 0, Date.now() + (delay ?? 0) * 1000),
    );

    const response = await this.request(url);

    return {
      url,
      body: response.body,
      robotsUrl,
      robotsBody: robots.body,
      fetchedAt: new Date().toISOString(),
    };
  }

  private validateUrl(url: string): URL {
    const parsed = new URL(url);

    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      isIP(parsed.hostname) ||
      !this.hosts.has(parsed.hostname)
    ) {
      throw new Error('Destination is outside the explicit official-site allowlist');
    }

    return parsed;
  }

  private async request(url: string, robots = false): Promise<{ body: string; status: number }> {
    const parsed = this.validateUrl(url);

    const addresses = await this.resolver(parsed.hostname, { all: true });

    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new Error('Official site resolves to a non-public address');
    }

    const previous = this.tails.get(parsed.hostname) ?? Promise.resolve();

    const current = previous
      .catch(() => undefined)
      .then(async () => {
        await new Promise<void>((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, (this.nextRequest.get(parsed.hostname) ?? 0) - Date.now()),
          ),
        );

        this.nextRequest.set(parsed.hostname, Date.now() + this.intervalMs);

        const remaining = this.deadline - Date.now();
        const markdownInventory = url === 'https://apply.workable.com/huggingface/jobs.md';

        if (remaining <= 0) {
          throw new Error('Official-site audit elapsed-time budget exhausted');
        }

        const response = await this.fetcher(url, {
          redirect: 'error',
          signal: AbortSignal.timeout(Math.min(30_000, remaining)),
          headers: {
            'User-Agent': userAgent,
            Accept: robots
              ? 'text/plain'
              : markdownInventory
                ? 'text/markdown'
                : 'text/html,application/javascript',
          },
        });

        if (robots && [404, 410].includes(response.status)) {
          await response.body?.cancel();

          return { body: '', status: response.status };
        }

        if (!response.ok || !response.body) {
          await response.body?.cancel();

          throw new Error(`Official site HTTP ${response.status}: ${url}`);
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (
          !(
            robots
              ? /text\/plain/i
              : markdownInventory
                ? /^text\/markdown(?:;|$)/i
                : /text\/html|javascript/i
          ).test(contentType)
        ) {
          await response.body.cancel();

          throw new Error(`Unexpected official-site content type: ${contentType}`);
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;

        for (;;) {
          const chunk = await reader.read();

          if (chunk.done) {
            break;
          }

          bytes += chunk.value.length;

          if (bytes > (robots ? 1024 * 1024 : 8 * 1024 * 1024)) {
            await reader.cancel();

            throw new Error('Official-site response exceeds audit byte budget');
          }

          chunks.push(chunk.value);
        }

        const body = Buffer.concat(chunks).toString('utf8');

        if (
          /cf-chl-|<title[^>]*>\s*(?:Just a moment|Access denied|Attention required)|<[^>]+>\s*Verify you are human/i.test(
            body.slice(0, 12000),
          )
        ) {
          throw new Error('Challenge page is not official listing evidence');
        }

        return { body, status: response.status };
      });

    this.tails.set(parsed.hostname, current);

    return current;
  }
}
