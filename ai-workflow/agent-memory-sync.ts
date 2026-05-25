import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export function syncAgentMemory(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const files = [
    "agent-memory/shared-state.md",
    "agent-memory/current-priority.md",
    "agent-memory/questions-for-gpt.md",
    "agent-memory/questions-for-human.md",
    "agent-memory/context-window-summary.md",
    "agent-memory/learned-failure-patterns.md",
  ];
  const markdown = [
    "# Agent Memory Sync",
    "",
    `Generated: ${generatedAt}`,
    "",
    ...files.flatMap((file) => [`## ${file}`, readOptional(projectRoot, file).split("\n").slice(0, 12).join("\n") || "- missing", ""]),
  ].join("\n");
  writeText(projectRoot, "agent-memory/agent-memory-sync.md", markdown);
  return markdown;
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  syncAgentMemory(process.cwd());
  console.log("Agent memory sync complete.");
}
