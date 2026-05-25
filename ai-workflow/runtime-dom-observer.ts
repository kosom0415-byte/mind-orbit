import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface DomObservation {
  generatedAt: string;
  nodeCount: number;
  hasRoot: boolean;
  hasBody: boolean;
  hasRuntimeErrorText: boolean;
  hasPageLoadFailureText: boolean;
  risk: "SAFE" | "WARNING" | "DANGEROUS";
  reasons: string[];
}

export function observeRuntimeDom(projectRoot: string, html = readOptional(projectRoot, "logs/runtime-vision.md")): DomObservation {
  const reasons: string[] = [];
  const reportedDomCount = Number(html.match(/DOM node count:\s*(\d+)/i)?.[1] ?? 0);
  const nodeCount = reportedDomCount || (html.match(/<\w+|\bbutton\b|\btextbox\b|\bgeneric\b/g) ?? []).length;
  const hasRoot = /main|__next|Mind Orbit/i.test(html);
  const hasBody = /body|main|Mind Orbit/i.test(html);
  const hasRuntimeErrorText = /Runtime crash:\s*yes|ReferenceError|TypeError|Application error|Cannot access|Cannot read/i.test(html);
  const hasPageLoadFailureText = /Blank screen:\s*yes|This page couldn't load:\s*yes|404: This page could not be found|white screen:\s*yes/i.test(html);
  if (!hasRoot) reasons.push("Root app signal missing.");
  if (!hasBody) reasons.push("Body/main content signal missing.");
  if (hasRuntimeErrorText) reasons.push("Runtime error text detected.");
  if (hasPageLoadFailureText) reasons.push("Page load failure text detected.");
  if (nodeCount < 5) reasons.push("Very low DOM/snapshot node count.");
  if (reasons.length === 0) reasons.push("DOM observation looks stable.");
  const risk: DomObservation["risk"] = hasRuntimeErrorText || hasPageLoadFailureText || nodeCount < 5 ? "DANGEROUS" : !hasRoot ? "WARNING" : "SAFE";
  const observation = { generatedAt: new Date().toISOString(), nodeCount, hasRoot, hasBody, hasRuntimeErrorText, hasPageLoadFailureText, risk, reasons };
  writeText(projectRoot, "logs/runtime-dom-observation.md", renderDomObservation(observation));
  return observation;
}

function renderDomObservation(observation: DomObservation): string {
  return [
    "# Runtime DOM Observation",
    "",
    `Generated: ${observation.generatedAt}`,
    `- Risk: ${observation.risk}`,
    `- Node count: ${observation.nodeCount}`,
    `- Root signal: ${observation.hasRoot ? "yes" : "no"}`,
    `- Body/main signal: ${observation.hasBody ? "yes" : "no"}`,
    `- Runtime error text: ${observation.hasRuntimeErrorText ? "yes" : "no"}`,
    `- Page load failure text: ${observation.hasPageLoadFailureText ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...observation.reasons.map((reason) => `- ${reason}`),
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const observation = observeRuntimeDom(process.cwd());
  console.log(`DOM observation: ${observation.risk}`);
}
