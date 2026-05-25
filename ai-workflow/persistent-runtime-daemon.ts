import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { firstMatch, parseQueueState, readOptional, writeText } from "./workflow-utils";

interface DaemonOptions {
  once: boolean;
  intervalSeconds: number;
  maxCycles: number;
  liveGpt: boolean;
  liveCodex: boolean;
  dryRun: boolean;
}

interface DaemonCycle {
  cycle: number;
  generatedAt: string;
  action: "dashboard-only" | "approve" | "continue" | "idle" | "blocked";
  waitingHuman: boolean;
  safeTaskAvailable: boolean;
  approvalResponsePending: boolean;
  runtimeStatus: string;
  releaseStatus: string;
  liveGpt: boolean;
  liveCodex: boolean;
  summary: string;
}

const DAEMON_EVENTS_PATH = "logs/daemon-events.md";
const DAEMON_STATUS_PATH = "dashboard/daemon-status.md";
const DAEMON_STATE_PATH = "agent-memory/daemon-state.md";
const MIN_DEBOUNCE_MS = 5_000;

export async function runPersistentRuntimeDaemon(projectRoot: string, options = parseArgs(process.argv.slice(2))): Promise<DaemonCycle[]> {
  const cycles: DaemonCycle[] = [];
  let lastRunAt = 0;

  for (let cycle = 1; cycle <= options.maxCycles; cycle += 1) {
    const now = Date.now();
    if (now - lastRunAt < MIN_DEBOUNCE_MS) {
      await sleep(MIN_DEBOUNCE_MS - (now - lastRunAt));
    }
    lastRunAt = Date.now();

    const result = runDaemonCycle(projectRoot, cycle, options);
    cycles.push(result);
    appendDaemonReports(projectRoot, cycles, options);

    if (options.once || cycle >= options.maxCycles) break;
    await sleep(options.intervalSeconds * 1000);
  }

  return cycles;
}

