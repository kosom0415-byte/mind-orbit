import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { firstMatch, readOptional, writeText } from "./workflow-utils";

export interface LiveReadinessResult {
  generatedAt: string;
  openAiKeyPresent: boolean;
  codexCliAvailable: boolean;
  humanApprovalWaiting: boolean;
  runtimeSafe: boolean;
  releaseSafe: boolean;
  liveGptReady: boolean;
  liveCodexReady: boolean;
  reasons: string[];
}

const LIVE_READINESS_PATH = "logs/live-readiness.md";

export function runLiveReadinessCheck(projectRoot: string): LiveReadinessResult {
  const generatedAt = new Date().toISOString();
  const queue = readOptional(projectRoot, "logs/task-queue.md");
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const release = readOptional(projectRoot, "logs/release-candidates.md");
  const realBridge = readOptional(projectRoot, "logs/real-bridge-runtime.md");
  const openAiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  const codexCliAvailable = commandExists("codex");
  const humanApprovalWaiting = /Human approval required:\s+[1-9]|waiting-human|needs_human_approval|human_approval_required/i.test(queue);
  const runtimeSafe = /Risk:\s+SAFE/i.test(runtime);
  const releaseDecision = firstMatch(release, /Decision:\s*(.+)/i, "unknown");
  const releaseSafe = releaseDecision === "SAFE";
  const bridgeBlocked = /Blocked by safety gate:\s+yes/i.test(realBridge);
  const reasons: string[] = [];

  if (!openAiKeyPresent) reasons.push("OPENAI_API_KEY is not present in process env. Key value was not read or logged.");
  if (!codexCliAvailable) reasons.push("codex CLI is not available on PATH.");
  if (humanApprovalWaiting) reasons.push("Human approval is still waiting; live Codex must remain blocked.");
  if (!runtimeSafe) reasons.push("Runtime status is not SAFE.");
  if (!releaseSafe) reasons.push(`Release readiness is ${releaseDecision}; production remains blocked.`);
  if (bridgeBlocked) reasons.push("Real bridge safety gate is currently blocking Codex execution.");

  const result: LiveReadinessResult = {
    generatedAt,
    openAiKeyPresent,
    codexCliAvailable,
    humanApprovalWaiting,
    runtimeSafe,
    releaseSafe,
    liveGptReady: openAiKeyPresent,
    liveCodexReady: codexCliAvailable && !humanApprovalWaiting && runtimeSafe && !bridgeBlocked,
    reasons: reasons.length ? reasons : ["Live GPT/Codex readiness checks passed for dev-only execution."],
  };
  writeText(projectRoot, LIVE_READINESS_PATH, renderLiveReadiness(result));
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

function renderLiveReadiness(result: LiveReadinessResult): string {
  return [
    "# Live Bridge Readiness",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Status",
    `- OPENAI_API_KEY present: ${result.openAiKeyPresent ? "yes" : "no"}`,
    "- OPENAI_API_KEY value exposed: no",
    `- codex CLI available: ${result.codexCliAvailable ? "yes" : "no"}`,
    `- Human approval waiting: ${result.humanApprovalWaiting ? "yes" : "no"}`,
    `- Runtime SAFE: ${result.runtimeSafe ? "yes" : "no"}`,
    `- Release SAFE: ${result.releaseSafe ? "yes" : "no"}`,
    `- Live GPT ready: ${result.liveGptReady ? "yes" : "no"}`,
    `- Live Codex ready: ${result.liveCodexReady ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "## Allowed Next Live Steps",
    result.liveGptReady
      ? "- Human may run `npm run agent:real-bridge -- --live-gpt` if API cost is approved."
      : "- Add OPENAI_API_KEY to the human-managed environment before live GPT.",
    result.liveCodexReady
      ? "- Human may run `npm run agent:real-bridge -- --live-codex` for LOW/MEDIUM dev-only task."
      : "- Do not run live Codex yet.",
    "",
    "## Safety",
    "- Production deploy: forbidden",
    "- Rollback: forbidden",
    "- env/API key value logging: forbidden",
    "- Approval bypass/yolo mode: forbidden",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runLiveReadinessCheck(process.cwd());
  console.log("Live readiness check complete.");
  console.log(`Live GPT ready: ${result.liveGptReady ? "yes" : "no"}`);
  console.log(`Live Codex ready: ${result.liveCodexReady ? "yes" : "no"}`);
  console.log(`Wrote: ${LIVE_READINESS_PATH}`);
}
