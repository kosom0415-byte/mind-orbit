import { pathToFileURL } from "node:url";
import { applyHumanResponse, type HumanDecision } from "./approval-response-parser";
import { runGptCodexBridge } from "./gpt-codex-bridge";
import { generateOrganizationDashboard } from "./organization-dashboard";

function readMockDecision(): HumanDecision | undefined {
  const index = process.argv.indexOf("--mock");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value === "approve" || value === "reject" || value === "modify-scope" || value === "ask-gpt") return value;
  return undefined;
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const projectRoot = process.cwd();
  const result = applyHumanResponse(projectRoot, { mockDecision: readMockDecision() });
  runGptCodexBridge(projectRoot);
  generateOrganizationDashboard(projectRoot);
  console.log("Human approval response applied.");
  console.log(`Action: ${result.action}`);
  console.log(`Valid: ${result.valid ? "yes" : "no"}`);
  console.log(`Task: ${result.response?.taskId ?? "none"}`);
  console.log("Wrote: logs/human-approval-apply-report.md");
  console.log("Updated: logs/task-queue.md");
  console.log("Updated: dashboard/ai-organization-dashboard.md");
}
