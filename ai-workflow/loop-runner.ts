import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEngineerReport } from "./orchestrator";
import {
  createTaskFromDecision,
  decidePriority,
  extractNextTaskInput,
  recommendNextAction,
  type MemorySnapshot,
} from "./priority-engine";
import { generateDecisionLogEntry, generateEngineerReport, generateLoopLog } from "./report-generator";

export interface LoopRunnerOptions {
  projectRoot: string;
  dryRun?: boolean;
  generatedAt?: string;
}

export interface LoopRunnerResult {
  taskId: string;
  status: string;
  priority: string;
  severity: string;
  humanApprovalRequired: boolean;
  nextAction: string;
  engineerReport: string;
  loopLog: string;
}

const WORKFLOW_STATE_PATH = "agent-memory/workflow-state.md";
const OPEN_QUESTIONS_PATH = "agent-memory/open-questions.md";
const DECISION_LOG_PATH = "agent-memory/decision-log.md";
const LOOP_LOG_PATH = "logs/agent-loop-latest.md";

export function runMockAgentLoop(options: LoopRunnerOptions): LoopRunnerResult {
  const snapshot = readMemorySnapshot(options.projectRoot);
  const taskInput = extractNextTaskInput(snapshot);
  const decision = decidePriority(taskInput);
  const task = createTaskFromDecision(taskInput, decision);
  const nextAction = recommendNextAction(task, decision);
  const memoryFilesRead = [WORKFLOW_STATE_PATH, OPEN_QUESTIONS_PATH];

  const engineerReportMarkdown = generateEngineerReport({
    task,
    decision,
    nextAction,
    memoryFilesRead,
    generatedAt: options.generatedAt,
  });
  const parsedReport = parseEngineerReport(engineerReportMarkdown);
  const loopLog = generateLoopLog(task, parsedReport, nextAction);
  const decisionLogEntry = generateDecisionLogEntry({
    task,
    decision,
    nextAction,
    memoryFilesRead,
    generatedAt: options.generatedAt,
  });

  if (!options.dryRun) {
    appendFileSync(join(options.projectRoot, DECISION_LOG_PATH), `${decisionLogEntry}\n`, "utf8");
    writeFileSync(join(options.projectRoot, LOOP_LOG_PATH), loopLog, "utf8");
  }

  return {
    taskId: task.id,
    status: task.status,
    priority: task.priority,
    severity: decision.severity,
    humanApprovalRequired: task.humanApprovalRequired,
    nextAction,
    engineerReport: engineerReportMarkdown,
    loopLog,
  };
}

export function readMemorySnapshot(projectRoot: string): MemorySnapshot {
  return {
    workflowStateMarkdown: readFileSync(join(projectRoot, WORKFLOW_STATE_PATH), "utf8"),
    openQuestionsMarkdown: readFileSync(join(projectRoot, OPEN_QUESTIONS_PATH), "utf8"),
  };
}
