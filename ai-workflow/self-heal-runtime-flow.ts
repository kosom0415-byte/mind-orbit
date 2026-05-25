import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { writeText, readOptional } from "./workflow-utils";

export interface SelfHealRuntimeResult {
  generatedAt: string;
  issueClass: "none" | "runtime" | "render-loop" | "memory" | "release-risk";
  approvalNeeded: boolean;
  confidence: number;
  safeRecoverySuggestion: string;
  retryCandidate: string;
  rollbackCandidate: string;
}

const OUTPUT = "logs/self-heal-runtime-report.md";

export function runSelfHealRuntimeFlow(projectRoot: string): SelfHealRuntimeResult {
  const evidence = [
    readOptional(projectRoot, "logs/browser-validation-report.md"),
    readOptional(projectRoot, "logs/runtime-memory-report.md"),
    readOptional(projectRoot, "logs/release-risk-score.md"),
  ].join("\n");
  const issueClass: SelfHealRuntimeResult["issueClass"] = /Runtime error:\s*yes|White screen:\s*yes|Load failure:\s*yes/i.test(evidence)
    ? "runtime"
    : /Render loop risk:\s*(WARNING|HIGH)|Loop anomaly:\s*yes/i.test(evidence)
      ? "render-loop"
      : /Memory spike:\s*yes/i.test(evidence)
        ? "memory"
        : /Level:\s*(HIGH|CRITICAL)/i.test(evidence)
          ? "release-risk"
          : "none";
  const approvalNeeded = issueClass === "runtime" || issueClass === "memory";
  const result = {
    generatedAt: new Date().toISOString(),
    issueClass,
    approvalNeeded,
    confidence: issueClass === "none" ? 0.94 : 0.76,
    safeRecoverySuggestion:
      issueClass === "none"
        ? "Continue with LOW/MEDIUM product tasks and keep browser validation active."
        : "Prefer a narrow dev-only fix, disable experimental motion/depth first if implicated, and rerun build/browser validation.",
    retryCandidate: issueClass === "none" ? "npm run agent:continue" : "npm run agent:validate -- --skip-build",
    rollbackCandidate: latestCommit(projectRoot),
  };
  writeText(projectRoot, OUTPUT, renderReport(result));
  return result;
}

function latestCommit(projectRoot: string): string {
  try {
    return execSync("git log --oneline -1", { cwd: projectRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function renderReport(result: SelfHealRuntimeResult): string {
  return [
    "# Self-Heal Runtime Report",
    "",
    `Generated: ${result.generatedAt}`,
    `- Issue class: ${result.issueClass}`,
    `- Approval needed: ${result.approvalNeeded ? "yes" : "no"}`,
    `- Confidence: ${result.confidence}`,
    `- Safe recovery suggestion: ${result.safeRecoverySuggestion}`,
    `- Retry candidate: ${result.retryCandidate}`,
    `- Rollback candidate: ${result.rollbackCandidate}`,
    "- Rollback executed: no",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runSelfHealRuntimeFlow(process.cwd());
  console.log(`Self-heal runtime flow: ${result.issueClass}`);
}
