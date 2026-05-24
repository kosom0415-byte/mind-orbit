import { assessTaskRisk, DANGEROUS_COMMAND_REGISTRY, enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";

export interface CommandFirewallResult {
  allowed: boolean;
  command: string;
  taskId: string;
  riskLevel: string;
  reason: string;
}

const PRODUCTION_COMMAND_PATTERNS = [/vercel\s+--prod/i, /vercel\s+promote/i, /vercel\s+rollback/i, /git\s+push\s+origin\s+main/i];
const ENV_COMMAND_PATTERNS = [/\.env/i, /openai_api_key/i, /supabase.*key/i, /secret/i, /token/i];

export function inspectCommand(projectRoot: string, task: ApprovalGateTask, command: string): CommandFirewallResult {
  const normalized = command.toLowerCase();
  const dangerous = DANGEROUS_COMMAND_REGISTRY.find((item) => normalized.includes(item.toLowerCase()));
  const production = PRODUCTION_COMMAND_PATTERNS.find((pattern) => pattern.test(command));
  const envAccess = ENV_COMMAND_PATTERNS.find((pattern) => pattern.test(command));
  const gate = enforceApprovalGate(projectRoot, task);
  const risk = assessTaskRisk(task);

  if (dangerous) return blocked(task.id, command, risk.riskLevel, `Dangerous command blocked: ${dangerous}`);
  if (production) return blocked(task.id, command, risk.riskLevel, "Production command blocked. Human approval and manual execution required.");
  if (envAccess) return blocked(task.id, command, risk.riskLevel, "env/API/secret access command blocked.");
  if (gate.action !== "allow") return blocked(task.id, command, risk.riskLevel, gate.message);

  return { allowed: true, command, taskId: task.id, riskLevel: risk.riskLevel, reason: "Command passed firewall and approval gate." };
}

function blocked(taskId: string, command: string, riskLevel: string, reason: string): CommandFirewallResult {
  return { allowed: false, command, taskId, riskLevel, reason };
}
