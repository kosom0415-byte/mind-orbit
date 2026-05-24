import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type HumanDecision = "approve" | "reject" | "modify-scope" | "ask-gpt";

export interface HumanResponse {
  approvalId: string;
  taskId: string;
  decision: HumanDecision;
  approvedScope: string;
  reason: string;
  requestedChanges: string;
  approvedBy: string;
  timestamp: string;
}

export interface ApprovalApplyResult {
  valid: boolean;
  response?: HumanResponse;
  action: "approved-to-pending" | "rejected-to-cancelled" | "scope-modification-requested" | "question-added" | "invalid" | "noop";
  message: string;
}

interface QueueState {
  version: 1;
  generatedAt: string;
  tasks: Array<Record<string, any>>;
  failedHistory: Array<Record<string, any>>;
  nextAction: string;
  codebaseImpact?: Record<string, any>;
}

const HUMAN_RESPONSE_PATH = "agent-memory/human-response.md";
const OPEN_QUESTIONS_PATH = "agent-memory/open-questions.md";
const HUMAN_APPROVAL_REQUIRED_PATH = "agent-memory/human-approval-required.md";
const TASK_QUEUE_PATH = "logs/task-queue.md";
const APPROVAL_HISTORY_PATH = "logs/approval-history.md";
const APPLY_REPORT_PATH = "logs/human-approval-apply-report.md";
const STATE_BLOCK_START = "<!-- task-queue-state";
const STATE_BLOCK_END = "-->";

export function parseHumanResponse(markdown: string): ApprovalApplyResult {
  if (!markdown.trim() || /-\s*None\./i.test(markdown)) {
    return { valid: true, action: "noop", message: "No pending human response." };
  }

  const response: HumanResponse = {
    approvalId: readValue(markdown, "approvalId") || readValue(markdown, "Approval ID") || "",
    taskId: readValue(markdown, "taskId") || readValue(markdown, "Task") || "",
    decision: normalizeDecision(readValue(markdown, "decision") || readValue(markdown, "Decision") || ""),
    approvedScope: readValue(markdown, "approvedScope") || readValue(markdown, "Approved Scope") || "",
    reason: readValue(markdown, "reason") || readValue(markdown, "Reason") || "",
    requestedChanges: readValue(markdown, "requestedChanges") || readValue(markdown, "Requested Changes") || "",
    approvedBy: readValue(markdown, "approvedBy") || readValue(markdown, "Approved By") || "",
    timestamp: readValue(markdown, "timestamp") || readValue(markdown, "Timestamp") || new Date().toISOString(),
  };

  const missing = validateResponse(response);
  if (missing.length > 0) {
    return { valid: false, response, action: "invalid", message: `Invalid human response. Missing: ${missing.join(", ")}` };
  }

  const action: ApprovalApplyResult["action"] =
    response.decision === "approve"
      ? "approved-to-pending"
      : response.decision === "reject"
        ? "rejected-to-cancelled"
        : response.decision === "modify-scope"
          ? "scope-modification-requested"
          : "question-added";

  return { valid: true, response, action, message: `Human response parsed as ${response.decision}.` };
}

export function applyHumanResponse(projectRoot: string, options?: { mockDecision?: HumanDecision }): ApprovalApplyResult {
  ensureDirs(projectRoot);
  const markdown = options?.mockDecision ? createMockResponse(options.mockDecision) : readOptional(projectRoot, HUMAN_RESPONSE_PATH);
  const result = parseHumanResponse(markdown);
  const generatedAt = new Date().toISOString();

  if (!result.valid || !result.response) {
    appendApprovalHistory(projectRoot, result, generatedAt);
    writeApplyReport(projectRoot, result, generatedAt);
    if (result.action !== "noop") clearHumanResponse(projectRoot);
    return result;
  }

  const queue = readQueueState(projectRoot);
  const task = findOrCreateTask(queue, result.response, generatedAt);
  task.goal = result.response.approvedScope || task.goal;
  task.updatedAt = generatedAt;

  if (result.response.decision === "approve") {
    Object.assign(task, {
      queueStatus: "pending",
      status: "queued",
      humanApprovalRequired: false,
      approvalStatus: "approved",
      approvalId: result.response.approvalId,
      approvedBy: result.response.approvedBy,
      approvedAt: result.response.timestamp,
      approvalReason: result.response.reason,
      approvedScope: [result.response.approvedScope],
      blockedReason: undefined,
      updatedAt: generatedAt,
    });
    queue.nextAction = `Run approved task: ${task.id}`;
  } else if (result.response.decision === "reject") {
    Object.assign(task, {
      queueStatus: "cancelled",
      status: "cancelled",
      humanApprovalRequired: false,
      approvalStatus: "rejected",
      approvalId: result.response.approvalId,
      blockedReason: `Human rejected task: ${result.response.reason}`,
      updatedAt: generatedAt,
    });
    queue.nextAction = "Ask GPT PM for a safer alternative after rejection.";
  } else if (result.response.decision === "modify-scope") {
    Object.assign(task, {
      queueStatus: "human_approval_required",
      status: "needs_human_approval",
      humanApprovalRequired: true,
      approvalStatus: "pending",
      approvalId: result.response.approvalId,
      blockedReason: `Human requested scope modification: ${result.response.requestedChanges}`,
      context: `${task.context ?? ""}\nRequested scope: ${result.response.approvedScope}`,
      updatedAt: generatedAt,
    });
    queue.nextAction = "Send modified scope back to GPT PM and Codex handoff.";
  } else if (result.response.decision === "ask-gpt") {
    appendOpenQuestion(projectRoot, result.response, generatedAt);
    Object.assign(task, {
      queueStatus: "blocked",
      status: "blocked",
      humanApprovalRequired: false,
      approvalStatus: "pending",
      blockedReason: `Human asked GPT PM: ${result.response.requestedChanges || result.response.reason}`,
      updatedAt: generatedAt,
    });
    queue.nextAction = "Ask GPT PM to answer human clarification request.";
  }

  queue.generatedAt = generatedAt;
  writeQueueState(projectRoot, queue);
  writeHumanApprovalRequired(projectRoot, queue, generatedAt);
  appendApprovalHistory(projectRoot, result, generatedAt);
  writeApplyReport(projectRoot, result, generatedAt);
  clearHumanResponse(projectRoot);
  return result;
}

