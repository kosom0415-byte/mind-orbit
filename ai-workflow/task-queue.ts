import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { BugSeverity, TaskStatus, WorkflowTask } from "./orchestrator";
import { generateCodexHandoff } from "./orchestrator";
import { createTaskFromDecision, decidePriority, extractNextTaskInput, recommendNextAction } from "./priority-engine";
import { generateGptPmReport } from "./report-generator";
import { readMemorySnapshot } from "./loop-runner";
import { buildCodebaseIndex } from "./codebase-index";
import { enforceApprovalGate, writeApprovalReports, type ApprovalDecision, type ApprovalGateResult, type RiskLevel } from "./approval-gate";

type QueueStatus = "pending" | "running" | "blocked" | "completed" | "failed" | "human_approval_required" | "cancelled";

interface QueueTask extends WorkflowTask {
  queueStatus: QueueStatus;
  severity: BugSeverity;
  riskLevel?: RiskLevel;
  riskReasons?: string[];
  approvalStatus?: ApprovalDecision;
  approvalId?: string;
  lastError?: string;
  completedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
}

interface QueueState {
  version: 1;
  generatedAt: string;
  tasks: QueueTask[];
  failedHistory: QueueTask[];
  nextAction: string;
  codebaseImpact?: CodebaseImpact;
}

interface QueueRunResult {
  selectedTask?: QueueTask;
  state: QueueState;
  markdown: string;
  gptPmReport: string;
}

interface CodebaseImpact {
  relatedFiles: string[];
  riskFiles: string[];
  productionRisk: string;
}

const TASK_QUEUE_PATH = "logs/task-queue.md";
const TASK_QUEUE_REPORT_PATH = "logs/task-queue-report-latest.md";
const STATE_BLOCK_START = "<!-- task-queue-state";
const STATE_BLOCK_END = "-->";

const STATUS_ORDER: QueueStatus[] = [
  "human_approval_required",
  "blocked",
  "running",
  "pending",
  "failed",
  "cancelled",
  "completed",
];

const PRIORITY_WEIGHT: Record<WorkflowTask["priority"], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const SEVERITY_WEIGHT: Record<BugSeverity, number> = {
  "s0-production-down": 4,
  "s1-critical": 3,
  "s2-major": 2,
  "s3-minor": 1,
};

export function runTaskQueue(projectRoot: string): QueueRunResult {
  const generatedAt = new Date().toISOString();
  const previousState = readQueueState(projectRoot);
  const memorySnapshot = readMemorySnapshot(projectRoot);
  const taskInput = extractNextTaskInput(memorySnapshot);
  const decision = decidePriority(taskInput);
  const task = createTaskFromDecision(taskInput, decision);
  const queueTask = toQueueTask(task, decision.severity);
  const tasks = upsertTask(previousState.tasks, queueTask);
  const normalizedTasks = normalizeFailedTasks(tasks, generatedAt);
  const gateResults = normalizedTasks.map((item) => enforceApprovalGate(projectRoot, item, generatedAt) as ApprovalGateResult<QueueTask>);
  const gatedTasks = gateResults.map((result) => result.task);
  const selectedTask = selectNextTask(gatedTasks);

  if (selectedTask) {
    const executionGate = enforceApprovalGate(projectRoot, selectedTask, generatedAt);
    if (executionGate.action !== "allow") {
      Object.assign(selectedTask, executionGate.task);
    } else {
    selectedTask.queueStatus = "running";
    selectedTask.status = "in_progress";
    selectedTask.attempts += 1;
    selectedTask.updatedAt = generatedAt;

    if (selectedTask.attempts > selectedTask.maxAttempts) {
      selectedTask.queueStatus = "blocked";
      selectedTask.status = "blocked";
      selectedTask.blockedReason = "Infinite retry protection: max attempts reached.";
    } else {
      selectedTask.queueStatus = "completed";
      selectedTask.status = "done";
      selectedTask.completedAt = generatedAt;
      selectedTask.nextSuggestedTask = recommendNextAction(selectedTask, decision);
    }
    }
  }

  const failedHistory = collectFailedHistory(previousState.failedHistory, gatedTasks);
  const nextAction = recommendQueueNextAction(gatedTasks);
  const codebaseImpact = calculateCodebaseImpact(projectRoot, selectedTask);
  const state: QueueState = {
    version: 1,
    generatedAt,
    tasks: sortTasks(gatedTasks),
    failedHistory,
    nextAction,
    codebaseImpact,
  };
  const markdown = generateQueueMarkdown(state);
  const gptPmReport = generateQueueGptPmReport(state, selectedTask);

  writeFileSync(join(projectRoot, TASK_QUEUE_PATH), markdown, "utf8");
  writeFileSync(join(projectRoot, TASK_QUEUE_REPORT_PATH), gptPmReport, "utf8");
  writeApprovalReports(projectRoot, gateResults, generatedAt);

  return { selectedTask, state, markdown, gptPmReport };
}

