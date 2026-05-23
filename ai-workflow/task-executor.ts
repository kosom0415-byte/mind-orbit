import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assertTaskExecutable, DANGEROUS_COMMAND_REGISTRY, enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";

interface ExecutionAttempt {
  task: ApprovalGateTask;
  command?: string;
}

const EXECUTION_HISTORY_PATH = "logs/execution-history.md";

export function assertCommandAllowed(command: string): void {
  const normalized = command.toLowerCase();
  const blocked = DANGEROUS_COMMAND_REGISTRY.find((item) => normalized.includes(item.toLowerCase()));
  if (blocked) {
    throw new Error(`Dangerous command blocked: ${blocked}`);
  }
}

export function runMockTaskExecutor(projectRoot: string, attempt: ExecutionAttempt): string {
  ensureLogDirectory(projectRoot);
  const generatedAt = new Date().toISOString();
  const gate = enforceApprovalGate(projectRoot, attempt.task, generatedAt);

  if (attempt.command) assertCommandAllowed(attempt.command);

  try {
    assertTaskExecutable(projectRoot, attempt.task);
    const entry = [
      "",
      `## ${generatedAt} - execution_allowed`,
      "",
      `- Task: ${attempt.task.id}`,
      `- Risk: ${gate.assessment.riskLevel}`,
      `- Command: ${attempt.command ?? "mock document execution"}`,
      "- Production deploy: not performed",
      "- env/API access: not used",
      "",
    ].join("\n");
    appendFileSync(join(projectRoot, EXECUTION_HISTORY_PATH), entry, "utf8");
    return "allowed";
  } catch (error) {
    const entry = [
      "",
      `## ${generatedAt} - execution_blocked`,
      "",
      `- Task: ${attempt.task.id}`,
      `- Risk: ${gate.assessment.riskLevel}`,
      `- Reason: ${error instanceof Error ? error.message : String(error)}`,
      `- Suggested safer alternative: ${suggestSaferAlternative(gate.assessment.riskLevel)}`,
      "- Production deploy: not performed",
      "- env/API access: not used",
      "",
    ].join("\n");
    appendFileSync(join(projectRoot, EXECUTION_HISTORY_PATH), entry, "utf8");
    return "blocked";
  }
}

function suggestSaferAlternative(riskLevel: string): string {
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    return "Ask GPT PM to narrow scope, produce an approval request, or split the work into a LOW-risk documentation task.";
  }
  return "Proceed only with build validation and no production actions.";
}

function ensureLogDirectory(projectRoot: string): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const now = new Date().toISOString();
  const lowTask: ApprovalGateTask = {
    id: "executor-test-low-docs",
    title: "Update workflow docs",
    goal: "LOW-risk documentation task.",
    status: "queued",
    owner: "codex-engineer",
    priority: "low",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: now,
    updatedAt: now,
  };
  const highTask: ApprovalGateTask = {
    ...lowTask,
    id: "executor-test-high-ui",
    title: "Rewrite app/page.tsx camera animation system",
    goal: "High-risk UI state architecture task.",
  };
  const lowResult = runMockTaskExecutor(process.cwd(), { task: lowTask, command: "mock-safe-docs" });
  const highResult = runMockTaskExecutor(process.cwd(), { task: highTask, command: "mock-high-risk-ui" });
  writeFileSync(
    join(process.cwd(), "logs", "executor-dry-run-latest.md"),
    [`# Executor Dry Run`, "", `- LOW task: ${lowResult}`, `- HIGH task: ${highResult}`, ""].join("\n"),
    "utf8",
  );
  console.log("Task executor dry-run complete.");
  console.log(`LOW task: ${lowResult}`);
  console.log(`HIGH task: ${highResult}`);
  console.log(`Wrote: ${EXECUTION_HISTORY_PATH}`);
  console.log("Wrote: logs/executor-dry-run-latest.md");
}