function validateResponse(response: HumanResponse): string[] {
  const missing: string[] = [];
  if (!response.approvalId) missing.push("approvalId");
  if (!response.taskId) missing.push("taskId");
  if (!response.decision) missing.push("decision");
  if (!["approve", "reject", "modify-scope", "ask-gpt"].includes(response.decision)) missing.push("valid decision");
  if (!response.approvedBy) missing.push("approvedBy");
  if (!response.reason) missing.push("reason");
  if (response.decision === "approve" && !response.approvedScope) missing.push("approvedScope");
  if ((response.decision === "modify-scope" || response.decision === "ask-gpt") && !response.requestedChanges) {
    missing.push("requestedChanges");
  }
  return missing;
}

function normalizeDecision(value: string): HumanDecision {
  const normalized = value.trim().toLowerCase();
  if (normalized === "approved") return "approve";
  if (normalized === "rejected") return "reject";
  if (normalized === "modify scope") return "modify-scope";
  if (normalized === "ask gpt") return "ask-gpt";
  return normalized as HumanDecision;
}

function readQueueState(projectRoot: string): QueueState {
  const markdown = readOptional(projectRoot, TASK_QUEUE_PATH);
  const match = markdown.match(new RegExp(`${STATE_BLOCK_START}\\s*([\\s\\S]*?)\\s*${STATE_BLOCK_END}`));
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as QueueState;
    } catch {
      // fall through to empty state
    }
  }
  return { version: 1, generatedAt: new Date().toISOString(), tasks: [], failedHistory: [], nextAction: "Rebuild queue after human approval." };
}

function findOrCreateTask(queue: QueueState, response: HumanResponse, generatedAt: string): Record<string, any> {
  let task = queue.tasks.find((item) => item.id === response.taskId);
  if (!task) {
    task = {
      id: response.taskId,
      title: `Human response task ${response.taskId}`,
      goal: response.approvedScope || response.reason,
      status: "needs_human_approval",
      owner: "human",
      priority: "high",
      branch: "dev",
      attempts: 0,
      maxAttempts: 2,
      productionSafeMode: true,
      humanApprovalRequired: true,
      approvalTypes: ["high_risk_task"],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      queueStatus: "human_approval_required",
      severity: "s1-critical",
      riskLevel: "HIGH",
      riskReasons: ["Created from human response because task was not present in queue."],
    };
    queue.tasks.push(task);
  }
  return task;
}

function writeQueueState(projectRoot: string, queue: QueueState): void {
  const markdown = [
    "# Autonomous Task Queue",
    "",
    `Generated: ${queue.generatedAt}`,
    "",
    "## Summary",
    `- Pending: ${count(queue, "pending")}`,
    `- Running: ${count(queue, "running")}`,
    `- Blocked: ${count(queue, "blocked")}`,
    `- Completed: ${count(queue, "completed")}`,
    `- Cancelled: ${count(queue, "cancelled")}`,
    `- Human approval required: ${count(queue, "human_approval_required")}`,
    `- Next action: ${queue.nextAction}`,
    "",
    renderSection("Pending", queue, "pending"),
    renderSection("Blocked", queue, "blocked"),
    renderSection("Human Approval Required", queue, "human_approval_required"),
    renderSection("Cancelled", queue, "cancelled"),
    renderSection("Completed", queue, "completed"),
    "## Safety",
    "- Production deploy: not automated",
    "- env/API key access: not used",
    "- OpenAI API calls: mocked / disabled",
    "",
    STATE_BLOCK_START,
    JSON.stringify(queue, null, 2),
    STATE_BLOCK_END,
    "",
  ].join("\n");
  writeFileSync(join(projectRoot, TASK_QUEUE_PATH), markdown, "utf8");
}

