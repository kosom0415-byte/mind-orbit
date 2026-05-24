import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ApprovalType, WorkflowTask } from "./orchestrator";
import { generateCodexHandoff, parseEngineerReport } from "./orchestrator";

type BridgeQuestionSource = "engineer-report" | "task-queue" | "human-approval";

interface BridgeQuestion {
  source: BridgeQuestionSource;
  text: string;
  taskId?: string;
}

interface HumanApprovalItem {
  taskId: string;
  title: string;
  reason: string;
  approvalTypes: string[];
}

interface BridgeRunResult {
  generatedAt: string;
  filesRead: string[];
  filesWritten: string[];
  questions: BridgeQuestion[];
  humanApprovals: HumanApprovalItem[];
  codexHandoff: string;
  bridgeLog: string;
}

interface QueueStateLike {
  tasks?: Array<{
    id?: string;
    title?: string;
    goal?: string;
    context?: string;
    queueStatus?: string;
    status?: string;
    blockedReason?: string;
    priority?: WorkflowTask["priority"];
    branch?: WorkflowTask["branch"];
    attempts?: number;
    maxAttempts?: number;
    humanApprovalRequired?: boolean;
    approvalTypes?: string[];
    riskLevel?: string;
    riskReasons?: string[];
    approvedBy?: string;
    approvedAt?: string;
    approvalReason?: string;
    validationRequired?: string[];
  }>;
  nextAction?: string;
}

interface GptAnswerParseResult {
  summary: string;
  nextTask?: WorkflowTask;
}

const GPT_PM_REPORT_PATH = "logs/gpt-pm-report-latest.md";
const ENGINEER_REPORT_PATH = "logs/engineer-report-latest.md";
const TASK_QUEUE_PATH = "logs/task-queue.md";
const OPEN_QUESTIONS_PATH = "agent-memory/open-questions.md";
const HUMAN_APPROVAL_PATH = "agent-memory/human-approval-required.md";
const APPROVAL_REQUEST_PATH = "agent-memory/approval-request.md";
const HUMAN_CONFIRMATION_PATH = "agent-memory/human-confirmation-required.md";
const NEXT_CODEX_HANDOFF_PATH = "agent-memory/next-codex-handoff.md";
const BRIDGE_LOG_PATH = "logs/gpt-codex-bridge.md";
const HUMAN_APPROVAL_APPLY_REPORT_PATH = "logs/human-approval-apply-report.md";
const STATE_BLOCK_START = "<!-- task-queue-state";
const STATE_BLOCK_END = "-->";

export interface AgentBridgePort {
  parseGptAnswer(markdown: string): GptAnswerParseResult;
  createCodexHandoff(task: WorkflowTask): string;
}

export const mockAgentBridgePort: AgentBridgePort = {
  parseGptAnswer: parseGptAnswerToCodexTask,
  createCodexHandoff: generateCodexHandoff,
};

