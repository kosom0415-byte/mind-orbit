import type { EngineerReport, WorkflowTask } from "./orchestrator";
import { createMockWorkflowState, generateCodexHandoff, generateMarkdownLog, type WorkflowState } from "./orchestrator";
import type { PriorityDecision } from "./priority-engine";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface LoopRunReportInput {
  task: WorkflowTask;
  decision: PriorityDecision;
  nextAction: string;
  memoryFilesRead: string[];
  openQuestions?: string[];
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
    "- logs/engineer-report-latest.md",
    "- logs/agent-loop-latest.md",
    "- logs/agent-loop-[timestamp].md",
    "- logs/gpt-pm-report-latest.md",
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

export function generateGptPmReport(input: LoopRunReportInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const openQuestions = input.openQuestions?.length ? input.openQuestions : ["None"];
  const approvalState = input.task.humanApprovalRequired ? input.task.approvalTypes.join(", ") : "not required";

  return [
    "## GPT PM Agent Report",
    "",
    "### Current Status",
    `- Generated: ${generatedAt}`,
    `- Task ID: ${input.task.id}`,
    `- Task: ${input.task.title}`,
    `- Status: ${input.task.status}`,
    `- Branch: ${input.task.branch}`,
    "",
    "### Blocked Questions",
    ...openQuestions.map((question) => `- ${question}`),
    "",
    "### Next Recommended Task",
    `- ${input.nextAction}`,
    "",
    "### Risk",
    `- Severity: ${input.decision.severity}`,
    `- Priority: ${input.task.priority}`,
    `- Production safe mode: ${input.task.productionSafeMode ? "enabled" : "disabled"}`,
    "",
    "### Human Approval",
    `- Required: ${input.task.humanApprovalRequired ? "yes" : "no"}`,
    `- Type: ${approvalState}`,
    "",
    "### Codex Engineer Handoff",
    generateCodexHandoff(input.task),
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
    generateCodexHandoff(task, report),
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const state = createMockWorkflowState();
  const report = generateMarkdownLog(state);
  const task = state.tasks[0];
  const generatedAt = new Date().toISOString();
  const loopInput: LoopRunReportInput = {
    task,
    decision: {
      severity: "s3-minor",
      priority: task.priority,
      status: task.status,
      humanApprovalRequired: task.humanApprovalRequired,
      nextAction: "Use agent:loop for live memory-based task selection.",
    },
    nextAction: "Use agent:loop for live memory-based task selection.",
    memoryFilesRead: ["agent-memory/workflow-state.md", "agent-memory/open-questions.md"],
    openQuestions: [],
    generatedAt,
  };
  const outputPath = join(process.cwd(), "logs", "agent-report-latest.md");
  const engineerPath = join(process.cwd(), "logs", "engineer-report-latest.md");
  const gptPmPath = join(process.cwd(), "logs", "gpt-pm-report-latest.md");
  writeFileSync(outputPath, report, "utf8");
  writeFileSync(engineerPath, generateEngineerReport(loopInput), "utf8");
  writeFileSync(gptPmPath, generateGptPmReport(loopInput), "utf8");
  console.log(`Agent report generated: ${outputPath}`);
  console.log(`Engineer report generated: ${engineerPath}`);
  console.log(`GPT PM report generated: ${gptPmPath}`);
}
