import { pathToFileURL } from "node:url";
import { enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";
import { appendMessages, createMessage } from "./message-bus";
import { parseQueueState, readOptional, taskLine, writeText, type QueueTaskLike } from "./workflow-utils";

type BusStatus =
  | "created"
  | "queued"
  | "assigned"
  | "waiting-gpt"
  | "waiting-human"
  | "approved"
  | "rejected"
  | "running"
  | "reviewing"
  | "validating"
  | "self-healing"
  | "completed"
  | "failed"
  | "archived";

interface BusTask {
  id: string;
  title: string;
  owner: string;
  status: BusStatus;
  risk: string;
  nextAction: string;
  reason: string;
}

const TASK_BUS_LOG = "logs/task-bus.md";
const TASK_BUS_STATE = "agent-memory/task-bus-state.md";

export function runTaskBus(projectRoot: string): BusTask[] {
  const generatedAt = new Date().toISOString();
  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const tasks = queue.tasks.map((task) => toBusTask(projectRoot, task));
  const nextAction = recommendNextAction(tasks, queue.nextAction);
  appendMessages(
    projectRoot,
    tasks.slice(0, 5).map((task) =>
      createMessage({
        from: "GPT_PM_AGENT",
        to: task.owner === "human" ? "HUMAN_VISION_OWNER" : "CODEX_ENGINEER_AGENT",
        taskId: task.id,
        severity: task.risk === "CRITICAL" ? "s1-critical" : task.risk === "HIGH" ? "s2-major" : "s3-minor",
        type: task.status === "waiting-human" ? "APPROVAL_REQUEST" : task.status === "waiting-gpt" ? "BLOCKED_WARNING" : "TASK_ASSIGN",
        summary: task.nextAction,
        payload: { busStatus: task.status, risk: task.risk },
        requiresApproval: task.status === "waiting-human",
      }),
    ),
  );
  const markdown = renderTaskBus(generatedAt, tasks, nextAction);
  writeText(projectRoot, TASK_BUS_LOG, markdown);
  writeText(projectRoot, TASK_BUS_STATE, markdown);
  return tasks;
}

function toBusTask(projectRoot: string, task: QueueTaskLike): BusTask {
  const gate = enforceApprovalGate(projectRoot, toGateTask(task));
  const status = mapStatus(task, gate.action);
  return {
    id: task.id,
    title: task.title,
    owner: status === "waiting-human" ? "human" : status === "waiting-gpt" ? "gpt-pm" : task.owner ?? "codex-engineer",
    status,
    risk: gate.assessment.riskLevel,
    reason: task.blockedReason ?? gate.message,
    nextAction: nextActionForStatus(status, task),
  };
}

function mapStatus(task: QueueTaskLike, gateAction: string): BusStatus {
  if (task.queueStatus === "completed" || task.status === "done") return "completed";
  if (task.queueStatus === "cancelled" || task.approvalStatus === "rejected") return "rejected";
  if (gateAction === "block" || task.queueStatus === "human_approval_required" || task.humanApprovalRequired) return "waiting-human";
  if (task.queueStatus === "blocked" || task.status === "blocked") return "waiting-gpt";
  if (task.queueStatus === "running" || task.status === "in_progress") return "running";
  if (task.queueStatus === "pending" || task.status === "queued") return "queued";
  return "created";
}

function nextActionForStatus(status: BusStatus, task: QueueTaskLike): string {
  if (status === "waiting-human") return `Ask Human Vision Owner to approve/reject/modify ${task.id}.`;
  if (status === "waiting-gpt") return `Ask GPT PM to clarify ${task.id}.`;
  if (status === "queued") return `Codex may execute ${task.id} only through approval gate and validation.`;
  if (status === "completed") return `Archive ${task.id} after report review.`;
  if (status === "rejected") return `Keep ${task.id} cancelled and request safer alternative.`;
  return task.nextSuggestedTask ?? "Continue through task bus.";
}

function recommendNextAction(tasks: BusTask[], fallback?: string): string {
  const safe = tasks.find((task) => task.status === "queued" && (task.risk === "LOW" || task.risk === "MEDIUM"));
  if (safe) return `Run safe queued task: ${safe.id}`;
  const human = tasks.find((task) => task.status === "waiting-human");
  if (human) return `Wait for human approval: ${human.id}`;
  const gpt = tasks.find((task) => task.status === "waiting-gpt");
  if (gpt) return `Ask GPT PM: ${gpt.id}`;
  return fallback ?? "Queue is clear; ask GPT PM for next task.";
}

function renderTaskBus(generatedAt: string, tasks: BusTask[], nextAction: string): string {
  return [
    "# Task Bus",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    `- Tasks: ${tasks.length}`,
    `- Waiting GPT: ${tasks.filter((task) => task.status === "waiting-gpt").length}`,
    `- Waiting Human: ${tasks.filter((task) => task.status === "waiting-human").length}`,
    `- Queued safe candidates: ${tasks.filter((task) => task.status === "queued" && (task.risk === "LOW" || task.risk === "MEDIUM")).length}`,
    `- Next action: ${nextAction}`,
    "",
    "## Tasks",
    "| Task | Owner | Status | Risk | Next Action |",
    "| --- | --- | --- | --- | --- |",
    ...tasks.map((task) => `| ${task.id} | ${task.owner} | ${task.status} | ${task.risk} | ${task.nextAction.replace(/\|/g, "\\|")} |`),
    "",
    "## Completed Archive Connection",
    ...tasks.filter((task) => task.status === "completed").map((task) => `- ${taskLine(task as never)}`),
    tasks.some((task) => task.status === "completed") ? "" : "- none",
    "",
    "## Safety",
    "- Production deploy: not automated",
    "- Git push automation: forbidden",
    "- HIGH/CRITICAL tasks remain waiting-human unless approved.",
    "",
  ].join("\n");
}

function toGateTask(task: QueueTaskLike): ApprovalGateTask {
  const now = new Date().toISOString();
  return {
    id: task.id,
    title: task.title,
    goal: task.goal ?? task.title,
    status: task.status === "blocked" ? "blocked" : "queued",
    owner: "codex-engineer",
    priority: "normal",
    branch: "dev",
    attempts: task.attempts ?? 0,
    maxAttempts: task.maxAttempts ?? 2,
    productionSafeMode: true,
    humanApprovalRequired: Boolean(task.humanApprovalRequired),
    approvalTypes: [],
    createdAt: now,
    updatedAt: now,
    context: task.blockedReason,
    approvalStatus: task.approvalStatus as never,
    approvalId: undefined,
  };
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const tasks = runTaskBus(process.cwd());
  console.log("Task bus updated.");
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Wrote: ${TASK_BUS_LOG}`);
}
