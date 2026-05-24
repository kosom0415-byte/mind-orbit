import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentId } from "./agent-registry";
import type { BugSeverity } from "./orchestrator";

export type RuntimeMessageType =
  | "TASK_ASSIGN"
  | "REVIEW_REQUEST"
  | "APPROVAL_REQUEST"
  | "FAILURE_ALERT"
  | "SELF_HEAL_TRIGGER"
  | "BLOCKED_WARNING"
  | "RELEASE_READY"
  | "HUMAN_REQUIRED";

export interface RuntimeMessage {
  from: AgentId;
  to: AgentId;
  taskId: string;
  severity: BugSeverity;
  type: RuntimeMessageType;
  summary: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  timestamp: string;
}

const MESSAGE_BUS_PATH = "logs/message-bus.md";
const MESSAGE_STATE_START = "<!-- message-bus-state";
const MESSAGE_STATE_END = "-->";

export function createMessage(input: Omit<RuntimeMessage, "timestamp">): RuntimeMessage {
  return { ...input, timestamp: new Date().toISOString() };
}

export function appendMessages(projectRoot: string, messages: RuntimeMessage[]): void {
  ensureLogDirectory(projectRoot);
  const previous = readMessages(projectRoot);
  const next = [...previous, ...messages].slice(-100);
  writeMessages(projectRoot, next);
}

export function writeMessages(projectRoot: string, messages: RuntimeMessage[]): void {
  ensureLogDirectory(projectRoot);
  writeFileSync(join(projectRoot, MESSAGE_BUS_PATH), renderMessages(messages), "utf8");
}

export function readMessages(projectRoot: string): RuntimeMessage[] {
  const fullPath = join(projectRoot, MESSAGE_BUS_PATH);
  if (!existsSync(fullPath)) return [];
  const markdown = readFileSync(fullPath, "utf8");
  const match = markdown.match(new RegExp(`${MESSAGE_STATE_START}\\s*([\\s\\S]*?)\\s*${MESSAGE_STATE_END}`));
  if (!match?.[1]) return [];
  try {
    return JSON.parse(match[1]) as RuntimeMessage[];
  } catch {
    return [];
  }
}

function renderMessages(messages: RuntimeMessage[]): string {
  return [
    "# Inter-Agent Message Bus",
    "",
    "| Time | From | To | Type | Task | Severity | Approval | Summary |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...messages.map(
      (message) =>
        `| ${message.timestamp} | ${message.from} | ${message.to} | ${message.type} | ${message.taskId} | ${message.severity} | ${message.requiresApproval ? "yes" : "no"} | ${escapeTable(message.summary)} |`,
    ),
    "",
    MESSAGE_STATE_START,
    JSON.stringify(messages, null, 2),
    MESSAGE_STATE_END,
    "",
  ].join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function ensureLogDirectory(projectRoot: string): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
}
