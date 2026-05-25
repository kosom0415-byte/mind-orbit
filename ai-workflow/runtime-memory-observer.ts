import { pathToFileURL } from "node:url";
import { detectRenderLoop } from "./render-loop-detector";
import { readOptional, writeText } from "./workflow-utils";

export interface RuntimeMemoryObservation {
  generatedAt: string;
  risk: "SAFE" | "WARNING" | "HIGH";
  memorySpike: boolean;
  renderLoopRisk: string;
  reasons: string[];
}

const OUTPUT = "logs/runtime-memory-report.md";

export function observeRuntimeMemory(projectRoot: string): RuntimeMemoryObservation {
  const renderLoop = detectRenderLoop(projectRoot);
  const runtime = [
    readOptional(projectRoot, "logs/runtime-vision.md"),
    readOptional(projectRoot, "logs/runtime-health-score.md"),
    readOptional(projectRoot, "logs/auto-validation-pipeline.md"),
  ].join("\n");
  const memorySpike = /Memory leak suspicion:\s*yes|memory spike|heap out of memory|Allocation failed/i.test(runtime);
  const reasons = [
    memorySpike ? "Memory spike/leak signal detected." : "",
    renderLoop.risk !== "SAFE" ? `Render loop detector is ${renderLoop.risk}.` : "",
  ].filter(Boolean);
  if (reasons.length === 0) reasons.push("No runtime memory or render anomaly detected.");
  const risk: RuntimeMemoryObservation["risk"] = memorySpike || renderLoop.risk === "HIGH" ? "HIGH" : renderLoop.risk === "WARNING" ? "WARNING" : "SAFE";
  const result = {
    generatedAt: new Date().toISOString(),
    risk,
    memorySpike,
    renderLoopRisk: renderLoop.risk,
    reasons,
  };
  writeText(projectRoot, OUTPUT, renderReport(result));
  return result;
}

function renderReport(result: RuntimeMemoryObservation): string {
  return [
    "# Runtime Memory Observer",
    "",
    `Generated: ${result.generatedAt}`,
    `- Risk: ${result.risk}`,
    `- Memory spike: ${result.memorySpike ? "yes" : "no"}`,
    `- Render loop risk: ${result.renderLoopRisk}`,
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
  const result = observeRuntimeMemory(process.cwd());
  console.log(`Runtime memory observer: ${result.risk}`);
}
