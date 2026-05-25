import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface RenderLoopDetection {
  generatedAt: string;
  risk: "SAFE" | "WARNING" | "HIGH";
  excessiveRerender: boolean;
  renderFreeze: boolean;
  hydrationMismatch: boolean;
  loopAnomaly: boolean;
  reasons: string[];
}

const OUTPUT = "logs/render-loop-report.md";

export function detectRenderLoop(projectRoot: string): RenderLoopDetection {
  const runtime = [
    readOptional(projectRoot, "logs/runtime-vision.md"),
    readOptional(projectRoot, "logs/runtime-observation.md"),
    readOptional(projectRoot, "logs/ui-regression.md"),
    readOptional(projectRoot, "logs/manual-browser-verification.md"),
  ].join("\n");
  const excessiveRerender = /Too many re-renders|Maximum update depth|Excessive rerender:\s*yes/i.test(runtime);
  const renderFreeze = /renderFreeze:\s*yes|render freeze|Page loaded:\s*no/i.test(runtime);
  const hydrationMismatch = /Hydration mismatch:\s*yes|hydration failed|hydration error/i.test(runtime);
  const loopAnomaly = /requestAnimationFrame.*loop|infinite loop|retry storm/i.test(runtime);
  const reasons = [
    excessiveRerender ? "Excessive rerender signal detected." : "",
    renderFreeze ? "Render freeze signal detected." : "",
    hydrationMismatch ? "Hydration mismatch signal detected." : "",
    loopAnomaly ? "Loop anomaly signal detected." : "",
  ].filter(Boolean);
  if (reasons.length === 0) reasons.push("No render loop anomaly detected in current runtime evidence.");
  const risk: RenderLoopDetection["risk"] = excessiveRerender || renderFreeze || loopAnomaly ? "HIGH" : hydrationMismatch ? "WARNING" : "SAFE";
  const result = {
    generatedAt: new Date().toISOString(),
    risk,
    excessiveRerender,
    renderFreeze,
    hydrationMismatch,
    loopAnomaly,
    reasons,
  };
  writeText(projectRoot, OUTPUT, renderReport(result));
  return result;
}

function renderReport(result: RenderLoopDetection): string {
  return [
    "# Render Loop Detector",
    "",
    `Generated: ${result.generatedAt}`,
    `- Risk: ${result.risk}`,
    `- Excessive rerender: ${result.excessiveRerender ? "yes" : "no"}`,
    `- Render freeze: ${result.renderFreeze ? "yes" : "no"}`,
    `- Hydration mismatch: ${result.hydrationMismatch ? "yes" : "no"}`,
    `- Loop anomaly: ${result.loopAnomaly ? "yes" : "no"}`,
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
  const result = detectRenderLoop(process.cwd());
  console.log(`Render loop detector: ${result.risk}`);
}
