import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const QUEUE_STATE_START = "<!-- task-queue-state";
export const QUEUE_STATE_END = "-->";

export interface QueueTaskLike {
  id: string;
  title: string;
  goal?: string;
  queueStatus?: string;
  status?: string;
  owner?: string;
  priority?: string;
  branch?: string;
  attempts?: number;
  maxAttempts?: number;
  humanApprovalRequired?: boolean;
  approvalStatus?: string;
  approvalId?: string;
  approvalTypes?: string[];
  riskLevel?: string;
  riskReasons?: string[];
  blockedReason?: string;
  context?: string;
  nextSuggestedTask?: string;
  validationRequired?: string[];
}

export interface QueueStateLike {
  generatedAt?: string;
  tasks: QueueTaskLike[];
  nextAction?: string;
}

export function readOptional(projectRoot: string, relativePath: string): string {
  const fullPath = join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

export function writeText(projectRoot: string, relativePath: string, text: string): void {
  const fullPath = join(projectRoot, relativePath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, text, "utf8");
}

export function parseQueueState(markdown: string): QueueStateLike {
  const match = markdown.match(new RegExp(`${QUEUE_STATE_START}\\s*([\\s\\S]*?)\\s*${QUEUE_STATE_END}`));
  if (!match?.[1]) return { tasks: [] };
  try {
    const parsed = JSON.parse(match[1]) as QueueStateLike;
    return { ...parsed, tasks: parsed.tasks ?? [] };
  } catch {
    return { tasks: [] };
  }
}

export function taskLine(task: QueueTaskLike): string {
  return `${task.id}: ${task.title}${task.riskLevel ? ` (${task.riskLevel})` : ""}`;
}

export function latestCommit(projectRoot: string): string {
  try {
    return readOptional(projectRoot, ".git/HEAD").trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export function section(title: string, lines: string[]): string[] {
  return [`## ${title}`, "", ...(lines.length ? lines : ["- none"]), ""];
}

export function list(lines: string[]): string[] {
  return lines.length ? lines.map((line) => (line.startsWith("-") ? line : `- ${line}`)) : ["- none"];
}

export function firstMatch(markdown: string, pattern: RegExp, fallback = "unknown"): string {
  return markdown.match(pattern)?.[1]?.trim() ?? fallback;
}
