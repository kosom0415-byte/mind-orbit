import { assessTaskRisk, DANGEROUS_COMMAND_REGISTRY, enforceApprovalGate, type ApprovalGateTask } from "./approval-gate";

export interface CommandFirewallResult {
  allowed: boolean;
  command: string;
  taskId: string;
  riskLevel: string;
  reason: string;
}

const PRODUCTION_COMMAND_PATTERNS = [/vercel\s+--prod/i, /vercel\s+promote/i, /vercel\s+rollback/i, /\bdeploy\b/i, /\brollback\b/i, /git\s+push\s+origin\s+main/i];
const ENV_COMMAND_PATTERNS = [/\.env/i, /openai_api_key/i, /supabase.*key/i, /secret/i, /token/i, /printenv/i, /process\.env/i];
const SYSTEM_MODIFICATION_PATTERNS = [/\bsudo\b/i, /\bchmod\b/i, /\bchown\b/i, /\bkillall\b/i, /\blaunchctl\b/i];
const DATABASE_PATTERNS = [/db\s+reset/i, /database\s+reset/i, /drop\s+table/i, /truncate\s+table/i, /migration\s+repair/i];
const PACKAGE_MAJOR_PATTERNS = [/npm\s+install\s+[^&|]*(next|react|react-dom)@(?:latest|\d+)/i, /major\s+upgrade/i, /breaking\s+upgrade/i];
const DESTRUCTIVE_GIT_PATTERNS = [/git\s+reset\s+--hard/i, /git\s+clean\s+-/i, /git\s+checkout\s+--/i, /git\s+push\s+--force/i, /git\s+rebase/i];
const HIGH_RISK_RUNTIME_PATTERNS = [
  /app\/page\.tsx.*(rewrite|large|mass|refactor|overwrite)/i,
  /globals\.css.*(rewrite|large|mass|refactor|overwrite)/i,
  /provider|providers/i,
  /runtime hook|core hook|hooks\/use/i,
  /camera|depth|perspective|translatez|rotatex|rotatey/i,
  /render pipeline|nodelayer|edgelayer/i,
];

export function inspectCommand(projectRoot: string, task: ApprovalGateTask, command: string): CommandFirewallResult {
  const normalized = command.toLowerCase();
  const dangerous = DANGEROUS_COMMAND_REGISTRY.find((item) => normalized.includes(item.toLowerCase()));
  const production = PRODUCTION_COMMAND_PATTERNS.find((pattern) => pattern.test(command));
  const envAccess = ENV_COMMAND_PATTERNS.find((pattern) => pattern.test(command));
  const systemModification = SYSTEM_MODIFICATION_PATTERNS.find((pattern) => pattern.test(command));
  const databaseModification = DATABASE_PATTERNS.find((pattern) => pattern.test(command));
  const packageMajor = PACKAGE_MAJOR_PATTERNS.find((pattern) => pattern.test(command));
  const destructiveGit = DESTRUCTIVE_GIT_PATTERNS.find((pattern) => pattern.test(command));
  const runtimeRisk = HIGH_RISK_RUNTIME_PATTERNS.find((pattern) => pattern.test(`${task.title}\n${task.goal}\n${task.context ?? ""}\n${command}`));
  const gate = enforceApprovalGate(projectRoot, task);
  const risk = assessTaskRisk(task);

  if (dangerous) return blocked(task.id, command, risk.riskLevel, `Dangerous command blocked: ${dangerous}`);
  if (production) return blocked(task.id, command, risk.riskLevel, "Production command blocked. Human approval and manual execution required.");
  if (envAccess) return blocked(task.id, command, risk.riskLevel, "env/API/secret access command blocked.");
  if (systemModification) return blocked(task.id, command, "CRITICAL", "System modification command blocked.");
  if (databaseModification) return blocked(task.id, command, "CRITICAL", "Database modification command blocked.");
  if (packageMajor) return blocked(task.id, command, "HIGH", "Package major upgrade command blocked.");
  if (destructiveGit) return blocked(task.id, command, "CRITICAL", "Destructive git command blocked.");
  if (runtimeRisk) return blocked(task.id, command, risk.riskLevel, "High-risk runtime/render change requires approval before execution.");
  if (gate.action !== "allow") return blocked(task.id, command, risk.riskLevel, gate.message);

  return { allowed: true, command, taskId: task.id, riskLevel: risk.riskLevel, reason: "Command passed firewall and approval gate." };
}

function blocked(taskId: string, command: string, riskLevel: string, reason: string): CommandFirewallResult {
  return { allowed: false, command, taskId, riskLevel, reason };
}
