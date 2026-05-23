import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

interface MemoryCompressionResult {
  generatedAt: string;
  scannedLogs: number;
  archivedLogs: string[];
  duplicateReports: number;
  retainedLogs: string[];
  activeRisks: string[];
  resolvedIssues: string[];
  decisions: string[];
  blockers: string[];
  nextPriority: string;
}

interface LogDoc {
  path: string;
  content: string;
  mtimeMs: number;
  importance: number;
  fingerprint: string;
}

const LOG_DIR = "logs";
const ARCHIVE_DIR = "logs/archive";
const AGENT_MEMORY_DIR = "agent-memory";
const RETAIN_LATEST_LOG_COUNT = 12;

const ALWAYS_RETAIN = new Set([
  "architecture-summary.md",
  "codebase-map.md",
  "dependency-graph.md",
  "risk-files.md",
  "task-queue.md",
  "task-queue-report-latest.md",
  "watch-events.md",
  "stability-validation-report.md",
]);

const LATEST_REPORT_PATTERN = /latest\.md$/;
const TIMESTAMPED_REPORT_PATTERN = /^(agent-loop|engineer-report|gpt-pm-report)-\d{4}-\d{2}-\d{2}T/;

export function compressAgentMemory(projectRoot: string): MemoryCompressionResult {
  ensureDir(join(projectRoot, LOG_DIR));
  ensureDir(join(projectRoot, ARCHIVE_DIR));
  ensureDir(join(projectRoot, AGENT_MEMORY_DIR));

  const generatedAt = new Date().toISOString();
  const logs = readLogs(projectRoot);
  const duplicateReports = countDuplicateReports(logs);
  const retainedLogs = selectRetainedLogs(logs);
  const archivedLogs = archiveOldLogs(projectRoot, logs, retainedLogs);
  const architecture = readOptional(projectRoot, "logs/architecture-summary.md");
  const risks = readOptional(projectRoot, "logs/risk-files.md");
  const queue = readOptional(projectRoot, "logs/task-queue.md");
  const decisions = extractImportantDecisions(readOptional(projectRoot, "agent-memory/decision-log.md"));
  const activeRisks = extractActiveRisks(risks, queue);
  const resolvedIssues = extractResolvedIssues(logs);
  const blockers = extractBlockers(queue, readOptional(projectRoot, "agent-memory/open-questions.md"));
  const nextPriority = extractNextPriority(queue, architecture);

  const result: MemoryCompressionResult = {
    generatedAt,
    scannedLogs: logs.length,
    archivedLogs,
    duplicateReports,
    retainedLogs,
    activeRisks,
    resolvedIssues,
    decisions,
    blockers,
    nextPriority,
  };

  writeMemorySnapshots(projectRoot, result, architecture, risks, queue);
  writeArchiveSummary(projectRoot, result);
  return result;
}

