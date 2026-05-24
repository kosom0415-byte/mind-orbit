import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildCodebaseIndex } from "./codebase-index";

export function generateDependencyRiskMap(projectRoot: string): string {
  const index = buildCodebaseIndex(projectRoot);
  const risky = index.productionRiskFiles.slice(0, 20);
  const markdown = [
    "# Runtime Risk Map",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## Highest-Risk Files",
    ...risky.map((file, indexNumber) => `${indexNumber + 1}. ${file.path} | ${file.riskLevel} | impact ${file.renderImpact}`),
    "",
    "## Dependency Risk Rules",
    "- `app/page.tsx`, `app/globals.css`, providers, core hooks, NodeLayer, EdgeLayer are approval-gated.",
    "- Camera/depth/animation changes are experimental and require runtime validation.",
    "- Build success alone does not prove runtime safety.",
    "",
    "## Suggested Safe Refactor Order",
    "- Prefer ai-workflow docs/scripts before app runtime files.",
    "- Split graph engine changes into pure lib modules before UI rendering changes.",
    "- Validate runtime in browser before release evaluation.",
    "",
  ].join("\n");
  write(projectRoot, "agent-memory/runtime-risk-map.md", markdown);
  return markdown;
}

function write(projectRoot: string, relativePath: string, markdown: string): void {
  const dir = join(projectRoot, "agent-memory");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectRoot, relativePath), markdown, "utf8");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  generateDependencyRiskMap(process.cwd());
  console.log("Generated: agent-memory/runtime-risk-map.md");
}