function readQueueState(projectRoot: string): QueueState {
  const queuePath = join(projectRoot, TASK_QUEUE_PATH);
  if (!existsSync(queuePath)) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      tasks: [],
      failedHistory: [],
      nextAction: "Create initial task queue from agent memory.",
      codebaseImpact: undefined,
    };
  }

  const markdown = readFileSync(queuePath, "utf8");
  const match = markdown.match(new RegExp(`${STATE_BLOCK_START}\\s*([\\s\\S]*?)\\s*${STATE_BLOCK_END}`));
  if (!match?.[1]) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      tasks: [],
      failedHistory: [],
      nextAction: "Rebuild task queue from agent memory.",
      codebaseImpact: undefined,
    };
  }

  try {
    return JSON.parse(match[1]) as QueueState;
  } catch {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      tasks: [],
      failedHistory: [],
      nextAction: "Queue state parse failed; rebuild from agent memory.",
      codebaseImpact: undefined,
    };
  }
}

function toQueueTask(task: WorkflowTask, severity: BugSeverity): QueueTask {
  const queueStatus: QueueStatus = task.humanApprovalRequired
    ? "human_approval_required"
    : task.status === "blocked"
      ? "blocked"
      : "pending";

  return {
    ...task,
    queueStatus,
    severity,
    status: task.humanApprovalRequired ? "needs_human_approval" : task.status,
  };
}

function upsertTask(tasks: QueueTask[], nextTask: QueueTask): QueueTask[] {
  const existing = tasks.find((task) => task.id === nextTask.id);
  if (!existing) return [...tasks, nextTask];

  if (existing.queueStatus === "completed") return tasks;
  if (existing.queueStatus === "human_approval_required") return tasks;

  Object.assign(existing, {
    title: nextTask.title,
    goal: nextTask.goal,
    priority: nextTask.priority,
    severity: nextTask.severity,
    humanApprovalRequired: nextTask.humanApprovalRequired,
    approvalTypes: nextTask.approvalTypes,
    nextSuggestedTask: nextTask.nextSuggestedTask,
    updatedAt: new Date().toISOString(),
  });

  return tasks;
}

function normalizeFailedTasks(tasks: QueueTask[], generatedAt: string): QueueTask[] {
  return tasks.map((task) => {
    if (task.queueStatus !== "failed") return task;

    if (task.attempts >= task.maxAttempts) {
      return {
        ...task,
        queueStatus: "blocked",
        status: "blocked",
        blockedReason: task.blockedReason ?? "Retry limit reached.",
        updatedAt: generatedAt,
      };
    }

    return {
      ...task,
      queueStatus: "pending",
      status: "queued",
      updatedAt: generatedAt,
    };
  });
}

function selectNextTask(tasks: QueueTask[]): QueueTask | undefined {
  return sortTasks(tasks).find((task) => task.queueStatus === "pending" && !task.humanApprovalRequired);
}

function sortTasks(tasks: QueueTask[]): QueueTask[] {
  return [...tasks].sort((a, b) => {
    const statusDelta = STATUS_ORDER.indexOf(a.queueStatus) - STATUS_ORDER.indexOf(b.queueStatus);
    if (statusDelta !== 0) return statusDelta;

    const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const severityDelta = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (severityDelta !== 0) return severityDelta;

    return a.createdAt.localeCompare(b.createdAt);
  });
}

function collectFailedHistory(previous: QueueTask[], tasks: QueueTask[]): QueueTask[] {
  const failed = tasks.filter((task) => task.queueStatus === "failed" || task.queueStatus === "blocked");
  const merged = [...previous, ...failed];
  const byId = new Map<string, QueueTask>();
  merged.forEach((task) => byId.set(`${task.id}:${task.failedAt ?? task.updatedAt}`, task));
  return [...byId.values()].slice(-10);
}

