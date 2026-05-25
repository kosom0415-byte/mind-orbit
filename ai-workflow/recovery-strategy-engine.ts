import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { learnFailurePatterns } from "./failure-pattern-learning";
import { suggestRuntimeHotfix } from "./runtime-hotfix-suggester";
import { readOptional, writeText } from "./workflow-utils";

export interface RecoveryStrategy {
  generatedAt: string;
  confidence: number;
  rollbackCandidate: string;
  strategy: string;
  autoRetry: string;
  humanApprovalRequired: boolean;
}

export function generateRecoveryStrategy(projectRoot: string): RecoveryStrategy {
  const patterns = learnFailurePatterns(projectRoot);
  const hotfix = suggestRuntimeHotfix(projectRoot);
  const runtime = readOptional(projectRoot, "logs/runtime-observation.md");
  const critical = /DANGEROUS|CRITICAL|Runtime crash|This page couldn't load/i.test(runtime);
  const strategy: RecoveryStrategy = {
    generatedAt: new Date().toISOString(),
    confidence: Math.max(hotfix.confidence, ...patterns.map((pattern) => pattern.confidence)),
    rollbackCandidate: recentCommit(projectRoot),
    strategy: critical ? hotfix.safePatchStrategy : "Continue monitoring and prefer narrow dev-only workflow tasks.",
    autoRetry: critical ? "blocked; human/GPT review required" : "allowed for LOW/MEDIUM workflow tasks only",
    humanApprovalRequired: critical,
  };
  writeText(projectRoot, "logs/recovery-strategy.md", renderStrategy(strategy, patterns));
  return strategy;
}

function recentCommit(projectRoot: string): string {
  try {
    return execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf8" }).split("\n")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function renderStrategy(strategy: RecoveryStrategy, patterns: ReturnType<typeof learnFailurePatterns>): string {
  return [
    "# Recovery Strategy Engine",
    "",
    `Generated: ${strategy.generatedAt}`,
    "",
    `- Confidence: ${strategy.confidence}`,
    `- Rollback candidate: ${strategy.rollbackCandidate}`,
    `- Strategy: ${strategy.strategy}`,
    `- Auto retry: ${strategy.autoRetry}`,
    `- Human approval required: ${strategy.humanApprovalRequired ? "yes" : "no"}`,
    "",
    "## Matched Patterns",
    ...patterns.map((pattern) => `- ${pattern.name}: ${pattern.recommendedAction}`),
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  const strategy = generateRecoveryStrategy(process.cwd());
  console.log(`Recovery strategy confidence: ${strategy.confidence}`);
}
