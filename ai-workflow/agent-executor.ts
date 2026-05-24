import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { findCapableAgents, getAgent, type AgentId, type RuntimeAgent } from "./agent-registry";
import { assessTaskRisk, enforceApprovalGate, type ApprovalGateTask, type RiskLevel } from "./approval-gate";
import { createMessage, writeMessages, type RuntimeMessage } from "./message-bus";
import type { BugSeverity } from "./orchestrator";
import { transitionTask, writeStateMachineLog, type StateTransition } from "./task-state-machine";

export type ReviewScore = "SAFE" | "WARNING" | "DANGEROUS";

interface RuntimeExecutionResult {
  taskId: string;
  assignedAgent?: AgentId;
  riskLevel: RiskLevel;
  reviewScore: ReviewScore;
  status: "completed" | "blocked" | "self-healing" | "review";
  messages: RuntimeMessage[];
  transitions: StateTransition[];
  releaseManagerSummary: string;
}

const RUNTIME_LOG_PATH = "logs/agent-runtime-execution.md";

export function runMultiAgentSimulation(projectRoot: string): RuntimeExecutionResult {
  ensureLogDirectory(projectRoot);
  const task = createSimulationTask();
  const risk = assessTaskRisk(task);
  const gate = enforceApprovalGate(projectRoot, task);
  const transitions: StateTransition[] = [];
  const messages: RuntimeMessage[] = [];

  transitions.push(transitionTask(task.id, "queued", "assigned", "Runtime simulation assigned task to capable agent."));
  const agent = assignAgent(task, risk.riskLevel);
  messages.push(
    createMessage({
      from: "GPT_PM_AGENT",
      to: agent.id,
      taskId: task.id,
      severity: severityFromRisk(risk.riskLevel),
      type: "TASK_ASSIGN",
      summary: `Assign ${task.title} to ${agent.id}`,
      payload: { riskLevel: risk.riskLevel, reasons: risk.reasons },
      requiresApproval: risk.approvalRequired,
    }),
  );

  if (gate.action !== "allow") {
    transitions.push(transitionTask(task.id, "assigned", "waiting-human", gate.message));
    messages.push(
      createMessage({
        from: agent.id,
        to: "GPT_PM_AGENT",
        taskId: task.id,
        severity: severityFromRisk(risk.riskLevel),
        type: "APPROVAL_REQUEST",
        summary: gate.task.blockedReason ?? "Approval gate blocked task.",
        payload: { riskLevel: risk.riskLevel, approvalStatus: gate.task.approvalStatus },
        requiresApproval: true,
      }),
    );
    writeRuntimeOutputs(projectRoot, {
      taskId: task.id,
      assignedAgent: agent.id,
      riskLevel: risk.riskLevel,
      reviewScore: "DANGEROUS",
      status: "blocked",
      messages,
      transitions,
      releaseManagerSummary: "Release Manager: not safe to release; human approval required.",
    });
    return {
      taskId: task.id,
      assignedAgent: agent.id,
      riskLevel: risk.riskLevel,
      reviewScore: "DANGEROUS",
      status: "blocked",
      messages,
      transitions,
      releaseManagerSummary: "Release Manager: not safe to release; human approval required.",
    };
  }

  transitions.push(transitionTask(task.id, "assigned", "running", "Approval gate allowed task."));
  const review = runClaudeReview(task);
  transitions.push(transitionTask(task.id, "running", "review", `Claude review score: ${review.score}`));
  messages.push(
    createMessage({
      from: "CODEX_ENGINEER_AGENT",
      to: "CLAUDE_REVIEWER_AGENT",
      taskId: task.id,
      severity: severityFromRisk(risk.riskLevel),
      type: "REVIEW_REQUEST",
      summary: "Request runtime risk review before completion.",
      payload: review,
      requiresApproval: review.score === "DANGEROUS",
    }),
  );

  if (review.score === "DANGEROUS") {
    transitions.push(transitionTask(task.id, "review", "self-healing", "Dangerous review score triggered self-heal."));
    messages.push(
      createMessage({
        from: "CLAUDE_REVIEWER_AGENT",
        to: "SELF_HEAL_AGENT",
        taskId: task.id,
        severity: "s1-critical",
        type: "SELF_HEAL_TRIGGER",
        summary: "Dangerous runtime risk requires self-heal analysis.",
        payload: review,
        requiresApproval: true,
      }),
    );
    writeRuntimeOutputs(projectRoot, {
      taskId: task.id,
      assignedAgent: agent.id,
      riskLevel: risk.riskLevel,
      reviewScore: review.score,
      status: "self-healing",
      messages,
      transitions,
      releaseManagerSummary: "Release Manager: blocked; self-heal and human review required.",
    });
    return {
      taskId: task.id,
      assignedAgent: agent.id,
      riskLevel: risk.riskLevel,
      reviewScore: review.score,
      status: "self-healing",
      messages,
      transitions,
      releaseManagerSummary: "Release Manager: blocked; self-heal and human review required.",
    };
  }

  transitions.push(transitionTask(task.id, "review", "completed", "Mock runtime task completed safely."));
  messages.push(
    createMessage({
      from: "RELEASE_MANAGER_AGENT",
      to: "GPT_PM_AGENT",
      taskId: task.id,
      severity: severityFromRisk(risk.riskLevel),
      type: "RELEASE_READY",
      summary: "Mock task is safe for dev branch report only; no production deploy.",
      payload: { productionDeploy: false, rollbackExecuted: false },
      requiresApproval: false,
    }),
  );

  const result: RuntimeExecutionResult = {
    taskId: task.id,
    assignedAgent: agent.id,
    riskLevel: risk.riskLevel,
    reviewScore: review.score,
    status: "completed",
    messages,
    transitions,
    releaseManagerSummary: "Release Manager: dev-only completion recorded; production deploy remains disabled.",
  };
  addBlockedAndSelfHealSimulation(projectRoot, messages, transitions);
  writeRuntimeOutputs(projectRoot, result);
  return result;
}

