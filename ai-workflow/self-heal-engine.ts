import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type FailureType =
  | "cannot_access_before_initialization"
  | "undefined_access"
  | "hydration_mismatch"
  | "import_cycle"
  | "hook_dependency_issue"
  | "build_fail"
  | "render_crash"
  | "dependency_conflict"
  | "excessive_rerender"
  | "unknown";

type Severity = "low" | "medium" | "high" | "critical";

type RecoveryMode = "safe_auto_fix_candidate" | "manual_review_required" | "rollback_recommended" | "blocked_escalation";

interface FailureClassification {
  type: FailureType;
  severity: Severity;
  confidence: number;
  reasons: string[];
  safeAutoFixRules: string[];
  riskyPatterns: string[];
  recoveryMode: RecoveryMode;
}

interface RecoveryPlan {
  classification: FailureClassification;
  rollbackCandidate: string;
  recentStableCommit: string;
  failedRetryCount: number;
  retryAllowed: boolean;
  blockedEscalation: boolean;
  productionSafeRecovery: boolean;
  autoDisableExperimentalLayer: string[];
  recommendedActions: string[];
  humanApprovalRequired: string[];
}

interface FailureSnapshot {
  generatedAt: string;
  inputName: string;
  errorText: string;
  plan: RecoveryPlan;
}

const MAX_RETRIES = 2;
const FAILURE_HISTORY_PATH = "logs/failure-history.md";
const SELF_HEAL_ACTIONS_PATH = "logs/self-heal-actions.md";
const KNOWN_FAILURES_PATH = "agent-memory/known-failures.md";
const RECOVERY_PATTERNS_PATH = "agent-memory/recovery-patterns.md";

const SAMPLE_FAILURES: Array<{ name: string; text: string }> = [
  {
    name: "production-tdz-runtime",
    text: "ReferenceError: Cannot access 'groupImageDragRef' before initialization at app/page.tsx",
  },
  {
    name: "hydration-warning",
    text: "Warning: Hydration failed because the server rendered HTML didn't match the client.",
  },
  {
    name: "excessive-rerender",
    text: "Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.",
  },
];

