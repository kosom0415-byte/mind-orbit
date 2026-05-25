import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { updateAgentCommunicationBus } from "./agent-communication-bus";
import { syncAgentMemory } from "./agent-memory-sync";
import { runApiSafetyCheck } from "./api-safety-check";
import { runBrowserObserver } from "./browser-observer";
import { compressContextWindow } from "./context-window-compressor";
import { writeDecisionReasoningLog } from "./decision-reasoning-log";
import { runLiveCodexReadiness } from "./live-codex-readiness";
import { runLiveOpenAiReadiness } from "./live-openai-readiness";
import { generateRecoveryStrategy } from "./recovery-strategy-engine";
import { calculateReleaseRiskScore } from "./release-risk-score";
import { calculateRuntimeHealthScore } from "./runtime-health-score";
import { prioritizeQueueTasks } from "./task-priority-engine";
import { parseQueueState, readOptional, taskLine, writeText, type QueueTaskLike } from "./workflow-utils";

export interface AutonomousCycleResult {
  generatedAt: string;
  currentCycle: number;
  action: "waiting-human" | "safe-continue" | "dead-queue" | "dashboard-only";
  nextTask?: QueueTaskLike;
  runtimeRisk: string;
  releaseRisk: string;
  maturityLevel: string;
  reasons: string[];
}

const CYCLE_LOG = "logs/autonomous-cycle.md";
const HUMAN_LIVE = "dashboard/human-supervision-live.md";
const MOBILE_APPROVAL = "dashboard/mobile-approval-feed.md";
const MOBILE_COMMAND = "dashboard/mobile-command-center.md";
const QUICK_APPROVE = "dashboard/quick-approve.md";
const ONE_TAP = "dashboard/one-tap-next-action.md";
const SYSTEM_REPORT = "AUTONOMOUS_SYSTEM_REPORT.md";

export async function runAutonomousCycleManager(projectRoot: string): Promise<AutonomousCycleResult> {
  const generatedAt = new Date().toISOString();
  runScript(projectRoot, "ai-workflow/shared-state-manager.ts");
  runScript(projectRoot, "ai-workflow/task-bus.ts");
  const priority = prioritizeQueueTasks(projectRoot);
  const browser = runBrowserObserver(projectRoot);
  const runtimeHealth = calculateRuntimeHealthScore(projectRoot);
  const releaseRisk = calculateReleaseRiskScore(projectRoot);
  const context = compressContextWindow(projectRoot);
  const recovery = generateRecoveryStrategy(projectRoot);
  const api = runApiSafetyCheck(projectRoot);
  const openAi = runLiveOpenAiReadiness(projectRoot);
  const codex = runLiveCodexReadiness(projectRoot);
  updateAgentCommunicationBus(projectRoot);
  syncAgentMemory(projectRoot);
  writeDecisionReasoningLog(projectRoot);

  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const waiting = queue.tasks.filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired);
  const blocked = queue.tasks.filter((task) => task.queueStatus === "blocked" || task.status === "blocked");
  const safeTasks = queue.tasks.filter((task) => task.queueStatus === "pending" && !task.humanApprovalRequired && task.riskLevel !== "HIGH" && task.riskLevel !== "CRITICAL");
  const nextTask = safeTasks[0] ?? priority[0];
  const action = waiting.length > 0 ? "waiting-human" : nextTask ? "safe-continue" : blocked.length > 0 ? "dead-queue" : "dashboard-only";
  const maturityLevel = calculateMaturity({ hasRuntimeObservation: browser.risk !== "DANGEROUS", hasLiveReadiness: openAi.ready || codex.codexCliAvailable, hasApprovalGate: waiting.length >= 0 });
  const reasons = [
    waiting.length ? `${waiting.length} task(s) require human approval.` : "No human approval blocker detected.",
    nextTask ? `Next safe task candidate: ${taskLine(nextTask)}` : "No safe pending task candidate.",
    `Runtime health: ${runtimeHealth.status}.`,
    `Release risk: ${releaseRisk.level}.`,
    `API safety: ${api.safe ? "safe" : "blocked"}.`,
    `Context summary scanned ${context.logsScanned} log(s) and retained ${context.retainedMemories.length} memory file(s).`,
    `Recovery confidence: ${recovery.confidence}.`,
  ];
  const result: AutonomousCycleResult = {
    generatedAt,
    currentCycle: inferCycleNumber(projectRoot) + 1,
    action,
    nextTask,
    runtimeRisk: runtimeHealth.status,
    releaseRisk: releaseRisk.level,
    maturityLevel,
    reasons,
  };

  writeText(projectRoot, CYCLE_LOG, renderCycle(result, waiting, blocked, safeTasks));
  writeMobileDashboards(projectRoot, result, waiting, blocked, safeTasks);
  writeFinalSystemReport(projectRoot, result);
  runDashboardRefresh(projectRoot);
  writeFinalSystemReport(projectRoot, result);
  return result;
}

