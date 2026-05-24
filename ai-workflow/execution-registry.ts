import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ExecutionKind = "shell" | "git" | "file-write" | "browser-runtime" | "release-evaluation" | "self-heal";
export type ExecutionStatus = "planned" | "allowed" | "blocked" | "running" | "completed" | "failed";
export type ExecutionRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ExecutionTrace {
  executionId: string;
  taskId: string;
  kind: ExecutionKind;
  command: string;
  commandHash: string;
  status: ExecutionStatus;
  riskLevel: ExecutionRisk;
  reason: string;
  retryCount: number;
  rollbackCandidate: string;
  startedAt: string;
  finishedAt?: string;
  outputSummary?: string;
}

const EXECUTION_STATE_PATH = "logs/execution-registry-state.json";

export function createExecutionTrace(input: {
  taskId: string;
  kind: ExecutionKind;
  command: string;
  riskLevel: ExecutionRisk;
  status?: ExecutionStatus;
  reason: string;
  retryCount?: number;
  rollbackCandidate?: string;
  timestamp?: string;
}): ExecutionTrace {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const hash = hashCommand(input.command);
  return {
    executionId: `exec-${timestamp.replace(/[:.]/g, "-")}-${hash.slice(0, 8)}`,
    taskId: input.taskId,
    kind: input.kind,
    command: input.command,
    commandHash: hash,
    status: input.status ?? "planned",
    riskLevel: input.riskLevel,
    reason: input.reason,
    retryCount: input.retryCount ?? 0,
    rollbackCandidate: input.rollbackCandidate ?? "manual approval required before rollback",
    startedAt: timestamp,
  };
}

export function readExecutionRegistry(projectRoot: string): ExecutionTrace[] {
  const fullPath = join(projectRoot, EXECUTION_STATE_PATH);
  if (!existsSync(fullPath)) return [];
  try {
    return JSON.parse(readFileSync(fullPath, "utf8")) as ExecutionTrace[];
  } catch {
    return [];
  }
}

export function writeExecutionRegistry(projectRoot: string, traces: ExecutionTrace[]): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(projectRoot, EXECUTION_STATE_PATH), JSON.stringify(traces.slice(-200), null, 2), "utf8");
}

export function appendExecutionTrace(projectRoot: string, trace: ExecutionTrace): ExecutionTrace[] {
  const traces = readExecutionRegistry(projectRoot);
  const next = [...traces, trace].slice(-200);
  writeExecutionRegistry(projectRoot, next);
  return next;
}

export function hashCommand(command: string): string {
  return createHash("sha256").update(command).digest("hex");
}

export function detectExecutorBypass(projectRoot: string): string[] {
  const history = readExecutionRegistry(projectRoot);
  const messages: string[] = [];
  const recent = history.slice(-20);
  const hasBuild = recent.some((trace) => trace.command === "npm run build" && trace.status === "completed");
  const hasValidation = recent.some((trace) => trace.kind === "browser-runtime" || trace.kind === "release-evaluation");

  if (!hasBuild) messages.push("No recent centralized build execution found.");
  if (!hasValidation) messages.push("No recent runtime/release validation trace found.");
  return messages;
}
