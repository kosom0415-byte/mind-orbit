import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { summarizeExecutionHistory } from "./execution-audit";

export type ReleaseDecision = "SAFE" | "WARNING" | "DANGEROUS";

export interface ReleaseEvaluation {
  generatedAt: string;
  decision: ReleaseDecision;
  score: number;
  reasons: string[];
  productionDeployAllowed: false;
  rollbackAllowed: false;
}

const RELEASE_CANDIDATES_PATH = "logs/release-candidates.md";

export function evaluateReleaseCandidate(projectRoot: string): ReleaseEvaluation {
  const generatedAt = new Date().toISOString();
  const buildLog = readOptional(projectRoot, "logs/execution-history.md");
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const queue = readOptional(projectRoot, "logs/task-queue.md");
  const selfHeal = readOptional(projectRoot, "logs/self-heal-actions.md");
  const execution = summarizeExecutionHistory(projectRoot);
  const reasons: string[] = [];
  let score = 100;

  if (!/npm run build|Command completed through central executor|Compiled successfully|build/i.test(buildLog)) {
    score -= 25;
    reasons.push("No recent successful build evidence found in centralized execution history.");
  }
  if (/Risk:\s+DANGEROUS|Runtime crash:\s+yes|Blank screen:\s+yes/i.test(runtime)) {
    score -= 45;
    reasons.push("Runtime vision reported dangerous load/crash risk.");
  }
  if (/Risk:\s+WARNING|Hydration mismatch:\s+yes/i.test(runtime)) {
    score -= 20;
    reasons.push("Runtime vision reported warning-level runtime risk.");
  }
  if (/Human approval required:\s+[1-9]/i.test(queue)) {
    score -= 25;
    reasons.push("Queue still has human approval waiting.");
  }
  if (/blocked|critical|rollback_recommended/i.test(selfHeal)) {
    score -= 15;
    reasons.push("Self-heal memory contains unresolved recovery risk.");
  }
  if (execution.dangerousAttempts > 0) {
    score -= 10;
    reasons.push("High-risk command attempts exist in execution audit.");
  }
  if (reasons.length === 0) reasons.push("Build/runtime/queue/recovery evidence does not show release-blocking risk.");

  const decision: ReleaseDecision = score < 55 ? "DANGEROUS" : score < 80 ? "WARNING" : "SAFE";
  const evaluation: ReleaseEvaluation = {
    generatedAt,
    decision,
    score: Math.max(0, score),
    reasons,
    productionDeployAllowed: false,
    rollbackAllowed: false,
  };
  writeReleaseCandidate(projectRoot, evaluation);
  return evaluation;
}

function writeReleaseCandidate(projectRoot: string, evaluation: ReleaseEvaluation): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  writeFileSync(
    join(projectRoot, RELEASE_CANDIDATES_PATH),
    [
      "# Release Candidate Evaluation",
      "",
      `Generated: ${evaluation.generatedAt}`,
      "",
      `- Decision: ${evaluation.decision}`,
      `- Score: ${evaluation.score}`,
      "- Production deploy: not automated",
      "- Rollback: not automated",
      "",
      "## Reasons",
      ...evaluation.reasons.map((reason) => `- ${reason}`),
      "",
      "## Required Human Actions",
      "- Production deploy requires explicit Human Vision Owner approval and manual action.",
      "- Rollback requires explicit Human Vision Owner approval and manual action.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function readOptional(projectRoot: string, relativePath: string): string {
  const fullPath = join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const evaluation = evaluateReleaseCandidate(process.cwd());
  console.log(`Release evaluation: ${evaluation.decision} (${evaluation.score})`);
  console.log(`Wrote: ${RELEASE_CANDIDATES_PATH}`);
}
