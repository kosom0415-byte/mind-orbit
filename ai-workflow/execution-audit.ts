import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectExecutorBypass, readExecutionRegistry, type ExecutionTrace } from "./execution-registry";

const EXECUTION_HISTORY_PATH = "logs/execution-history.md";

export function writeExecutionAudit(projectRoot: string, traces?: ExecutionTrace[]): string {
  const history = traces ?? readExecutionRegistry(projectRoot);
  const bypass = detectExecutorBypass(projectRoot);
  const markdown = renderExecutionHistory(history, bypass);
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(projectRoot, EXECUTION_HISTORY_PATH), markdown, "utf8");
  return markdown;
}

export function summarizeExecutionHistory(projectRoot: string): {
  total: number;
  blocked: number;
  dangerousAttempts: number;
  lastExecution: string;
} {
  const traces = readExecutionRegistry(projectRoot);
  const last = traces.at(-1);
  return {
    total: traces.length,
    blocked: traces.filter((trace) => trace.status === "blocked").length,
    dangerousAttempts: traces.filter((trace) => trace.riskLevel === "HIGH" || trace.riskLevel === "CRITICAL").length,
    lastExecution: last ? `${last.executionId} ${last.status} ${last.command}` : "none",
  };
}

function renderExecutionHistory(history: ExecutionTrace[], bypass: string[]): string {
  const latest = history.slice(-40);
  return [
    "# Central Execution History",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    `- Total recorded executions: ${history.length}`,
    `- Blocked executions: ${history.filter((trace) => trace.status === "blocked").length}`,
    `- High-risk attempts: ${history.filter((trace) => trace.riskLevel === "HIGH" || trace.riskLevel === "CRITICAL").length}`,
    `- Executor bypass suspicion: ${bypass.length ? "yes" : "no"}`,
    "",
    "## Bypass Checks",
    ...(bypass.length ? bypass.map((item) => `- ${item}`) : ["- No bypass signal in latest registry window."]),
    "",
    "## Latest Traces",
    "| Time | Execution | Kind | Status | Risk | Command Hash | Reason |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...latest.map(
      (trace) =>
        `| ${trace.finishedAt ?? trace.startedAt} | ${trace.executionId} | ${trace.kind} | ${trace.status} | ${trace.riskLevel} | ${trace.commandHash.slice(0, 12)} | ${escapeTable(trace.reason)} |`,
    ),
    "",
    "## Rollback Candidates",
    ...latest
      .filter((trace) => trace.rollbackCandidate && trace.rollbackCandidate !== "manual approval required before rollback")
      .map((trace) => `- ${trace.taskId}: ${trace.rollbackCandidate}`),
    latest.some((trace) => trace.rollbackCandidate && trace.rollbackCandidate !== "manual approval required before rollback") ? "" : "- none",
    "",
    "## Safety",
    "- Production deploy: not performed",
    "- Rollback: not performed",
    "- env/API key access: not used",
    "- Destructive commands: blocked before execution",
    "",
  ].join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
