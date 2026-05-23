export type AgentRole = "gpt-pm" | "codex-engineer" | "computer-use" | "human";

export type TaskStatus =
  | "queued"
  | "in_progress"
  | "blocked"
  | "needs_human_approval"
  | "ready_for_review"
  | "done"
  | "failed";

export type BugSeverity = "s0-production-down" | "s1-critical" | "s2-major" | "s3-minor";

export type ApprovalType =
  | "production_deploy"
  | "production_rollback"
  | "env_or_api_key_change"
  | "vercel_or_github_settings"
  | "supabase_schema_or_permission"
  | "billing_or_paid_feature"
  | "domain_or_alias"
  | "user_data_change";

export interface WorkflowTask {
  id: string;
  title: string;
  goal: string;
  status: TaskStatus;
  owner: AgentRole;
  priority: "low" | "normal" | "high" | "urgent";
  branch: "dev" | "main" | `feature/${string}`;
  attempts: number;
  maxAttempts: number;
  productionSafeMode: boolean;
  humanApprovalRequired: boolean;
  approvalTypes: ApprovalType[];
  createdAt: string;
  updatedAt: string;
  context?: string;
  successCriteria?: string[];
  blockedReason?: string;
  validationRequired?: string[];
  nextSuggestedTask?: string;
}

export interface EngineerReport {
  taskSummary: string;
  branch?: string;
  changes: string[];
  filesChanged: string[];
  validation: Record<string, string>;
  commit?: string;
  pushed?: boolean;
  decisionsMade: string[];
  questionsForGpt: string[];
  humanApprovalNeeded: string[];
  risks: string[];
  rollbackPlan?: string;
}

export interface CodexHandoff {
  goal: string;
  context: string;
  scopeIn: string[];
  scopeOut: string[];
  mustPreserve: string[];
  allowedDecisions: string[];
  askGptBefore: string[];
  humanApprovalRequired: string[];
  validationRequired: string[];
  commitMessage: string;
}

export interface WorkflowState {
  tasks: WorkflowTask[];
  reports: EngineerReport[];
  logs: string[];
}

const HUMAN_APPROVAL_KEYWORDS = [
  "production",
  "prod",
  "rollback",
  "deploy",
  "promote",
  "alias",
  "domain",
  "dns",
  "api key",
  "apikey",
  "env",
  "secret",
  "token",
  "supabase schema",
  "permission",
  "billing",
  "paid",
  "upgrade",
  "delete user data",
];

const BLOCKED_KEYWORDS = [
  "blocked",
  "cannot proceed",
  "need approval",
  "needs approval",
  "permission denied",
  "2fa",
  "password",
  "security approval",
  "payment",
  "missing env",
  "api key",
];

const PRODUCTION_RISK_KEYWORDS = [
  "camera",
  "depth",
  "perspective",
  "translatez",
  "rotatex",
  "rotatey",
  "motion",
  "animation",
  "vercel",
  "production",
  "runtime",
];

export class TaskQueue {
  private readonly tasks: WorkflowTask[] = [];

  enqueue(task: Omit<WorkflowTask, "status" | "attempts" | "createdAt" | "updatedAt">): WorkflowTask {
    const now = new Date().toISOString();
    const queuedTask: WorkflowTask = {
      ...task,
      status: task.humanApprovalRequired ? "needs_human_approval" : "queued",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.push(queuedTask);
    return queuedTask;
  }

  next(): WorkflowTask | undefined {
    return this.tasks.find((task) => task.status === "queued");
  }

  update(taskId: string, updates: Partial<WorkflowTask>): WorkflowTask | undefined {
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task) return undefined;

    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    return task;
  }

  all(): WorkflowTask[] {
    return [...this.tasks];
  }
}

