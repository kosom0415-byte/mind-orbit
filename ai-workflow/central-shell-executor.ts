import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { enforceApprovalGate, type ApprovalGateTask, type RiskLevel } from "./approval-gate";
import { inspectCommand } from "./command-firewall";
import { writeExecutionAudit } from "./execution-audit";
import { appendExecutionTrace, createExecutionTrace, type ExecutionKind, type ExecutionTrace } from "./execution-registry";

export interface CentralShellResult {
  trace: ExecutionTrace;
  allowed: boolean;
  exitCode: number;
  output: string;
}

const ALLOWED_COMMANDS = new Set([
  "npm run build",
  "npm run agent:queue",
  "npm run agent:bridge",
  "npm run agent:dashboard",
  "npm run agent:approve",
  "npm run agent:report",
  "npm run agent:self-heal",
]);

export function runCentralShellCommand(
  projectRoot: string,
  task: ApprovalGateTask,
  command: string,
  options: { dryRun?: boolean; kind?: ExecutionKind } = {},
): CentralShellResult {
  ensureLogDir(projectRoot);
  const kind = options.kind ?? classifyKind(command);
  const gate = enforceApprovalGate(projectRoot, task);
  const firewall = inspectCommand(projectRoot, task, command);
  const allowListed = ALLOWED_COMMANDS.has(command);
  const riskLevel = highestRisk(gate.assessment.riskLevel, firewall.riskLevel as RiskLevel, allowListed ? "LOW" : "HIGH");
  const baseReason = allowListed ? "Command is in central executor allow-list." : "Command is not in central executor allow-list.";
  const trace = createExecutionTrace({
    taskId: task.id,
    kind,
    command,
    riskLevel,
    status: "planned",
    reason: baseReason,
    rollbackCandidate: "manual approval required before rollback",
  });

  if (gate.action !== "allow" || !firewall.allowed || !allowListed) {
    const blockedTrace = {
      ...trace,
      status: "blocked" as const,
      finishedAt: new Date().toISOString(),
      reason: [baseReason, gate.message, firewall.reason].filter(Boolean).join(" "),
    };
    appendExecutionTrace(projectRoot, blockedTrace);
    writeExecutionAudit(projectRoot);
    return { trace: blockedTrace, allowed: false, exitCode: 1, output: blockedTrace.reason };
  }

  const runningTrace = { ...trace, status: "running" as const, reason: "Central executor accepted command." };
  appendExecutionTrace(projectRoot, runningTrace);

  if (options.dryRun) {
    const dryTrace = {
      ...runningTrace,
      status: "completed" as const,
      finishedAt: new Date().toISOString(),
      outputSummary: "dry-run completed",
      reason: "Dry-run mode recorded without shell execution.",
    };
    appendExecutionTrace(projectRoot, dryTrace);
    writeExecutionAudit(projectRoot);
    return { trace: dryTrace, allowed: true, exitCode: 0, output: "dry-run completed" };
  }

  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    const completedTrace = {
      ...runningTrace,
      status: "completed" as const,
      finishedAt: new Date().toISOString(),
      outputSummary: summarizeOutput(output),
      reason: "Command completed through central executor.",
    };
    appendExecutionTrace(projectRoot, completedTrace);
    writeExecutionAudit(projectRoot);
    return { trace: completedTrace, allowed: true, exitCode: 0, output };
  } catch (error) {
    const output = error instanceof Error ? error.message : String(error);
    const failedTrace = {
      ...runningTrace,
      status: "failed" as const,
      finishedAt: new Date().toISOString(),
      outputSummary: summarizeOutput(output),
      reason: "Command failed inside central executor.",
    };
    appendExecutionTrace(projectRoot, failedTrace);
    writeExecutionAudit(projectRoot);
    return { trace: failedTrace, allowed: true, exitCode: 1, output };
  }
}

function classifyKind(command: string): ExecutionKind {
  if (/^git\b/.test(command)) return "git";
  return "shell";
}

function highestRisk(...levels: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return levels.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? "LOW";
}

function summarizeOutput(output: string): string {
  return output.split("\n").filter(Boolean).slice(-8).join(" ").slice(0, 600);
}

function ensureLogDir(projectRoot: string): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
}

function createValidationTask(): ApprovalGateTask {
  const now = new Date().toISOString();
  return {
    id: "central-shell-validation",
    title: "Run central shell executor validation",
    goal: "Run allow-listed workflow validation command through central executor.",
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
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const command = process.argv.slice(2).join(" ") || "npm run agent:report";
  const result = runCentralShellCommand(process.cwd(), createValidationTask(), command, { dryRun: command !== "npm run agent:report" });
  console.log(`Central shell executor: ${result.trace.status}`);
  console.log(`Execution ID: ${result.trace.executionId}`);
}
