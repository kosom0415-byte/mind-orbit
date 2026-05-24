import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { writeText } from "./workflow-utils";

const STEPS = [
  ["agent:state", "ai-workflow/shared-state-manager.ts"],
  ["agent:approve", "ai-workflow/apply-human-approval.ts"],
  ["agent:task-bus", "ai-workflow/task-bus.ts"],
  ["agent:direct-bridge", "ai-workflow/direct-bridge.ts"],
  ["agent:real-bridge", "ai-workflow/real-bridge-runtime.ts"],
  ["agent:live-readiness", "ai-workflow/live-readiness-check.ts"],
  ["agent:queue", "ai-workflow/task-queue.ts"],
  ["agent:bridge", "ai-workflow/gpt-codex-bridge.ts"],
  ["agent:report", "ai-workflow/report-generator.ts"],
  ["agent:dashboard", "ai-workflow/organization-dashboard.ts"],
  ["agent:human-center", "ai-workflow/human-supervision-center.ts"],
  ["agent:mobile", "ai-workflow/mobile-report-generator.ts"],
] as const;

const CONTINUE_LOG = "logs/continue-workflow.md";

export function continueWorkflow(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const results = STEPS.map(([name, script]) => runStep(projectRoot, name, script));
  const markdown = [
    "# Continue Workflow",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Steps",
    ...results.map((result) => `- ${result.name}: ${result.ok ? "ok" : "failed"}${result.summary ? ` - ${result.summary}` : ""}`),
    "",
    "## Safety",
    "- Dangerous work was not executed.",
    "- Production deploy was not executed.",
    "- Git push automation was not executed.",
    "- Live GPT/Codex was not executed by `agent:continue`.",
    "- Approval-required tasks remain waiting-human.",
    "",
  ].join("\n");
  writeText(projectRoot, CONTINUE_LOG, markdown);
  return markdown;
}

function runStep(projectRoot: string, name: string, script: string): { name: string; ok: boolean; summary: string } {
  try {
    const output = execFileSync("node", ["--import", "tsx", script], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    return { name, ok: true, summary: output.split("\n").filter(Boolean).slice(-1)[0] ?? "done" };
  } catch (error) {
    return { name, ok: false, summary: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180) };
  }
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  continueWorkflow(process.cwd());
  console.log(`Continue workflow complete: ${CONTINUE_LOG}`);
}
