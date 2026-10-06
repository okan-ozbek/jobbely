import { load } from 'cheerio';
import { z } from 'zod';
import type { Extraction, Source } from '../../domain/model.js';
import type { AuditPlan } from './model.js';
import { atlassianPortalHosts } from '../adapters/atlassian.js';

export interface OfficialIdentity {
  board: string;
  id: string | null;
}

export function officialIdentity(value: string): OfficialIdentity | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const parts = url.pathname.split('/').filter(Boolean);

  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !parts[0] ||
    !/^[a-zA-Z0-9_-]+$/.test(parts[0])
  ) {
    return null;
  }

  if (url.hostname === 'jobs.apple.com') {
    return {
      board: 'apple:apple',
      id: url.pathname.match(/^\/en-us\/details\/(\d+(?:-\d+)?)(?:\/|$)/)?.[1] ?? null,
    };
  }

  if (url.hostname === 'www.lifeatcanva.com' && /^\/en\/jobs(?:\/|$)/.test(url.pathname)) {
    return {
      board: 'smartrecruiters:Canva',
      id: url.pathname.match(/^\/en\/jobs\/(\d{1,30})\/[^/]+\/?$/)?.[1] ?? null,
    };
  }

  if (url.hostname === 'vercel.com' && /^\/careers(?:\/|$)/.test(url.pathname)) {
    return {
      board: 'greenhouse:vercel',
      id: url.pathname.match(/^\/careers\/[a-z0-9]+(?:-[a-z0-9]+)*-(\d{1,30})\/?$/)?.[1] ?? null,
    };
  }

  if (url.hostname === 'www.shopify.com' && /^\/careers(?:\/|$)/.test(url.pathname)) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const pathId = url.pathname.match(/_([0-9a-f-]{36})$/)?.[1];
    const queryId = url.searchParams.get('ashby_jid');

    if ((queryId && !uuid.test(queryId)) || (pathId && queryId && pathId !== queryId)) {
      return null;
    }

    return { board: 'shopify:shopify', id: pathId && uuid.test(pathId) ? pathId : queryId };
  }

  if (Object.values(atlassianPortalHosts).includes(url.hostname)) {
    return {
      board: 'atlassian:atlassian',
      id: url.pathname.match(/^\/jobs\/(\d+)(?:\/|$)/)?.[1] ?? null,
    };
  }

  if (url.hostname === 'www.atlassian.com' && url.pathname.startsWith('/company/careers/')) {
    return {
      board: 'atlassian:atlassian',
      id: url.pathname.match(/^\/company\/careers\/details\/(\d+)\/?$/)?.[1] ?? null,
    };
  }

  if (['www.amazon.jobs', 'account.amazon.jobs', 'account.amazon.com'].includes(url.hostname)) {
    return {
      board: 'amazon:amazon',
      id: url.pathname.match(/^\/(?:en\/)?jobs\/((?:SF)?\d+)(?:\/|$)/)?.[1] ?? null,
    };
  }

  if (url.hostname === 'explore.jobs.netflix.net') {
    return {
      board: 'eightfold:netflix',
      id: url.pathname.match(/^\/careers\/job\/(\d+)(?:\/|$)/)?.[1] ?? null,
    };
  }

  if (url.hostname === 'hvr-amazon.my.site.com' && url.pathname === '/JobDetails') {
    return { board: 'amazon:amazon', id: url.searchParams.get('reqid') };
  }

  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname) && parts[0]) {
    return { board: `greenhouse:${parts[0]}`, id: parts[1] === 'jobs' ? (parts[2] ?? null) : null };
  }

  if (['jobs.smartrecruiters.com', 'careers.smartrecruiters.com'].includes(url.hostname)) {
    const knownBoards: Record<string, string> = { servicenow: 'ServiceNow', canva: 'Canva' };
    const board = knownBoards[parts[0].toLowerCase()] ?? parts[0];

    return {
      board: `smartrecruiters:${board}`,
      id:
        url.hostname === 'jobs.smartrecruiters.com' && parts.length === 2
          ? (parts[1]?.match(/^(\d+)(?:-[^/]+)?$/)?.[1] ?? null)
          : null,
    };
  }

  if (['jobs.lever.co', 'jobs.eu.lever.co'].includes(url.hostname) && parts[0]) {
    return { board: `lever:${parts[0]}`, id: parts[1] && parts[1] !== 'apply' ? parts[1] : null };
  }

  if (url.hostname === 'jobs.ashbyhq.com' && parts[0]) {
    return {
      board: `ashby:${parts[0]}`,
      id: parts[1] && parts[1] !== 'application' ? parts[1] : null,
    };
  }

  if (/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/.test(url.hostname)) {
    const siteIndex = /^[a-z]{2}-[A-Z]{2}$/.test(parts[0]) ? 1 : 0;
    const site = parts[siteIndex];
    const jobIndex = parts.indexOf('job', siteIndex + 1);
    const id = jobIndex >= 0 ? (parts.at(-1) === 'apply' ? parts.at(-2) : parts.at(-1)) : null;

    return site ? { board: `workday:${site}`, id: id ?? null } : null;
  }

  if (/^wd\d+\.myworkdaysite\.com$/.test(url.hostname)) {
    const recruiting = parts.indexOf('recruiting');
    const site = recruiting >= 0 ? parts[recruiting + 2] : undefined;

    return site
      ? {
          board: `workday:${site}`,
          id:
            parts[recruiting + 3] === 'job'
              ? parts.at(-1) === 'apply'
                ? parts.at(-2)!
                : parts.at(-1)!
              : null,
        }
      : null;
  }

  const icimsBoards: Record<string, string> = {
    'careers.amd.com': 'amd',
    'careers-amd.icims.com': 'amd',
    'jobs.booking.com': 'workingatbooking',
    'external-workingatbooking.icims.com': 'workingatbooking',
    'www.github.careers': 'githubinc',
    'githubinc.jibeapply.com': 'githubinc',
    'careers-githubinc.icims.com': 'githubinc',
    'globalcareers-githubinc.icims.com': 'githubinc',
  };

  const board = icimsBoards[url.hostname];

  if (board) {
    return {
      board: `icims:${board}`,
      id: url.pathname.match(/\/jobs\/(\d+)(?:\/|$)/)?.[1] ?? null,
    };
  }

  return null;
}

