import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ApprovalGateTask } from "./approval-gate";
import { runBrowserRuntimeAgent } from "./browser-runtime-agent";
import { runCentralShellCommand } from "./central-shell-executor";
import { generateArchitectureMap } from "./architecture-map";
import { generateCodebaseSummary } from "./codebase-summary-generator";
import { generateDependencyRiskMap } from "./dependency-risk-map";
import { writeExecutionAudit } from "./execution-audit";
import { generateFeatureHistory } from "./feature-history-tracker";
import { generateOrganizationDashboard } from "./organization-dashboard";
import { evaluateReleaseCandidate } from "./release-manager";

const VALIDATION_PIPELINE_PATH = "logs/auto-validation-pipeline.md";

export async function runAutoValidationPipeline(projectRoot: string, options: { skipBuild?: boolean; runtimeMode?: "http-probe" | "mock-crash" | "mock-safe"; targetUrl?: string } = {}): Promise<string> {
  const generatedAt = new Date().toISOString();
  const task = createValidationTask(generatedAt);
  const build = options.skipBuild
    ? { allowed: true, exitCode: 0, output: "build skipped by caller", trace: undefined }
    : runCentralShellCommand(projectRoot, task, "npm run build");
  const runtime = await runBrowserRuntimeAgent(projectRoot, { mode: options.runtimeMode ?? "http-probe", targetUrl: options.targetUrl });
  const release = evaluateReleaseCandidate(projectRoot);
  generateCodebaseSummary(projectRoot);
  generateArchitectureMap(projectRoot);
  generateDependencyRiskMap(projectRoot);
  generateFeatureHistory(projectRoot);
  writeExecutionAudit(projectRoot);

  const markdown = [
    "# Auto Validation Pipeline",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Pipeline",
    `- Build: ${build.exitCode === 0 ? "passed" : "failed"}`,
    `- Runtime open: ${runtime.loadStatus}`,
    `- Screenshot capture: ${runtime.screenshotHash ? "recorded as hash" : "not recorded"}`,
    `- Console error scan: ${runtime.consoleErrors.length ? "errors found" : "no errors from probe"}`,
    `- Runtime risk: ${runtime.detection.risk}`,
    `- Release decision: ${release.decision}`,
    `- Release score: ${release.score}`,
    "",
    "## Runtime Reasons",
    ...runtime.detection.reasons.map((reason) => `- ${reason}`),
    "",
    "## Release Reasons",
    ...release.reasons.map((reason) => `- ${reason}`),
    "",
    "## Safety",
    "- Production deploy: not performed",
    "- Rollback: not performed",
    "- env/API key access: not used",
    "- Destructive commands: not executed",
    "",
  ].join("\n");

  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(projectRoot, VALIDATION_PIPELINE_PATH), markdown, "utf8");
  generateOrganizationDashboard(projectRoot);
  return markdown;
}

function createValidationTask(generatedAt: string): ApprovalGateTask {
  return {
    id: "auto-validation-pipeline",
    title: "Run dev-safe validation pipeline",
    goal: "Run build, local runtime probe, release readiness scoring, and dashboard update in dev-safe mode.",
    status: "queued",
    owner: "codex-engineer",
    priority: "normal",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runAutoValidationPipeline(process.cwd(), {
    skipBuild: process.argv.includes("--skip-build"),
    runtimeMode: process.argv.includes("--mock-crash") ? "mock-crash" : process.argv.includes("--mock-safe") ? "mock-safe" : "http-probe",
    targetUrl: process.env.AGENT_RUNTIME_URL,
  }).then(() => {
    console.log(`Auto validation pipeline complete: ${VALIDATION_PIPELINE_PATH}`);
  });
}
