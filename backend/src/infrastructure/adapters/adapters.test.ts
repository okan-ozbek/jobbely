import { describe, expect, it } from "vitest";
import { GreenhouseAdapter } from "./greenhouse.js";
import { AshbyAdapter } from "./ashby.js";
import { LeverAdapter } from "./lever.js";
import type { JsonTransport } from "../../ports/ingestion.js";
import type { Source } from "../../domain/model.js";
const source: Source = {
  id: "test",
  companySlug: "test",
  provider: "greenhouse",
  board: "test",
  auditStatus: "candidate",
  scheduled: false,
};
const http = (body: unknown): JsonTransport => ({
  get: async (url) => ({ url, fetchedAt: "2026-09-30T12:00:00.000Z", body }),
});
const gh = {
  id: 1,
  internal_job_id: 2,
  title: "Software Engineer",
  absolute_url: "https://example.com/jobs/1",
  content: "<p>Build software</p>",
  location: { name: "London" },
  departments: [{ name: "Engineering" }],
};
const ashby = {
  id: "id",
  title: "Recruiter",
  jobUrl: "https://example.com/job",
  applyUrl: "https://example.com/job/apply",
  descriptionHtml: "<p>Recruit people</p>",
  department: "People",
  location: "Paris",
  isListed: true,
};
const lever = (id: string) => ({
  id,
  text: "Product Manager",
  hostedUrl: `https://example.com/${id}`,
  applyUrl: `https://example.com/${id}/apply`,
  description: "<p>Lead product</p>",
  categories: { team: "Product", location: "Amsterdam" },
  lists: [{ text: "Requirements", content: "<ul><li>Experience</li></ul>" }],
  additional: "<p>Benefits</p>",
});

describe("source translation and completeness", () => {
  it("preserves Greenhouse IDs/categories and excludes prospects", async () => {
    const result = await new GreenhouseAdapter(
      http({
        jobs: [gh, { ...gh, id: 3, internal_job_id: null }],
        meta: { total: 2 },
      }),
    ).extract(source);
    expect(result.postings).toHaveLength(1);
    expect(result.excluded).toBe(1);
    expect(result.postings[0]).toMatchObject({
      sourcePostingId: "1",
      departments: ["Engineering"],
      locations: ["London"],
      publishedAt: null,
    });
  });
  it("handles a null office location without dropping the posting", async () => {
    const result = await new GreenhouseAdapter(
      http({
        jobs: [{ ...gh, offices: [{ name: "Remote", location: null }] }],
        meta: { total: 1 },
      }),
    ).extract(source);
    expect(result.postings[0]?.locations).toEqual(["London", "Remote"]);
  });
  it("fails the whole snapshot when a Greenhouse item is malformed", async () => {
    await expect(
      new GreenhouseAdapter(
        http({ jobs: [gh, { id: 2 }], meta: { total: 2 } }),
      ).extract(source),
    ).rejects.toThrow();
  });
  it("does not trust a mismatched Greenhouse total or unsafe application URL", async () => {
    await expect(
      new GreenhouseAdapter(http({ jobs: [gh], meta: { total: 2 } })).extract(
        source,
      ),
    ).rejects.toThrow(/count/);
    await expect(
      new GreenhouseAdapter(
        http({
          jobs: [{ ...gh, absolute_url: "javascript:alert(1)" }],
          meta: { total: 1 },
        }),
      ).extract(source),
    ).rejects.toThrow();
  });
  it("accepts a valid empty feed but rejects an HTML/challenge object", async () => {
    expect(
      (
        await new GreenhouseAdapter(
          http({ jobs: [], meta: { total: 0 } }),
        ).extract(source)
      ).enumerationComplete,
    ).toBe(true);
    await expect(
      new GreenhouseAdapter(http({ challenge: true })).extract(source),
    ).rejects.toThrow();
  });
  it("excludes unlisted Ashby postings and preserves secondary locations", async () => {
    const result = await new AshbyAdapter(
      http({
        apiVersion: "1",
        jobs: [
          {
            ...ashby,
            secondaryLocations: [{ location: "Berlin" }],
            workplaceType: "Hybrid",
          },
          { ...ashby, id: "hidden", isListed: false },
        ],
      }),
    ).extract({ ...source, provider: "ashby" });
    expect(result.excluded).toBe(1);
    expect(result.postings[0]).toMatchObject({
      locations: ["Paris", "Berlin"],
      workplace: "hybrid",
    });
  });
  it("uses an audited URL identity when Ashby omits an ID and rejects unknown versions", async () => {
    const withoutId = { ...ashby, id: undefined };
    expect(
      (
        await new AshbyAdapter(
          http({ apiVersion: "1", jobs: [withoutId] }),
        ).extract(source)
      ).postings[0]?.sourcePostingId,
    ).toBe(ashby.jobUrl);
    await expect(
      new AshbyAdapter(http({ apiVersion: "2", jobs: [] })).extract(source),
    ).rejects.toThrow(/version/);
  });
  it("traverses Lever pages and assembles requirements/closing content", async () => {
    const urls: string[] = [];
    const transport: JsonTransport = {
      get: async (url) => {
        urls.push(url);
        return {
          url,
          fetchedAt: "2026-09-30T12:00:00.000Z",
          body: urls.length === 1 ? [lever("a"), lever("b")] : [lever("c")],
        };
      },
    };
    const result = await new LeverAdapter(transport, 2).extract(source);
    expect(result.postings).toHaveLength(3);
    expect(urls[1]).toContain("skip=2");
    expect(result.postings[0]?.descriptionHtml).toContain("Experience");
    expect(result.postings[0]?.descriptionHtml).toContain("Benefits");
  });
  it("preserves unknown workplace fields when Ashby explicitly returns null", async () => {
    const result = await new AshbyAdapter(
      http({
        apiVersion: "1",
        jobs: [{ ...ashby, isRemote: null, workplaceType: null }],
      }),
    ).extract(source);
    expect(result.postings[0]?.workplace).toBe("unknown");
  });
  it("detects repeating Lever pages instead of reporting completeness", async () => {
    await expect(
      new LeverAdapter(http([lever("a")]), 1).extract(source),
    ).rejects.toThrow(/repeated/);
  });
});
