import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export interface RuntimeApprovalGateResult {
  generatedAt: string;
  risk: "SAFE" | "WARNING" | "HIGH" | "CRITICAL";
  action: "auto-continue" | "ask-gpt" | "waiting-human";
  reason: string;
  releaseImpact: string;
}

const OUTPUT = "dashboard/live-approval-status.md";

export function runApprovalRuntimeGate(projectRoot: string): RuntimeApprovalGateResult {
  const evidence = [
    readOptional(projectRoot, "logs/browser-validation-report.md"),
    readOptional(projectRoot, "logs/runtime-memory-report.md"),
    readOptional(projectRoot, "logs/self-heal-runtime-report.md"),
    readOptional(projectRoot, "logs/release-risk-score.md"),
  ].join("\n");
  const critical = /Risk:\s*DANGEROUS|Issue class:\s*(runtime|memory)|Level:\s*CRITICAL/i.test(evidence);
  const warning = /Risk:\s*WARNING|Render loop risk:\s*WARNING|Level:\s*(MEDIUM|HIGH)/i.test(evidence);
  const risk: RuntimeApprovalGateResult["risk"] = critical ? "CRITICAL" : warning ? "WARNING" : "SAFE";
  const action: RuntimeApprovalGateResult["action"] = risk === "SAFE" ? "auto-continue" : risk === "WARNING" ? "ask-gpt" : "waiting-human";
  const result = {
    generatedAt: new Date().toISOString(),
    risk,
    action,
    reason:
      action === "auto-continue"
        ? "Runtime/product task evidence is safe enough for dev-loop continuation."
        : action === "ask-gpt"
          ? "Warning-level runtime/release evidence should be clarified by GPT PM before another product task."
          : "High/critical evidence requires Human Vision Owner approval.",
    releaseImpact: risk === "SAFE" ? "No release blocker from runtime gate; production still manual." : "Release remains blocked until risk is cleared.",
  };
  writeText(projectRoot, OUTPUT, renderReport(result));
  return result;
}

function renderReport(result: RuntimeApprovalGateResult): string {
  return [
    "# Live Approval Status",
    "",
    `Generated: ${result.generatedAt}`,
    `- Risk: ${result.risk}`,
    `- Action: ${result.action}`,
    `- Why approval required: ${result.action === "waiting-human" ? result.reason : "not required"}`,
    `- Suggested action: ${result.action}`,
    `- Release impact: ${result.releaseImpact}`,
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const result = runApprovalRuntimeGate(process.cwd());
  console.log(`Approval runtime gate: ${result.action}`);
}