function renderSection(title: string, queue: QueueState, status: string): string {
  const tasks = queue.tasks.filter((task) => task.queueStatus === status);
  return [`## ${title}`, tasks.length ? tasks.map((task) => `- ${task.id}: ${task.title}`).join("\n") : "- none", ""].join("\n");
}

function count(queue: QueueState, status: string): number {
  return queue.tasks.filter((task) => task.queueStatus === status).length;
}

function writeHumanApprovalRequired(projectRoot: string, queue: QueueState, generatedAt: string): void {
  const waiting = queue.tasks.filter((task) => task.queueStatus === "human_approval_required");
  const markdown = [
    "# Human Approval Required",
    "",
    `Updated: ${generatedAt}`,
    "",
    "## Pending Approval",
    ...(waiting.length
      ? waiting.flatMap((task) => [
          `- Task: ${task.id}`,
          `  - Title: ${task.title}`,
          `  - Risk: ${task.riskLevel ?? "unknown"}`,
          `  - Reason: ${task.blockedReason ?? task.riskReasons?.join("; ") ?? "Approval required."}`,
          "  - Options: A. approve / B. reject / C. modify scope / D. rollback / E. ask GPT PM",
        ])
      : ["- None."]),
    "",
  ].join("\n");
  writeFileSync(join(projectRoot, HUMAN_APPROVAL_REQUIRED_PATH), markdown, "utf8");
}

function appendOpenQuestion(projectRoot: string, response: HumanResponse, generatedAt: string): void {
  const existing = readOptional(projectRoot, OPEN_QUESTIONS_PATH);
  const question = `- [human/${response.taskId}] ${response.requestedChanges || response.reason}`;
  const markdown = existing.includes("## Pending")
    ? existing.replace(/(## Pending\s*\n)/, `$1${question}\n`)
    : ["# Open Questions", "", `Updated: ${generatedAt}`, "", "## Pending", question, "", "## Resolved", "- None.", ""].join("\n");
  writeFileSync(join(projectRoot, OPEN_QUESTIONS_PATH), markdown, "utf8");
}

function appendApprovalHistory(projectRoot: string, result: ApprovalApplyResult, generatedAt: string): void {
  const response = result.response;
  const entry = [
    "",
    `## ${generatedAt}`,
    "",
    `- Action: ${result.action}`,
    `- Valid: ${result.valid ? "yes" : "no"}`,
    `- Task: ${response?.taskId ?? "none"}`,
    `- Decision: ${response?.decision ?? "none"}`,
    `- Approved by: ${response?.approvedBy ?? "none"}`,
    `- Reason: ${response?.reason ?? result.message}`,
    "",
  ].join("\n");
  writeFileSync(join(projectRoot, APPROVAL_HISTORY_PATH), `${readOptional(projectRoot, APPROVAL_HISTORY_PATH)}${entry}`, "utf8");
}

function writeApplyReport(projectRoot: string, result: ApprovalApplyResult, generatedAt: string): void {
  const response = result.response;
  const report = [
    "# Human Approval Apply Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    `- Action: ${result.action}`,
    `- Valid: ${result.valid ? "yes" : "no"}`,
    `- Task: ${response?.taskId ?? "none"}`,
    `- Decision: ${response?.decision ?? "none"}`,
    `- Message: ${result.message}`,
    "- Production deploy: not performed",
    "- Rollback: not performed",
    "- env/API access: not used",
    "",
  ].join("\n");
  writeFileSync(join(projectRoot, APPLY_REPORT_PATH), report, "utf8");
}

function clearHumanResponse(projectRoot: string): void {
  writeFileSync(
    join(projectRoot, HUMAN_RESPONSE_PATH),
    [
      "# Human Response",
      "",
      "## Pending Response",
      "",
      "- None.",
      "",
      "## Instructions",
      "",
      "Copy one example from `agent-memory/human-response-template.md`, paste it here, edit values, then run `npm run agent:approve`.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function createMockResponse(decision: HumanDecision): string {
  const taskId = `mock-${decision}-task`;
  return [
    "# Human Response",
    "",
    `- approvalId: approval-${taskId}`,
    `- taskId: ${taskId}`,
    `- decision: ${decision}`,
    "- approvedScope: docs-only mock validation",
    `- reason: Mock ${decision} validation.`,
    "- requestedChanges: Ask GPT PM for a safer scope if needed.",
    "- approvedBy: Human Vision Owner",
    `- timestamp: ${new Date().toISOString()}`,
    "",
  ].join("\n");
}

function readValue(markdown: string, label: string): string | undefined {
  const match = markdown.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${escapeRegExp(label)}\\s*:\\s*(.+)`, "i"));
  return match?.[1]?.trim();
}

function readOptional(projectRoot: string, relativePath: string): string {
  const fullPath = join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function ensureDirs(projectRoot: string): void {
  for (const dir of ["agent-memory", "logs"]) {
    const fullPath = join(projectRoot, dir);
    if (!existsSync(fullPath)) mkdirSync(fullPath, { recursive: true });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