export function runGptCodexBridge(projectRoot: string, port: AgentBridgePort = mockAgentBridgePort): BridgeRunResult {
  ensureDirectories(projectRoot);

  const generatedAt = new Date().toISOString();
  const filesRead = [GPT_PM_REPORT_PATH, ENGINEER_REPORT_PATH, TASK_QUEUE_PATH, OPEN_QUESTIONS_PATH, HUMAN_APPROVAL_PATH, APPROVAL_REQUEST_PATH, HUMAN_CONFIRMATION_PATH, HUMAN_APPROVAL_APPLY_REPORT_PATH];
  const gptPmReport = readOptional(projectRoot, GPT_PM_REPORT_PATH);
  const engineerReport = readOptional(projectRoot, ENGINEER_REPORT_PATH);
  const queueMarkdown = readOptional(projectRoot, TASK_QUEUE_PATH);
  const previousQuestions = readOptional(projectRoot, OPEN_QUESTIONS_PATH);
  const previousHumanApproval = readOptional(projectRoot, HUMAN_APPROVAL_PATH);
  const approvalRequest = readOptional(projectRoot, APPROVAL_REQUEST_PATH);
  const humanConfirmation = readOptional(projectRoot, HUMAN_CONFIRMATION_PATH);
  const approvalApplyReport = readOptional(projectRoot, HUMAN_APPROVAL_APPLY_REPORT_PATH);
  const queueState = parseQueueState(queueMarkdown);
  const engineer = parseEngineerReport(engineerReport);

  const questions = dedupeQuestions([
    ...questionsFromEngineerReport(engineer.questionsForGpt),
    ...questionsFromBlockedTasks(queueState),
    ...questionsFromHumanApprovalTasks(queueState),
  ]);
  const humanApprovals = humanApprovalsFromQueue(queueState, engineer.humanApprovalNeeded, previousHumanApproval, `${approvalRequest}\n${humanConfirmation}`);
  const gptAnswer = port.parseGptAnswer(gptPmReport);
  const nextTask = gptAnswer.nextTask ?? taskFromQueueOrFallback(queueState, questions, generatedAt);
  const codexHandoff = enrichHandoffWithApproval(port.createCodexHandoff(nextTask), approvalApplyReport);

  const filesWritten = [OPEN_QUESTIONS_PATH, HUMAN_APPROVAL_PATH, NEXT_CODEX_HANDOFF_PATH, BRIDGE_LOG_PATH];
  const openQuestionsMarkdown = generateOpenQuestionsMarkdown(generatedAt, questions, previousQuestions);
  const humanApprovalMarkdown = generateHumanApprovalMarkdown(generatedAt, humanApprovals);
  const bridgeLog = generateBridgeLog({
    generatedAt,
    filesRead,
    filesWritten,
    questions,
    humanApprovals,
    gptAnswerSummary: gptAnswer.summary,
    codexHandoff,
  });

  writeFileSync(join(projectRoot, OPEN_QUESTIONS_PATH), openQuestionsMarkdown, "utf8");
  writeFileSync(join(projectRoot, HUMAN_APPROVAL_PATH), humanApprovalMarkdown, "utf8");
  writeFileSync(join(projectRoot, NEXT_CODEX_HANDOFF_PATH), codexHandoff, "utf8");
  writeFileSync(join(projectRoot, BRIDGE_LOG_PATH), bridgeLog, "utf8");

  return {
    generatedAt,
    filesRead,
    filesWritten,
    questions,
    humanApprovals,
    codexHandoff,
    bridgeLog,
  };
}

function questionsFromEngineerReport(questions: string[]): BridgeQuestion[] {
  return questions
    .filter((question) => question && question !== "-")
    .map((question) => ({ source: "engineer-report", text: question }));
}

function questionsFromBlockedTasks(queueState: QueueStateLike): BridgeQuestion[] {
  return (queueState.tasks ?? [])
    .filter((task) => task.queueStatus === "blocked" || task.status === "blocked")
    .map((task) => ({
      source: "task-queue",
      taskId: task.id,
      text: task.blockedReason ?? `Blocked task needs GPT PM decision: ${task.title ?? task.id ?? "unknown task"}`,
    }));
}

function questionsFromHumanApprovalTasks(queueState: QueueStateLike): BridgeQuestion[] {
  return (queueState.tasks ?? [])
    .filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired)
    .map((task) => ({
      source: "human-approval",
      taskId: task.id,
      text: `Human approval required before continuing: ${task.title ?? task.id ?? "unknown task"}${task.riskLevel ? ` (${task.riskLevel})` : ""}`,
    }));
}

function humanApprovalsFromQueue(queueState: QueueStateLike, reportApprovals: string[], previousHumanApproval: string, approvalRequest: string): HumanApprovalItem[] {
  const queueApprovals = (queueState.tasks ?? [])
    .filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired)
    .map((task) => ({
      taskId: task.id ?? "unknown-task",
      title: task.title ?? "Untitled approval task",
      reason: task.blockedReason ?? task.riskReasons?.join("; ") ?? "Queue marked this task as human approval required.",
      approvalTypes: task.approvalTypes?.length ? task.approvalTypes : ["human_review"],
    }));

  const reportItems = reportApprovals
    .filter((item) => item && item !== "-")
    .map((item, index) => ({
      taskId: `engineer-report-approval-${index + 1}`,
      title: item,
      reason: "Engineer report requested explicit human approval.",
      approvalTypes: ["human_review"],
    }));

  const requestItems = extractApprovalTasksFromMarkdown(`${previousHumanApproval}\n${approvalRequest}`);
  return dedupeHumanApprovals([...queueApprovals, ...reportItems, ...requestItems]);
}

