import { createHash } from "node:crypto";
import type { ExtractedPosting, Source } from "../domain/model.js";
import {
  classify,
  LabelMappingStrategy,
  TitleRuleStrategy,
} from "../domain/classification.js";
import { htmlPreparation } from "./html.js";
import type { JobRepository } from "../ports/ingestion.js";

export async function seedDemo(repository: JobRepository, sources: Source[]) {
  const examples: [
    string,
    string,
    string,
    string,
    "remote" | "hybrid" | "onsite",
  ][] = [
    [
      "openai",
      "Software Engineer, Developer Experience",
      "Engineering",
      "San Francisco, CA",
      "hybrid",
    ],
    [
      "openai",
      "Product Manager, Platform",
      "Product",
      "London, United Kingdom",
      "hybrid",
    ],
    [
      "anthropic",
      "Research Scientist, Interpretability",
      "Research",
      "San Francisco, CA",
      "onsite",
    ],
    [
      "figma",
      "Senior Product Designer",
      "Product Design",
      "Remote · United States",
      "remote",
    ],
    ["discord", "People Partner", "People", "San Francisco, CA", "hybrid"],
    [
      "palantir",
      "Software Engineer, Infrastructure",
      "Engineering",
      "New York, NY",
      "onsite",
    ],
  ];
  for (const source of sources) {
    const samples = examples.filter(
      ([company]) => company === source.companySlug,
    );
    if (!samples.length) continue;
    const at = new Date().toISOString();
    const run = await repository.startRun(source, at);
    if (!run) continue;
    const postings = samples.map(
      ([, title, department, location, workplace], index) => {
        const posting: ExtractedPosting = {
          sourcePostingId: `demo-${index}`,
          title,
          departments: [department],
          locations: [location],
          workplace,
          employment: "Full-time",
          publishedAt: null,
          url: `https://example.com/demo/${source.id}/${index}`,
          applyUrl: `https://example.com/demo/${source.id}/${index}`,
          descriptionHtml: `<h2>Synthetic demonstration listing</h2><p>This is sample data used to preview Jobbely. It is not a real vacancy and cannot be applied to.</p><h3>The role</h3><p>The ${title} works with a collaborative team to solve meaningful problems and develop thoughtful products.</p><h3>What you will do</h3><ul><li>Partner with your team on projects from discovery to delivery.</li><li>Bring care, clear thinking, and craftsmanship to your work.</li><li>Help improve the systems and practices around you.</li></ul>`,
        };
        const prepared = htmlPreparation.prepare(posting.descriptionHtml);
        const normalized = {
          ...posting,
          descriptionHtml: prepared.html,
          descriptionText: prepared.text,
          classification: classify(posting, source.companySlug, [
            new LabelMappingStrategy(),
            new TitleRuleStrategy(),
          ]),
        };
        return {
          ...normalized,
          contentHash: createHash("sha256")
            .update(JSON.stringify(normalized))
            .digest("hex"),
        };
      },
    );
    await repository.commitSnapshot({
      source,
      runId: run.id,
      observedAt: at,
      postings,
      excluded: 0,
      rawResponses: [],
      enumerationComplete: false,
    });
  }
}