function readLogs(projectRoot: string): LogDoc[] {
  return readdirSync(join(projectRoot, LOG_DIR))
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const relPath = `${LOG_DIR}/${file}`;
      const absPath = join(projectRoot, relPath);
      const content = readFileSync(absPath, "utf8");
      return {
        path: relPath,
        content,
        mtimeMs: statSync(absPath).mtimeMs,
        importance: scoreImportance(file, content),
        fingerprint: fingerprint(content),
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function scoreImportance(fileName: string, content: string): number {
  let score = 0;
  if (ALWAYS_RETAIN.has(fileName)) score += 100;
  if (LATEST_REPORT_PATTERN.test(fileName)) score += 40;
  if (/risk|architecture|queue|stability/i.test(fileName)) score += 30;
  if (/production|human approval|blocked|failed|critical|runtime/i.test(content)) score += 20;
  if (TIMESTAMPED_REPORT_PATTERN.test(fileName)) score -= 10;
  return score;
}

function selectRetainedLogs(logs: LogDoc[]): string[] {
  const byFingerprint = new Set<string>();
  const retained: string[] = [];

  logs
    .sort((a, b) => b.importance - a.importance || b.mtimeMs - a.mtimeMs)
    .forEach((log) => {
      const fileName = basename(log.path);
      const mustRetain = ALWAYS_RETAIN.has(fileName) || LATEST_REPORT_PATTERN.test(fileName);
      const isDuplicate = byFingerprint.has(log.fingerprint);
      if (!isDuplicate || mustRetain) {
        byFingerprint.add(log.fingerprint);
        retained.push(log.path);
      }
    });

  return [...new Set(retained)].slice(0, Math.max(RETAIN_LATEST_LOG_COUNT, retained.length));
}

function archiveOldLogs(projectRoot: string, logs: LogDoc[], retainedLogs: string[]): string[] {
  const retained = new Set(retainedLogs);
  const archived: string[] = [];

  logs.forEach((log) => {
    const fileName = basename(log.path);
    if (!TIMESTAMPED_REPORT_PATTERN.test(fileName)) return;
    if (retained.has(log.path)) return;

    const from = join(projectRoot, log.path);
    const toRel = `${ARCHIVE_DIR}/${fileName}`;
    const to = join(projectRoot, toRel);
    if (!existsSync(from) || existsSync(to)) return;

    renameSync(from, to);
    archived.push(toRel);
  });

  return archived;
}

function countDuplicateReports(logs: LogDoc[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  logs.forEach((log) => {
    if (seen.has(log.fingerprint)) duplicates += 1;
    seen.add(log.fingerprint);
  });
  return duplicates;
}

function extractImportantDecisions(markdown: string): string[] {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  const normalized = new Set<string>();
  const decisions: string[] = [];
  lines.forEach((line) => {
    const cleaned = line.replace(/Generated: .+/g, "").trim();
    if (normalized.has(cleaned)) return;
    if (/External API calls|Production changes/.test(cleaned)) return;
    normalized.add(cleaned);
    decisions.push(cleaned);
  });

  return decisions.slice(-12);
}

function extractActiveRisks(riskMarkdown: string, queueMarkdown: string): string[] {
  const riskLines = riskMarkdown
    .split("\n")
    .filter((line) => /^\d+\.\s+/.test(line.trim()))
    .slice(0, 10);
  const queueRisk = queueMarkdown
    .split("\n")
    .filter((line) => /Production risk:|Risk files:|Blocked:|Human approval required:/i.test(line))
    .slice(0, 8);
  return [...riskLines, ...queueRisk].map((line) => line.trim()).filter(Boolean);
}

function extractResolvedIssues(logs: LogDoc[]): string[] {
  const resolved = new Set<string>();
  logs.forEach((log) => {
    log.content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("##") || trimmed.startsWith('"')) return;
      if (/passed|success|completed|resolved|정상|성공/i.test(line)) {
        resolved.add(trimmed.replace(/^\s*-\s*/, ""));
      }
    });
  });
  return [...resolved].filter(Boolean).slice(-20);
}

