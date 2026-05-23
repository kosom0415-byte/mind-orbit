import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, watch } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runMockAgentLoop } from "./loop-runner";

interface WatchRunnerOptions {
  projectRoot: string;
  debounceMs?: number;
  minRunIntervalMs?: number;
  maxRunsPerMinute?: number;
  once?: boolean;
}

interface WatchState {
  isRunning: boolean;
  pendingTimer: NodeJS.Timeout | null;
  lastRunAt: number;
  runHistory: number[];
  watchedFiles: Map<string, number>;
}

const AGENT_MEMORY_DIR = "agent-memory";
const WATCH_EVENTS_PATH = "logs/watch-events.md";
const DEFAULT_DEBOUNCE_MS = 900;
const DEFAULT_MIN_RUN_INTERVAL_MS = 2_000;
const DEFAULT_MAX_RUNS_PER_MINUTE = 5;

export function startAgentWatch(options: WatchRunnerOptions): () => void {
  const projectRoot = options.projectRoot;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const minRunIntervalMs = options.minRunIntervalMs ?? DEFAULT_MIN_RUN_INTERVAL_MS;
  const maxRunsPerMinute = options.maxRunsPerMinute ?? DEFAULT_MAX_RUNS_PER_MINUTE;
  const memoryDir = join(projectRoot, AGENT_MEMORY_DIR);
  const state: WatchState = {
    isRunning: false,
    pendingTimer: null,
    lastRunAt: 0,
    runHistory: [],
    watchedFiles: snapshotMarkdownFiles(memoryDir),
  };

  ensureLogDirectory(projectRoot);
  appendWatchEvent(projectRoot, "watch_started", [
    `Watching: ${AGENT_MEMORY_DIR}/*.md`,
    `Debounce: ${debounceMs}ms`,
    "Production safe mode: enabled",
    "External API calls: disabled",
  ]);

  if (options.once) {
    runLoopFromWatch(projectRoot, state, "manual_once", minRunIntervalMs, maxRunsPerMinute);
    return () => undefined;
  }

  const watcher = watch(memoryDir, { persistent: true }, (_eventType, filename) => {
    if (!filename || !filename.toString().endsWith(".md")) return;

    const changedFile = filename.toString();
    if (!shouldReactToChange(memoryDir, changedFile, state)) return;

    appendWatchEvent(projectRoot, "change_detected", [`File: ${AGENT_MEMORY_DIR}/${changedFile}`]);
    scheduleLoopRun(projectRoot, state, changedFile, debounceMs, minRunIntervalMs, maxRunsPerMinute);
  });

  return () => {
    if (state.pendingTimer) clearTimeout(state.pendingTimer);
    watcher.close();
    appendWatchEvent(projectRoot, "watch_stopped", ["Agent memory watcher stopped."]);
  };
}

function scheduleLoopRun(
  projectRoot: string,
  state: WatchState,
  reason: string,
  debounceMs: number,
  minRunIntervalMs: number,
  maxRunsPerMinute: number,
): void {
  if (state.pendingTimer) clearTimeout(state.pendingTimer);

  state.pendingTimer = setTimeout(() => {
    state.pendingTimer = null;
    runLoopFromWatch(projectRoot, state, reason, minRunIntervalMs, maxRunsPerMinute);
  }, debounceMs);
}

function runLoopFromWatch(
  projectRoot: string,
  state: WatchState,
  reason: string,
  minRunIntervalMs: number,
  maxRunsPerMinute: number,
): void {
  const now = Date.now();
  state.runHistory = state.runHistory.filter((timestamp) => now - timestamp < 60_000);

  if (state.isRunning) {
    appendWatchEvent(projectRoot, "run_skipped", ["Reason: loop already running"]);
    return;
  }

  if (now - state.lastRunAt < minRunIntervalMs) {
    appendWatchEvent(projectRoot, "run_skipped", ["Reason: min interval protection"]);
    return;
  }

  if (state.runHistory.length >= maxRunsPerMinute) {
    appendWatchEvent(projectRoot, "run_blocked", [
      "Reason: infinite loop protection",
      `Limit: ${maxRunsPerMinute} runs per minute`,
      "Next step: ask GPT PM Agent or human to inspect agent-memory changes.",
    ]);
    return;
  }

  state.isRunning = true;
  appendWatchEvent(projectRoot, "loop_started", [`Reason: ${reason}`]);

  try {
    const result = runMockAgentLoop({ projectRoot });
    state.lastRunAt = Date.now();
    state.runHistory.push(state.lastRunAt);
    appendWatchEvent(projectRoot, "loop_completed", [
      `Task: ${result.taskId}`,
      `Status: ${result.status}`,
      `Priority: ${result.priority}`,
      `Severity: ${result.severity}`,
      `Human approval required: ${result.humanApprovalRequired ? "yes" : "no"}`,
      `Log: ${result.logPath}`,
    ]);
  } catch (error) {
    appendWatchEvent(projectRoot, "loop_failed", [
      `Error: ${error instanceof Error ? error.message : String(error)}`,
      "Production action: not performed",
    ]);
  } finally {
    state.isRunning = false;
  }
}

function shouldReactToChange(memoryDir: string, filename: string, state: WatchState): boolean {
  const fullPath = join(memoryDir, filename);
  if (!existsSync(fullPath)) return false;

  const previousMtime = state.watchedFiles.get(filename) ?? 0;
  const currentMtime = statSync(fullPath).mtimeMs;
  state.watchedFiles.set(filename, currentMtime);

  return currentMtime !== previousMtime;
}

function snapshotMarkdownFiles(memoryDir: string): Map<string, number> {
  const files = new Map<string, number>();
  if (!existsSync(memoryDir)) return files;

  readdirSync(memoryDir)
    .filter((file) => file.endsWith(".md"))
    .forEach((file) => {
      files.set(basename(file), statSync(join(memoryDir, file)).mtimeMs);
    });

  return files;
}

function ensureLogDirectory(projectRoot: string): void {
  const logsDir = join(projectRoot, "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
}

function appendWatchEvent(projectRoot: string, eventName: string, details: string[]): void {
  const timestamp = new Date().toISOString();
  const entry = [
    "",
    `## ${timestamp} - ${eventName}`,
    "",
    ...details.map((detail) => `- ${detail}`),
    "- Mock mode: enabled",
    "- Production deploy/rollback: not automated",
    "- env/API key access: not used",
    "",
  ].join("\n");

  appendFileSync(join(projectRoot, WATCH_EVENTS_PATH), entry, "utf8");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectRun()) {
  const once = process.argv.includes("--once");
  startAgentWatch({ projectRoot: process.cwd(), once });

  if (!once) {
    console.log("Agent watch started. Watching agent-memory/*.md.");
    console.log("Mock mode enabled. Production actions and env/API key access are disabled.");
  }
}