function runScript(projectRoot: string, script: string): void {
  execFileSync("node", ["--import", "tsx", script], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
  });
}

function runDashboardRefresh(projectRoot: string): void {
  for (const script of ["ai-workflow/organization-dashboard.ts", "ai-workflow/human-supervision-center.ts", "ai-workflow/mobile-report-generator.ts"]) {
    runScript(projectRoot, script);
  }
}

function inferCycleNumber(projectRoot: string): number {
  const previous = readOptional(projectRoot, CYCLE_LOG);
  const match = previous.match(/Current autonomous cycle:\s*(\d+)/i);
  return Number(match?.[1] ?? 0);
}

function calculateMaturity(input: { hasRuntimeObservation: boolean; hasLiveReadiness: boolean; hasApprovalGate: boolean }): string {
  let score = 3;
  if (input.hasRuntimeObservation) score += 1;
  if (input.hasApprovalGate) score += 1;
  if (input.hasLiveReadiness) score += 1;
  return `LEVEL ${Math.min(score, 6)} - ${score >= 6 ? "production-safe AI organization readiness" : "human-supervised autonomous engineering"}`;
}

function renderCycle(result: AutonomousCycleResult, waiting: QueueTaskLike[], blocked: QueueTaskLike[], safeTasks: QueueTaskLike[]): string {
  return [
    "# Autonomous Cycle Manager",
    "",
    `Generated: ${result.generatedAt}`,
    `- Current autonomous cycle: ${result.currentCycle}`,
    `- Action: ${result.action}`,
    `- Runtime risk: ${result.runtimeRisk}`,
    `- Release risk: ${result.releaseRisk}`,
    `- Autonomous maturity: ${result.maturityLevel}`,
    "",
    "## Next Safe Task",
    result.nextTask ? `- ${taskLine(result.nextTask)}` : "- none",
    "",
    "## Waiting Human",
    ...(waiting.length ? waiting.map((task) => `- ${taskLine(task)} :: ${task.blockedReason ?? "approval required"}`) : ["- none"]),
    "",
    "## Blocked / Dead Queue",
    ...(blocked.length ? blocked.map((task) => `- ${taskLine(task)} :: ${task.blockedReason ?? "blocked"}`) : ["- none"]),
    "",
    "## Safe Queue Candidates",
    ...(safeTasks.length ? safeTasks.map((task) => `- ${taskLine(task)}`) : ["- none"]),
    "",
    "## Reasons",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "## Safety",
    "- Production deploy: not executed",
    "- Rollback: not executed",
    "- env/API key modification: not performed",
    "- Dangerous commands: not executed",
    "",
  ].join("\n");
}

