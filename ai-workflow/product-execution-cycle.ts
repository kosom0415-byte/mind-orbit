import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { runApprovalRuntimeGate } from "./approval-runtime-gate";
import { runBrowserValidationLoop } from "./browser-validation-loop";
import { observeRuntimeMemory } from "./runtime-memory-observer";
import { runSelfHealRuntimeFlow } from "./self-heal-runtime-flow";
import { readOptional, writeText } from "./workflow-utils";

export interface ProductExecutionCycleResult {
  generatedAt: string;
  task: string;
  build: "passed" | "failed" | "skipped";
  browserRisk: string;
  memoryRisk: string;
  selfHealIssue: string;
  approvalAction: string;
  safeContinue: boolean;
}

const OUTPUT = "logs/product-cycle-report.md";
const SEARCH_REPORT = "logs/search-ux-report.md";
const CAMERA_REPORT = "logs/camera-runtime-report.md";

export async function runProductExecutionCycle(projectRoot: string, options: { skipBuild?: boolean; targetUrl?: string } = {}): Promise<ProductExecutionCycleResult> {
  const generatedAt = new Date().toISOString();
  writeProductTaskReports(projectRoot, generatedAt);
  const build = options.skipBuild ? "skipped" : runBuild(projectRoot);
  const browser = await runBrowserValidationLoop(projectRoot, options.targetUrl);
  const memory = observeRuntimeMemory(projectRoot);
  const selfHeal = runSelfHealRuntimeFlow(projectRoot);
  const approval = runApprovalRuntimeGate(projectRoot);
  runScript(projectRoot, "ai-workflow/organization-dashboard.ts");
  runScript(projectRoot, "ai-workflow/mobile-report-generator.ts");
  runScript(projectRoot, "ai-workflow/human-supervision-center.ts");
  const result = {
    generatedAt,
    task: "Node search UX improvement, camera/zoom safe stabilization, and runtime observation loop.",
    build,
    browserRisk: browser.risk,
    memoryRisk: memory.risk,
    selfHealIssue: selfHeal.issueClass,
    approvalAction: approval.action,
    safeContinue: build === "passed" && browser.risk !== "DANGEROUS" && memory.risk !== "HIGH" && approval.action !== "waiting-human",
  };
  writeText(projectRoot, OUTPUT, renderReport(projectRoot, result));
  return result;
}

function writeProductTaskReports(projectRoot: string, generatedAt: string): void {
  writeText(projectRoot, SEARCH_REPORT, [
    "# Search UX Report",
    "",
    `Generated: ${generatedAt}`,
    "- Task: Node Search UX Improvement",
    "- Product change: index search now uses deferred query stabilization.",
    "- Loading state: shows `검색 중...` while deferred search catches up.",
    "- Empty state: shows `검색 결과 없음` when no node/project matches.",
    "- Keyboard navigation: Enter focuses first matching node; Escape clears search.",
    "- Scope: small app/page.tsx search panel change only.",
    "",
  ].join("\n"));
  writeText(projectRoot, CAMERA_REPORT, [
    "# Camera Runtime Report",
    "",
    `Generated: ${generatedAt}`,
    "- Task: Camera/Zoom Safe Stabilization",
    "- Product change: wheel delta is clamped before zoom mutation.",
    "- Zoom clamp: 0.5 to 2.0.",
    "- Motion limit: zoom step softened to 0.065 per wheel event.",
    "- Experimental depth transform: not added.",
    "- rotateX/Y aggressive transform: not added.",
    "- Scope: hooks/useGestures.ts only.",
    "",
  ].join("\n"));
}

function runBuild(projectRoot: string): ProductExecutionCycleResult["build"] {
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
    });
    return "passed";
  } catch {
    return "failed";
  }
}

function runScript(projectRoot: string, script: string): void {
  execFileSync("node", ["--import", "tsx", script], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
}

function renderReport(projectRoot: string, result: ProductExecutionCycleResult): string {
  return [
    "# Product Execution Cycle Report",
    "",
    `Generated: ${result.generatedAt}`,
    `- Task: ${result.task}`,
    `- Build: ${result.build}`,
    `- Browser risk: ${result.browserRisk}`,
    `- Memory/render risk: ${result.memoryRisk}`,
    `- Self-heal issue: ${result.selfHealIssue}`,
    `- Approval action: ${result.approvalAction}`,
    `- Safe continue: ${result.safeContinue ? "yes" : "no"}`,
    "",
    "## Product Reports",
    "- logs/search-ux-report.md",
    "- logs/camera-runtime-report.md",
    "- logs/runtime-memory-report.md",
    "- logs/browser-validation-report.md",
    "- logs/self-heal-runtime-report.md",
    "- dashboard/live-approval-status.md",
    "",
    "## Mobile Status Excerpt",
    readOptional(projectRoot, "dashboard/mobile-status.md").split("\n").slice(0, 16).join("\n") || "- missing",
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runProductExecutionCycle(process.cwd(), {
    skipBuild: process.argv.includes("--skip-build"),
    targetUrl: process.env.AGENT_RUNTIME_URL,
  }).then((result) => {
    console.log(`Product execution cycle: ${result.safeContinue ? "safe-continue" : result.approvalAction}`);
    console.log(`Wrote: ${OUTPUT}`);
  });
}
