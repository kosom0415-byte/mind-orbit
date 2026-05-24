import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ApprovalType, WorkflowTask } from "./orchestrator";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApprovalDecision = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalToken {
  approvalId: string;
  taskId: string;
  approvedBy: string;
  approvedAt: string;
  approvalReason: string;
  approvedScope: string[];
  expiresAt: string;
  status: ApprovalDecision;
}

export interface TaskRiskAssessment {
  riskLevel: RiskLevel;
  score: number;
  reasons: string[];
  dangerousCommands: string[];
  approvalRequired: boolean;
}

export interface ApprovalGateTask extends WorkflowTask {
  queueStatus?: string;
  severity?: string;
  riskLevel?: RiskLevel;
  riskReasons?: string[];
  approvedBy?: string;
  approvedAt?: string;
  approvalReason?: string;
  approvedScope?: string[];
  approvalId?: string;
  approvalStatus?: ApprovalDecision;
  cancelledAt?: string;
}

export interface ApprovalGateResult<T extends ApprovalGateTask> {
  task: T;
  assessment: TaskRiskAssessment;
  approval?: ApprovalToken;
  action: "allow" | "block" | "cancel";
  message: string;
}

const APPROVAL_REQUEST_PATH = "agent-memory/approval-request.md";
const APPROVAL_RESPONSE_PATH = "agent-memory/approval-response.md";
const HUMAN_APPROVAL_PATH = "agent-memory/human-approval-required.md";
const APPROVAL_HISTORY_PATH = "logs/approval-history.md";
const BLOCKED_TASKS_PATH = "logs/blocked-tasks.md";
const RISK_ESCALATIONS_PATH = "logs/risk-escalations.md";

const RISK_RULES: Array<{ pattern: RegExp; score: number; reason: string }> = [
  { pattern: /globals\.css/i, score: 35, reason: "Touches global CSS." },
  { pattern: /app\/page\.tsx/i, score: 40, reason: "Touches primary app page." },
  { pattern: /provider|providers/i, score: 30, reason: "Touches provider/root app setup." },
  { pattern: /hook|hooks|use[A-Z][a-zA-Z]+/i, score: 30, reason: "Touches core hook surface." },
  { pattern: /nodelayer/i, score: 35, reason: "Touches node render layer." },
  { pattern: /edgelayer/i, score: 35, reason: "Touches edge render layer." },
  { pattern: /camera|perspective|depth|translatez|rotatex|rotatey/i, score: 40, reason: "Touches camera/depth transform system." },
  { pattern: /delete|remove|drop|purge/i, score: 35, reason: "Contains delete/remove operation language." },
  { pattern: /refactor|rewrite|restructure|architecture/i, score: 25, reason: "Contains broad refactor/architecture language." },
  { pattern: /animation|motion|overwrite/i, score: 30, reason: "Touches animation or overwrite behavior." },
  { pattern: /state architecture|state management|store|reducer/i, score: 35, reason: "Touches state architecture." },
  { pattern: /dependency upgrade|upgrade dependency|npm install|package-lock|package\.json/i, score: 30, reason: "Touches dependency upgrade/install surface." },
  { pattern: /production|deploy|rollback|main branch|vercel|domain|alias/i, score: 50, reason: "Touches production/deployment surface." },
  { pattern: /env|api key|secret|token|password/i, score: 50, reason: "Touches secret/env/security surface." },
  { pattern: /auth|security|payment|billing/i, score: 50, reason: "Touches auth/security/payment surface." },
  { pattern: /database schema|db schema|migration|supabase schema/i, score: 50, reason: "Touches database schema or migration surface." },
  { pattern: /git push|push automation/i, score: 50, reason: "Attempts to automate git push." },
  { pattern: /major upgrade|breaking upgrade/i, score: 45, reason: "Touches dependency major upgrade surface." },
];