function recommendQueueNextAction(tasks: QueueTask[]): string {
  const approval = tasks.find((task) => task.queueStatus === "human_approval_required");
  if (approval) return `Ask human approval for ${approval.id}: ${approval.title}`;

  const blocked = tasks.find((task) => task.queueStatus === "blocked");
  if (blocked) return `Send blocked task to GPT PM Agent: ${blocked.blockedReason ?? blocked.title}`;

  const pending = selectNextTask(tasks);
  if (pending) return `Run next pending task: ${pending.id}`;

  return "Queue is clear. Ask GPT PM Agent for the next prioritized task.";
}

function generateQueueMarkdown(state: QueueState): string {
  const sections = [
    "# Autonomous Task Queue",
    "",
    `Generated: ${state.generatedAt}`,
    "",
    "## Summary",
    `- Pending: ${countByStatus(state.tasks, "pending")}`,
    `- Running: ${countByStatus(state.tasks, "running")}`,
    `- Blocked: ${countByStatus(state.tasks, "blocked")}`,
    `- Completed: ${countByStatus(state.tasks, "completed")}`,
    `- Cancelled: ${countByStatus(state.tasks, "cancelled")}`,
    `- Human approval required: ${countByStatus(state.tasks, "human_approval_required")}`,
    `- Next action: ${state.nextAction}`,
    "",
    renderTaskSection("Pending", state.tasks, "pending"),
    renderTaskSection("Running", state.tasks, "running"),
    renderTaskSection("Blocked", state.tasks, "blocked"),
    renderTaskSection("Human Approval Required", state.tasks, "human_approval_required"),
    renderTaskSection("Cancelled", state.tasks, "cancelled"),
    renderTaskSection("Completed", state.tasks, "completed"),
    "## Recent Failed Task History",
    renderTaskTable(state.failedHistory),
    "",
    "## Codebase Impact",
    `- Production risk: ${state.codebaseImpact?.productionRisk ?? "unknown"}`,
    "- Related files:",
    ...(state.codebaseImpact?.relatedFiles.length
      ? state.codebaseImpact.relatedFiles.map((file) => `  - ${file}`)
      : ["  - none"]),
    "- Risk files:",
    ...(state.codebaseImpact?.riskFiles.length ? state.codebaseImpact.riskFiles.map((file) => `  - ${file}`) : ["  - none"]),
    "",
    "## Safety",
    "- Production deploy: not automated",
    "- env/API key access: not used",
    "- OpenAI API calls: mocked / disabled",
    "- Infinite retry protection: enabled",
    "",
    STATE_BLOCK_START,
    JSON.stringify(state, null, 2),
    STATE_BLOCK_END,
    "",
  ];

  return sections.join("\n");
}