function writeMobileDashboards(projectRoot: string, result: AutonomousCycleResult, waiting: QueueTaskLike[], blocked: QueueTaskLike[], safeTasks: QueueTaskLike[]): void {
  const approvalBlock = waiting[0]
    ? [
        "```text",
        `approvalId: ${waiting[0].approvalId ?? `approval-${waiting[0].id}`}`,
        `taskId: ${waiting[0].id}`,
        "decision: approve",
        "approvedScope: task-only",
        "reason: Human Vision Owner approves this exact scoped task.",
        "requestedChanges:",
        "approvedBy: Human Vision Owner",
        `timestamp: ${new Date().toISOString()}`,
        "```",
      ].join("\n")
    : "- No approval needed right now.";
  const common = [
    `Generated: ${result.generatedAt}`,
    `- Cycle: ${result.currentCycle}`,
    `- Status: ${result.action}`,
    `- Runtime risk: ${result.runtimeRisk}`,
    `- Release risk: ${result.releaseRisk}`,
    `- Maturity: ${result.maturityLevel}`,
    "",
  ];
  writeText(projectRoot, HUMAN_LIVE, [
    "# Human Supervision Live",
    "",
    ...common,
    "## Waiting Approvals",
    ...(waiting.length ? waiting.map((task) => `- ${taskLine(task)} :: ${task.blockedReason ?? "approval required"}`) : ["- none"]),
    "",
    "## AI Can Handle",
    ...(safeTasks.length ? safeTasks.map((task) => `- ${taskLine(task)}`) : ["- none"]),
    "",
    "## Blocked",
    ...(blocked.length ? blocked.map((task) => `- ${taskLine(task)}`) : ["- none"]),
    "",
  ].join("\n"));
  writeText(projectRoot, MOBILE_APPROVAL, [
    "# Mobile Approval Feed",
    "",
    ...common,
    "## Next Suggested Approval",
    waiting[0] ? `- ${taskLine(waiting[0])}` : "- none",
    "",
    "## Copy This Response",
    approvalBlock,
    "",
  ].join("\n"));
  writeText(projectRoot, MOBILE_COMMAND, [
    "# Mobile Command Center",
    "",
    ...common,
    "## What You Can Do",
    "- approve: copy a block from `dashboard/mobile-approval-feed.md` into `agent-memory/human-response.md`",
    "- reject: set `decision: reject` in the response block",
    "- modify-scope: set `decision: modify-scope` and add requestedChanges",
    "- ask-gpt: set `decision: ask-gpt`",
    "- continue workflow: run `npm run agent:daemon -- --once` or `npm run agent:continue` on the Mac",
    "",
  ].join("\n"));
  writeText(projectRoot, QUICK_APPROVE, [
    "# Quick Approve",
    "",
    "Use only when the task scope is exactly understood and acceptable.",
    "",
    approvalBlock,
    "",
  ].join("\n"));
  writeText(projectRoot, ONE_TAP, [
    "# One Tap Next Action",
    "",
    waiting.length ? "- Next action: Human approval required." : safeTasks.length ? "- Next action: Continue safe workflow." : "- Next action: Ask GPT PM for a new safe task.",
    result.nextTask ? `- Next task: ${taskLine(result.nextTask)}` : "- Next task: none",
    "",
  ].join("\n"));
}

