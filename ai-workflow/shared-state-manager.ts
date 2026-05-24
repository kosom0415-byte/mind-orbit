import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { firstMatch, parseQueueState, readOptional, writeText } from "./workflow-utils";

export interface SharedState {
  generatedAt: string;
  currentGoal: string;
  blocker: string;
  risk: string;
  approvalWaiting: number;
  executableTask: string;
  nextTask: string;
  recentFailure: string;
  recentStableCommit: string;
  productionSafe: string;
  humanRequired: boolean;
}

export function generateSharedState(projectRoot: string): SharedState {
  const generatedAt = new Date().toISOString();
  const workflow = readOptional(projectRoot, "agent-memory/workflow-state.md");
  const openQuestions = readOptional(projectRoot, "agent-memory/open-questions.md");
  const humanConfirmation = readOptional(projectRoot, "agent-memory/human-confirmation-required.md");
  const humanApproval = readOptional(projectRoot, "agent-memory/human-approval-required.md");
  const queueMarkdown = readOptional(projectRoot, "logs/task-queue.md");
  const engineer = readOptional(projectRoot, "logs/engineer-report-latest.md");
  const gpt = readOptional(projectRoot, "logs/gpt-pm-report-latest.md");
  const selfHeal = readOptional(projectRoot, "logs/self-heal-actions.md");
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const release = readOptional(projectRoot, "logs/release-candidates.md");
  const dashboard = readOptional(projectRoot, "dashboard/live-ai-organization-dashboard.md");
  const queue = parseQueueState(queueMarkdown);
  const waiting = queue.tasks.filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired).length;
  const executable = readOptional(projectRoot, "agent-memory/next-executable-task.md");
  const state: SharedState = {
    generatedAt,
    currentGoal: firstNonEmpty([
      firstMatch(workflow, /Current Goal\s*\n-\s*(.+)/i, ""),
      firstMatch(gpt, /Task:\s*(.+)/i, ""),
      "Maintain human-supervised GPT Codex automation loop.",
    ]),
    blocker: firstNonEmpty([
      firstMatch(openQuestions, /-\s*(.+)/, ""),
      firstMatch(humanConfirmation, /Reason:\s*(.+)/i, ""),
      waiting ? `${waiting} human approval item(s) waiting.` : "",
      "none",
    ]),
    risk: firstNonEmpty([
      firstMatch(release, /Decision:\s*(.+)/i, ""),
      firstMatch(runtime, /Risk:\s*(.+)/i, ""),
      "unknown",
    ]),
    approvalWaiting: waiting,
    executableTask: firstMatch(executable, /Task ID:\s*(.+)/i, "none"),
    nextTask: queue.nextAction ?? firstMatch(dashboard, /Next action:\s*(.+)/i, "Ask GPT PM for next safe task."),
    recentFailure: firstMatch(selfHeal, /##\s+([^\n]+)/, "none"),
    recentStableCommit: recentCommit(projectRoot),
    productionSafe: /Production deploy:\s+not automated|requires human approval/i.test(`${dashboard}\n${release}`) ? "human-gated" : "unknown",
    humanRequired: waiting > 0 || /Required:\s+yes/i.test(`${humanApproval}\n${humanConfirmation}`),
  };
  writeText(projectRoot, "agent-memory/shared-state.md", renderSharedState(state, engineer));
  writeText(projectRoot, "agent-memory/current-operating-context.md", renderOperatingContext(state, runtime, release));
  writeText(projectRoot, "agent-memory/current-priority.md", renderCurrentPriority(state));
  return state;
}

function renderSharedState(state: SharedState, engineer: string): string {
  return [
    "# Shared State",
    "",
    `Generated: ${state.generatedAt}`,
    "",
    `- Current goal: ${state.currentGoal}`,
    `- Current blocker: ${state.blocker}`,
    `- Current risk: ${state.risk}`,
    `- Approval waiting: ${state.approvalWaiting}`,
    `- Current executable task: ${state.executableTask}`,
    `- Next recommended task: ${state.nextTask}`,
    `- Recent failure: ${state.recentFailure}`,
    `- Recent stable commit: ${state.recentStableCommit}`,
    `- Production-safe state: ${state.productionSafe}`,
    `- Human intervention needed: ${state.humanRequired ? "yes" : "no"}`,
    "",
    "## Latest Engineer Signal",
    ...(engineer.trim() ? engineer.split("\n").slice(0, 16) : ["- none"]),
    "",
  ].join("\n");
}

function renderOperatingContext(state: SharedState, runtime: string, release: string): string {
  return [
    "# Current Operating Context",
    "",
    `Generated: ${state.generatedAt}`,
    "",
    "## Situation",
    `- Goal: ${state.currentGoal}`,
    `- Blocker: ${state.blocker}`,
    `- Production safety: ${state.productionSafe}`,
    "",
    "## Runtime",
    runtime.trim() ? runtime.split("\n").slice(0, 18).join("\n") : "- runtime report missing",
    "",
    "## Release",
    release.trim() ? release.split("\n").slice(0, 18).join("\n") : "- release report missing",
    "",
  ].join("\n");
}

function renderCurrentPriority(state: SharedState): string {
  return [
    "# Current Priority",
    "",
    `Generated: ${state.generatedAt}`,
    "",
    state.humanRequired
      ? "- Priority: wait for Human Vision Owner approval or scope decision."
      : state.executableTask !== "none"
        ? `- Priority: execute safe task ${state.executableTask} through central validation.`
        : "- Priority: ask GPT PM for the next LOW-risk task.",
    "",
  ].join("\n");
}

function firstNonEmpty(values: string[]): string {
  return values.find((value) => value.trim().length > 0) ?? "";
}

function recentCommit(projectRoot: string): string {
  try {
    return execSync("git log --oneline -1", { cwd: projectRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const state = generateSharedState(process.cwd());
  console.log("Shared state generated.");
  console.log(`Risk: ${state.risk}`);
  console.log("Wrote: agent-memory/shared-state.md");
}
