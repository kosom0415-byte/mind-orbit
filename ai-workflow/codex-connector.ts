import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";
import { inspectCommand } from "./command-firewall";
import { readOptional, writeText } from "./workflow-utils";

export interface CodexConnectorOptions {
  liveCodex?: boolean;
  workspacePath?: string;
  timeoutMs?: number;
}

export interface CodexConnectorResult {
  generatedAt: string;
  mode: "dry-run" | "live-codex";
  executed: boolean;
  blocked: boolean;
  reason: string;
  output: string;
}

const CODEX_CONNECTOR_LOG = "logs/codex-connector.md";
const CODEX_EXECUTION_OUTPUT = "logs/codex-execution-output.md";

export function runCodexTask(prompt: string, options: CodexConnectorOptions = {}): CodexConnectorResult {
  const generatedAt = new Date().toISOString();
  const projectRoot = options.workspacePath ?? process.cwd();
  const task = promptToTask(prompt, generatedAt);
  const gate = enforceApprovalGate(projectRoot, task, generatedAt);
  const firewall = inspectCommand(projectRoot, task, "codex exec");
  const blocked = gate.action !== "allow" || !firewall.allowed;

  if (blocked) {
    const result: CodexConnectorResult = {
      generatedAt,
      mode: options.liveCodex ? "live-codex" : "dry-run",
      executed: false,
      blocked: true,
      reason: gate.message || firewall.reason,
      output: "Codex execution blocked by approval gate or command firewall.",
    };
    writeReports(projectRoot, result, prompt);
    return result;
  }

  if (!options.liveCodex) {
    const result: CodexConnectorResult = {
      generatedAt,
      mode: "dry-run",
      executed: false,
      blocked: false,
      reason: "Dry-run only. Use --live-codex to call codex exec.",
      output: renderDryRunOutput(prompt),
    };
    writeReports(projectRoot, result, prompt);
    return result;
  }

  const output = executeCodex(projectRoot, prompt, options.timeoutMs ?? 120_000);
  const result: CodexConnectorResult = {
    generatedAt,
    mode: "live-codex",
    executed: true,
    blocked: false,
    reason: "codex exec completed through connector.",
    output,
  };
  writeReports(projectRoot, result, prompt);
  return result;
}

export function runCodexFromHandoff(projectRoot: string, options: CodexConnectorOptions = {}): CodexConnectorResult {
  const prompt = readOptional(projectRoot, "agent-memory/next-codex-handoff.md") || "No Codex handoff found.";
  return runCodexTask(prompt, { ...options, workspacePath: projectRoot });
}

function executeCodex(projectRoot: string, prompt: string, timeoutMs: number): string {
  const env = sanitizeEnv(process.env);
  return execFileSync("codex", ["exec", "--sandbox", "workspace-write", prompt], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
    env,
  });
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (/OPENAI|API_KEY|TOKEN|SECRET|PASSWORD|SUPABASE/i.test(key)) continue;
    if (typeof value === "string") next[key] = value;
  }
  return next as NodeJS.ProcessEnv;
}

function promptToTask(prompt: string, generatedAt: string): ApprovalGateTask {
  return {
    id: "codex-connector-task",
    title: "Codex connector handoff execution",
    goal: prompt,
    status: "queued",
    owner: "codex-engineer",
    priority: "normal",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function writeReports(projectRoot: string, result: CodexConnectorResult, prompt: string): void {
  writeText(
    projectRoot,
    CODEX_CONNECTOR_LOG,
    [
      "# Codex Connector",
      "",
      `Generated: ${result.generatedAt}`,
      `- Mode: ${result.mode}`,
      `- Executed codex exec: ${result.executed ? "yes" : "no"}`,
      `- Blocked: ${result.blocked ? "yes" : "no"}`,
      `- Reason: ${result.reason}`,
      "- Approval bypass: no",
      "- Yolo mode: forbidden",
      "- env/API key forwarded: no",
      "- Production deploy: not performed",
      "",
      "## Prompt Summary",
      prompt.split("\n").slice(0, 20).join("\n"),
      "",
    ].join("\n"),
  );
  writeText(
    projectRoot,
    CODEX_EXECUTION_OUTPUT,
    [
      "# Codex Execution Output",
      "",
      `Generated: ${result.generatedAt}`,
      `- Mode: ${result.mode}`,
      `- Executed: ${result.executed ? "yes" : "no"}`,
      "",
      "## Output",
      result.output,
      "",
    ].join("\n"),
  );
}

function renderDryRunOutput(prompt: string): string {
  return [
    "Dry-run Codex connector output.",
    "No codex exec process was started.",
    "The connector would pass the approved handoff to Codex only with --live-codex.",
    "",
    "Prompt preview:",
    prompt.split("\n").slice(0, 12).join("\n"),
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runCodexFromHandoff(process.cwd(), { liveCodex: process.argv.includes("--live-codex") });
  console.log(`Codex connector complete: ${result.mode}`);
  console.log(`Executed: ${result.executed ? "yes" : "no"}`);
  console.log(`Wrote: ${CODEX_EXECUTION_OUTPUT}`);
}
