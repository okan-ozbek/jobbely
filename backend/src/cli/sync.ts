import { bootstrap, config } from "../bootstrap.js";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { company: { type: "string" }, "all-enabled": { type: "boolean" } },
});
if (config.DATA_MODE !== "postgres")
  throw new Error(
    "Sync requires DATA_MODE=postgres. Demo data must stay separate from real vacancies.",
  );
const dependencies = await bootstrap();
try {
  const sources = dependencies.sources.filter((source) =>
    values.company
      ? source.companySlug === values.company
      : values["all-enabled"] && source.scheduled,
  );
  if (!sources.length)
    throw new Error(
      "No matching sources. Specify --company <slug> or --all-enabled.",
    );
  let failed = false;
  for (const source of sources) {
    try {
      console.log(JSON.stringify(await dependencies.sync.execute(source)));
    } catch (error) {
      failed = true;
      console.error(source.id, error instanceof Error ? error.message : error);
    }
  }
  if (failed) process.exitCode = 1;
} finally {
  await dependencies.repository.close();
}