function createSimulationTask(): ApprovalGateTask {
  const now = new Date().toISOString();
  return {
    id: "runtime-sim-doc-task",
    title: "Document multi-agent runtime architecture",
    goal: "Create a dev-only runtime simulation for GPT Codex orchestration.",
    status: "queued",
    owner: "codex-engineer",
    priority: "normal",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: now,
    updatedAt: now,
    context: "Documentation-only local runtime simulation for markdown notes.",
  };
}

function addBlockedAndSelfHealSimulation(projectRoot: string, messages: RuntimeMessage[], transitions: StateTransition[]): void {
  const riskyTask: ApprovalGateTask = {
    ...createSimulationTask(),
    id: "runtime-sim-high-risk-ui",
    title: "Rewrite camera depth animation system",
    goal: "Modify app/page.tsx, NodeLayer, EdgeLayer, and state architecture for cinematic motion.",
  };
  const risk = assessTaskRisk(riskyTask);
  const gate = enforceApprovalGate(projectRoot, riskyTask);
  transitions.push(transitionTask(riskyTask.id, "queued", "waiting-human", gate.task.blockedReason ?? "High-risk task requires approval."));
  messages.push(
    createMessage({
      from: "CODEX_ENGINEER_AGENT",
      to: "GPT_PM_AGENT",
      taskId: riskyTask.id,
      severity: severityFromRisk(risk.riskLevel),
      type: "BLOCKED_WARNING",
      summary: gate.task.blockedReason ?? "High-risk task blocked by approval gate.",
      payload: { riskLevel: risk.riskLevel, reasons: risk.reasons },
      requiresApproval: true,
    }),
    createMessage({
      from: "CODEX_ENGINEER_AGENT",
      to: "CLAUDE_REVIEWER_AGENT",
      taskId: riskyTask.id,
      severity: severityFromRisk(risk.riskLevel),
      type: "REVIEW_REQUEST",
      summary: "Request review for blocked high-risk camera/depth task.",
      payload: runClaudeReview(riskyTask),
      requiresApproval: true,
    }),
    createMessage({
      from: "CLAUDE_REVIEWER_AGENT",
      to: "SELF_HEAL_AGENT",
      taskId: riskyTask.id,
      severity: "s1-critical",
      type: "SELF_HEAL_TRIGGER",
      summary: "Mock dangerous runtime pattern should trigger self-heal planning, not direct execution.",
      payload: { reason: "camera/depth/app shell risk" },
      requiresApproval: true,
    }),
  );
}

