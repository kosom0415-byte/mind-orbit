import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function generateFeatureHistory(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const commits = readRecentCommits(projectRoot);
  const markdown = [
    "# Feature History Tracker",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Recent Development Themes",
    ...commits.map((line) => `- ${line}`),
    "",
    "## Current Direction",
    "- AI workflow safety and autonomous engineering operations are the active development lane.",
    "- Product UI changes remain isolated until approved and validated.",
    "",
  ].join("\n");
  const dir = join(projectRoot, "agent-memory");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectRoot, "agent-memory/feature-history.md"), markdown, "utf8");
  return markdown;
}

function readRecentCommits(projectRoot: string): string[] {
  try {
    return execSync("git log --oneline -12", { cwd: projectRoot, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return ["git history unavailable"];
  }
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  generateFeatureHistory(process.cwd());
  console.log("Generated: agent-memory/feature-history.md");
}
