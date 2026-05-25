import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export function updateAgentCommunicationBus(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const gpt = readOptional(projectRoot, "logs/gpt-pm-report-latest.md");
  const codex = readOptional(projectRoot, "logs/engineer-report-latest.md");
  const human = readOptional(projectRoot, "logs/human-approval-apply-report.md");
  const review = readOptional(projectRoot, "logs/runtime-observation.md");
  const markdown = [
    "# Agent Conversations",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## GPT PM Reasoning",
    ...excerpt(gpt),
    "",
    "## Codex Engineering Reasoning",
    ...excerpt(codex),
    "",
    "## Human Approval Reason",
    ...excerpt(human),
    "",
    "## Runtime Review Result",
    ...excerpt(review),
    "",
  ].join("\n");
  writeText(projectRoot, "logs/agent-conversations.md", markdown);
  return markdown;
}

function excerpt(markdown: string): string[] {
  const lines = markdown.split("\n").filter((line) => line.trim()).slice(0, 10);
  return lines.length ? lines.map((line) => (line.startsWith("#") || line.startsWith("-") ? line : `- ${line}`)) : ["- none"];
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  updateAgentCommunicationBus(process.cwd());
  console.log("Agent communication bus updated.");
}