function taskFromQueueOrFallback(queueState: QueueStateLike, questions: BridgeQuestion[], generatedAt: string): WorkflowTask {
  const queueTask =
    (queueState.tasks ?? []).find((task) => task.queueStatus === "pending" || task.status === "queued") ??
    (queueState.tasks ?? []).find((task) => task.queueStatus === "blocked" || task.status === "blocked");

  if (queueTask) {
    return normalizeWorkflowTask(queueTask, generatedAt);
  }

  const firstQuestion = questions[0]?.text;
  return {
    id: "bridge-awaiting-gpt-pm",
    title: firstQuestion ? `Resolve GPT PM question: ${firstQuestion}` : "Ask GPT PM Agent for the next prioritized task",
    goal: firstQuestion ?? "No pending queue task was available. GPT PM should provide the next task.",
    status: questions.length ? "blocked" : "queued",
    owner: questions.length ? "gpt-pm" : "codex-engineer",
    priority: questions.length ? "high" : "normal",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: generatedAt,
    updatedAt: generatedAt,
    context: "Generated by GPT Codex bridge fallback.",
    blockedReason: firstQuestion,
    validationRequired: ["npm run build"],
    nextSuggestedTask: "Wait for GPT PM answer, then convert it into the next Codex handoff.",
  };
}

function normalizeWorkflowTask(task: NonNullable<QueueStateLike["tasks"]>[number], generatedAt: string): WorkflowTask {
  const humanApprovalRequired = Boolean(task.humanApprovalRequired || task.queueStatus === "human_approval_required");
  return {
    id: task.id ?? "bridge-task",
    title: task.title ?? "Bridge generated Codex task",
    goal: task.goal ?? task.title ?? "Continue the next queue task.",
    status: humanApprovalRequired ? "needs_human_approval" : task.status === "blocked" ? "blocked" : "queued",
    owner: humanApprovalRequired ? "human" : "codex-engineer",
    priority: task.priority ?? "normal",
    branch: task.branch ?? "dev",
    attempts: task.attempts ?? 0,
    maxAttempts: task.maxAttempts ?? 2,
    productionSafeMode: true,
    humanApprovalRequired,
    approvalTypes: normalizeApprovalTypes(task.approvalTypes),
    riskLevel: task.riskLevel as WorkflowTask["riskLevel"],
    riskReasons: task.riskReasons,
    approvedBy: task.approvedBy,
    approvedAt: task.approvedAt,
    approvalReason: task.approvalReason,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    context: task.context ?? "Generated from logs/task-queue.md by GPT Codex bridge.",
    blockedReason: task.blockedReason,
    validationRequired: task.validationRequired?.length ? task.validationRequired : ["npm run build"],
    nextSuggestedTask: "Run Codex on dev branch after GPT PM/human approval requirements are clear.",
  };
}

function parseGptAnswerToCodexTask(markdown: string): GptAnswerParseResult {
  const approved = /approved|승인|go ahead|진행/i.test(markdown);
  const nextTask = readFirstListItemAfterHeading(markdown, "Next Recommended Task") ?? readFirstListItemAfterHeading(markdown, "Codex Engineer Handoff");

  if (!approved && !nextTask) {
    return {
      summary: "No explicit GPT PM answer found. Keeping bridge in mock handoff mode.",
    };
  }

  const generatedAt = new Date().toISOString();
  return {
    summary: approved ? "Mock parser detected approval or go-ahead language." : "Mock parser detected a next task.",
    nextTask: {
      id: "gpt-answer-next-codex-task",
      title: nextTask ?? "Continue approved Codex task",
      goal: nextTask ?? "Proceed with the GPT PM approved task on dev branch.",
      status: "queued",
      owner: "codex-engineer",
      priority: approved ? "high" : "normal",
      branch: "dev",
      attempts: 0,
      maxAttempts: 2,
      productionSafeMode: true,
      humanApprovalRequired: false,
      approvalTypes: [],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      context: "Generated by mock GPT answer parser. Real OpenAI API integration is intentionally disabled.",
      validationRequired: ["npm run build"],
      nextSuggestedTask: "Execute the handoff in Codex and report back to GPT PM.",
    },
  };
}

