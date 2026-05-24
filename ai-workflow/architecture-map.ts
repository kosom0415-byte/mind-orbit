import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildCodebaseIndex } from "./codebase-index";

export function generateArchitectureMap(projectRoot: string): string {
  const index = buildCodebaseIndex(projectRoot);
  const workflowFiles = index.files.filter((file) => file.path.startsWith("ai-workflow/"));
  const appFiles = index.files.filter((file) => file.path.startsWith("app/"));
  const markdown = [
    "# Architecture Map",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "## Product Runtime",
    ...appFiles.slice(0, 20).map((file) => `- ${file.path}: ${file.kind}, risk ${file.riskLevel}`),
    "",
    "## AI Engineering OS",
    ...workflowFiles.slice(0, 40).map((file) => `- ${file.path}: imports ${file.imports.length}, imported by ${file.importedBy.length}`),
    "",
    "## Control Flow",
    "1. GPT PM frames task and approval questions.",
    "2. Codex Engineer changes dev-only workflow files.",
    "3. Central Executor records safe validation actions.",
    "4. Browser Runtime Agent evaluates local load/runtime risk.",
    "5. Release Manager scores readiness without deploying.",
    "6. Human Vision Owner approves high-risk actions manually.",
    "",
  ].join("\n");
  write(projectRoot, "agent-memory/architecture-map.md", markdown);
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
  generateArchitectureMap(process.cwd());
  console.log("Generated: agent-memory/architecture-map.md");
}
