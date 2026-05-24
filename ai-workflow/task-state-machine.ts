import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type RuntimeTaskState =
  | "queued"
  | "assigned"
  | "running"
  | "review"
  | "blocked"
  | "waiting-human"
  | "retrying"
  | "self-healing"
  | "completed"
  | "failed"
  | "archived";

export interface StateTransition {
  taskId: string;
  from: RuntimeTaskState;
  to: RuntimeTaskState;
  reason: string;
  timestamp: string;
}

const ALLOWED_TRANSITIONS: Record<RuntimeTaskState, RuntimeTaskState[]> = {
  queued: ["assigned", "blocked", "waiting-human"],
  assigned: ["running", "blocked", "waiting-human"],
  running: ["review", "completed", "failed", "self-healing", "blocked"],
  review: ["completed", "blocked", "retrying", "waiting-human"],
  blocked: ["waiting-human", "retrying", "archived"],
  "waiting-human": ["assigned", "blocked", "archived"],
  retrying: ["assigned", "self-healing", "failed", "waiting-human"],
  "self-healing": ["retrying", "review", "failed", "waiting-human"],
  completed: ["archived"],
  failed: ["retrying", "self-healing", "archived"],
  archived: [],
};

const STATE_MACHINE_LOG_PATH = "logs/task-state-machine.md";

export function transitionTask(taskId: string, from: RuntimeTaskState, to: RuntimeTaskState, reason: string): StateTransition {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid task transition for ${taskId}: ${from} -> ${to}`);
  }
  return { taskId, from, to, reason, timestamp: new Date().toISOString() };
}

export function writeStateMachineLog(projectRoot: string, transitions: StateTransition[]): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  writeFileSync(
    join(projectRoot, STATE_MACHINE_LOG_PATH),
    [
      "# Runtime Task State Machine",
      "",
      "| Time | Task | From | To | Reason |",
      "| --- | --- | --- | --- | --- |",
      ...transitions.map((item) => `| ${item.timestamp} | ${item.taskId} | ${item.from} | ${item.to} | ${escapeTable(item.reason)} |`),
      "",
    ].join("\n"),
    "utf8",
  );
}

export function describeLifecycle(): string[] {
  return Object.entries(ALLOWED_TRANSITIONS).map(([state, next]) => `${state} -> ${next.join(", ") || "terminal"}`);
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
