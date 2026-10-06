import { describe, expect, it, vi } from 'vitest';
import type { Source } from '../../domain/model.js';
import type { JsonTransport } from '../../ports/ingestion.js';
import { htmlPreparation } from '../html.js';
import { officialIdentity } from '../audits/reconcile.js';
import { AtlassianAdapter, atlassianPortalHosts } from './atlassian.js';

const source: Source = {
  id: 'atlassian',
  companySlug: 'atlassian',
  provider: 'atlassian',
  board: 'atlassian',
  endpoint: 'https://www.atlassian.com/endpoint/careers/listings',
  auditStatus: 'candidate',
  scheduled: false,
};

function job(id = 100, portalId = 17) {
  const portalUrl = `https://${atlassianPortalHosts[portalId]}/jobs/${id}/engineer/job`;

  return {
    id,
    portalId,
    portalJobPost: { id, portalId, portalUrl },
    title: 'Software Engineer',
    locations: ['Amsterdam', 'Remote'],
    category: 'Engineering',
    overview: '<p>Build collaboration tools.</p>',
    responsibilities: '<ul><li>Design services.</li></ul>',
    qualifications: '<p>Experience with TypeScript.</p>',
    compensation: '<p>Bonus and equity.</p>',
    payRanges: '<p>EUR 80,000–100,000.</p>',
    applyUrl: `${portalUrl}?mode=apply`,
  };
}

function setup(first: unknown, second: unknown = first) {
  const get = vi
    .fn<JsonTransport['get']>()
    .mockResolvedValueOnce({
      url: source.endpoint!,
      fetchedAt: '2026-10-06T12:00:00Z',
      body: first,
    })
    .mockResolvedValueOnce({
      url: source.endpoint!,
      fetchedAt: '2026-10-06T12:00:01Z',
      body: second,
    });

  return { adapter: new AtlassianAdapter({ get }), get };
}

describe('Atlassian native employer feed', () => {
  it('deduplicates identical IDs, rechecks the feed and preserves every description section', async () => {
    const one = job();
    const test = setup([one, one, job(101, 242)], [job(101, 242), one]);
    const result = await test.adapter.extract(source);

    expect(result.postings.map((posting) => posting.sourcePostingId)).toEqual(['100', '101']);
    expect(result).toMatchObject({ enumerationComplete: true, excluded: 0 });
    expect(result.rawResponses).toHaveLength(2);
    expect(test.get.mock.calls).toEqual([[source.endpoint], [source.endpoint]]);

    expect(result.postings[0]).toMatchObject({
      url: one.portalJobPost.portalUrl,
      applyUrl: one.applyUrl,
      locations: one.locations,
      departments: ['Engineering'],
      employment: 'unknown',
      workplace: 'unknown',
      publishedAt: null,
    });

    const text = htmlPreparation.prepare(result.postings[0]!.descriptionHtml).text;

    for (const content of [
      'Build collaboration tools.',
      'Design services.',
      'Experience with TypeScript.',
      'Bonus and equity.',
      'EUR 80,000–100,000.',
    ]) {
      expect(text).toContain(content);
    }
  });

  it('rejects conflicting duplicates and changed inventories instead of publishing a subset', async () => {
    await expect(
      setup([job(), { ...job(), title: 'Different role' }]).adapter.extract(source),
    ).rejects.toThrow(/conflicting records/);

    for (const changed of [
      [],
      [job(101)],
      [job(), job(101)],
      [{ ...job(), overview: 'Changed' }],
    ]) {
      await expect(setup([job()], changed).adapter.extract(source)).rejects.toThrow();
    }
  });

  it('fails the whole extraction when one real role has no readable description', async () => {
    for (const content of [undefined, '', '<script>fake content</script>', '<p>&nbsp;</p>']) {
      const missing = {
        ...job(101),
        overview: content,
        responsibilities: undefined,
        qualifications: undefined,
      };

      const test = setup([job(), missing]);

      await expect(test.adapter.extract(source)).rejects.toThrow(
        'Atlassian posting 101 has no readable job description',
      );

      expect(test.get).toHaveBeenCalledTimes(1);
    }
  });

  it('supports all six attributed portals and resolves official audit identities', async () => {
    const rows = Object.keys(atlassianPortalHosts).map((id, index) => job(100 + index, Number(id)));
    const result = await setup(rows).adapter.extract(source);

    for (const posting of result.postings) {
      expect(officialIdentity(posting.applyUrl)).toEqual({
        board: 'atlassian:atlassian',
        id: posting.sourcePostingId,
      });

      expect(
        officialIdentity(
          `https://www.atlassian.com/company/careers/details/${posting.sourcePostingId}`,
        ),
      ).toEqual({ board: 'atlassian:atlassian', id: posting.sourcePostingId });
    }

    expect(
      officialIdentity('https://unrelated-atlassian.icims.com/jobs/100/engineer/job'),
    ).toBeNull();
  });

  it('rejects foreign application URLs, mismatched IDs, unknown portals and filtered endpoints', async () => {
    const good = job();

    for (const bad of [
      { ...good, applyUrl: 'https://example.com/jobs/100/engineer/job?mode=apply' },
      { ...good, applyUrl: good.applyUrl.replace('/100/', '/101/') },
      { ...good, portalId: 999 },
      { ...good, portalJobPost: { ...good.portalJobPost, id: 101 } },
      { ...good, portalJobPost: { ...good.portalJobPost, portalId: 242 } },
    ]) {
      await expect(setup([bad]).adapter.extract(source)).rejects.toThrow(/identity or employer/);
    }

    const test = setup([good]);

    await expect(
      test.adapter.extract({ ...source, endpoint: `${source.endpoint}?location=US` }),
    ).rejects.toThrow(/exact native/);

    expect(test.get).not.toHaveBeenCalled();
  });

  it('rejects malformed and empty inventories; keeps unknown locations and employment explicit', async () => {
    for (const body of [[], {}, [{ ...job(), id: -1 }], [{ ...job(), locations: [''] }]]) {
      await expect(setup(body).adapter.extract(source)).rejects.toThrow(/schema mismatch/);
    }

    const result = await setup([{ ...job(), locations: [], type: 'Full-Time' }]).adapter.extract(
      source,
    );

    expect(result.postings[0]).toMatchObject({ locations: [], employment: 'Full-Time' });
  });

  it('excludes explicit talent communities without excluding ordinary campus vacancies', async () => {
    const result = await setup([
      { ...job(), title: 'Talent Community', overview: '' },
      { ...job(101, 250), title: 'Software Engineer Intern' },
    ]).adapter.extract(source);

    expect(result.excluded).toBe(1);
    expect(result.postings.map((posting) => posting.sourcePostingId)).toEqual(['101']);
  });
});