export const DANGEROUS_COMMAND_REGISTRY = [
  "git reset --hard",
  "git push --force",
  "git clean -fd",
  "git checkout --",
  "rm -rf",
  "rm ",
  "find . -delete",
  "vercel --prod",
  "vercel rollback",
  "vercel alias",
  "sudo ",
  "chmod ",
  "chown ",
  "drop table",
  "truncate table",
  "database reset",
  "npm install --force",
  "npm audit fix --force",
  "supabase db reset",
  "supabase migration repair",
];

export function assessTaskRisk(task: Pick<WorkflowTask, "id" | "title" | "goal" | "context" | "attempts" | "maxAttempts">): TaskRiskAssessment {
  const text = `${task.id}\n${task.title}\n${task.goal}\n${task.context ?? ""}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  for (const rule of RISK_RULES) {
    if (rule.pattern.test(text)) {
      score += rule.score;
      reasons.push(rule.reason);
    }
  }

  const dangerousCommands = DANGEROUS_COMMAND_REGISTRY.filter((command) => text.includes(command.toLowerCase()));
  if (dangerousCommands.length > 0) {
    score += 60;
    reasons.push(`Dangerous command detected: ${dangerousCommands.join(", ")}`);
  }

  if (task.attempts >= task.maxAttempts) {
    score += 55;
    reasons.push("Retry limit reached or exceeded.");
  }

  const riskLevel = score >= 90 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";

  return {
    riskLevel,
    score,
    reasons: reasons.length ? reasons : ["No approval-gated risk pattern detected."],
    dangerousCommands,
    approvalRequired: riskLevel === "HIGH" || riskLevel === "CRITICAL",
  };
}

export function enforceApprovalGate<T extends ApprovalGateTask>(projectRoot: string, task: T, generatedAt = new Date().toISOString()): ApprovalGateResult<T> {
  const assessment = assessTaskRisk(task);
  const approval = findApprovalForTask(projectRoot, task.id);
  const nextTask = {
    ...task,
    riskLevel: assessment.riskLevel,
    riskReasons: assessment.reasons,
  };

  if (task.approvalStatus === "rejected" || task.approvalStatus === "expired") {
    const cancelled = {
      ...nextTask,
      queueStatus: "cancelled",
      status: "cancelled",
      humanApprovalRequired: false,
      blockedReason: `Human approval ${task.approvalStatus}.`,
      updatedAt: generatedAt,
    } as T;
    return { task: cancelled, assessment, approval, action: "cancel", message: `Existing ${task.approvalStatus} queue token found.` };
  }

  if (approval?.status === "rejected" || approval?.status === "expired") {
    const cancelled = {
      ...nextTask,
      queueStatus: "cancelled",
      status: "cancelled",
      humanApprovalRequired: false,
      approvalStatus: approval.status,
      approvalId: approval.approvalId,
      cancelledAt: generatedAt,
      blockedReason: `Human approval denied: ${approval.approvalReason}`,
      updatedAt: generatedAt,
    } as T;
    return { task: cancelled, assessment, approval, action: "cancel", message: "Approval denied; task cancelled." };
  }

  if (!assessment.approvalRequired) {
    return { task: nextTask as T, assessment, approval, action: "allow", message: "Approval not required." };
  }

  if (task.approvalStatus === "approved" && task.approvalId && task.approvedBy) {
    const approved = {
      ...nextTask,
      humanApprovalRequired: false,
      queueStatus: task.queueStatus === "human_approval_required" || task.queueStatus === "blocked" ? "pending" : task.queueStatus,
      status: task.status === "needs_human_approval" || task.status === "blocked" ? "queued" : task.status,
      blockedReason: undefined,
      updatedAt: generatedAt,
    } as T;
    return { task: approved, assessment, approval, action: "allow", message: "Existing approved queue token found." };
  }

  if (approval?.status === "approved") {
    const approved = {
      ...nextTask,
      approvalId: approval.approvalId,
      approvalStatus: approval.status,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      approvalReason: approval.approvalReason,
      approvedScope: approval.approvedScope,
      humanApprovalRequired: false,
      queueStatus: task.queueStatus === "human_approval_required" || task.queueStatus === "blocked" ? "pending" : task.queueStatus,
      status: task.status === "needs_human_approval" || task.status === "blocked" ? "queued" : task.status,
      blockedReason: undefined,
      updatedAt: generatedAt,
    } as T;
    return { task: approved, assessment, approval, action: "allow", message: "Human approval token found." };
  }

  const blocked = {
    ...nextTask,
    queueStatus: "human_approval_required",
    status: "needs_human_approval",
    owner: "human",
    humanApprovalRequired: true,
    approvalTypes: ensureApprovalType(task.approvalTypes),
    approvalStatus: "pending",
    blockedReason: `Approval gate blocked ${assessment.riskLevel} risk task: ${assessment.reasons.join("; ")}`,
    updatedAt: generatedAt,
  } as T;

  return { task: blocked, assessment, action: "block", message: "High-risk task blocked until human approval is recorded." };
}

export function assertTaskExecutable(projectRoot: string, task: ApprovalGateTask): void {
  const result = enforceApprovalGate(projectRoot, task);
  if (result.action !== "allow") {
    throw new Error(`Approval gate refused task ${task.id}: ${result.message}`);
  }
}

export function parseApprovalResponse(markdown: string): ApprovalToken[] {
  const sections = markdown.split(/\n(?=##\s+)/g);
  return sections
    .map((section) => {
      const taskId = readValue(section, "Task") || readValue(section, "Task ID");
      const statusText = readValue(section, "Status") || readValue(section, "Decision");
      if (!taskId || !statusText) return undefined;

      const status: ApprovalDecision = /expire|expired|만료/i.test(statusText)
        ? "expired"
        : /deny|denied|reject|rejected|거절|반려/i.test(statusText)
          ? "rejected"
          : /approve|approved|승인/i.test(statusText)
            ? "approved"
            : "pending";
      const expiresAt = readValue(section, "Expires At") || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      return {
        approvalId: readValue(section, "Approval ID") || `approval-${taskId}`,
        taskId,
        status: isExpired(status, expiresAt) ? "expired" : status,
        approvedBy: readValue(section, "Approved By") || readValue(section, "Approver") || "human",
        approvedAt: readValue(section, "Approved At") || new Date().toISOString(),
        approvalReason: readValue(section, "Reason") || "No approval reason provided.",
        approvedScope: splitCsv(readValue(section, "Approved Scope") || "task-only"),
        expiresAt,
      };
    })
    .filter((token): token is ApprovalToken => Boolean(token));
}

export function writeApprovalReports(projectRoot: string, results: ApprovalGateResult<ApprovalGateTask>[], generatedAt = new Date().toISOString()): void {
  ensureDirectories(projectRoot);
  writeFileSync(join(projectRoot, APPROVAL_REQUEST_PATH), generateApprovalRequest(results, generatedAt), "utf8");
  writeFileSync(join(projectRoot, HUMAN_APPROVAL_PATH), generateHumanApprovalRequired(results, generatedAt), "utf8");
  writeFileSync(join(projectRoot, APPROVAL_HISTORY_PATH), generateApprovalHistory(results, generatedAt), "utf8");
  writeFileSync(join(projectRoot, BLOCKED_TASKS_PATH), generateBlockedTasks(results, generatedAt), "utf8");
  writeFileSync(join(projectRoot, RISK_ESCALATIONS_PATH), generateRiskEscalations(results, generatedAt), "utf8");
}

function findApprovalForTask(projectRoot: string, taskId: string): ApprovalToken | undefined {
  const responsePath = join(projectRoot, APPROVAL_RESPONSE_PATH);
  if (!existsSync(responsePath)) return undefined;
  return parseApprovalResponse(readFileSync(responsePath, "utf8")).find((token) => token.taskId === taskId);
}

function ensureApprovalType(types: ApprovalType[]): ApprovalType[] {
  return types.length ? types : ["high_risk_task"];
}

function generateApprovalRequest(results: ApprovalGateResult<ApprovalGateTask>[], generatedAt: string): string {
  const blocked = results.filter((result) => result.action === "block");
  return [
    "# Approval Request",
    "",
    `Updated: ${generatedAt}`,
    "",
    "## Pending Approval",
    ...(blocked.length
      ? blocked.flatMap((result) => [
          `- Task: ${result.task.id}`,
          `  - Title: ${result.task.title}`,
          `  - Risk: ${result.assessment.riskLevel}`,
          `  - Score: ${result.assessment.score}`,
          `  - Reason: ${result.assessment.reasons.join("; ")}`,
          "  - Required response format:",
          `    - Approval ID: approval-${result.task.id}`,
          `    - Task: ${result.task.id}`,
          "    - Status: approved | rejected",
          "    - Approved By: <human name>",
          "    - Approved Scope: <task-only | listed files | exact command>",
          "    - Expires At: <ISO timestamp>",
          "    - Reason: <why this is safe or denied>",
          "  - Recommended choices:",
          "    - A. approve",
          "    - B. reject",
          "    - C. modify scope",
          "    - D. rollback",
          "    - E. ask GPT PM",
        ])
      : ["- None."]),
    "",
    "## Safety",
    "- Approval request does not perform deploy, git push, env/API access, or destructive commands.",
    "",
  ].join("\n");
}

function generateHumanApprovalRequired(results: ApprovalGateResult<ApprovalGateTask>[], generatedAt: string): string {
  const blocked = results.filter((result) => result.action === "block");
  return [
    "# Human Approval Required",
    "",
    `Updated: ${generatedAt}`,
    "",
    "## Pending Approval",
    ...(blocked.length
      ? blocked.flatMap((result) => [
          `- Task: ${result.task.id}`,
          `  - Title: ${result.task.title}`,
          `  - Risk: ${result.assessment.riskLevel}`,
          `  - Reason: ${result.assessment.reasons.join("; ")}`,
          `  - Approval types: ${result.task.approvalTypes.join(", ")}`,
        ])
      : ["- None."]),
    "",
    "## Guardrails",
    "- HIGH and CRITICAL tasks cannot run without approval token fields.",
    "- Approval token fields: approvalId, approvedBy, approvedAt, approvalReason, approvedScope, expiresAt, status.",
    "- Production deploy/rollback is never automated.",
    "- env/API key access is never automated.",
    "- Destructive commands are forbidden.",
    "",
  ].join("\n");
}

function generateApprovalHistory(results: ApprovalGateResult<ApprovalGateTask>[], generatedAt: string): string {
  return [
    "# Approval History",
    "",
    `Updated: ${generatedAt}`,
    "",
    "| Task | Risk | Action | Approved By | Reason |",
    "| --- | --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| ${result.task.id} | ${result.assessment.riskLevel} | ${result.action} | ${result.approval?.approvedBy ?? "-"} | ${escapeTable(result.approval?.approvalReason ?? result.message)} |`,
    ),
    "",
  ].join("\n");
}