export function parseEngineerReport(markdown: string): EngineerReport {
  return {
    taskSummary: readSection(markdown, "Task") || readSection(markdown, "작업") || "No task summary provided.",
    branch: readLineValue(markdown, "Branch"),
    changes: readListSection(markdown, "Changes").concat(readListSection(markdown, "수행한 작업")),
    filesChanged: readListSection(markdown, "Files Changed").concat(readListSection(markdown, "변경 파일")),
    validation: parseValidation(markdown),
    commit: readLineValue(markdown, "Commit"),
    pushed: /push:\s*(yes|true|done|완료|success)/i.test(markdown),
    decisionsMade: readListSection(markdown, "Decisions Made By Codex"),
    questionsForGpt: readListSection(markdown, "Questions For GPT PM"),
    humanApprovalNeeded: readListSection(markdown, "Human Approval Needed").concat(
      readListSection(markdown, "사람 승인 필요"),
    ),
    risks: readListSection(markdown, "Risks / Rollback").concat(readListSection(markdown, "남은 리스크")),
    rollbackPlan: readSection(markdown, "Rollback Plan") || undefined,
  };
}

export function generateCodexHandoff(task: WorkflowTask, report?: EngineerReport): string {
  const approvalLines = task.approvalTypes.length > 0 ? task.approvalTypes : ["none"];
  const nextContext = report?.questionsForGpt.length
    ? `Previous report raised questions: ${report.questionsForGpt.join("; ")}`
    : task.context || "Continue from the current repository state.";

  return [
    "## Codex Handoff",
    "",
    "### Goal",
    `- ${task.goal}`,
    "",
    "### Context",
    `- ${nextContext}`,
    "",
    "### Scope",
    "- In:",
    `  - ${task.title}`,
    "- Out:",
    "  - Production changes without human approval",
    "  - API key/env automation",
    "",
    "### Must Preserve",
    "- App load stability",
    "- Memo input",
    "- Node rendering and dragging",
    "- Edge rendering",
    "- AI structure button",
    "- localStorage and Supabase storage compatibility",
    "",
    "### Allowed Decisions",
    "- Small dev-branch fixes",
    "- Documentation updates",
    "- Type-safe refactors that preserve behavior",
    "",
    "### Ask GPT Before",
    "- Product direction changes",
    "- Large UX effects",
    "- Data structure or migration decisions",
    "- More than two failed retries",
    "",
    "### Human Approval Required",
    ...approvalLines.map((item) => `- ${item}`),
    "",
    "### Validation Required",
    ...(task.validationRequired?.length ? task.validationRequired : ["npm run build"]).map((item) => `- ${item}`),
    "",
    "### Commit Message",
    `- ${suggestCommitMessage(task)}`,
    "",
  ].join("\n");
}

export function detectBlockedState(markdown: string, task?: WorkflowTask): TaskStatus | null {
  const normalized = markdown.toLowerCase();
  const requiresHuman = HUMAN_APPROVAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
  if (requiresHuman || task?.humanApprovalRequired) return "needs_human_approval";

  const blocked = BLOCKED_KEYWORDS.some((keyword) => normalized.includes(keyword));
  if (blocked) return "blocked";

  if (task && task.attempts >= task.maxAttempts) return "blocked";
  return null;
}

export function incrementRetry(task: WorkflowTask, reason: string): WorkflowTask {
  const attempts = task.attempts + 1;
  const status: TaskStatus = attempts >= task.maxAttempts ? "blocked" : "queued";

  return {
    ...task,
    attempts,
    status,
    blockedReason: status === "blocked" ? reason : task.blockedReason,
    updatedAt: new Date().toISOString(),
  };
}

export function enforceProductionSafeMode(task: WorkflowTask): WorkflowTask {
  const text = `${task.title} ${task.goal} ${task.context ?? ""}`.toLowerCase();
  const riskDetected = PRODUCTION_RISK_KEYWORDS.some((keyword) => text.includes(keyword));
  const approvalDetected = HUMAN_APPROVAL_KEYWORDS.some((keyword) => text.includes(keyword));

  return {
    ...task,
    productionSafeMode: task.productionSafeMode || riskDetected || approvalDetected,
    humanApprovalRequired: task.humanApprovalRequired || approvalDetected || task.branch === "main",
    status: task.humanApprovalRequired || approvalDetected || task.branch === "main" ? "needs_human_approval" : task.status,
    updatedAt: new Date().toISOString(),
  };
}

export function classifyBugSeverity(input: string): BugSeverity {
  const text = input.toLowerCase();
  if (text.includes("production") && (text.includes("down") || text.includes("load failed") || text.includes("runtime"))) {
    return "s0-production-down";
  }
  if (text.includes("data loss") || text.includes("save failed") || text.includes("auth failed")) return "s1-critical";
  if (text.includes("broken") || text.includes("error") || text.includes("failed")) return "s2-major";
  return "s3-minor";
}

