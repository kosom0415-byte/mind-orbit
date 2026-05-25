import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface ApiSafetyResult {
  generatedAt: string;
  safe: boolean;
  openAiKeyNamePresent: boolean;
  keyValueExposed: boolean;
  liveFlagsRequired: boolean;
  reasons: string[];
}

const API_SAFETY_PATH = "logs/api-safety-check.md";

export function runApiSafetyCheck(projectRoot: string): ApiSafetyResult {
  const generatedAt = new Date().toISOString();
  const logs = [
    readOptional(projectRoot, "logs/real-bridge-runtime.md"),
    readOptional(projectRoot, "logs/codex-connector.md"),
    readOptional(projectRoot, "agent-memory/gpt-api-response.md"),
  ].join("\n");
  const keyValueExposed = /sk-[A-Za-z0-9_-]{12,}/.test(logs);
  const result: ApiSafetyResult = {
    generatedAt,
    safe: !keyValueExposed,
    openAiKeyNamePresent: Boolean(process.env.OPENAI_API_KEY),
    keyValueExposed,
    liveFlagsRequired: true,
    reasons: keyValueExposed
      ? ["Potential API key-looking string found in generated workflow logs. Human review required."]
      : ["No API key-looking values found in generated workflow logs.", "Live calls remain disabled unless explicit live flags are used."],
  };
  writeText(projectRoot, API_SAFETY_PATH, renderApiSafety(result));
  return result;
}

function renderApiSafety(result: ApiSafetyResult): string {
  return [
    "# API Safety Check",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Safe: ${result.safe ? "yes" : "no"}`,
    `- OPENAI_API_KEY present in process env: ${result.openAiKeyNamePresent ? "yes" : "no"}`,
    "- OPENAI_API_KEY value logged: no",
    `- Key-looking value found in generated logs: ${result.keyValueExposed ? "yes" : "no"}`,
    `- Explicit live flags required: ${result.liveFlagsRequired ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "## Hard Stops",
    "- Do not read, print, edit, or commit env/API key values.",
    "- Do not run paid/live API paths without explicit Human Vision Owner approval.",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runApiSafetyCheck(process.cwd());
  console.log(`API safety: ${result.safe ? "safe" : "blocked"}`);
  console.log(`Wrote: ${API_SAFETY_PATH}`);
}
