import { pathToFileURL } from "node:url";
import { observeRuntimeDom } from "./runtime-dom-observer";
import { runScreenshotDiff } from "./screenshot-diff-engine";
import { detectUiRegression } from "./ui-regression-detector";
import { readOptional, writeText } from "./workflow-utils";

export interface BrowserObservation {
  generatedAt: string;
  risk: "SAFE" | "WARNING" | "DANGEROUS";
  summary: string;
}

export function runBrowserObserver(projectRoot: string): BrowserObservation {
  const dom = observeRuntimeDom(projectRoot);
  const diff = runScreenshotDiff(projectRoot);
  const regression = detectUiRegression(projectRoot);
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const dangerous = dom.risk === "DANGEROUS" || regression.risk === "DANGEROUS" || /This page couldn't load/i.test(runtime);
  const warning = diff.layoutShiftRisk !== "LOW" || regression.risk === "WARNING";
  const observation: BrowserObservation = {
    generatedAt: new Date().toISOString(),
    risk: dangerous ? "DANGEROUS" : warning ? "WARNING" : "SAFE",
    summary: dangerous ? "Browser observation found runtime/UI danger." : warning ? "Browser observation found warning-level UI drift." : "Browser observation looks stable.",
  };
  writeReports(projectRoot, observation);
  return observation;
}

function writeReports(projectRoot: string, observation: BrowserObservation): void {
  const markdown = [
    "# Runtime Browser Observation",
    "",
    `Generated: ${observation.generatedAt}`,
    `- Risk: ${observation.risk}`,
    `- Summary: ${observation.summary}`,
    "",
    "## Detectors",
    "- Runtime DOM observer: logs/runtime-dom-observation.md",
    "- Screenshot diff engine: logs/screenshot-diff.md",
    "- UI regression detector: logs/ui-regression.md",
    "",
    "## Computer Use Integration",
    "- Future Computer Use screenshots can be appended to logs/runtime-observation-log.md.",
    "- This observer consumes markdown/snapshot evidence and keeps secrets out of logs.",
    "",
  ].join("\n");
  writeText(projectRoot, "logs/runtime-observation.md", markdown);
  writeText(projectRoot, "dashboard/runtime-health-dashboard.md", markdown);
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const observation = runBrowserObserver(process.cwd());
  console.log(`Browser observation: ${observation.risk}`);
}
