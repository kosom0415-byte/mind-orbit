import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseQueueState, readOptional, writeText } from "./workflow-utils";

export interface LiveCodexReadiness {
  generatedAt: string;
  ready: boolean;
  codexCliAvailable: boolean;
  safeTaskAvailable: boolean;
  waitingHuman: boolean;
  runtimeSafe: boolean;
  reasons: string[];
}

const LIVE_CODEX_PATH = "logs/live-codex-readiness.md";

export function runLiveCodexReadiness(projectRoot: string): LiveCodexReadiness {
  const generatedAt = new Date().toISOString();
  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const runtime = readOptional(projectRoot, "logs/runtime-health-score.md") || readOptional(projectRoot, "logs/runtime-vision.md");
  const codexCliAvailable = commandExists("codex");
  const safeTaskAvailable = queue.tasks.some((task) => task.queueStatus === "pending" && !task.humanApprovalRequired && task.riskLevel !== "HIGH" && task.riskLevel !== "CRITICAL");
  const waitingHuman = queue.tasks.some((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired);
  const runtimeSafe = /SAFE|Risk:\s*SAFE/i.test(runtime) && !/DANGEROUS|white screen|runtime crash/i.test(runtime);
  const reasons: string[] = [];

  if (!codexCliAvailable) reasons.push("Codex CLI is not available on PATH.");
  if (!safeTaskAvailable) reasons.push("No LOW/MEDIUM safe pending task is available.");
  if (waitingHuman) reasons.push("Human approval is waiting; live Codex must remain blocked.");
  if (!runtimeSafe) reasons.push("Runtime health is not SAFE enough for live Codex execution.");
  if (reasons.length === 0) reasons.push("Live Codex is technically ready for a dev-only safe task, with explicit human command.");

  const result = {
    generatedAt,
    ready: codexCliAvailable && safeTaskAvailable && !waitingHuman && runtimeSafe,
    codexCliAvailable,
    safeTaskAvailable,
    waitingHuman,
    runtimeSafe,
    reasons,
  };
  writeText(projectRoot, LIVE_CODEX_PATH, renderReadiness(result));
  return result;
}

function commandExists(command: string): boolean {
  try {
    execFileSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function renderReadiness(result: LiveCodexReadiness): string {
  return [
    "# Live Codex Readiness",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Ready for live Codex: ${result.ready ? "yes" : "no"}`,
    `- Codex CLI available: ${result.codexCliAvailable ? "yes" : "no"}`,
    `- Safe pending task available: ${result.safeTaskAvailable ? "yes" : "no"}`,
    `- Waiting human: ${result.waitingHuman ? "yes" : "no"}`,
    `- Runtime SAFE: ${result.runtimeSafe ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "## Human Command",
    "- Live Codex only: `npm run agent:real-bridge -- --live-codex`",
    "- Live GPT + Codex: `npm run agent:real-bridge -- --live-gpt --live-codex`",
    "",
    "## Safety",
    "- Approval bypass and yolo mode are forbidden.",
    "- Production deploy, rollback, env/API key, and destructive commands remain blocked.",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runLiveCodexReadiness(process.cwd());
  console.log(`Live Codex ready: ${result.ready ? "yes" : "no"}`);
  console.log(`Wrote: ${LIVE_CODEX_PATH}`);
}
