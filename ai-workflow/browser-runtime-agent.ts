import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { appendExecutionTrace, createExecutionTrace } from "./execution-registry";
import { detectRuntimeErrors, type RuntimeDetectionResult } from "./runtime-error-detector";
import { compareRuntimeSnapshots, hashRuntimeSnapshot, type ScreenshotComparison } from "./runtime-screenshot-compare";

export interface BrowserRuntimeReport {
  generatedAt: string;
  targetUrl: string;
  mode: "http-probe" | "mock-crash" | "mock-safe";
  loadStatus: "not-run" | "loaded" | "failed";
  statusCode?: number;
  title?: string;
  htmlLength: number;
  domNodeCount: number;
  consoleErrors: string[];
  screenshotHash: string;
  comparison: ScreenshotComparison;
  detection: RuntimeDetectionResult;
}

const RUNTIME_VISION_PATH = "logs/runtime-vision.md";

export async function runBrowserRuntimeAgent(
  projectRoot: string,
  options: { targetUrl?: string; mode?: "http-probe" | "mock-crash" | "mock-safe"; beforeSnapshot?: string } = {},
): Promise<BrowserRuntimeReport> {
  const generatedAt = new Date().toISOString();
  const targetUrl = options.targetUrl ?? "http://localhost:3000";
  const mode = options.mode ?? "http-probe";
  const probe = await collectProbe(targetUrl, mode);
  const screenshotHash = hashRuntimeSnapshot(probe.html);
  const comparison = compareRuntimeSnapshots(options.beforeSnapshot ?? probe.html, probe.html);
  const detection = detectRuntimeErrors({
    html: probe.html,
    consoleMessages: probe.consoleErrors,
    screenshotHash,
    previousScreenshotHash: comparison.beforeHash,
    domNodeCount: probe.domNodeCount,
    previousDomNodeCount: probe.domNodeCount,
    loadStatus: probe.loadStatus,
  });
  const report: BrowserRuntimeReport = {
    generatedAt,
    targetUrl,
    mode,
    loadStatus: probe.loadStatus,
    statusCode: probe.statusCode,
    title: probe.title,
    htmlLength: probe.html.length,
    domNodeCount: probe.domNodeCount,
    consoleErrors: probe.consoleErrors,
    screenshotHash,
    comparison,
    detection,
  };

  writeRuntimeVision(projectRoot, report);
  appendExecutionTrace(
    projectRoot,
    createExecutionTrace({
      taskId: "browser-runtime-validation",
      kind: "browser-runtime",
      command: `runtime probe ${targetUrl}`,
      riskLevel: detection.risk === "DANGEROUS" ? "CRITICAL" : detection.risk === "WARNING" ? "MEDIUM" : "LOW",
      status: detection.risk === "DANGEROUS" ? "failed" : "completed",
      reason: detection.reasons.join("; "),
      timestamp: generatedAt,
    }),
  );
  return report;
}

function writeRuntimeVision(projectRoot: string, report: BrowserRuntimeReport): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(projectRoot, RUNTIME_VISION_PATH), renderRuntimeVision(report), "utf8");
}

function renderRuntimeVision(report: BrowserRuntimeReport): string {
  return [
    "# Browser Runtime Vision",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Target",
    `- URL: ${report.targetUrl}`,
    `- Mode: ${report.mode}`,
    `- Load status: ${report.loadStatus}`,
    `- Status code: ${report.statusCode ?? "n/a"}`,
    `- Title: ${report.title ?? "n/a"}`,
    "",
    "## Runtime Signals",
    `- Risk: ${report.detection.risk}`,
    `- Blank screen: ${report.detection.blankScreen ? "yes" : "no"}`,
    `- Runtime crash: ${report.detection.runtimeCrash ? "yes" : "no"}`,
    `- Hydration mismatch: ${report.detection.hydrationMismatch ? "yes" : "no"}`,
    `- Excessive rerender: ${report.detection.excessiveRerender ? "yes" : "no"}`,
    `- Animation jitter suspicion: ${report.detection.animationJitterSuspicion ? "yes" : "no"}`,
    `- Scroll freeze suspicion: ${report.detection.scrollFreezeSuspicion ? "yes" : "no"}`,
    `- Memory leak suspicion: ${report.detection.memoryLeakSuspicion ? "yes" : "no"}`,
    `- Excessive DOM update: ${report.detection.excessiveDomUpdate ? "yes" : "no"}`,
    "",
    "## Screenshot / DOM Approximation",
    `- Snapshot hash: ${report.screenshotHash.slice(0, 16)}`,
    `- Similarity score: ${report.comparison.similarityScore.toFixed(2)}`,
    `- Visual risk: ${report.comparison.visualRisk}`,
    `- HTML length: ${report.htmlLength}`,
    `- DOM node count: ${report.domNodeCount}`,
    "",
    "## Reasons",
    ...report.detection.reasons.map((reason) => `- ${reason}`),
    "",
    "## Console Errors",
    ...(report.consoleErrors.length ? report.consoleErrors.map((line) => `- ${line}`) : ["- none captured by runtime probe"]),
    "",
    "## Computer Use Integration Prep",
    "- browser-action-log.md can record manual/Computer Use browser steps.",
    "- runtime-observation-log.md can receive screenshot notes.",
    "- ui-issue-report.md can receive visual issue summaries.",
    "",
  ].join("\n");
}

async function collectProbe(targetUrl: string, mode: BrowserRuntimeReport["mode"]): Promise<{
  loadStatus: "loaded" | "failed";
  statusCode?: number;
  title?: string;
  html: string;
  domNodeCount: number;
  consoleErrors: string[];
}> {
  if (mode === "mock-safe") {
    const html = "<html><head><title>Mind Orbit Mock Safe</title></head><body><main>Mind Orbit loaded</main></body></html>";
    return { loadStatus: "loaded", statusCode: 200, title: "Mind Orbit Mock Safe", html, domNodeCount: 5, consoleErrors: [] };
  }
  if (mode === "mock-crash") {
    const html = "<html><body>ReferenceError: Cannot access 're' before initialization</body></html>";
    return { loadStatus: "failed", statusCode: 500, title: "Runtime Crash", html, domNodeCount: 3, consoleErrors: ["ReferenceError: Cannot access 're' before initialization"] };
  }

  try {
    const response = await fetch(targetUrl);
    const html = await response.text();
    return {
      loadStatus: response.ok ? "loaded" : "failed",
      statusCode: response.status,
      title: html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1],
      html,
      domNodeCount: (html.match(/<\w+/g) ?? []).length,
      consoleErrors: [],
    };
  } catch (error) {
    return {
      loadStatus: "failed",
      html: "",
      domNodeCount: 0,
      consoleErrors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runBrowserRuntimeAgent(process.cwd(), {
    mode: process.argv.includes("--mock-crash") ? "mock-crash" : "http-probe",
    targetUrl: process.env.AGENT_RUNTIME_URL,
  }).then((report) => {
    console.log(`Runtime vision: ${report.detection.risk}`);
    console.log(`Wrote: ${RUNTIME_VISION_PATH}`);
  });
}
