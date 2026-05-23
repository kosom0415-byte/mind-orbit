import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface DashboardCounts {
  activeQueue: number;
  blocked: number;
  humanApprovalRequired: number;
  unsafeWaitingApproval: string[];
}

const DASHBOARD_PATH = "dashboard/ai-organization-dashboard.md";

export function generateOrganizationDashboard(projectRoot: string): string {
  ensureDashboardDir(projectRoot);
  const generatedAt = new Date().toISOString();
  const queue = readOptional(projectRoot, "logs/task-queue.md");
  const engineerReport = readOptional(projectRoot, "logs/engineer-report-latest.md");
  const gptPmReport = readOptional(projectRoot, "logs/gpt-pm-report-latest.md");
  const selfHeal = readOptional(projectRoot, "logs/self-heal-actions.md");
  const risks = readOptional(projectRoot, "agent-memory/active-risks.md");
  const memory = readOptional(projectRoot, "agent-memory/project-state-latest.md");
  const codebase = readOptional(projectRoot, "logs/architecture-summary.md");
  const approvals = readOptional(projectRoot, "agent-memory/human-approval-required.md");
  const counts = deriveCounts(queue, approvals);

  const markdown = [
    "# AI Organization Dashboard",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Current Workflow Status",
    "- GPT PM Agent: active via markdown reports",
    "- Codex Engineer Agent: active via dev-branch workflow",
    "- Watcher: available",
    "- Loop runner: available",
    "- Task queue: available",
    "- Bridge: available",
    "- Executor gate: available",
    "- Self-healing: dry-run available",
    "- Production deploy automation: disabled",
    "- env/API access automation: disabled",
    "",
    "## Queue",
    `- Active queue count: ${counts.activeQueue}`,
    `- Blocked task count: ${counts.blocked}`,
    `- Human approval required count: ${counts.humanApprovalRequired}`,
    "",
    "## Latest Engineer Report",
    excerpt(engineerReport, "No engineer report found."),
    "",
    "## Latest GPT PM Report",
    excerpt(gptPmReport, "No GPT PM report found."),
    "",
    "## Latest Self-Heal Result",
    excerpt(selfHeal, "No self-heal result found."),
    "",
    "## Active Risks",
    excerpt(risks, "No active risk memory found."),
    "",
    "## Production Safety Status",
    "- Production-safe mode: enabled",
    "- Production deploy: requires human approval",
    "- Rollback: requires human approval",
    "- Build success alone is not production-safe proof",
    "- Browser runtime validation is required before production confidence",
    "",
    "## Autonomous Maturity Level",
    "- Level 4: enforceable mock safety gates with human approval files",
    "- Remaining gap: real executor command firewall and approval UI integration",
    "",
    "## Next Recommended Safe Task",
    nextSafeTask(queue),
    "",
    "## Unsafe Tasks Waiting Approval",
    ...(counts.unsafeWaitingApproval.length ? counts.unsafeWaitingApproval.map((item) => `- ${item}`) : ["- None."]),
    "",
    "## Memory Snapshot Status",
    excerpt(memory, "No memory snapshot found."),
    "",
    "## Codebase Intelligence Status",
    excerpt(codebase, "No codebase intelligence summary found."),
    "",
  ].join("\n");

  writeFileSync(join(projectRoot, DASHBOARD_PATH), markdown, "utf8");
  return markdown;
}

function deriveCounts(queueMarkdown: string, approvalMarkdown: string): DashboardCounts {
  const activeQueue = countTableRows(queueMarkdown);
  const blocked = countSectionItems(queueMarkdown, "Blocked");
  const approvalFromQueue = countSectionItems(queueMarkdown, "Human Approval Required");
  const approvalFromMemory = countSectionItems(approvalMarkdown, "Pending Approval");
  const unsafeWaitingApproval = readSection(approvalMarkdown, "Pending Approval")
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line.startsWith("Task:"));

  return {
    activeQueue,
    blocked,
    humanApprovalRequired: Math.max(approvalFromQueue, approvalFromMemory),
    unsafeWaitingApproval,
  };
}

function nextSafeTask(queueMarkdown: string): string {
  const pending = readSection(queueMarkdown, "Pending");
  if (pending.includes("|")) return "- Continue with the first LOW/MEDIUM pending dev task after build validation.";
  return "- Ask GPT PM Agent for a LOW-risk documentation or test task.";
}

function countTableRows(markdown: string): number {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes(" ID "))
    .length;
}

function countSectionItems(markdown: string, heading: string): number {
  const section = readSection(markdown, heading);
  if (!section || /-\s*None\./i.test(section) || /-\s*none/i.test(section)) return 0;
  const taskLines = section.split("\n").filter((line) => /^\s*-\s+Task:/.test(line));
  if (taskLines.length > 0) return taskLines.length;
  return section.split("\n").filter((line) => /^\|/.test(line) && !line.includes("---") && !line.includes(" ID ")).length;
}

function readSection(markdown: string, heading: string): string {
  const match = markdown.match(new RegExp(`##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"));
  return match?.[1] ?? "";
}

function excerpt(markdown: string, fallback: string): string {
  if (!markdown.trim()) return `- ${fallback}`;
  return markdown
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, 10)
    .map((line) => (line.startsWith("#") ? line : line.startsWith("-") ? line : `- ${line}`))
    .join("\n");
}

function readOptional(projectRoot: string, relativePath: string): string {
  const fullPath = join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureDashboardDir(projectRoot: string): void {
  const dashboardDir = join(projectRoot, "dashboard");
  if (!existsSync(dashboardDir)) mkdirSync(dashboardDir, { recursive: true });
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  generateOrganizationDashboard(process.cwd());
  console.log(`AI organization dashboard generated: ${DASHBOARD_PATH}`);
}