function generateBlockedTasks(results: ApprovalGateResult<ApprovalGateTask>[], generatedAt: string): string {
  const blocked = results.filter((result) => result.action === "block");
  return [
    "# Blocked Tasks",
    "",
    `Updated: ${generatedAt}`,
    "",
    ...(blocked.length
      ? blocked.flatMap((result) => [
          `- ${result.task.id}: ${result.task.title} (${result.assessment.riskLevel})`,
          `  - Blocked reason: ${result.task.blockedReason}`,
          "  - Recommended safe alternative: narrow scope, split into docs/test-only task, or ask GPT PM for a safer handoff.",
        ])
      : ["- None."]),
    "",
  ].join("\n");
}

function generateRiskEscalations(results: ApprovalGateResult<ApprovalGateTask>[], generatedAt: string): string {
  const escalated = results.filter((result) => result.assessment.approvalRequired || result.assessment.dangerousCommands.length > 0);
  return [
    "# Risk Escalations",
    "",
    `Updated: ${generatedAt}`,
    "",
    ...(escalated.length
      ? escalated.flatMap((result) => [
          `## ${result.task.id}`,
          "",
          `- Risk: ${result.assessment.riskLevel}`,
          `- Score: ${result.assessment.score}`,
          `- Action: ${result.action}`,
          `- Reasons: ${result.assessment.reasons.join("; ")}`,
          `- Dangerous commands: ${result.assessment.dangerousCommands.join(", ") || "none"}`,
          "",
        ])
      : ["- None.", ""]),
  ].join("\n");
}

