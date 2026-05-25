import { pathToFileURL } from "node:url";
import { readOptional, writeText } from "./workflow-utils";

export type TerminalRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TerminalValidationResult {
  generatedAt: string;
  command: string;
  normalizedCommand: string;
  allowed: boolean;
  riskLevel: TerminalRiskLevel;
  riskScore: number;
  category: string;
  reason: string;
  actor: string;
  taskId?: string;
}

const TERMINAL_ACTIONS_PATH = "logs/terminal-actions.md";
const BLOCKED_TERMINAL_ACTIONS_PATH = "logs/blocked-terminal-actions.md";
const TERMINAL_DASHBOARD_PATH = "dashboard/terminal-runtime.md";

const SAFE_EXACT_COMMANDS = new Map<string, string>([
  ["npm run build", "build"],
  ["npm run agent:dashboard", "dashboard"],
  ["npm run agent:state", "state"],
  ["npm run agent:mobile", "mobile report"],
  ["npm run agent:continue", "continue"],
  ["npm run agent:daemon -- --once", "daemon once"],
  ["git status", "git status"],
]);

const SAFE_PATTERN_COMMANDS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /^npm run agent:daemon -- --once --max-cycles=(?:[1-9]|10)$/, category: "daemon once limited cycle" },
  { pattern: /^npm run agent:daemon -- --max-cycles=(?:[1-9]|10)(?: --interval=(?:[5-9]|[1-9][0-9]|[12][0-9]{2}|300))?$/, category: "daemon limited cycle" },
];

const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string; riskScore: number }> = [
  { pattern: /\bdeploy\b|vercel\s+--prod|vercel\s+promote/i, reason: "Production deploy command is forbidden.", riskScore: 100 },
  { pattern: /\brollback\b|vercel\s+rollback/i, reason: "Rollback command is forbidden.", riskScore: 100 },
  { pattern: /\bgit\s+push\b/i, reason: "git push is forbidden in Safe Terminal Mode.", riskScore: 90 },
  { pattern: /\bgit\s+push\b.*--force|--force-with-lease/i, reason: "Force push is forbidden.", riskScore: 100 },
  { pattern: /(^|\s)rm(\s|$)|rm\s+-rf|find\s+.+\s+-delete/i, reason: "Destructive delete command is forbidden.", riskScore: 100 },
  { pattern: /\bsudo\b|\bchmod\b|\bchown\b/i, reason: "System modification command is forbidden.", riskScore: 95 },
  { pattern: /\.env|OPENAI_API_KEY|SUPABASE|secret|token|password|printenv|process\.env/i, reason: "env/API/secret access or edit is forbidden.", riskScore: 100 },
  { pattern: /git\s+reset\s+--hard|git\s+clean\s+-|git\s+checkout\s+--|git\s+rebase/i, reason: "Destructive git command is forbidden.", riskScore: 100 },
  { pattern: /drop\s+table|truncate\s+table|db\s+reset|database\s+reset|supabase\s+db\s+reset/i, reason: "Database destructive command is forbidden.", riskScore: 100 },
  { pattern: /npm\s+install|npm\s+update|pnpm\s+add|yarn\s+add/i, reason: "Dependency modification is not allowed in Safe Terminal Mode.", riskScore: 80 },
];

export function validateTerminalCommand(
  projectRoot: string,
  command: string,
  options: { actor?: string; taskId?: string; writeLogs?: boolean } = {},
): TerminalValidationResult {
  const generatedAt = new Date().toISOString();
  const normalizedCommand = normalizeCommand(command);
  const dangerous = DANGEROUS_COMMAND_PATTERNS.find((entry) => entry.pattern.test(normalizedCommand));
  const safeCategory = SAFE_EXACT_COMMANDS.get(normalizedCommand) ?? SAFE_PATTERN_COMMANDS.find((entry) => entry.pattern.test(normalizedCommand))?.category;
  const result: TerminalValidationResult = dangerous
    ? {
        generatedAt,
        command,
        normalizedCommand,
        allowed: false,
        riskLevel: riskLevelFromScore(dangerous.riskScore),
        riskScore: dangerous.riskScore,
        category: "blocked",
        reason: dangerous.reason,
        actor: options.actor ?? "computer-use",
        taskId: options.taskId,
      }
    : safeCategory
      ? {
          generatedAt,
          command,
          normalizedCommand,
          allowed: true,
          riskLevel: normalizedCommand === "npm run build" ? "MEDIUM" : "LOW",
          riskScore: normalizedCommand === "npm run build" ? 25 : 5,
          category: safeCategory,
          reason: "Command is allowed by Safe Terminal Mode whitelist.",
          actor: options.actor ?? "computer-use",
          taskId: options.taskId,
        }
      : {
          generatedAt,
          command,
          normalizedCommand,
          allowed: false,
          riskLevel: "HIGH",
          riskScore: 75,
          category: "not-whitelisted",
          reason: "Command is not in the Safe Terminal Mode whitelist.",
          actor: options.actor ?? "computer-use",
          taskId: options.taskId,
        };

  if (options.writeLogs !== false) writeTerminalReports(projectRoot, result);
  return result;
}

