import { pathToFileURL } from "node:url";
import { parseQueueState, readOptional, writeText, type QueueTaskLike } from "./workflow-utils";

export interface PrioritizedTask extends QueueTaskLike {
  priorityScore: number;
  autoExecutable: boolean;
  priorityReason: string;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  "s0-production-down": 100,
  "s1-critical": 80,
  "s2-major": 55,
  "s3-minor": 25,
};

const RISK_PENALTY: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 70,
  MEDIUM: 20,
  LOW: 0,
};

export function prioritizeQueueTasks(projectRoot: string): PrioritizedTask[] {
  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const tasks = queue.tasks.map((task) => prioritizeTask(task)).sort((a, b) => b.priorityScore - a.priorityScore);
  writeText(projectRoot, "logs/task-priority.md", renderPriority(tasks));
  return tasks;
}

export function nextSafeTask(tasks: PrioritizedTask[]): PrioritizedTask | undefined {
  return tasks.find((task) => task.autoExecutable);
}

function prioritizeTask(task: QueueTaskLike): PrioritizedTask {
  const severity = String((task as { severity?: string }).severity ?? "s3-minor");
  const base = SEVERITY_WEIGHT[severity] ?? 25;
  const risk = String(task.riskLevel ?? "LOW");
  const riskPenalty = RISK_PENALTY[risk] ?? 0;
  const waiting = task.queueStatus === "human_approval_required" || task.humanApprovalRequired;
  const blocked = task.queueStatus === "blocked" || task.status === "blocked";
  const completed = task.queueStatus === "completed" || task.status === "done";
  const pending = task.queueStatus === "pending" || task.status === "queued";
  const score = completed ? 0 : Math.max(0, base - riskPenalty + (pending ? 10 : 0) - (waiting || blocked ? 30 : 0));
  const autoExecutable = pending && !waiting && !blocked && risk !== "HIGH" && risk !== "CRITICAL";
  return {
    ...task,
    priorityScore: score,
    autoExecutable,
    priorityReason: autoExecutable
      ? "Pending LOW/MEDIUM task can continue through validation."
      : waiting
        ? "Waiting for Human Vision Owner approval."
        : blocked
          ? "Blocked; GPT PM clarification needed."
          : completed
            ? "Completed task."
            : "Not currently executable.",
  };
}

function renderPriority(tasks: PrioritizedTask[]): string {
  return [
    "# Task Priority Engine",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Task | Queue | Risk | Score | Auto | Reason |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...tasks.map(
      (task) =>
        `| ${task.id} | ${task.queueStatus ?? task.status ?? "unknown"} | ${task.riskLevel ?? "LOW"} | ${task.priorityScore} | ${task.autoExecutable ? "yes" : "no"} | ${task.priorityReason.replace(/\|/g, "\\|")} |`,
    ),
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const tasks = prioritizeQueueTasks(process.cwd());
  console.log(`Task priority updated. Tasks: ${tasks.length}`);
}