function enrichHandoffWithApproval(handoff: string, approvalApplyReport: string): string {
  if (!approvalApplyReport.trim()) return handoff;
  const action = readLineValue(approvalApplyReport, "Action");
  const decision = readLineValue(approvalApplyReport, "Decision");
  const task = readLineValue(approvalApplyReport, "Task");
  if (!action || action === "noop") return handoff;

  const extra =
    action === "approved-to-pending"
      ? ["### Approved Scope", `- Human response approved task ${task}. Codex may proceed only within the approved scope.`]
      : action === "rejected-to-cancelled"
        ? ["### Safer Alternative", `- Human rejected task ${task}. Ask GPT PM for a safer replacement before Codex proceeds.`]
        : action === "scope-modification-requested"
          ? ["### Scope Restriction", `- Human requested modified scope for ${task}. Codex must wait for narrowed GPT PM handoff.`]
          : action === "question-added"
            ? ["### GPT PM Follow-Up Required", `- Human requested GPT PM clarification for ${task}. Codex must not execute until answered.`]
            : ["### Human Response", `- Last decision: ${decision ?? action}`];

  return [handoff.trim(), "", ...extra, ""].join("\n");
}

function readLineValue(markdown: string, label: string): string | undefined {
  const match = markdown.match(new RegExp(`(?:^|\\n)\\s*-\\s*${escapeRegExp(label)}\\s*:\\s*(.+)`, "i"));
  return match?.[1]?.trim();
}

function parseQueueState(markdown: string): QueueStateLike {
  const match = markdown.match(new RegExp(`${STATE_BLOCK_START}\\s*([\\s\\S]*?)\\s*${STATE_BLOCK_END}`));
  if (!match?.[1]) return {};

  try {
    return JSON.parse(match[1]) as QueueStateLike;
  } catch {
    return {};
  }
}

function generateOpenQuestionsMarkdown(generatedAt: string, questions: BridgeQuestion[], previousMarkdown: string): string {
  const resolvedSection = readSection(previousMarkdown, "Resolved");
  return [
    "# Open Questions",
    "",
    `Updated: ${generatedAt}`,
    "",
    "## Pending",
    ...(questions.length ? questions.map((question) => `- ${formatQuestion(question)}`) : ["- None."]),
    "",
    "## Resolved",
    resolvedSection.trim() || "- None.",
    "",
    "## Source",
    "- Generated by ai-workflow/gpt-codex-bridge.ts",
    "- Blocked queue tasks are converted into GPT PM questions.",
    "- Human approval items are mirrored in agent-memory/human-approval-required.md.",
    "",
  ].join("\n");
}

function generateHumanApprovalMarkdown(generatedAt: string, approvals: HumanApprovalItem[]): string {
  return [
    "# Human Approval Required",
    "",
    `Updated: ${generatedAt}`,
    "",
    "## Pending Approval",
    ...(approvals.length
      ? approvals.flatMap((approval) => [
          `- Task: ${approval.taskId}`,
          `  - Title: ${approval.title}`,
          `  - Reason: ${approval.reason}`,
          `  - Approval types: ${approval.approvalTypes.join(", ")}`,
        ])
      : ["- None."]),
    "",
    "## Guardrails",
    "- Production deploy/rollback requires explicit human approval.",
    "- env/API key access is never automated.",
    "- Git push is not automated by the bridge.",
    "- Destructive commands are forbidden.",
    "",
  ].join("\n");
}