export function runSafeTerminalSelfTest(projectRoot: string): TerminalValidationResult[] {
  const safe = validateTerminalCommand(projectRoot, "git status", { actor: "safe-terminal-self-test", taskId: "safe-command-test" });
  const blocked = validateTerminalCommand(projectRoot, "git push", { actor: "safe-terminal-self-test", taskId: "blocked-command-test" });
  writeTerminalDashboard(projectRoot, [safe, blocked]);
  return [safe, blocked];
}

function writeTerminalReports(projectRoot: string, result: TerminalValidationResult): void {
  const existingActions = readOptional(projectRoot, TERMINAL_ACTIONS_PATH);
  const existingBlocked = readOptional(projectRoot, BLOCKED_TERMINAL_ACTIONS_PATH);
  const entry = renderTerminalEntry(result);
  const nextActions = appendEntry(existingActions, "# Terminal Actions", entry);
  writeText(projectRoot, TERMINAL_ACTIONS_PATH, nextActions);
  if (!result.allowed) {
    writeText(projectRoot, BLOCKED_TERMINAL_ACTIONS_PATH, appendEntry(existingBlocked, "# Blocked Terminal Actions", entry));
  }
  writeTerminalDashboard(projectRoot, collectRecentResults(nextActions));
}

function writeTerminalDashboard(projectRoot: string, results: TerminalValidationResult[]): void {
  const recent = results.slice(-10);
  const blockedCount = recent.filter((result) => !result.allowed).length;
  const markdown = [
    "# Terminal Runtime",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Safe Terminal Mode",
    "- Status: enabled",
    "- Computer Use terminal commands must pass whitelist validation before central execution.",
    "- Production deploy, rollback, git push, env/API key edits, sudo, rm, and destructive commands are blocked.",
    "",
    "## Summary",
    `- Recent terminal actions: ${recent.length}`,
    `- Recent blocked actions: ${blockedCount}`,
    `- Current risk: ${blockedCount > 0 ? "HIGH" : "LOW"}`,
    "",
    "## Recent Activity",
    ...(recent.length ? recent.map((result) => `- ${result.generatedAt} | ${result.allowed ? "allowed" : "blocked"} | ${result.riskLevel} | ${result.normalizedCommand} | ${result.reason}`) : ["- none"]),
    "",
    "## Allowed Commands",
    ...[...SAFE_EXACT_COMMANDS.keys()].map((command) => `- ${command}`),
    "- npm run agent:daemon -- --once --max-cycles=1..10",
    "- npm run agent:daemon -- --max-cycles=1..10 --interval=5..300",
    "",
  ].join("\n");
  writeText(projectRoot, TERMINAL_DASHBOARD_PATH, markdown);
}

function renderTerminalEntry(result: TerminalValidationResult): string {
  return [
    `## ${result.generatedAt}`,
    `- Actor: ${result.actor}`,
    `- Task: ${result.taskId ?? "none"}`,
    `- Command: ${result.normalizedCommand}`,
    `- Allowed: ${result.allowed ? "yes" : "no"}`,
    `- Risk: ${result.riskLevel}`,
    `- Risk score: ${result.riskScore}`,
    `- Category: ${result.category}`,
    `- Reason: ${result.reason}`,
    "",
  ].join("\n");
}

function appendEntry(existing: string, title: string, entry: string): string {
  const header = existing.trim() ? existing.trim() : `${title}\n`;
  return `${header}\n\n${entry}`.trimEnd() + "\n";
}

function collectRecentResults(markdown: string): TerminalValidationResult[] {
  const parsed: Array<TerminalValidationResult | undefined> = markdown
    .split(/\n(?=##\s+\d{4}-)/g)
    .map((section) => {
      const generatedAt = section.match(/^##\s+(.+)$/m)?.[1]?.trim();
      const command = section.match(/Command:\s*(.+)$/m)?.[1]?.trim();
      if (!generatedAt || !command) return undefined;
      const result: TerminalValidationResult = {
        generatedAt,
        command,
        normalizedCommand: command,
        allowed: /Allowed:\s*yes/i.test(section),
        riskLevel: (section.match(/Risk:\s*(LOW|MEDIUM|HIGH|CRITICAL)/i)?.[1]?.toUpperCase() as TerminalRiskLevel) ?? "HIGH",
        riskScore: Number(section.match(/Risk score:\s*(\d+)/i)?.[1] ?? 75),
        category: section.match(/Category:\s*(.+)$/m)?.[1]?.trim() ?? "unknown",
        reason: section.match(/Reason:\s*(.+)$/m)?.[1]?.trim() ?? "unknown",
        actor: section.match(/Actor:\s*(.+)$/m)?.[1]?.trim() ?? "unknown",
      };
      const taskId = section.match(/Task:\s*(.+)$/m)?.[1]?.trim();
      if (taskId && taskId !== "none") result.taskId = taskId;
      return result;
    })
  return parsed.filter((result): result is TerminalValidationResult => Boolean(result));
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function riskLevelFromScore(score: number): TerminalRiskLevel {
  if (score >= 95) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const command = process.argv.slice(2).join(" ");
  const results = command ? [validateTerminalCommand(process.cwd(), command)] : runSafeTerminalSelfTest(process.cwd());
  const last = results.at(-1);
  console.log(`Safe terminal mode: ${last?.allowed ? "allowed" : "blocked"}`);
  console.log(`Wrote: ${TERMINAL_ACTIONS_PATH}`);
  if (last && !last.allowed) console.log(`Blocked log: ${BLOCKED_TERMINAL_ACTIONS_PATH}`);
}
