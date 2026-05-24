import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";
import { inspectCommand } from "./command-firewall";
import { runHumanConfirmationFlow } from "./human-confirmation-flow";

const CENTRAL_EXECUTOR_LOG_PATH = "logs/central-executor.md";

export function runCentralExecutor(projectRoot: string): "allowed" | "blocked" {
  ensureLogDirectory(projectRoot);
  const generatedAt = new Date().toISOString();
  const task = createExecutorProbeTask(generatedAt);
  const confirmation = runHumanConfirmationFlow(projectRoot);
  const gate = enforceApprovalGate(projectRoot, task, generatedAt);
  const firewall = inspectCommand(projectRoot, task, "mock-safe-docs");
  const allowed = gate.action === "allow" && firewall.allowed && !confirmation.required;

  const entry = [
    "# Central Executor",
    "",
    `Generated: ${generatedAt}`,
    "",
    `- Task: ${task.id}`,
    `- Approval gate: ${gate.action}`,
    `- Firewall: ${firewall.allowed ? "allowed" : "blocked"}`,
    `- Human confirmation required: ${confirmation.required ? "yes" : "no"}`,
    `- Result: ${allowed ? "allowed" : "blocked"}`,
    `- Reason: ${allowed ? "Safe LOW/MEDIUM dev-only task." : confirmation.reason || gate.message || firewall.reason}`,
    "- Production deploy: not performed",
    "- Rollback: not performed",
    "- env/API access: not used",
    "- Destructive command: not executed",
    "",
  ].join("\n");

  writeFileSync(join(projectRoot, CENTRAL_EXECUTOR_LOG_PATH), entry, "utf8");
  appendFileSync(join(projectRoot, "logs", "execution-history.md"), `\n${entry}`, "utf8");
  return allowed ? "allowed" : "blocked";
}

function createExecutorProbeTask(generatedAt: string): ApprovalGateTask {
  return {
    id: "central-executor-safe-docs",
    title: "Run safe markdown dashboard refresh",
    goal: "Central executor validates approval and command firewall before a mock docs-only task.",
    status: "queued",
    owner: "codex-engineer",
    priority: "low",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: generatedAt,
    updatedAt: generatedAt,
    context: "Docs-only central executor probe.",
  };
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
  const result = runCentralExecutor(process.cwd());
  console.log("Central executor complete.");
  console.log(`Result: ${result}`);
  console.log(`Wrote: ${CENTRAL_EXECUTOR_LOG_PATH}`);
}