function runDaemonCycle(projectRoot: string, cycle: number, options: DaemonOptions): DaemonCycle {
  const generatedAt = new Date().toISOString();
  runScript(projectRoot, "ai-workflow/shared-state-manager.ts");
  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const humanResponse = readOptional(projectRoot, "agent-memory/human-response.md");
  const approvalResponsePending = hasPendingHumanResponse(humanResponse);
  const waitingHuman = queue.tasks.some((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired);
  const safeTaskAvailable = queue.tasks.some((task) => task.queueStatus === "pending" && !task.humanApprovalRequired && task.riskLevel !== "HIGH" && task.riskLevel !== "CRITICAL");
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const release = readOptional(projectRoot, "logs/release-candidates.md");
  const runtimeStatus = firstMatch(runtime, /Risk:\s*(.+)/i, "unknown");
  const releaseStatus = firstMatch(release, /Decision:\s*(.+)/i, "unknown");

  if (options.liveCodex && waitingHuman) {
    runDashboardOnly(projectRoot);
    return cycleResult(cycle, generatedAt, "blocked", waitingHuman, safeTaskAvailable, approvalResponsePending, runtimeStatus, releaseStatus, options, "live-codex requested but waiting-human is present; blocked.");
  }

  if (approvalResponsePending) {
    runScript(projectRoot, "ai-workflow/apply-human-approval.ts");
    runDashboardOnly(projectRoot);
    return cycleResult(cycle, generatedAt, "approve", waitingHuman, safeTaskAvailable, approvalResponsePending, runtimeStatus, releaseStatus, options, "Applied pending human approval response, then refreshed dashboards.");
  }

  if (waitingHuman) {
    runDashboardOnly(projectRoot);
    return cycleResult(cycle, generatedAt, "dashboard-only", waitingHuman, safeTaskAvailable, approvalResponsePending, runtimeStatus, releaseStatus, options, "Waiting-human detected; daemon refreshed dashboards only.");
  }

  if (safeTaskAvailable) {
    runContinue(projectRoot, options);
    return cycleResult(cycle, generatedAt, "continue", waitingHuman, safeTaskAvailable, approvalResponsePending, runtimeStatus, releaseStatus, options, "Safe task available; ran continue workflow.");
  }

  runDashboardOnly(projectRoot);
  return cycleResult(cycle, generatedAt, "idle", waitingHuman, safeTaskAvailable, approvalResponsePending, runtimeStatus, releaseStatus, options, "No safe task or approval response; refreshed dashboards.");
}

function runContinue(projectRoot: string, options: DaemonOptions): void {
  if (!options.liveGpt && !options.liveCodex) {
    runScript(projectRoot, "ai-workflow/continue-workflow.ts");
    return;
  }

  runScript(projectRoot, "ai-workflow/continue-workflow.ts");
  const liveArgs = ["--import", "tsx", "ai-workflow/real-bridge-runtime.ts"];
  if (options.liveGpt) liveArgs.push("--live-gpt");
  if (options.liveCodex) liveArgs.push("--live-codex");
  execFileSync("node", liveArgs, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
}

function runDashboardOnly(projectRoot: string): void {
  for (const script of [
    "ai-workflow/autonomous-cycle-manager.ts",
    "ai-workflow/live-readiness-check.ts",
    "ai-workflow/organization-dashboard.ts",
    "ai-workflow/human-supervision-center.ts",
    "ai-workflow/mobile-report-generator.ts",
  ]) {
    runScript(projectRoot, script);
  }
}

function runScript(projectRoot: string, script: string): void {
  execFileSync("node", ["--import", "tsx", script], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
  });
}

function appendDaemonReports(projectRoot: string, cycles: DaemonCycle[], options: DaemonOptions): void {
  const latest = cycles.at(-1);
  const events = [
    "# Persistent Runtime Daemon Events",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Options",
    `- dry-run: ${options.dryRun ? "yes" : "no"}`,
    `- live-gpt: ${options.liveGpt ? "yes" : "no"}`,
    `- live-codex: ${options.liveCodex ? "yes" : "no"}`,
    `- interval seconds: ${options.intervalSeconds}`,
    `- max cycles: ${options.maxCycles}`,
    "",
    "## Events",
    ...cycles.map((cycle) => `- ${cycle.generatedAt} | cycle ${cycle.cycle} | ${cycle.action} | ${cycle.summary}`),
    "",
    "## Safety",
    "- Production deploy: forbidden",
    "- Rollback: forbidden",
    "- env/API key access: forbidden",
    "- Destructive command: forbidden",
    "- Git force push: forbidden",
    "- HIGH/CRITICAL tasks remain waiting-human without approval.",
    "",
  ].join("\n");
  const status = renderDaemonStatus(latest, options);
  writeText(projectRoot, DAEMON_EVENTS_PATH, events);
  writeText(projectRoot, DAEMON_STATUS_PATH, status);
  writeText(projectRoot, DAEMON_STATE_PATH, status);
}

function renderDaemonStatus(cycle: DaemonCycle | undefined, options: DaemonOptions): string {
  if (!cycle) return "# Daemon Status\n\n- No cycle has run.\n";
  return [
    "# Daemon Status",
    "",
    `Generated: ${cycle.generatedAt}`,
    "",
    `- Last cycle: ${cycle.cycle}`,
    `- Last action: ${cycle.action}`,
    `- Summary: ${cycle.summary}`,
    `- Waiting human: ${cycle.waitingHuman ? "yes" : "no"}`,
    `- Safe task available: ${cycle.safeTaskAvailable ? "yes" : "no"}`,
    `- Approval response pending: ${cycle.approvalResponsePending ? "yes" : "no"}`,
    `- Runtime status: ${cycle.runtimeStatus}`,
    `- Release status: ${cycle.releaseStatus}`,
    `- Dry-run: ${options.dryRun ? "yes" : "no"}`,
    `- Live GPT: ${cycle.liveGpt ? "yes" : "no"}`,
    `- Live Codex: ${cycle.liveCodex ? "yes" : "no"}`,
    "",
    "## Mobile Guidance",
    cycle.waitingHuman
      ? "- Human Vision Owner should write approve/reject/modify-scope/ask-gpt in `agent-memory/human-response.md`."
      : "- Run daemon again or keep it alive with `npm run agent:daemon -- --interval=60 --max-cycles=10`.",
    "",
  ].join("\n");
}

function cycleResult(
  cycle: number,
  generatedAt: string,
  action: DaemonCycle["action"],
  waitingHuman: boolean,
  safeTaskAvailable: boolean,
  approvalResponsePending: boolean,
  runtimeStatus: string,
  releaseStatus: string,
  options: DaemonOptions,
  summary: string,
): DaemonCycle {
  return {
    cycle,
    generatedAt,
    action,
    waitingHuman,
    safeTaskAvailable,
    approvalResponsePending,
    runtimeStatus,
    releaseStatus,
    liveGpt: options.liveGpt,
    liveCodex: options.liveCodex,
    summary,
  };
}

function hasPendingHumanResponse(markdown: string): boolean {
  if (!markdown.trim()) return false;
  if (/Pending Response\s*\n-\s*None/i.test(markdown)) return false;
  return /decision\s*:\s*(approve|reject|modify-scope|ask-gpt)/i.test(markdown);
}

function parseArgs(args: string[]): DaemonOptions {
  const intervalArg = args.find((arg) => arg.startsWith("--interval="));
  const maxCyclesArg = args.find((arg) => arg.startsWith("--max-cycles="));
  const once = args.includes("--once");
  const liveGpt = args.includes("--live-gpt");
  const liveCodex = args.includes("--live-codex");
  const intervalSeconds = clampNumber(Number(intervalArg?.split("=")[1] ?? 60), 5, 3600);
  const maxCycles = once ? 1 : clampNumber(Number(maxCyclesArg?.split("=")[1] ?? 10), 1, 10_000);
  return {
    once,
    intervalSeconds,
    maxCycles,
    liveGpt,
    liveCodex,
    dryRun: !liveGpt && !liveCodex,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runPersistentRuntimeDaemon(process.cwd()).then((cycles) => {
    const latest = cycles.at(-1);
    console.log("Persistent runtime daemon complete.");
    console.log(`Cycles: ${cycles.length}`);
    console.log(`Last action: ${latest?.action ?? "none"}`);
    console.log(`Wrote: ${DAEMON_EVENTS_PATH}`);
  });
}