export function suggestNextTask(state: WorkflowState): string {
  const blocked = state.tasks.find((task) => task.status === "blocked" || task.status === "needs_human_approval");
  if (blocked) return `Resolve blocker for ${blocked.id}: ${blocked.blockedReason ?? "approval or clarification needed"}`;

  const queued = state.tasks.find((task) => task.status === "queued");
  if (queued) return `Start queued task ${queued.id}: ${queued.title}`;

  const riskyReport = state.reports.find((report) => report.risks.length > 0 || report.humanApprovalNeeded.length > 0);
  if (riskyReport) return `Review reported risk: ${riskyReport.risks[0] ?? riskyReport.humanApprovalNeeded[0]}`;

  return "No pending work. Ask GPT PM Agent for the next prioritized task.";
}

export function generateMarkdownLog(state: WorkflowState): string {
  const lines = [
    "# AI Orchestration Log",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Queue",
    ...state.tasks.map(
      (task) =>
        `- ${task.id} | ${task.status} | ${task.priority} | ${task.owner} | attempts ${task.attempts}/${task.maxAttempts} | ${task.title}`,
    ),
    "",
    "## Reports",
    ...state.reports.map((report, index) => `- Report ${index + 1}: ${report.taskSummary}`),
    "",
    "## Next Suggested Task",
    `- ${suggestNextTask(state)}`,
    "",
  ];

  return lines.join("\n");
}

export function createMockWorkflowState(): WorkflowState {
  const queue = new TaskQueue();
  const task = queue.enqueue({
    id: "task-001",
    title: "Document AI collaboration loop",
    goal: "Prepare a production-safe local orchestration structure without API calls.",
    owner: "codex-engineer",
    priority: "normal",
    branch: "dev",
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    context: "Mock task used to validate the orchestrator data model.",
    successCriteria: ["Task queue exists", "Reports can be parsed", "Markdown log can be generated"],
    validationRequired: ["npm run build"],
  });

  const report = parseEngineerReport(`
## Engineer Report

### Task
- 요청 요약: ${task.title}
- Branch: dev

### Changes
- Added mock orchestration model

### Files Changed
- ai-workflow/orchestrator.ts

### Validation
- Build: pending
- Local: not required
- Preview: not required

### Commit / Push
- Commit:
- Push:

### Decisions Made By Codex
- Kept API calls mocked

### Questions For GPT PM
- 

### Human Approval Needed
- 

### Risks / Rollback
- Low risk documentation and local TypeScript only
`);

  return {
    tasks: queue.all(),
    reports: [report],
    logs: [generateCodexHandoff(task, report)],
  };
}

function readLineValue(markdown: string, label: string): string | undefined {
  const match = markdown.match(new RegExp(`-\\s*${escapeRegExp(label)}:\\s*(.+)`, "i"));
  return match?.[1]?.trim() || undefined;
}

function readSection(markdown: string, heading: string): string {
  const match = markdown.match(new RegExp(`###\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n##\\s+|$)`, "i"));
  return cleanSection(match?.[1] ?? "");
}

function readListSection(markdown: string, heading: string): string[] {
  const section = readSection(markdown, heading);
  return section
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function parseValidation(markdown: string): Record<string, string> {
  const section = readSection(markdown, "Validation") || readSection(markdown, "검증") || readSection(markdown, "검증 결과");
  const validation: Record<string, string> = {};

  section.split("\n").forEach((line) => {
    const normalized = line.replace(/^\s*-\s*/, "").trim();
    const [key, ...valueParts] = normalized.split(":");
    if (key && valueParts.length > 0) validation[key.trim()] = valueParts.join(":").trim();
  });

  return validation;
}

function suggestCommitMessage(task: WorkflowTask): string {
  const safeTitle = task.title.replace(/[^a-zA-Z0-9가-힣 ]/g, "").trim();
  return safeTitle || "Update AI workflow task";
}

function cleanSection(section: string): string {
  return section
    .trim()
    .replace(/^\s*-\s*$/gm, "")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
