import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildCodebaseIndex } from "./codebase-index";

export function generateCodebaseSummary(projectRoot: string): string {
  const index = buildCodebaseIndex(projectRoot);
  const markdown = [
    "# Codebase Summary",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## Core Surfaces",
    "- `app/page.tsx`: primary app shell and highest render-risk surface.",
    "- `app/components/*Layer.tsx`: node/edge/render interaction layers.",
    "- `hooks/use*.ts`: shared interaction state and runtime behavior.",
    "- `lib/mind/*`: semantic graph and edge engine.",
    "- `ai-workflow/*`: autonomous engineering operating system.",
    "",
    "## Most Imported Files",
    ...index.mostImported.slice(0, 10).map((item) => `- ${item.path}: imported by ${item.count}`),
    "",
    "## Highest Render Impact",
    ...index.highRenderImpact.slice(0, 10).map((file) => `- ${file.path}: impact ${file.renderImpact}, risk ${file.riskLevel}`),
    "",
    "## AI Operating Principle",
    "- UX/runtime app files remain human-gated.",
    "- Workflow automation can evolve on dev branch with build and runtime validation.",
    "",
  ].join("\n");
  writeMemory(projectRoot, "agent-memory/codebase-summary.md", markdown);
  return markdown;
}

function writeMemory(projectRoot: string, relativePath: string, markdown: string): void {
  const dir = join(projectRoot, "agent-memory");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectRoot, relativePath), markdown, "utf8");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  generateCodebaseSummary(process.cwd());
  console.log("Generated: agent-memory/codebase-summary.md");
}
