import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { listAgents } from "./agent-registry";
import { readMessages } from "./message-bus";

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
  const confirmations = readOptional(projectRoot, "agent-memory/human-confirmation-required.md");
  const confirmationLog = readOptional(projectRoot, "logs/human-confirmation.md");
  const centralExecutor = readOptional(projectRoot, "logs/central-executor.md");
  const humanResponse = readOptional(projectRoot, "agent-memory/human-response.md");
  const approvalApplyReport = readOptional(projectRoot, "logs/human-approval-apply-report.md");
  const approvalHistory = readOptional(projectRoot, "logs/approval-history.md");
  const runtime = readOptional(projectRoot, "logs/agent-runtime-execution.md");
  const stateMachine = readOptional(projectRoot, "logs/task-state-machine.md");
  const counts = deriveCounts(queue, approvals);
  const agents = listAgents();
  const messages = readMessages(projectRoot);
  const maturity = calculateMaturity({
    hasQueue: Boolean(queue),
    hasBridge: Boolean(readOptional(projectRoot, "logs/gpt-codex-bridge.md")),
    hasApprovalGate: Boolean(readOptional(projectRoot, "logs/approval-history.md")),
    hasSelfHeal: Boolean(selfHeal),
    hasRuntime: Boolean(runtime),
    hasMessageBus: messages.length > 0,
  });

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
    "## Active Agents",
    ...agents.map(
      (agent) =>
        `- ${agent.id}: ${agent.currentStatus} | max autonomous level ${agent.maxAutonomousLevel} | production ${agent.canModifyProduction ? "yes" : "no"}`,
    ),
    "",
    "## Queue",
    `- Active queue count: ${counts.activeQueue}`,
    `- Blocked task count: ${counts.blocked}`,
    `- Human approval required count: ${counts.humanApprovalRequired}`,
    "",
    "## Human Confirmation Waiting",
    excerpt(confirmations, "No human confirmation request found."),
    "",
    "## Task Ownership",
    "- GPT_PM_AGENT: planning, blocked routing, handoff framing",
    "- CODEX_ENGINEER_AGENT: dev implementation and validation",
    "- CLAUDE_REVIEWER_AGENT: risk review simulation",
    "- SELF_HEAL_AGENT: failure recovery recommendation",
    "- RELEASE_MANAGER_AGENT: release readiness only, no deploy",
    "",
    "## Blocked Flows",
    excerpt(readOptional(projectRoot, "logs/blocked-tasks.md"), "No blocked task log found."),
    "",
    "## Review Status",
    excerpt(runtime, "No runtime execution log found."),
    "",
    "## Central Executor Status",
    excerpt(centralExecutor, "No central executor log found."),
    "",
    "## Human Confirmation Log",
    excerpt(confirmationLog, "No human confirmation log found."),
    "",
    "## Last Human Response",
    excerpt(humanResponse, "No human response file found."),
    "",
    "## Human Approval Apply Result",
    excerpt(approvalApplyReport, "No approval apply report found."),
    "",
    "## Approval History Summary",
    excerpt(lastLines(approvalHistory, 12), "No approval history found."),
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
    `- Score: ${maturity.score}/5`,
    `- Level: ${maturity.label}`,
    `- Reason: ${maturity.reason}`,
    "",
    "## Current Risk Level",
    currentRiskLevel(counts, runtime),
    "",
    "## Safe / Unsafe Tasks",
    `- Safe task guidance: ${nextSafeTask(queue).replace(/^- /, "")}`,
    ...(counts.unsafeWaitingApproval.length ? counts.unsafeWaitingApproval.map((item) => `- Unsafe waiting approval: ${item}`) : ["- Unsafe waiting approval: none"]),
    "",
    "## Inter-Agent Messages",
    ...(messages.length ? messages.slice(-8).map((message) => `- ${message.from} -> ${message.to}: ${message.type} / ${message.summary}`) : ["- None."]),
    "",
    "## Task State Machine",
    excerpt(stateMachine, "No task state machine log found."),
    "",
    "## Next Recommended Safe Task",
    nextSafeTask(queue),
    "",
    "## Unsafe Tasks Waiting Approval",
    ...(counts.unsafeWaitingApproval.length ? counts.unsafeWaitingApproval.map((item) => `- ${item}`) : ["- None."]),
    "",
    "## Approved / Cancelled Queue Changes",
    approvedCancelledSummary(queue),
    "",
    "## Mobile Review Files",
    "- dashboard/ai-organization-dashboard.md",
    "- agent-memory/human-confirmation-required.md",
    "- logs/human-confirmation.md",
    "- logs/central-executor.md",
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

function approvedCancelledSummary(queueMarkdown: string): string {
  const pending = readSection(queueMarkdown, "Pending");
  const cancelled = readSection(queueMarkdown, "Cancelled");
  return [
    pending && !/-\s*none/i.test(pending) ? `- Approved/pending: ${compactSection(pending)}` : "- Approved/pending: none",
    cancelled && !/-\s*none/i.test(cancelled) ? `- Cancelled: ${compactSection(cancelled)}` : "- Cancelled: none",
  ].join("\n");
}

function compactSection(section: string): string {
  return section
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5)
    .join("; ");
}

function lastLines(markdown: string, count: number): string {
  return markdown
    .split("\n")
    .slice(-count)
    .join("\n");
}

function currentRiskLevel(counts: DashboardCounts, runtimeMarkdown: string): string {
  if (counts.humanApprovalRequired > 0) return "- HIGH: human approval is waiting.";
  if (/DANGEROUS|CRITICAL/i.test(runtimeMarkdown)) return "- HIGH: runtime review reported dangerous risk.";
  if (counts.blocked > 0) return "- MEDIUM: blocked tasks exist.";
  return "- LOW: no blocked or approval-waiting task detected.";
}

function calculateMaturity(input: {
  hasQueue: boolean;
  hasBridge: boolean;
  hasApprovalGate: boolean;
  hasSelfHeal: boolean;
  hasRuntime: boolean;
  hasMessageBus: boolean;
}): { score: number; label: string; reason: string } {
  let score = 0;
  if (input.hasQueue || input.hasBridge) score = 2;
  if (input.hasQueue && input.hasBridge && input.hasApprovalGate) score = 3;
  if (score >= 3 && input.hasSelfHeal && input.hasMessageBus) score = 4;
  if (score >= 4 && input.hasRuntime) score = 5;

  const labels = [
    "LEVEL 0 manual coding only",
    "LEVEL 1 AI assisted",
    "LEVEL 2 workflow automation",
    "LEVEL 3 multi-agent orchestration",
    "LEVEL 4 self-healing runtime",
    "LEVEL 5 human-supervised autonomous engineering",
  ];
  return {
    score,
    label: labels[score],
    reason:
      score >= 5
        ? "Registry, message bus, approval gate, self-heal, and runtime simulation are present; production remains human-gated."
        : "Runtime simulation or safety evidence is incomplete.",
  };
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
