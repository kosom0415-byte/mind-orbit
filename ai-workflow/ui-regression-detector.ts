import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface UiRegressionResult {
  generatedAt: string;
  risk: "SAFE" | "WARNING" | "DANGEROUS";
  checks: Record<string, boolean>;
  reasons: string[];
}

export function detectUiRegression(projectRoot: string): UiRegressionResult {
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const dom = readOptional(projectRoot, "logs/runtime-dom-observation.md");
  const diff = readOptional(projectRoot, "logs/screenshot-diff.md");
  const checks = {
    whiteScreen: /Blank screen:\s+yes|white screen:\s*yes|This page couldn't load:\s*yes/i.test(runtime + dom),
    runtimePopup: /Application error|Unhandled Runtime Error|This page couldn't load:\s*yes/i.test(runtime + dom),
    hydrationMismatch: /Hydration mismatch:\s+yes|hydration failed/i.test(runtime + dom),
    renderFreeze: /render freeze:\s*yes|Maximum update depth|Too many re-renders/i.test(runtime + dom),
    layoutShift: /Layout shift risk:\s+(HIGH|MEDIUM)/i.test(diff),
  };
  const reasons = Object.entries(checks)
    .filter(([, value]) => value)
    .map(([key]) => `${key} signal detected.`);
  if (reasons.length === 0) reasons.push("No UI regression signal detected.");
  const risk: UiRegressionResult["risk"] = checks.whiteScreen || checks.runtimePopup || checks.renderFreeze ? "DANGEROUS" : checks.hydrationMismatch || checks.layoutShift ? "WARNING" : "SAFE";
  const result = { generatedAt: new Date().toISOString(), risk, checks, reasons };
  writeText(projectRoot, "logs/ui-regression.md", renderRegression(result));
  return result;
}

function renderRegression(result: UiRegressionResult): string {
  return [
    "# UI Regression Detector",
    "",
    `Generated: ${result.generatedAt}`,
    `- Risk: ${result.risk}`,
    "",
    "## Checks",
    ...Object.entries(result.checks).map(([key, value]) => `- ${key}: ${value ? "yes" : "no"}`),
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
  const result = detectUiRegression(process.cwd());
  console.log(`UI regression: ${result.risk}`);
}