function generateQueueGptPmReport(state: QueueState, selectedTask?: QueueTask): string {
  return [
    "## Engineer Report",
    "",
    "### Task",
    "- 요청 요약: 지속 실행 가능한 task queue 구조 검증",
    "- Branch: dev",
    `- Generated: ${state.generatedAt}`,
    "",
    "### Changes",
    "- Created or updated markdown-backed task queue state",
    "- Connected severity-based ordering to queue selection",
    "- Connected retry limit and blocked task separation",
    "- Kept human approval tasks out of automatic execution",
    "",
    "### Queue Result",
    `- Selected task: ${selectedTask?.id ?? "none"}`,
    `- Selected status: ${selectedTask?.queueStatus ?? "none"}`,
    `- Selected risk: ${selectedTask?.riskLevel ?? "none"}`,
    `- Next action: ${state.nextAction}`,
    "",
    "### Approval Required",
    ...state.tasks
      .filter((task) => task.queueStatus === "human_approval_required")
      .map((task) => `- ${task.id}: ${task.title} (${task.riskLevel ?? "unknown"})`),
    ...(state.tasks.some((task) => task.queueStatus === "human_approval_required") ? [] : ["- none"]),
    "",
    "### Blocked Tasks",
    ...state.tasks
      .filter((task) => task.queueStatus === "blocked" || task.queueStatus === "human_approval_required")
      .map((task) => `- ${task.id}: ${task.blockedReason ?? task.title}`),
    ...(state.tasks.some((task) => task.queueStatus === "blocked" || task.queueStatus === "human_approval_required") ? [] : ["- none"]),
    "",
    "### Safe To Continue",
    state.tasks.some((task) => task.queueStatus === "human_approval_required" || task.queueStatus === "blocked")
      ? "- Not safe to continue automatically. Human/GPT PM decision required."
      : "- Safe to continue with LOW/MEDIUM dev-only task queue items.",
    "",
    "### GPT PM Next-Step Recommendation",
    `- ${state.nextAction}`,
    "",
    "### Codebase Impact",
    `- Production risk: ${state.codebaseImpact?.productionRisk ?? "unknown"}`,
    "- Related files:",
    ...(state.codebaseImpact?.relatedFiles.length
      ? state.codebaseImpact.relatedFiles.map((file) => `  - ${file}`)
      : ["  - none"]),
    "- Risk files:",
    ...(state.codebaseImpact?.riskFiles.length ? state.codebaseImpact.riskFiles.map((file) => `  - ${file}`) : ["  - none"]),
    "",
    "### Next Priority Task Proposal",
    selectedTask ? generateCodexHandoff(selectedTask).split("\n").slice(0, 18).join("\n") : "- Ask GPT PM Agent for a new task.",
    "",
    "### Human Approval Needed",
    ...state.tasks
      .filter((task) => task.queueStatus === "human_approval_required")
      .map((task) => `- ${task.id}: ${task.title}`),
    ...(state.tasks.some((task) => task.queueStatus === "human_approval_required") ? [] : ["- none"]),
    "",
    "### Risks / Rollback",
    "- Queue runner is mock-only and writes markdown logs only.",
    "- Production deploy, env/API key access, and OpenAI API calls are disabled.",
  ].join("\n");
}

function calculateCodebaseImpact(projectRoot: string, selectedTask?: QueueTask): CodebaseImpact {
  const index = buildCodebaseIndex(projectRoot);
  const taskText = `${selectedTask?.title ?? ""} ${selectedTask?.goal ?? ""}`.toLowerCase();
  const keywordMatches = index.files
    .filter((file) => {
      const path = file.path.toLowerCase();
      return path
        .split(/[\/.-]/)
        .filter((part) => part.length > 3)
        .some((part) => taskText.includes(part));
    })
    .map((file) => file.path);

  const relatedFiles = [...new Set([...keywordMatches, ...index.highRenderImpact.slice(0, 5).map((file) => file.path)])].slice(0, 8);
  const riskFiles = index.productionRiskFiles.slice(0, 8).map((file) => file.path);
  const productionRisk = selectedTask?.humanApprovalRequired
    ? "human approval required"
    : relatedFiles.some((file) => riskFiles.includes(file))
      ? "medium"
      : "low";

  return { relatedFiles, riskFiles, productionRisk };
}

function renderTaskSection(title: string, tasks: QueueTask[], status: QueueStatus): string {
  return [`## ${title}`, renderTaskTable(tasks.filter((task) => task.queueStatus === status)), ""].join("\n");
}

function renderTaskTable(tasks: QueueTask[]): string {
  if (tasks.length === 0) return "- none";

  return [
    "| ID | Priority | Severity | Risk | Approval | Attempts | Owner | Title |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...tasks.map(
      (task) =>
        `| ${task.id} | ${task.priority} | ${task.severity} | ${task.riskLevel ?? "unknown"} | ${task.approvalStatus ?? "none"} | ${task.attempts}/${task.maxAttempts} | ${task.owner} | ${escapeTable(task.title)} |`,
    ),
  ].join("\n");
}

function countByStatus(tasks: QueueTask[], status: QueueStatus): number {
  return tasks.filter((task) => task.queueStatus === status).length;
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const result = runTaskQueue(process.cwd());
  console.log("Task queue updated.");
  console.log(`Selected: ${result.selectedTask?.id ?? "none"}`);
  console.log(`Next action: ${result.state.nextAction}`);
  console.log(`Wrote: ${TASK_QUEUE_PATH}`);
  console.log(`Wrote: ${TASK_QUEUE_REPORT_PATH}`);
}