function extractBlockers(queueMarkdown: string, openQuestions: string): string[] {
  const blockers = [
    ...queueMarkdown.split("\n").filter((line) => {
      if (/^- (Blocked|Human approval required): 0$/i.test(line.trim())) return false;
      if (/^## (Blocked|Human Approval Required)$/i.test(line.trim())) return false;
      if (/^- none$/i.test(line.trim())) return false;
      if (/nextAction/i.test(line)) return false;
      if (/^- Next action:/i.test(line.trim())) return false;
      return /blocked task|human approval required before/i.test(line);
    }),
    ...openQuestions.split("\n").filter((line) => line.trim().startsWith("- ")),
  ];
  return [...new Set(blockers.map((line) => line.trim()).filter((line) => line !== "- None."))].slice(0, 12);
}

function extractNextPriority(queueMarkdown: string, architectureMarkdown: string): string {
  const queueNext = queueMarkdown.match(/- Next action:\s*(.+)/)?.[1];
  if (queueNext) return queueNext;
  const architectureNext = architectureMarkdown.match(/## Next Automation Recommendation\s*\n- (.+)/)?.[1];
  return architectureNext ?? "Ask GPT PM Agent for the next prioritized task.";
}

function writeMemorySnapshots(
  projectRoot: string,
  result: MemoryCompressionResult,
  architecture: string,
  risks: string,
  queue: string,
): void {
  writeFileSync(join(projectRoot, "agent-memory/project-state-latest.md"), generateProjectState(result, queue), "utf8");
  writeFileSync(join(projectRoot, "agent-memory/core-architecture.md"), generateCoreArchitecture(result, architecture), "utf8");
  writeFileSync(join(projectRoot, "agent-memory/active-risks.md"), generateActiveRisks(result, risks), "utf8");
  writeFileSync(join(projectRoot, "agent-memory/resolved-history.md"), generateResolvedHistory(projectRoot, result), "utf8");
}

function generateProjectState(result: MemoryCompressionResult, queue: string): string {
  return [
    "# Project State Latest",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Current System Status",
    "- queue: enabled",
    "- watcher: enabled",
    "- loop runner: enabled",
    "- reports: enabled",
    "- dependency intelligence: enabled",
    "- memory compression: enabled",
    "- production-safe: enabled",
    "- OpenAI API calls: disabled",
    "- env/API key access: disabled",
    "",
    "## Current Blockers",
    ...(result.blockers.length ? result.blockers.map((item) => `- ${item.replace(/^- /, "")}`) : ["- none"]),
    "",
    "## Recent Decisions",
    ...result.decisions.map((item) => `- ${item.replace(/^- /, "")}`),
    "",
    "## Next Priority",
    `- ${result.nextPriority}`,
    "",
    "## Queue Snapshot",
    ...queue.split("\n").slice(0, 40),
    "",
    "## Memory Compression Stats",
    `- scanned logs: ${result.scannedLogs}`,
    `- archived logs: ${result.archivedLogs.length}`,
    `- duplicate reports detected: ${result.duplicateReports}`,
    `- retained log references: ${result.retainedLogs.length}`,
    "",
  ].join("\n");
}

function generateCoreArchitecture(result: MemoryCompressionResult, architecture: string): string {
  return [
    "# Core Architecture",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Token-Efficient Summary",
    "- `app/page.tsx`: primary app shell and graph interaction coordinator.",
    "- `app/components/*Layer.tsx`: node, edge, HUD, and minimap rendering.",
    "- `hooks/*`: gesture, selection, viewport, and interaction behavior.",
    "- `lib/mind/*`: graph edge, visibility, render, and relation scoring logic.",
    "- `ai-workflow/*`: local GPT/Codex automation, queue, watcher, reports, and memory compression.",
    "",
    "## Architecture Source Extract",
    ...architecture.split("\n").slice(0, 80),
    "",
  ].join("\n");
}

function generateActiveRisks(result: MemoryCompressionResult, risks: string): string {
  return [
    "# Active Risks",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Highest Risk Areas",
    ...result.activeRisks.map((item) => `- ${item.replace(/^- /, "")}`),
    "",
    "## Production-Safe State",
    "- Production deploy: not automated",
    "- Production rollback: human approval required",
    "- env/API key access: disabled",
    "- OpenAI API integration: mocked / disabled",
    "",
    "## Risk Source Extract",
    ...risks.split("\n").slice(0, 80),
    "",
  ].join("\n");
}

function generateResolvedHistory(projectRoot: string, result: MemoryCompressionResult): string {
  return [
    "# Resolved History",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Resolved / Successful Checks",
    ...(result.resolvedIssues.length ? result.resolvedIssues.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Archived Logs",
    ...(existingArchiveFiles(projectRoot).length ? existingArchiveFiles(projectRoot).map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Retained Logs",
    ...result.retainedLogs.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function writeArchiveSummary(projectRoot: string, result: MemoryCompressionResult): void {
  const archivedFiles = existingArchiveFiles(projectRoot);
  writeFileSync(
    join(projectRoot, "logs/archive/archive-summary.md"),
    [
      "# Log Archive Summary",
      "",
      `Generated: ${result.generatedAt}`,
      "",
      "## Archived Logs",
      ...(archivedFiles.length ? archivedFiles.map((item) => `- ${item}`) : ["- none"]),
      "",
      "## Dedupe",
      `- Duplicate report fingerprints detected: ${result.duplicateReports}`,
      "",
      "## Retain Policy",
      "- latest reports, architecture, queue, risk, watch, and stability logs are retained",
      "- older timestamped reports are archived",
      "- secret/env/API values are never read or stored",
      "",
    ].join("\n"),
    "utf8",
  );
}

function existingArchiveFiles(projectRoot: string): string[] {
  const archiveDir = join(projectRoot, "logs/archive");
  if (!existsSync(archiveDir)) return [];
  return readdirSync(archiveDir)
    .filter((file) => file.endsWith(".md") && file !== "archive-summary.md")
    .sort()
    .map((file) => `logs/archive/${file}`);
}

function readOptional(projectRoot: string, relPath: string): string {
  const absPath = join(projectRoot, relPath);
  return existsSync(absPath) ? readFileSync(absPath, "utf8") : "";
}

function fingerprint(content: string): string {
  return content
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z/g, "<timestamp>")
    .replace(/agent-loop-\d{4}-[^)\s]+\.md/g, "agent-loop-<timestamp>.md")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
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
  const result = compressAgentMemory(process.cwd());
  console.log("Memory compression complete.");
  console.log(`Scanned logs: ${result.scannedLogs}`);
  console.log(`Archived logs: ${result.archivedLogs.length}`);
  console.log(`Duplicate reports detected: ${result.duplicateReports}`);
  console.log("Wrote: agent-memory/project-state-latest.md");
  console.log("Wrote: agent-memory/core-architecture.md");
  console.log("Wrote: agent-memory/active-risks.md");
  console.log("Wrote: agent-memory/resolved-history.md");
}
