import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(`${directory}/${entry.name}`)
          : `${directory}/${entry.name}`,
      ),
    )
  ).flat();
}
const allowedLayers = {
  domain: new Set(["domain"]),
  ports: new Set(["domain", "ports"]),
  application: new Set(["domain", "ports", "application"]),
};
function moduleSpecifiers(content) {
  // Covers imports, re-exports, side-effect imports and literal dynamic imports/requires.
  return [
    ...content.matchAll(
      /(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g,
    ),
  ].map((match) => match[1]);
}
for (const layer of Object.keys(allowedLayers)) {
  for (const file of await walk(`backend/src/${layer}`)) {
    if (file.endsWith(".test.ts")) continue;
    const content = await readFile(file, "utf8");
    for (const specifier of moduleSpecifiers(content)) {
      if (!specifier.startsWith(".")) {
        if (layer === "application" && specifier === "node:crypto") continue;
        throw new Error(
          `External dependency ${specifier} violates ${layer} purity in ${file}`,
        );
      }
      const target = resolve(dirname(file), specifier);
      const targetPath = relative(resolve("backend/src"), target);
      const targetLayer = targetPath.split(sep)[0];
      if (!allowedLayers[layer].has(targetLayer))
        throw new Error(
          `Dependency ${specifier} violates ${layer} boundary in ${file}`,
        );
    }
  }
}
for (const file of await walk("frontend/src")) {
  if (
    moduleSpecifiers(await readFile(file, "utf8")).some((specifier) =>
      /backend/.test(specifier),
    )
  )
    throw new Error(`Frontend imports backend internals: ${file}`);
}
console.log("Dependency boundaries verified.");
