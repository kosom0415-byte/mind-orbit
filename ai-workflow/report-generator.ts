import type { EngineerReport, WorkflowTask } from "./orchestrator";
import { generateCodexHandoff, generateMarkdownLog, type WorkflowState } from "./orchestrator";
import type { PriorityDecision } from "./priority-engine";

export interface LoopRunReportInput {
  task: WorkflowTask;
  decision: PriorityDecision;
  nextAction: string;
  memoryFilesRead: string[];
  generatedAt?: string;
}

export function generateEngineerReport(input: LoopRunReportInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return [
    "## Engineer Report",
    "",
    "### Task",
    `- 요청 요약: ${input.task.title}`,
    `- Branch: ${input.task.branch}`,
    `- Generated: ${generatedAt}`,
    "",
    "### Changes",
    "- Read agent-memory workflow files",
    "- Created the next mock task from local memory",
    "- Evaluated severity, priority, blocked state, and approval state",
    "- Generated next action recommendation",
    "",
    "### Files Changed",
    "- agent-memory/decision-log.md",
    "- logs/agent-loop-latest.md",
    "",
    "### Validation",
    "- Build: required before push",
    "- Local: not required for mock document loop",
    "- Preview: not required for mock document loop",
    "- Production: not touched",
    "",
    "### Commit / Push",
    "- Commit:",
    "- Push:",
    "",
    "### Decisions Made By Codex",
    `- Severity: ${input.decision.severity}`,
    `- Priority: ${input.task.priority}`,
    `- Status: ${input.task.status}`,
    `- Next action: ${input.nextAction}`,
    "",
    "### Questions For GPT PM",
    ...(input.task.status === "blocked" ? [`- ${input.task.blockedReason ?? "Clarification needed."}`] : ["-"]),
    "",
    "### Human Approval Needed",
    ...(input.task.humanApprovalRequired ? input.task.approvalTypes.map((type) => `- ${type}`) : ["-"]),
    "",
    "### Risks / Rollback",
    "- Mock loop only; no external API calls, env changes, or Production actions were performed.",
    "",
    "### Memory Files Read",
    ...input.memoryFilesRead.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

export function generateDecisionLogEntry(input: LoopRunReportInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return [
    "",
    `## ${generatedAt}`,
    "",
    `- Auto-selected task: ${input.task.title}`,
    `- Severity: ${input.decision.severity}`,
    `- Priority: ${input.task.priority}`,
    `- Status: ${input.task.status}`,
    `- Human approval required: ${input.task.humanApprovalRequired ? "yes" : "no"}`,
    `- Next action: ${input.nextAction}`,
    "- External API calls: none",
    "- Production changes: none",
  ].join("\n");
}

export function generateLoopLog(task: WorkflowTask, report: EngineerReport, nextAction: string): string {
  const workflowState: WorkflowState = {
    tasks: [task],
    reports: [report],
    logs: [generateCodexHandoff(task, report)],
  };

  return [
    generateMarkdownLog(workflowState),
    "",
    "## Recommended Next Action",
    `- ${nextAction}`,
    "",
    "## Codex Handoff",
    generateCodexHandoff(task, report),
  ].join("\n");
}
