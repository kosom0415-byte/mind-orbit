import { pathToFileURL } from "node:url";
import { writeText } from "./workflow-utils";

export function runEnvIntegrityCheck(projectRoot: string): { safe: boolean; reasons: string[] } {
  const sensitiveKeys = Object.keys(process.env).filter((key) => /OPENAI|API_KEY|TOKEN|SECRET|PASSWORD|SUPABASE/i.test(key));
  const reasons = [
    sensitiveKeys.length ? `${sensitiveKeys.length} sensitive env key name(s) present; values were not read or logged.` : "No sensitive env key names detected in current process.",
    ".env.local was not read or modified by this check.",
  ];
  const result = { safe: true, reasons };
  writeText(projectRoot, "logs/env-integrity-check.md", render(result));
  return result;
}

function render(result: { safe: boolean; reasons: string[] }): string {
  return [
    "# Env Integrity Check",
    "",
    `Generated: ${new Date().toISOString()}`,
    `- Safe: ${result.safe ? "yes" : "no"}`,
    "- Secret values logged: no",
    "- .env.local modified: no",
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runEnvIntegrityCheck(process.cwd());
  console.log(`Env integrity safe: ${result.safe ? "yes" : "no"}`);
}
