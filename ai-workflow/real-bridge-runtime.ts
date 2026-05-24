import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";
import { runCodexFromHandoff, type CodexConnectorResult } from "./codex-connector";
import { runGptPmConnector, type GptConnectorResult } from "./openai-gpt-connector";
import { generateSharedState } from "./shared-state-manager";
import { readOptional, writeText } from "./workflow-utils";

export interface RealBridgeRuntimeResult {
  generatedAt: string;
  liveGpt: boolean;
  liveCodex: boolean;
  gpt: GptConnectorResult;
  codex: CodexConnectorResult;
  blockedBySafetyGate: boolean;
  reason: string;
}

const REAL_BRIDGE_LOG = "logs/real-bridge-runtime.md";

export async function runRealBridgeRuntime(
  projectRoot: string,
  options: { liveGpt?: boolean; liveCodex?: boolean } = {},
): Promise<RealBridgeRuntimeResult> {
  const generatedAt = new Date().toISOString();
  generateSharedState(projectRoot);
  const gpt = await runGptPmConnector(projectRoot, { live: options.liveGpt });
  const handoff = readOptional(projectRoot, "agent-memory/next-codex-handoff.md");
  const gate = enforceApprovalGate(projectRoot, handoffToGateTask(handoff, generatedAt), generatedAt);
  const blockedBySafetyGate = gate.action !== "allow" || gpt.blockedForHuman;

  if (blockedBySafetyGate) {
    const codex = blockedCodexResult(generatedAt, gate.message);
    writeText(projectRoot, "logs/codex-execution-output.md", renderBlockedCodexOutput(codex));
    writeText(projectRoot, "logs/codex-connector.md", renderBlockedCodexLog(codex));
    writeText(projectRoot, "agent-memory/questions-for-human.md", renderHumanQuestion(generatedAt, gate.assessment.reasons));
    runPostReports(projectRoot);
    const result = {
      generatedAt,
      liveGpt: Boolean(options.liveGpt),
      liveCodex: Boolean(options.liveCodex),
      gpt,
      codex,
      blockedBySafetyGate,
      reason: gate.message,
    };
    writeText(projectRoot, REAL_BRIDGE_LOG, renderRuntimeLog(result));
    return result;
  }

  const codex = runCodexFromHandoff(projectRoot, { liveCodex: options.liveCodex, workspacePath: projectRoot });
  runPostReports(projectRoot);
  const result = {
    generatedAt,
    liveGpt: Boolean(options.liveGpt),
    liveCodex: Boolean(options.liveCodex),
    gpt,
    codex,
    blockedBySafetyGate: codex.blocked,
    reason: codex.reason,
  };
  writeText(projectRoot, REAL_BRIDGE_LOG, renderRuntimeLog(result));
  return result;
}

function runPostReports(projectRoot: string): void {
  for (const script of ["ai-workflow/report-generator.ts", "ai-workflow/organization-dashboard.ts", "ai-workflow/human-supervision-center.ts"]) {
    execFileSync("node", ["--import", "tsx", script], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
  }
}

function handoffToGateTask(handoff: string, generatedAt: string): ApprovalGateTask {
  return {
    id: "real-bridge-codex-handoff",
    title: "Real bridge Codex handoff safety check",
    goal: handoff,
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

function blockedCodexResult(generatedAt: string, reason: string): CodexConnectorResult {
  return {
    generatedAt,
    mode: "dry-run",
    executed: false,
    blocked: true,
    reason,
    output: "Codex connector was not called because the real bridge safety gate requires human approval.",
  };
}

function renderHumanQuestion(generatedAt: string, reasons: string[]): string {
  return [
    "# Questions For Human Vision Owner",
    "",
    `Generated: ${generatedAt}`,
    "",
    "- Real bridge found a HIGH/CRITICAL or approval-gated handoff.",
    "- Should this be approved, rejected, modified in scope, or sent back to GPT PM?",
    ...reasons.map((reason) => `- Risk reason: ${reason}`),
    "",
  ].join("\n");
}

function renderBlockedCodexOutput(result: CodexConnectorResult): string {
  return ["# Codex Execution Output", "", `Generated: ${result.generatedAt}`, "- Executed: no", "- Blocked: yes", "", "## Output", result.output, ""].join("\n");
}

function renderBlockedCodexLog(result: CodexConnectorResult): string {
  return [
    "# Codex Connector",
    "",
    `Generated: ${result.generatedAt}`,
    "- Mode: dry-run",
    "- Executed codex exec: no",
    "- Blocked: yes",
    `- Reason: ${result.reason}`,
    "- Approval bypass: no",
    "- env/API key forwarded: no",
    "- Production deploy: not performed",
    "",
  ].join("\n");
}

function renderRuntimeLog(result: RealBridgeRuntimeResult): string {
  return [
    "# Real Bridge Runtime",
    "",
    `Generated: ${result.generatedAt}`,
    `- Live GPT: ${result.liveGpt ? "yes" : "no"}`,
    `- Live Codex: ${result.liveCodex ? "yes" : "no"}`,
    `- GPT API called: ${result.gpt.calledApi ? "yes" : "no"}`,
    `- Codex executed: ${result.codex.executed ? "yes" : "no"}`,
    `- Blocked by safety gate: ${result.blockedBySafetyGate ? "yes" : "no"}`,
    `- Reason: ${result.reason}`,
    "- API key exposed: no",
    "- Production deploy: not performed",
    "- Rollback: not performed",
    "- Destructive command: not executed",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runRealBridgeRuntime(process.cwd(), {
    liveGpt: process.argv.includes("--live-gpt"),
    liveCodex: process.argv.includes("--live-codex"),
  }).then((result) => {
    console.log("Real bridge runtime complete.");
    console.log(`Live GPT: ${result.liveGpt ? "yes" : "no"}`);
    console.log(`Live Codex: ${result.liveCodex ? "yes" : "no"}`);
    console.log(`Codex executed: ${result.codex.executed ? "yes" : "no"}`);
    console.log(`Wrote: ${REAL_BRIDGE_LOG}`);
  });
}
