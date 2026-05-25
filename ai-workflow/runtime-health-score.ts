import { pathToFileURL } from "node:url";
import { firstMatch, readOptional, writeText } from "./workflow-utils";

export interface RuntimeHealthScore {
  generatedAt: string;
  score: number;
  status: "SAFE" | "WARNING" | "DANGEROUS";
  reasons: string[];
}

export function calculateRuntimeHealthScore(projectRoot: string): RuntimeHealthScore {
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md") + "\n" + readOptional(projectRoot, "logs/runtime-observation.md");
  const status = firstMatch(runtime, /Risk:\s*(SAFE|WARNING|DANGEROUS)/i, "unknown").toUpperCase();
  const reasons: string[] = [];
  let score = status === "SAFE" ? 95 : status === "WARNING" ? 65 : status === "DANGEROUS" ? 25 : 50;

  if (/Blank screen:\s+yes|white screen|This page couldn't load/i.test(runtime)) {
    score -= 40;
    reasons.push("Blank/white page or page load failure signal detected.");
  }
  if (/Runtime crash:\s+yes|ReferenceError|TypeError/i.test(runtime)) {
    score -= 35;
    reasons.push("Runtime crash signal detected.");
  }
  if (/Hydration mismatch:\s+yes/i.test(runtime)) {
    score -= 20;
    reasons.push("Hydration mismatch signal detected.");
  }
  if (/Excessive rerender:\s+yes|Maximum update depth|Too many re-renders/i.test(runtime)) {
    score -= 25;
    reasons.push("Excessive rerender signal detected.");
  }
  if (reasons.length === 0) reasons.push("No runtime failure signal detected.");

  const result: RuntimeHealthScore = {
    generatedAt: new Date().toISOString(),
    score: Math.max(0, Math.min(100, score)),
    status: score >= 80 ? "SAFE" : score >= 55 ? "WARNING" : "DANGEROUS",
    reasons,
  };
  writeText(projectRoot, "logs/runtime-health-score.md", renderRuntimeScore(result));
  return result;
}

function renderRuntimeScore(result: RuntimeHealthScore): string {
  return [
    "# Runtime Health Score",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Score: ${result.score}`,
    `- Status: ${result.status}`,
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
  const result = calculateRuntimeHealthScore(process.cwd());
  console.log(`Runtime health: ${result.status} ${result.score}`);
}
