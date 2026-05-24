import { pathToFileURL } from "node:url";
import { enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";
import { parseQueueState, readOptional, taskLine, writeText, type QueueTaskLike } from "./workflow-utils";

const OUTPUTS = {
  handoff: "agent-memory/next-codex-handoff.md",
  questionsForGpt: "agent-memory/questions-for-gpt.md",
  questionsForHuman: "agent-memory/questions-for-human.md",
  nextExecutableTask: "agent-memory/next-executable-task.md",
  log: "logs/direct-bridge.md",
};

export interface DirectBridgeResult {
  generatedAt: string;
  nextExecutableTask?: string;
  questionsForGpt: string[];
  questionsForHuman: string[];
  blockedCount: number;
  waitingHumanCount: number;
}

export function runDirectBridge(projectRoot: string): DirectBridgeResult {
  const generatedAt = new Date().toISOString();
  const gptReport = readOptional(projectRoot, "logs/gpt-pm-report-latest.md");
  const engineerReport = readOptional(projectRoot, "logs/engineer-report-latest.md");
  const queueMarkdown = readOptional(projectRoot, "logs/task-queue.md");
  const humanApproval = readOptional(projectRoot, "agent-memory/human-approval-required.md");
  const humanConfirmation = readOptional(projectRoot, "agent-memory/human-confirmation-required.md");
  const queue = parseQueueState(queueMarkdown);
  const safeTasks = queue.tasks.filter((task) => isSafeExecutable(projectRoot, task));
  const blockedTasks = queue.tasks.filter((task) => task.queueStatus === "blocked" || task.status === "blocked");
  const waitingHuman = queue.tasks.filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired);
  const questionsForGpt = [
    ...blockedTasks.map((task) => `${taskLine(task)} needs GPT PM scope decision. Reason: ${task.blockedReason ?? "blocked"}`),
    ...extractQuestions(engineerReport),
  ];
  const questionsForHuman = [
    ...waitingHuman.map((task) => `${taskLine(task)} requires Human Vision Owner approval. Reason: ${task.blockedReason ?? task.riskReasons?.join("; ") ?? "approval gated"}`),
    ...extractHumanQuestions(`${humanApproval}\n${humanConfirmation}`),
  ];
  const nextTask = safeTasks[0];
  const result: DirectBridgeResult = {
    generatedAt,
    nextExecutableTask: nextTask?.id,
    questionsForGpt: dedupe(questionsForGpt),
    questionsForHuman: dedupe(questionsForHuman),
    blockedCount: blockedTasks.length,
    waitingHumanCount: waitingHuman.length,
  };

  writeText(projectRoot, OUTPUTS.handoff, renderCodexHandoff(generatedAt, nextTask, result, gptReport));
  writeText(projectRoot, OUTPUTS.questionsForGpt, renderQuestions("Questions For GPT PM", generatedAt, result.questionsForGpt));
  writeText(projectRoot, OUTPUTS.questionsForHuman, renderQuestions("Questions For Human Vision Owner", generatedAt, result.questionsForHuman));
  writeText(projectRoot, OUTPUTS.nextExecutableTask, renderNextExecutableTask(generatedAt, nextTask));
  writeText(projectRoot, OUTPUTS.log, renderDirectBridgeLog(result));
  return result;
}

function isSafeExecutable(projectRoot: string, task: QueueTaskLike): boolean {
  if (task.queueStatus !== "pending" && task.status !== "queued") return false;
  if (task.humanApprovalRequired) return false;
  const gateTask: ApprovalGateTask = {
    id: String(task.id ?? "unknown"),
    title: String(task.title ?? "Untitled task"),
    goal: String(task.goal ?? task.title ?? "Continue safe task."),
    status: "queued",
    owner: "codex-engineer",
    priority: "normal",
    branch: "dev",
    attempts: Number(task.attempts ?? 0),
    maxAttempts: Number(task.maxAttempts ?? 2),
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    context: String(task.context ?? ""),
  };
  return enforceApprovalGate(projectRoot, gateTask).action === "allow";
}

function renderCodexHandoff(generatedAt: string, task: QueueTaskLike | undefined, result: DirectBridgeResult, gptReport: string): string {
  return [
    "# Next Codex Handoff",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Rule",
    "- Execute only tasks listed in `agent-memory/next-executable-task.md`.",
    "- If the task is missing, blocked, HIGH, or CRITICAL, stop and ask GPT PM/Human through the generated question files.",
    "- Production deploy, rollback, env/API key, billing/account, destructive command, and git push automation remain forbidden.",
    "",
    "## Next Executable Task",
    task ? `- ${taskLine(task)}` : "- none",
    "",
    "## GPT PM Context",
    gptReport.trim() ? gptReport.split("\n").slice(0, 20).join("\n") : "- No GPT PM report available.",
    "",
    "## Blockers",
    `- GPT questions: ${result.questionsForGpt.length}`,
    `- Human questions: ${result.questionsForHuman.length}`,
    `- Blocked tasks: ${result.blockedCount}`,
    `- Waiting human: ${result.waitingHumanCount}`,
    "",
  ].join("\n");
}

function renderQuestions(title: string, generatedAt: string, questions: string[]): string {
  return ["# " + title, "", `Generated: ${generatedAt}`, "", ...(questions.length ? questions.map((q) => `- ${q}`) : ["- none"]), ""].join("\n");
}

function renderNextExecutableTask(generatedAt: string, task: QueueTaskLike | undefined): string {
  if (!task) {
    return [
      "# Next Executable Task",
      "",
      `Generated: ${generatedAt}`,
      "",
      "- Status: none",
      "- Reason: no safe pending task found; use GPT/Human question files first.",
      "",
    ].join("\n");
  }
  return [
    "# Next Executable Task",
    "",
    `Generated: ${generatedAt}`,
    "",
    `- Task ID: ${task.id}`,
    `- Title: ${task.title}`,
    `- Risk: ${task.riskLevel ?? "LOW"}`,
    `- Owner: ${task.owner ?? "codex-engineer"}`,
    `- Branch: ${task.branch ?? "dev"}`,
    "- Allowed: yes",
    "- Validation: npm run build",
    "",
  ].join("\n");
}

function renderDirectBridgeLog(result: DirectBridgeResult): string {
  return [
    "# Direct GPT Codex Bridge",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Next executable task: ${result.nextExecutableTask ?? "none"}`,
    `- GPT questions: ${result.questionsForGpt.length}`,
    `- Human questions: ${result.questionsForHuman.length}`,
    `- Blocked tasks: ${result.blockedCount}`,
    `- Waiting-human tasks: ${result.waitingHumanCount}`,
    "- API calls: none",
    "- Production deploy: not performed",
    "",
  ].join("\n");
}

function extractQuestions(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("-") && /question|clarif|blocked|질문|확인/i.test(line))
    .map((line) => line.replace(/^\s*-\s*/, "").trim());
}

function extractHumanQuestions(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("-") && /Task:|Can Codex|approval|required|승인/i.test(line))
    .map((line) => line.replace(/^\s*-\s*/, "").trim());
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))].slice(0, 20);
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runDirectBridge(process.cwd());
  console.log("Direct bridge complete.");
  console.log(`Next executable task: ${result.nextExecutableTask ?? "none"}`);
  console.log(`Wrote: ${Object.values(OUTPUTS).join(", ")}`);
}