export function classifyFailure(errorText: string): FailureClassification {
  const text = errorText.toLowerCase();
  const reasons: string[] = [];
  const safeAutoFixRules: string[] = [];
  const riskyPatterns: string[] = [];

  if (/cannot access .* before initialization/i.test(errorText)) {
    reasons.push("Temporal dead zone or initialization order issue detected.");
    safeAutoFixRules.push("Move ref/state initialization before useMemo/useCallback usage.");
    safeAutoFixRules.push("Avoid reading values returned by later hook destructuring during earlier render calculations.");
    riskyPatterns.push("app/page.tsx hook order changes require extra review.");
    return classification("cannot_access_before_initialization", "critical", 0.94, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/cannot read properties of undefined|undefined is not an object|reading .* of undefined/i.test(errorText)) {
    reasons.push("Undefined access detected.");
    safeAutoFixRules.push("Add null-safe guards at data boundary.");
    safeAutoFixRules.push("Preserve existing data shape and avoid migration during recovery.");
    return classification("undefined_access", "high", 0.86, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/hydration failed|hydration mismatch|server rendered html/i.test(errorText)) {
    reasons.push("React/Next hydration mismatch detected.");
    safeAutoFixRules.push("Move browser-only reads behind client effects.");
    safeAutoFixRules.push("Avoid time/random/localStorage dependent initial render output.");
    riskyPatterns.push("Do not change broad UI layout while recovering hydration.");
    return classification("hydration_mismatch", "high", 0.88, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/circular dependency|require cycle|import cycle/i.test(errorText)) {
    reasons.push("Import cycle detected.");
    safeAutoFixRules.push("Move shared types/constants into leaf module.");
    riskyPatterns.push("Avoid large file moves without build validation.");
    return classification("import_cycle", "high", 0.82, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/react hook .* dependency|exhaustive-deps|invalid hook call|hooks can only/i.test(errorText)) {
    reasons.push("Hook dependency or hook usage issue detected.");
    safeAutoFixRules.push("Keep hook call order stable.");
    safeAutoFixRules.push("Prefer extracting pure helper instead of conditional hook calls.");
    riskyPatterns.push("Core hooks require manual review if touched.");
    return classification("hook_dependency_issue", "high", 0.84, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/build failed|failed to compile|typescript error|type error|module not found/i.test(errorText)) {
    reasons.push("Build failure detected.");
    safeAutoFixRules.push("Fix narrow type/import issue only.");
    safeAutoFixRules.push("Run npm run build after each attempt.");
    return classification("build_fail", "medium", 0.8, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/error boundary|render crash|minified react error|component stack/i.test(errorText)) {
    reasons.push("Render crash detected.");
    safeAutoFixRules.push("Disable recently added experimental render layer first.");
    safeAutoFixRules.push("Add defensive guard around optional graph data.");
    riskyPatterns.push("NodeLayer/EdgeLayer/page render changes are high risk.");
    return classification("render_crash", "critical", 0.78, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/dependency conflict|eresolve|peer dependency|lockfile/i.test(errorText)) {
    reasons.push("Dependency conflict detected.");
    safeAutoFixRules.push("Prefer lockfile-preserving install.");
    riskyPatterns.push("Do not force install or upgrade major dependency automatically.");
    return classification("dependency_conflict", "medium", 0.82, reasons, safeAutoFixRules, riskyPatterns);
  }

  if (/too many re-renders|maximum update depth exceeded|infinite loop/i.test(errorText)) {
    reasons.push("Excessive rerender detected.");
    safeAutoFixRules.push("Remove state updates from render path.");
    safeAutoFixRules.push("Check useEffect dependency loops.");
    riskyPatterns.push("Core interaction hooks need manual review.");
    return classification("excessive_rerender", "critical", 0.9, reasons, safeAutoFixRules, riskyPatterns);
  }

  return classification(
    "unknown",
    "medium",
    0.35,
    ["Unknown failure type."],
    ["Collect full stack trace and recent diff before modifying code."],
    ["Do not apply broad refactor for unknown failures."],
  );
}

export function createRecoveryPlan(projectRoot: string, inputName: string, errorText: string): FailureSnapshot {
  const generatedAt = new Date().toISOString();
  const classificationResult = classifyFailure(errorText);
  const failedRetryCount = countPreviousFailures(projectRoot, classificationResult.type);
  const retryAllowed = failedRetryCount < MAX_RETRIES && classificationResult.recoveryMode !== "manual_review_required";
  const recentStableCommit = getRecentStableCommit(projectRoot);
  const rollbackCandidate = classificationResult.severity === "critical" ? recentStableCommit : "Prefer narrow fix before rollback.";

  const snapshot: FailureSnapshot = {
    generatedAt,
    inputName,
    errorText,
    plan: {
      classification: classificationResult,
      rollbackCandidate,
      recentStableCommit,
      failedRetryCount,
      retryAllowed,
      blockedEscalation: failedRetryCount >= MAX_RETRIES || classificationResult.severity === "critical",
      productionSafeRecovery: true,
      autoDisableExperimentalLayer: recommendExperimentalDisables(classificationResult.type),
      recommendedActions: recommendActions(classificationResult, retryAllowed),
      humanApprovalRequired: humanApprovalRequirements(classificationResult, failedRetryCount),
    },
  };

  return snapshot;
}

export function writeSelfHealReports(projectRoot: string, snapshots: FailureSnapshot[]): void {
  ensureDir(join(projectRoot, "logs"));
  ensureDir(join(projectRoot, "agent-memory"));

  writeFileSync(join(projectRoot, FAILURE_HISTORY_PATH), generateFailureHistory(snapshots), "utf8");
  writeFileSync(join(projectRoot, SELF_HEAL_ACTIONS_PATH), generateSelfHealActions(snapshots), "utf8");
  writeFileSync(join(projectRoot, KNOWN_FAILURES_PATH), generateKnownFailures(snapshots), "utf8");
  writeFileSync(join(projectRoot, RECOVERY_PATTERNS_PATH), generateRecoveryPatterns(), "utf8");
}

function classification(
  type: FailureType,
  severity: Severity,
  confidence: number,
  reasons: string[],
  safeAutoFixRules: string[],
  riskyPatterns: string[],
): FailureClassification {
  const recoveryMode: RecoveryMode =
    severity === "critical"
      ? "rollback_recommended"
      : riskyPatterns.length > 0
        ? "manual_review_required"
        : "safe_auto_fix_candidate";

  return { type, severity, confidence, reasons, safeAutoFixRules, riskyPatterns, recoveryMode };
}

function recommendExperimentalDisables(type: FailureType): string[] {
  if (["render_crash", "hydration_mismatch", "excessive_rerender", "cannot_access_before_initialization"].includes(type)) {
    return [
      "Disable experimental depth/camera/motion layer if present.",
      "Disable recently added transform/animation code if present.",
      "Fall back to hierarchy edges and simple render path first.",
    ];
  }
  return ["No experimental layer disable required by default."];
}

function recommendActions(classificationResult: FailureClassification, retryAllowed: boolean): string[] {
  const actions = [
    `Classify as ${classificationResult.type}.`,
    "Capture error text, affected files, and recent diff before changes.",
    ...classificationResult.safeAutoFixRules,
  ];

  if (!retryAllowed) actions.push("Stop auto-retry and escalate to GPT PM Agent/human.");
  if (classificationResult.severity === "critical") actions.push("Prefer rollback recommendation before broad fix.");
  actions.push("Run npm run build after any candidate fix.");
  return actions;
}

function humanApprovalRequirements(classificationResult: FailureClassification, failedRetryCount: number): string[] {
  const approvals = ["Production deploy/rollback requires human approval."];
  if (classificationResult.severity === "critical") approvals.push("Critical runtime recovery requires human review before production action.");
  if (failedRetryCount >= MAX_RETRIES) approvals.push("Retry limit reached; human approval required to continue.");
  if (classificationResult.riskyPatterns.length > 0) approvals.push("Risky file edits require explicit validation plan.");
  return approvals;
}

function countPreviousFailures(projectRoot: string, type: FailureType): number {
  const historyPath = join(projectRoot, FAILURE_HISTORY_PATH);
  if (!existsSync(historyPath)) return 0;
  const history = readFileSync(historyPath, "utf8");
  return [...history.matchAll(new RegExp(`Type: ${type}`, "g"))].length;
}

function getRecentStableCommit(projectRoot: string): string {
  try {
    return execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf8" })
      .split("\n")
      .find((line) => /stabil|validat|memory|intelligence|queue|watch|foundation/i.test(line))
      ?.trim() ?? execSync("git rev-parse --short HEAD", { cwd: projectRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function generateFailureHistory(snapshots: FailureSnapshot[]): string {
  return [
    "# Failure History",
    "",
    ...snapshots.flatMap((snapshot) => [
      `## ${snapshot.generatedAt} - ${snapshot.inputName}`,
      "",
      `- Type: ${snapshot.plan.classification.type}`,
      `- Severity: ${snapshot.plan.classification.severity}`,
      `- Confidence: ${snapshot.plan.classification.confidence}`,
      `- Retry count: ${snapshot.plan.failedRetryCount}`,
      `- Retry allowed: ${snapshot.plan.retryAllowed ? "yes" : "no"}`,
      `- Blocked escalation: ${snapshot.plan.blockedEscalation ? "yes" : "no"}`,
      `- Recent stable commit: ${snapshot.plan.recentStableCommit}`,
      `- Rollback candidate: ${snapshot.plan.rollbackCandidate}`,
      "",
    ]),
  ].join("\n");
}

function generateSelfHealActions(snapshots: FailureSnapshot[]): string {
  return [
    "# Self-Heal Actions",
    "",
    "## Safety",
    "- Dry-run only",
    "- Production deploy: not automated",
    "- git push: not automated",
    "- env/API access: not used",
    "- destructive commands: forbidden",
    "",
    ...snapshots.flatMap((snapshot) => [
      `## ${snapshot.inputName}`,
      "",
      "### Recommended Actions",
      ...snapshot.plan.recommendedActions.map((action) => `- ${action}`),
      "",
      "### Auto-Disable Experimental Layer",
      ...snapshot.plan.autoDisableExperimentalLayer.map((action) => `- ${action}`),
      "",
      "### Human Approval Required",
      ...snapshot.plan.humanApprovalRequired.map((item) => `- ${item}`),
      "",
    ]),
  ].join("\n");
}

function generateKnownFailures(snapshots: FailureSnapshot[]): string {
  const unique = new Map<FailureType, FailureSnapshot>();
  snapshots.forEach((snapshot) => unique.set(snapshot.plan.classification.type, snapshot));

  return [
    "# Known Failures",
    "",
    "## Self-Heal Capable Error Classes",
    ...[...unique.values()].map((snapshot) => {
      const classificationResult = snapshot.plan.classification;
      return `- ${classificationResult.type}: ${classificationResult.severity}, ${classificationResult.safeAutoFixRules.join(" ")}`;
    }),
    "",
    "## Most Dangerous Failure Type",
    "- critical render/runtime failures: `cannot_access_before_initialization`, `render_crash`, `excessive_rerender`",
    "",
    "## Current Guardrails",
    "- Production-safe recovery mode is always enabled.",
    "- Critical failures prefer rollback recommendation before broad fixes.",
    "- Retry limit is 2 before blocked escalation.",
  ].join("\n");
}

function generateRecoveryPatterns(): string {
  return [
    "# Recovery Patterns",
    "",
    "## Safe Auto-Fix Candidates",
    "- Build fail from narrow type/import issue",
    "- Undefined access with local null guard",
    "- Hook dependency warning that can be solved by extracting pure helper",
    "- Hydration mismatch caused by browser-only read during first render",
    "",
    "## Manual Review Required",
    "- Edits to `app/page.tsx`, `app/globals.css`, core hooks, NodeLayer, EdgeLayer",
    "- Any production deploy, rollback, promote, or alias change",
    "- Any env/API key/auth/security setting",
    "- Any dependency major upgrade or force install",
    "",
    "## Rollback Recommendation Rules",
    "- Production load failure or critical runtime crash: recommend recent stable commit first",
    "- Unknown failure after two retries: stop and escalate",
    "- Experimental depth/camera/motion/animation layer suspected: disable before UX improvements",
    "",
    "## Next Automation Recommendation",
    "- Connect self-heal dry-run output to task queue so risky auto-fix candidates become blocked tasks with approval requirements.",
  ].join("\n");
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const projectRoot = process.cwd();
  const snapshots = SAMPLE_FAILURES.map((sample) => createRecoveryPlan(projectRoot, sample.name, sample.text));
  writeSelfHealReports(projectRoot, snapshots);

  console.log("Self-heal dry-run complete.");
  snapshots.forEach((snapshot) => {
    console.log(`${snapshot.inputName}: ${snapshot.plan.classification.type} / ${snapshot.plan.classification.severity}`);
  });
  console.log(`Wrote: ${FAILURE_HISTORY_PATH}`);
  console.log(`Wrote: ${SELF_HEAL_ACTIONS_PATH}`);
  console.log(`Wrote: ${KNOWN_FAILURES_PATH}`);
  console.log(`Wrote: ${RECOVERY_PATTERNS_PATH}`);
}
