import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface ContextCompressionResult {
  generatedAt: string;
  logsScanned: number;
  retainedMemories: string[];
  summaryPath: string;
}

export function compressContextWindow(projectRoot: string): ContextCompressionResult {
  const generatedAt = new Date().toISOString();
  const logsDir = join(projectRoot, "logs");
  const logFiles = existsSync(logsDir)
    ? readdirSync(logsDir)
        .filter((file) => file.endsWith(".md"))
        .map((file) => join(logsDir, file))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    : [];
  const summaries = logFiles.slice(0, 24).map((file) => summarizeFile(file));
  const retained = [
    "agent-memory/shared-state.md",
    "agent-memory/current-priority.md",
    "agent-memory/runtime-risk-map.md",
    "agent-memory/known-failures.md",
    "agent-memory/recovery-patterns.md",
  ];
  const markdown = [
    "# Context Window Summary",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Current State",
    readOptional(projectRoot, "agent-memory/shared-state.md").split("\n").slice(0, 16).join("\n") || "- missing",
    "",
    "## Recent Log Summaries",
    ...summaries,
    "",
    "## Retained Memory",
    ...retained.map((file) => `- ${file}`),
    "",
  ].join("\n");
  writeText(projectRoot, "agent-memory/context-window-summary.md", markdown);
  writeText(projectRoot, "logs/context-window-compression.md", markdown);
  return { generatedAt, logsScanned: logFiles.length, retainedMemories: retained, summaryPath: "agent-memory/context-window-summary.md" };
}

function summarizeFile(filePath: string): string {
  const name = filePath.split("/").at(-1) ?? filePath;
  const text = readFileSync(filePath, "utf8");
  const bullets = text
    .split("\n")
    .filter((line) => /^[-#]/.test(line.trim()))
    .slice(0, 5)
    .join(" ");
  return `- ${name}: ${bullets.slice(0, 260) || "no summary"}`;
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = compressContextWindow(process.cwd());
  console.log(`Context compressed: ${result.logsScanned} logs`);
}
