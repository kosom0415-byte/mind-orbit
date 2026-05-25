import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface ScreenshotDiffResult {
  generatedAt: string;
  beforeHash: string;
  afterHash: string;
  similarity: number;
  layoutShiftRisk: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

export function runScreenshotDiff(projectRoot: string): ScreenshotDiffResult {
  const before = readOptional(projectRoot, "logs/runtime-observation-log.md");
  const after = readOptional(projectRoot, "logs/runtime-vision.md");
  const result = compareSnapshots(before, after);
  writeText(projectRoot, "logs/screenshot-diff.md", renderDiff(result));
  return result;
}

export function compareSnapshots(before: string, after: string): ScreenshotDiffResult {
  const beforeHash = hash(before);
  const afterHash = hash(after);
  const similarity = jaccard(before, after);
  const layoutShiftRisk = similarity < 0.25 ? "HIGH" : similarity < 0.55 ? "MEDIUM" : "LOW";
  const reasons = layoutShiftRisk === "LOW" ? ["No large text/snapshot drift detected."] : ["Large snapshot/text drift requires visual review."];
  return { generatedAt: new Date().toISOString(), beforeHash, afterHash, similarity, layoutShiftRisk, reasons };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  return intersection / new Set([...setA, ...setB]).size;
}

function renderDiff(result: ScreenshotDiffResult): string {
  return [
    "# Screenshot Diff Engine",
    "",
    `Generated: ${result.generatedAt}`,
    `- Before hash: ${result.beforeHash}`,
    `- After hash: ${result.afterHash}`,
    `- Similarity: ${result.similarity.toFixed(2)}`,
    `- Layout shift risk: ${result.layoutShiftRisk}`,
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
  const result = runScreenshotDiff(process.cwd());
  console.log(`Screenshot diff: ${result.layoutShiftRisk}`);
}