function assignAgent(task: ApprovalGateTask, riskLevel: RiskLevel): RuntimeAgent {
  const candidates = findCapableAgents("code_editing");
  const codex = candidates.find((agent) => agent.id === "CODEX_ENGINEER_AGENT") ?? getAgent("CODEX_ENGINEER_AGENT");
  if ((riskLevel === "HIGH" || riskLevel === "CRITICAL") && !codex.canEditCoreRuntime) {
    return getAgent("GPT_PM_AGENT");
  }
  return codex;
}

function runClaudeReview(task: ApprovalGateTask): { score: ReviewScore; findings: string[] } {
  const text = `${task.title} ${task.goal} ${task.context ?? ""}`.toLowerCase();
  const findings: string[] = [];
  if (/too many re-renders|maximum update depth|setstate.*render/i.test(text)) findings.push("Excessive rerender risk.");
  if (/hydration|localstorage|window\./i.test(text)) findings.push("Hydration mismatch risk.");
  if (/circular|import cycle/i.test(text)) findings.push("Circular dependency risk.");
  if (/camera|depth|perspective|animation/i.test(text)) findings.push("Camera/depth instability risk.");
  if (/app\/page\.tsx|globals\.css|provider|hook/i.test(text)) findings.push("High-impact runtime file risk.");

  const score: ReviewScore = findings.length >= 2 ? "DANGEROUS" : findings.length === 1 ? "WARNING" : "SAFE";
  return { score, findings: findings.length ? findings : ["No React runtime anti-pattern detected in mock review."] };
}

function severityFromRisk(riskLevel: RiskLevel): BugSeverity {
  if (riskLevel === "CRITICAL") return "s0-production-down";
  if (riskLevel === "HIGH") return "s1-critical";
  if (riskLevel === "MEDIUM") return "s2-major";
  return "s3-minor";
}

function writeRuntimeOutputs(projectRoot: string, result: RuntimeExecutionResult): void {
  writeMessages(projectRoot, result.messages);
  writeStateMachineLog(projectRoot, result.transitions);
  writeFileSync(
    join(projectRoot, RUNTIME_LOG_PATH),
    [
      "# Agent Runtime Execution",
      "",
      `- Task: ${result.taskId}`,
      `- Assigned agent: ${result.assignedAgent ?? "none"}`,
      `- Risk level: ${result.riskLevel}`,
      `- Review score: ${result.reviewScore}`,
      `- Status: ${result.status}`,
      `- Release manager: ${result.releaseManagerSummary}`,
      "- Production deploy: not performed",
      "- Rollback: not performed",
      "- env/API access: not used",
      "",
      "## Transitions",
      ...result.transitions.map((item) => `- ${item.from} -> ${item.to}: ${item.reason}`),
      "",
      "## Messages",
      ...result.messages.map((message) => `- ${message.from} -> ${message.to}: ${message.type} / ${message.summary}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

function ensureLogDirectory(projectRoot: string): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  ensureLogDirectory(process.cwd());
  const result = runMultiAgentSimulation(process.cwd());
  console.log("Multi-agent runtime simulation complete.");
  console.log(`Task: ${result.taskId}`);
  console.log(`Assigned: ${result.assignedAgent ?? "none"}`);
  console.log(`Status: ${result.status}`);
  console.log(`Risk: ${result.riskLevel}`);
  console.log(`Review: ${result.reviewScore}`);
  console.log(`Wrote: ${RUNTIME_LOG_PATH}`);
}