/** Workday URLs contain mutable title slugs; map them to immutable IDs from captured detail evidence. */
export function resolveOfficialIds(
  source: Source,
  extraction: Extraction,
  ids: Set<string>,
): Set<string> {
  if (source.provider === 'apple') {
    const mapping = new Map(
      extraction.postings.map((posting) => [
        officialIdentity(posting.url)?.id,
        posting.sourcePostingId,
      ]),
    );

    return new Set([...ids].map((id) => mapping.get(id) ?? id));
  }

  if (source.provider === 'amazon') {
    const mapping = new Map(
      extraction.postings.map((posting) => [
        officialIdentity(posting.applyUrl)?.id,
        posting.sourcePostingId,
      ]),
    );

    return new Set([...ids].map((id) => mapping.get(id) ?? id));
  }

  if (source.provider !== 'workday') {
    return ids;
  }

  const detail = z.object({
    jobPostingInfo: z.object({ id: z.string(), jobPostingId: z.string() }),
  });

  const nativeIds = new Map<string, string>();

  for (const raw of extraction.rawResponses) {
    const result = detail.safeParse(raw.body);

    if (result.success) {
      nativeIds.set(result.data.jobPostingInfo.jobPostingId, result.data.jobPostingInfo.id);
    }
  }

  return new Set([...ids].map((id) => nativeIds.get(id) ?? id));
}