function readValue(section: string, label: string): string | undefined {
  const match = section.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${escapeRegExp(label)}\\s*:\\s*(.+)`, "i"));
  return match?.[1]?.trim();
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isExpired(status: ApprovalDecision, expiresAt: string): boolean {
  if (status !== "approved") return false;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires < Date.now();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function ensureDirectories(projectRoot: string): void {
  for (const dir of ["agent-memory", "logs"]) {
    const fullPath = join(projectRoot, dir);
    if (!existsSync(fullPath)) mkdirSync(fullPath, { recursive: true });
  }
}

function runDryRun(projectRoot: string): void {
  const now = new Date().toISOString();
  const lowTask: ApprovalGateTask = {
    id: "approval-test-low-docs",
    title: "Update workflow documentation",
    goal: "Small documentation-only update.",
    status: "queued",
    owner: "codex-engineer",
    priority: "low",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: now,
    updatedAt: now,
  };
  const highTask: ApprovalGateTask = {
    ...lowTask,
    id: "approval-test-high-page",
    title: "Refactor app/page.tsx camera system",
    goal: "Rewrite camera depth animation and state architecture.",
  };
  const retryTask: ApprovalGateTask = {
    ...lowTask,
    id: "approval-test-retry-limit",
    title: "Retry failed build fix",
    goal: "Retry limit should escalate approval.",
    attempts: 2,
    maxAttempts: 2,
  };
  const approvedTask: ApprovalGateTask = {
    ...highTask,
    id: "approval-test-approved-high-page",
  };
  const responsePath = join(projectRoot, APPROVAL_RESPONSE_PATH);
  if (!existsSync(responsePath)) {
    writeFileSync(
      responsePath,
      [
        "# Approval Response",
        "",
        "## Approved High Task",
        "- Approval ID: approval-approval-test-approved-high-page",
        "- Task: approval-test-approved-high-page",
        "- Status: approved",
        "- Approved By: Human Vision Owner",
        "- Approved Scope: dry-run only",
        `- Expires At: ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}`,
        "- Reason: Dry-run validation token only.",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  const results = [lowTask, highTask, approvedTask, retryTask].map((task) => enforceApprovalGate(projectRoot, task, now));
  writeApprovalReports(projectRoot, results, now);
  console.log("Approval gate dry-run complete.");
  results.forEach((result) => console.log(`${result.task.id}: ${result.assessment.riskLevel} / ${result.action}`));
  console.log(`Wrote: ${APPROVAL_REQUEST_PATH}`);
  console.log(`Wrote: ${HUMAN_APPROVAL_PATH}`);
  console.log(`Wrote: ${APPROVAL_HISTORY_PATH}`);
  console.log(`Wrote: ${BLOCKED_TASKS_PATH}`);
  console.log(`Wrote: ${RISK_ESCALATIONS_PATH}`);
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  runDryRun(process.cwd());
}
