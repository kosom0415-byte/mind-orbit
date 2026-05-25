import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface LearnedFailurePattern {
  name: string;
  confidence: number;
  recommendedAction: string;
}

export function learnFailurePatterns(projectRoot: string): LearnedFailurePattern[] {
  const history = readOptional(projectRoot, "logs/failure-history.md") + "\n" + readOptional(projectRoot, "logs/runtime-observation.md");
  const patterns: LearnedFailurePattern[] = [];
  if (/cannot_access_before_initialization|Cannot access .* before initialization/i.test(history)) {
    patterns.push({ name: "temporal-dead-zone", confidence: 0.92, recommendedAction: "Move initialization before use and avoid circular hook references." });
  }
  if (/hydration/i.test(history)) {
    patterns.push({ name: "hydration-mismatch", confidence: 0.84, recommendedAction: "Move browser-only reads behind client effects." });
  }
  if (/Too many re-renders|Maximum update depth|excessive_rerender/i.test(history)) {
    patterns.push({ name: "render-loop", confidence: 0.9, recommendedAction: "Remove state updates from render path and check effect dependencies." });
  }
  if (/This page couldn't load|white screen|Blank screen/i.test(history)) {
    patterns.push({ name: "load-failure", confidence: 0.88, recommendedAction: "Disable recent experimental runtime layer and validate app shell first." });
  }
  if (patterns.length === 0) patterns.push({ name: "no-active-known-pattern", confidence: 0.5, recommendedAction: "Keep collecting runtime evidence." });
  writeText(projectRoot, "agent-memory/learned-failure-patterns.md", renderPatterns(patterns));
  return patterns;
}

function renderPatterns(patterns: LearnedFailurePattern[]): string {
  return [
    "# Learned Failure Patterns",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    ...patterns.map((pattern) => `- ${pattern.name}: confidence ${pattern.confidence}, action: ${pattern.recommendedAction}`),
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const patterns = learnFailurePatterns(process.cwd());
  console.log(`Learned failure patterns: ${patterns.length}`);
}
