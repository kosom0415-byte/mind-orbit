import { createHash } from "node:crypto";

export interface ScreenshotComparison {
  beforeHash: string;
  afterHash: string;
  changed: boolean;
  similarityScore: number;
  visualRisk: "SAFE" | "WARNING";
  reasons: string[];
}

export function hashRuntimeSnapshot(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function compareRuntimeSnapshots(before: string, after: string): ScreenshotComparison {
  const beforeHash = hashRuntimeSnapshot(before);
  const afterHash = hashRuntimeSnapshot(after);
  const similarityScore = calculateSimilarity(before, after);
  const changed = beforeHash !== afterHash;
  const visualRisk = similarityScore < 0.35 ? "WARNING" : "SAFE";
  return {
    beforeHash,
    afterHash,
    changed,
    similarityScore,
    visualRisk,
    reasons: visualRisk === "WARNING" ? ["Large before/after snapshot drift detected."] : ["No large visual drift signal detected."],
  };
}

function calculateSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const tokensA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 1 : intersection / union;
}
