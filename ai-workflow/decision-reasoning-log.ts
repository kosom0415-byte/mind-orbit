import { pathToFileURL } from "node:url";
import { firstMatch, readOptional, writeText } from "./workflow-utils";

export function writeDecisionReasoningLog(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const queue = readOptional(projectRoot, "logs/task-queue.md");
  const release = readOptional(projectRoot, "logs/release-risk-score.md");
  const runtime = readOptional(projectRoot, "logs/runtime-health-score.md");
  const approval = readOptional(projectRoot, "logs/human-approval-apply-report.md");
  const markdown = [
    "# Decision History",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Current Decision",
    `- Runtime health: ${firstMatch(runtime, /Status:\s*(.+)/i, "unknown")}`,
    `- Release risk: ${firstMatch(release, /Level:\s*(.+)/i, "unknown")}`,
    `- Queue next action: ${firstMatch(queue, /Next action:\s*(.+)/i, "unknown")}`,
    `- Last approval action: ${firstMatch(approval, /Action:\s*(.+)/i, "none")}`,
    "",
    "## Rationale",
    "- Safe LOW/MEDIUM tasks can proceed through daemon/continue.",
    "- Waiting-human or HIGH/CRITICAL tasks require Human Vision Owner action.",
    "- Runtime or release DANGEROUS keeps release blocked.",
    "",
  ].join("\n");
  writeText(projectRoot, "logs/decision-history.md", markdown);
  return markdown;
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  writeDecisionReasoningLog(process.cwd());
  console.log("Decision reasoning log updated.");
}