export function inspectOfficialPage(
  body: string,
  page: AuditPlan['pages'][number],
  sources: Source[],
) {
  const document = load(body);
  const ids = new Map<string, Set<string>>();
  const boards = new Set<string>();
  const links = new Set<string>();
  const titles = new Map<string, string>();
  const paginationHints = new Set<string>();

  for (const element of document('a[rel="next"], a, button').toArray()) {
    const control = document(element);
    const label = control.text().trim() || control.attr('aria-label')?.trim() || '';

    if (control.is('[disabled]') || control.attr('aria-disabled') === 'true') {
      continue;
    }

    if (
      control.attr('rel') === 'next' ||
      /^(next(?: page)?|load more|show more|more jobs)(\s*[›»→])?$/i.test(label)
    ) {
      const href = control.attr('href');

      paginationHints.add(
        href && href !== '#' ? new URL(href, page.url).href : `interactive:${label}`,
      );
    }
  }

  for (const element of document(page.selector).toArray()) {
    const href = document(element).attr('href');

    if (!href) {
      continue;
    }

    let resolved: URL;

    try {
      resolved = new URL(href, page.url);
    } catch {
      continue;
    }

    if (!['https:', 'http:'].includes(resolved.protocol)) {
      continue;
    }

    const link = resolved.href;
    const identity = officialIdentity(link);

    if (identity || /career|jobs|join-us|recruit|employment/i.test(link)) {
      links.add(link);
    }

    if (identity) {
      boards.add(identity.board);

      if (identity.id) {
        const values = ids.get(identity.board) ?? new Set<string>();

        values.add(identity.id);
        ids.set(identity.board, values);
        titles.set(`${identity.board}:${identity.id}`, document(element).text().trim());
      }
    } else if (resolved.origin === new URL(page.url).origin && page.sourceIds.length === 1) {
      // Mozilla's official wrapper exposes the Greenhouse posting ID in its URL.
      const mozilla =
        resolved.hostname === 'www.mozilla.org' &&
        resolved.pathname.match(/\/careers\/position\/gh\/(\d+)\/?$/);

      const source = sources.find((item) => item.id === page.sourceIds[0]);

      if (mozilla && source?.provider === 'greenhouse') {
        const key = `${source.provider}:${source.board}`;
        const values = ids.get(key) ?? new Set<string>();

        values.add(mozilla[1]!);
        ids.set(key, values);
        boards.add(key);
        titles.set(`${key}:${mozilla[1]}`, document(element).text().trim());
      }
    }
  }

  // Embedded URLs establish discovery only, never an exhaustive visible vacancy inventory.
  for (const match of body.replaceAll('\\/', '/').matchAll(/https?:\/\/[^\s"<>\\&]+/g)) {
    const identity = officialIdentity(match[0]);

    if (identity) {
      boards.add(identity.board);
      links.add(match[0]);
    }
  }

  if (page.boardArray) {
    const name = page.boardArray.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const array = body.match(new RegExp(`${name}\\s*=\\s*(\\[[^\\]]+\\])`));

    if (!array?.[1]) {
      throw new Error(`Official script no longer exposes ${page.boardArray}`);
    }

    const tokens = JSON.parse(array[1]) as unknown;

    if (
      !Array.isArray(tokens) ||
      tokens.some((token) => typeof token !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(token))
    ) {
      throw new Error('Invalid official script board inventory');
    }

    for (const token of tokens as string[]) {
      boards.add(`greenhouse:${token}`);
    }
  }

  const explicitlyEmpty = Boolean(
    page.emptySelector &&
    document(page.emptySelector).length > 0 &&
    [...ids.values()].every((values) => values.size === 0),
  );

  return { ids, boards, links, titles, paginationHints, explicitlyEmpty };
}

export function compareIdentities(feed: Iterable<string>, official: Iterable<string>) {
  const feedIds = new Set(feed);
  const officialIds = new Set(official);

  return {
    matchedCount: [...feedIds].filter((id) => officialIds.has(id)).length,
    missingFromFeed: [...officialIds].filter((id) => !feedIds.has(id)).sort(),
    missingFromOfficial: [...feedIds].filter((id) => !officialIds.has(id)).sort(),
  };
}

export function greenhouseVariants(extraction: Extraction, officialIds: Set<string>) {
  const jobsSchema = z.object({
    jobs: z.array(
      z.object({
        id: z.union([z.number().int(), z.string()]),
        internal_job_id: z.union([z.number().int(), z.string()]).nullish(),
      }),
    ),
  });

  const jobs = extraction.rawResponses.flatMap((raw) => {
    const result = jobsSchema.safeParse(raw.body);

    return result.success ? result.data.jobs : [];
  });

  const officialRequisitions = new Map<string, string>();
  const currentIds = new Set(extraction.postings.map((posting) => posting.sourcePostingId));

  for (const job of jobs) {
    if (
      job.internal_job_id !== null &&
      job.internal_job_id !== undefined &&
      officialIds.has(String(job.id)) &&
      currentIds.has(String(job.id))
    ) {
      officialRequisitions.set(String(job.internal_job_id), String(job.id));
    }
  }

  return jobs.flatMap((job) => {
    const feedId = String(job.id);

    const requisitionId =
      job.internal_job_id === null || job.internal_job_id === undefined
        ? null
        : String(job.internal_job_id);

    const officialId = requisitionId === null ? undefined : officialRequisitions.get(requisitionId);

    return officialId && requisitionId && currentIds.has(feedId) && !officialIds.has(feedId)
      ? [{ feedId, officialId, requisitionId }]
      : [];
  });
}