function generateBridgeLog(input: {
  generatedAt: string;
  filesRead: string[];
  filesWritten: string[];
  questions: BridgeQuestion[];
  humanApprovals: HumanApprovalItem[];
  gptAnswerSummary: string;
  codexHandoff: string;
}): string {
  return [
    "# GPT Codex Bridge Log",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Flow",
    "- agent:loop creates GPT PM and Codex reports.",
    "- agent:queue updates markdown-backed task queue state.",
    "- agent:bridge turns reports, blocked tasks, and approvals into the next handoff.",
    "- agent:watch can run loop plus bridge when started with --with-bridge.",
    "",
    "## Files Read",
    ...input.filesRead.map((file) => `- ${file}`),
    "",
    "## Files Written",
    ...input.filesWritten.map((file) => `- ${file}`),
    "",
    "## GPT PM Questions",
    ...(input.questions.length ? input.questions.map((question) => `- ${formatQuestion(question)}`) : ["- None."]),
    "",
    "## Human Approval Required",
    ...(input.humanApprovals.length
      ? input.humanApprovals.map((approval) => `- ${approval.taskId}: ${approval.title}`)
      : ["- None."]),
    "",
    "## Mock GPT Answer Parser",
    `- ${input.gptAnswerSummary}`,
    "- Real OpenAI API calls are disabled.",
    "",
    "## Next Codex Handoff",
    input.codexHandoff,
  ].join("\n");
}

function dedupeQuestions(questions: BridgeQuestion[]): BridgeQuestion[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = `${question.source}:${question.taskId ?? ""}:${question.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return question.text.trim().length > 0 && question.text.trim() !== "-";
  });
}

function dedupeHumanApprovals(approvals: HumanApprovalItem[]): HumanApprovalItem[] {
  const seen = new Set<string>();
  return approvals.filter((approval) => {
    const key = `${approval.taskId}:${approval.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatQuestion(question: BridgeQuestion): string {
  const prefix = question.taskId ? `[${question.source}/${question.taskId}]` : `[${question.source}]`;
  return `${prefix} ${question.text}`;
}

function normalizeApprovalTypes(values?: string[]): ApprovalType[] {
  const allowed: ApprovalType[] = [
    "production_deploy",
    "production_rollback",
    "env_or_api_key_change",
    "vercel_or_github_settings",
    "supabase_schema_or_permission",
    "billing_or_paid_feature",
    "domain_or_alias",
    "user_data_change",
    "high_risk_task",
    "retry_limit_exceeded",
  ];
  return (values ?? []).filter((value): value is ApprovalType => allowed.includes(value as ApprovalType));
}

function extractApprovalTasksFromMarkdown(markdown: string): HumanApprovalItem[] {
  const matches = [...markdown.matchAll(/Task:\s*([^\n]+)(?:[\s\S]*?Title:\s*([^\n]+))?(?:[\s\S]*?Reason:\s*([^\n]+))?/gi)];
  return matches.map((match) => ({
    taskId: match[1]?.trim() || "approval-request",
    title: match[2]?.trim() || "Approval request",
    reason: match[3]?.trim() || "Approval request markdown contains a pending task.",
    approvalTypes: ["human_review"],
  }));
}

function readOptional(projectRoot: string, relativePath: string): string {
  const fullPath = join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function readFirstListItemAfterHeading(markdown: string, heading: string): string | undefined {
  const section = readSection(markdown, heading);
  return section
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .find((line) => line.length > 0 && !line.startsWith("#") && !line.includes("---"));
}

function readSection(markdown: string, heading: string): string {
  const match = markdown.match(new RegExp(`##+\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##+\\s+|$)`, "i"));
  return match?.[1] ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureDirectories(projectRoot: string): void {
  for (const dir of ["agent-memory", "logs"]) {
    const fullPath = join(projectRoot, dir);
    if (!existsSync(fullPath)) mkdirSync(fullPath, { recursive: true });
  }
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const result = runGptCodexBridge(process.cwd());
  console.log("GPT Codex bridge completed.");
  console.log(`Questions: ${result.questions.length}`);
  console.log(`Human approvals: ${result.humanApprovals.length}`);
  result.filesWritten.forEach((file) => console.log(`Wrote: ${file}`));
}
