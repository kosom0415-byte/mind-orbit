import { pathToFileURL } from "node:url";
import { parseQueueState, readOptional, writeText } from "./workflow-utils";

export interface ReleaseRiskScore {
  generatedAt: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  releaseReady: boolean;
  reasons: string[];
}

export function calculateReleaseRiskScore(projectRoot: string): ReleaseRiskScore {
  const release = readOptional(projectRoot, "logs/release-candidates.md");
  const runtime = readOptional(projectRoot, "logs/runtime-health-score.md");
  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const reasons: string[] = [];
  let risk = 0;

  if (/Decision:\s+DANGEROUS/i.test(release)) {
    risk += 45;
    reasons.push("Release manager marked candidate DANGEROUS.");
  }
  if (/Decision:\s+WARNING/i.test(release)) {
    risk += 25;
    reasons.push("Release manager marked candidate WARNING.");
  }
  if (/Status:\s+DANGEROUS/i.test(runtime)) {
    risk += 45;
    reasons.push("Runtime health is DANGEROUS.");
  }
  if (/Status:\s+WARNING/i.test(runtime)) {
    risk += 20;
    reasons.push("Runtime health is WARNING.");
  }

  const waiting = queue.tasks.filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired).length;
  const blocked = queue.tasks.filter((task) => task.queueStatus === "blocked" || task.status === "blocked").length;
  if (waiting > 0) {
    risk += 30;
    reasons.push(`${waiting} human approval task(s) waiting.`);
  }
  if (blocked > 0) {
    risk += 20;
    reasons.push(`${blocked} blocked task(s) in queue.`);
  }
  if (reasons.length === 0) reasons.push("No release-blocking signal found.");

  const score = Math.min(100, risk);
  const level = score >= 85 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  const result: ReleaseRiskScore = {
    generatedAt: new Date().toISOString(),
    score,
    level,
    releaseReady: level === "LOW",
    reasons,
  };
  writeText(projectRoot, "logs/release-risk-score.md", renderReleaseRisk(result));
  return result;
}

function renderReleaseRisk(result: ReleaseRiskScore): string {
  return [
    "# Release Risk Score",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Score: ${result.score}`,
    `- Level: ${result.level}`,
    `- Release ready: ${result.releaseReady ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "## Safety",
    "- Production deploy remains human-only and is not automated.",
    "- Rollback remains human-only and is not automated.",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = calculateReleaseRiskScore(process.cwd());
  console.log(`Release risk: ${result.level} ${result.score}`);
}