function writeFinalSystemReport(projectRoot: string, result: AutonomousCycleResult): void {
  const shared = readOptional(projectRoot, "agent-memory/shared-state.md");
  const queue = readOptional(projectRoot, "logs/task-queue.md");
  const runtime = readOptional(projectRoot, "dashboard/runtime-health-dashboard.md");
  const release = readOptional(projectRoot, "logs/release-risk-score.md");
  const recovery = readOptional(projectRoot, "logs/recovery-strategy.md");
  const mobile = readOptional(projectRoot, MOBILE_COMMAND);
  const report = [
    "# Autonomous System Report",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## 1. Current Structure",
    "- GPT PM, Codex Engineer, queue, bridge, shared state, approval, daemon, runtime observation, self-heal, release readiness, and mobile dashboards are connected through local markdown/state files.",
    "",
    "## 2. GPT ↔ Codex Flow",
    "- GPT PM report and queue state feed direct bridge handoff files.",
    "- Codex consumes only `agent-memory/next-executable-task.md` when approval gate allows it.",
    "- Reports feed back into shared state and next questions.",
    "",
    "## 3. Human Approval Flow",
    "- HIGH/CRITICAL or production/env/rollback/destructive work is routed to human approval files.",
    "- Human writes approve/reject/modify-scope/ask-gpt to `agent-memory/human-response.md`.",
    "- Approval parser returns approved tasks to pending or cancels/re-scopes them.",
    "",
    "## 4. Queue Lifecycle",
    "- pending -> running -> validation/report -> completed, or waiting-human/blocked when risk is high.",
    "",
    "## 5. Runtime Observation Structure",
    runtime.trim() ? runtime.split("\n").slice(0, 24).join("\n") : "- Runtime observation report missing.",
    "",
    "## 6. Self-Heal Structure",
    recovery.trim() ? recovery.split("\n").slice(0, 28).join("\n") : "- Recovery strategy report missing.",
    "",
    "## 7. Browser Observation Structure",
    "- `browser-observer.ts` combines DOM signals, screenshot-hash comparison, and UI regression heuristics into runtime observation logs.",
    "",
    "## 8. Mobile Supervision Structure",
    mobile.trim() ? mobile.split("\n").slice(0, 32).join("\n") : "- Mobile command center missing.",
    "",
    "## 9. Release Safety Structure",
    release.trim() ? release.split("\n").slice(0, 24).join("\n") : "- Release risk report missing.",
    "",
    "## 10. Current Maturity Level",
    `- ${result.maturityLevel}`,
    "",
    "## 11. Currently Automatable",
    "- Local state refresh, queue prioritization, safe handoff generation, dry-run bridge, runtime observation, release-risk scoring, dashboard/report generation, and approval response application.",
    "",
    "## 12. Human Intervention Required",
    "- Production deploy, rollback, env/API key, billing/account, product direction, design direction, and HIGH/CRITICAL approval.",
    "",
    "## 13. Top System Risks",
    "- Approval file format drift",
    "- Runtime probe relying on localhost availability",
    "- Markdown queue corruption",
    "- Over-broad task text causing false HIGH risk",
    "- Missing browser visual ground truth",
    "- Live API cost and rate limits",
    "- Codex CLI permissions drift",
    "- Old logs creating context noise",
    "- Human approval ambiguity",
    "- Production confidence without browser validation",
    "",
    "## 14. OpenAI API Connection Needs",
    "- Human-managed environment key, explicit live flag, budget approval, model choice, and monitoring.",
    "",
    "## 15. Codex Live Bridge Needs",
    "- Human approval for live execution, Codex CLI availability, safe task candidate, clean runtime, and no waiting-human tasks.",
    "",
    "## 16. Biggest Bottleneck",
    "- Reliable real browser visual validation and human approval ergonomics remain the main bottlenecks.",
    "",
    "## 17. Roadmap",
    "- Add real screenshot capture integration, harden queue state schema, add approval response linting, then pilot live GPT-only planning.",
    "",
    "## 18. Limits",
    "- This is still local, file-based orchestration. It does not independently deploy, rollback, change secrets, or make product decisions.",
    "",
    "## 19. AI-Native Company OS Evaluation",
    "- Strong MVP for human-supervised autonomous engineering operations, with good safety posture and clear manual boundaries.",
    "",
    "## 20. Actual Capability Today",
    "- It can repeatedly select safe work, refresh state, report health, route approvals, and prepare Codex handoffs. It cannot safely perform production changes without humans.",
    "",
    "## Shared State Excerpt",
    shared.trim() ? shared.split("\n").slice(0, 18).join("\n") : "- missing",
    "",
    "## Queue Excerpt",
    queue.trim() ? queue.split("\n").slice(0, 18).join("\n") : "- missing",
    "",
  ].join("\n");
  writeText(projectRoot, SYSTEM_REPORT, report);
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runAutonomousCycleManager(process.cwd()).then((result) => {
    console.log(`Autonomous cycle: ${result.action}`);
    console.log(`Maturity: ${result.maturityLevel}`);
    console.log(`Wrote: ${CYCLE_LOG}, ${SYSTEM_REPORT}`);
  });
}
