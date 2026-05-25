import { pathToFileURL } from "node:url";
import { runApiSafetyCheck } from "./api-safety-check";
import { readOptional, writeText } from "./workflow-utils";

export interface LiveOpenAiReadiness {
  generatedAt: string;
  ready: boolean;
  envPresent: boolean;
  approvalClean: boolean;
  runtimeAcceptable: boolean;
  reasons: string[];
}

const LIVE_OPENAI_PATH = "logs/live-openai-readiness.md";

export function runLiveOpenAiReadiness(projectRoot: string): LiveOpenAiReadiness {
  const generatedAt = new Date().toISOString();
  const apiSafety = runApiSafetyCheck(projectRoot);
  const approval = readOptional(projectRoot, "agent-memory/human-approval-required.md");
  const runtime = readOptional(projectRoot, "logs/runtime-health-score.md") || readOptional(projectRoot, "logs/runtime-vision.md");
  const approvalClean = !/human_approval_required|Approval Required|waiting-human/i.test(approval);
  const runtimeAcceptable = !/DANGEROUS|runtime crash|white screen/i.test(runtime);
  const envPresent = Boolean(process.env.OPENAI_API_KEY);
  const reasons: string[] = [];

  if (!envPresent) reasons.push("OPENAI_API_KEY is not present in the process environment. Value was not read or logged.");
  if (!approvalClean) reasons.push("Human approval queue is not clean; live GPT should wait.");
  if (!runtimeAcceptable) reasons.push("Runtime health is not acceptable for live GPT planning.");
  if (!apiSafety.safe) reasons.push("API safety check found a possible key exposure risk.");
  if (reasons.length === 0) reasons.push("Live GPT is technically ready, but still requires explicit human command and cost approval.");

  const result = {
    generatedAt,
    ready: envPresent && approvalClean && runtimeAcceptable && apiSafety.safe,
    envPresent,
    approvalClean,
    runtimeAcceptable,
    reasons,
  };
  writeText(projectRoot, LIVE_OPENAI_PATH, renderReadiness(result));
  return result;
}

function renderReadiness(result: LiveOpenAiReadiness): string {
  return [
    "# Live OpenAI Readiness",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Ready for live GPT: ${result.ready ? "yes" : "no"}`,
    `- OPENAI_API_KEY present: ${result.envPresent ? "yes" : "no"}`,
    "- API key value exposed: no",
    `- Approval queue clean: ${result.approvalClean ? "yes" : "no"}`,
    `- Runtime acceptable: ${result.runtimeAcceptable ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "## Human Command",
    "- Dry run: `npm run agent:real-bridge`",
    "- Live GPT only: `npm run agent:real-bridge -- --live-gpt`",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runLiveOpenAiReadiness(process.cwd());
  console.log(`Live OpenAI ready: ${result.ready ? "yes" : "no"}`);
  console.log(`Wrote: ${LIVE_OPENAI_PATH}`);
}
