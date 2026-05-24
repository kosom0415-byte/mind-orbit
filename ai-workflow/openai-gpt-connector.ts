import { pathToFileURL } from "node:url";
import { assessTaskRisk, type ApprovalGateTask } from "./approval-gate";
import { readOptional, writeText } from "./workflow-utils";

export interface GptConnectorOptions {
  live?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  model?: string;
}

export interface GptConnectorResult {
  generatedAt: string;
  mode: "dry-run" | "live";
  model: string;
  calledApi: boolean;
  blockedForHuman: boolean;
  responseMarkdown: string;
  codexHandoff: string;
  questionsForHuman: string;
}

const GPT_RESPONSE_PATH = "agent-memory/gpt-api-response.md";
const NEXT_CODEX_HANDOFF_PATH = "agent-memory/next-codex-handoff.md";
const QUESTIONS_FOR_HUMAN_PATH = "agent-memory/questions-for-human.md";

export async function runGptPmConnector(projectRoot: string, options: GptConnectorOptions = {}): Promise<GptConnectorResult> {
  const generatedAt = new Date().toISOString();
  const model = options.model ?? process.env.GPT_PM_MODEL ?? "gpt-5.4-mini";
  const sharedState = readOptional(projectRoot, "agent-memory/shared-state.md");
  const questionsForGpt = readOptional(projectRoot, "agent-memory/questions-for-gpt.md");
  const engineerReport = readOptional(projectRoot, "logs/engineer-report-latest.md");
  const approvalState = readOptional(projectRoot, "agent-memory/human-approval-required.md");
  const prompt = buildSafePrompt(sharedState, questionsForGpt, engineerReport, approvalState);
  const risk = assessTaskRisk(promptToGateTask(prompt));
  const blockedForHuman = risk.approvalRequired;
  const live = Boolean(options.live);
  let responseMarkdown = "";

  if (live) {
    responseMarkdown = await callOpenAiWithRetry({
      prompt,
      model,
      timeoutMs: options.timeoutMs ?? 45_000,
      maxRetries: options.maxRetries ?? 2,
    });
  } else {
    responseMarkdown = renderDryRunGptResponse(generatedAt, model, risk.riskLevel, blockedForHuman, questionsForGpt);
  }

  const codexHandoff = blockedForHuman ? renderBlockedHandoff(generatedAt, risk.reasons) : extractOrCreateCodexHandoff(generatedAt, responseMarkdown);
  const questionsForHuman = blockedForHuman ? renderQuestionsForHuman(generatedAt, risk.reasons) : mergeHumanQuestions(generatedAt, responseMarkdown);
  const result: GptConnectorResult = {
    generatedAt,
    mode: live ? "live" : "dry-run",
    model,
    calledApi: live,
    blockedForHuman,
    responseMarkdown,
    codexHandoff,
    questionsForHuman,
  };

  writeText(projectRoot, GPT_RESPONSE_PATH, renderGptResponseFile(result));
  writeText(projectRoot, NEXT_CODEX_HANDOFF_PATH, codexHandoff);
  writeText(projectRoot, QUESTIONS_FOR_HUMAN_PATH, questionsForHuman);
  return result;
}

function buildSafePrompt(sharedState: string, questionsForGpt: string, engineerReport: string, approvalState: string): string {
  return [
    "You are GPT PM Agent for Mind Orbit.",
    "Production deploy, rollback, env/API key access, destructive commands, billing/account work, and HIGH/CRITICAL work must be separated for human approval.",
    "Return a concise markdown response with sections: GPT PM Decision, Codex Handoff, Questions For Human, Safety.",
    "Never ask Codex to expose secrets or run production actions.",
    "",
    "## Shared State",
    sharedState,
    "",
    "## Questions For GPT",
    questionsForGpt,
    "",
    "## Latest Engineer Report",
    engineerReport,
    "",
    "## Approval State",
    approvalState,
  ].join("\n");
}

async function callOpenAiWithRetry(input: { prompt: string; model: string; timeoutMs: number; maxRetries: number }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. The key value was not logged.");
  }

  let lastError = "unknown";
  for (let attempt = 1; attempt <= input.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          input: input.prompt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        lastError = `OpenAI API returned ${response.status}`;
        continue;
      }
      const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      return data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("\n") ?? "";
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`GPT PM API call failed after retries: ${lastError}`);
}

function promptToGateTask(prompt: string): ApprovalGateTask {
  const now = new Date().toISOString();
  return {
    id: "gpt-pm-api-connector",
    title: "GPT PM API connector prompt safety check",
    goal: prompt,
    status: "queued",
    owner: "gpt-pm",
    priority: "normal",
    branch: "dev",
    attempts: 0,
    maxAttempts: 2,
    productionSafeMode: true,
    humanApprovalRequired: false,
    approvalTypes: [],
    createdAt: now,
    updatedAt: now,
  };
}

function renderDryRunGptResponse(generatedAt: string, model: string, riskLevel: string, blockedForHuman: boolean, questionsForGpt: string): string {
  return [
    "# GPT API Response",
    "",
    `Generated: ${generatedAt}`,
    "- Mode: dry-run",
    `- Model: ${model}`,
    "- API call: not performed",
    `- Risk: ${riskLevel}`,
    `- Human approval required: ${blockedForHuman ? "yes" : "no"}`,
    "",
    "## GPT PM Decision",
    blockedForHuman
      ? "- Do not hand this task to Codex until Human Vision Owner resolves approval."
      : "- Safe to produce a dev-only Codex handoff.",
    "",
    "## Codex Handoff",
    "- Continue only with LOW/MEDIUM dev-safe workflow automation work.",
    "- Do not modify app UI, app/page.tsx, globals.css, production, rollback, env/API key, or destructive command surfaces.",
    "- Run build/report/dashboard validation.",
    "",
    "## Questions For Human",
    blockedForHuman ? "- Human approval is required before Codex execution." : "- none",
    "",
    "## Questions Considered",
    questionsForGpt.trim() ? questionsForGpt : "- none",
    "",
  ].join("\n");
}

function renderBlockedHandoff(generatedAt: string, reasons: string[]): string {
  return [
    "# Next Codex Handoff",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Status",
    "- blocked",
    "",
    "## Reason",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "## Rule",
    "- Codex execution is blocked until Human Vision Owner approval is recorded.",
    "",
  ].join("\n");
}

function extractOrCreateCodexHandoff(generatedAt: string, response: string): string {
  const match = response.match(/## Codex Handoff\s*([\s\S]*?)(?=\n##\s+|$)/i);
  return [
    "# Next Codex Handoff",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Source",
    "- GPT PM connector",
    "",
    "## Codex Handoff",
    match?.[1]?.trim() || "- Continue safe dev-only workflow automation.",
    "",
    "## Safety",
    "- Approval gate still applies before Codex execution.",
    "",
  ].join("\n");
}

function renderQuestionsForHuman(generatedAt: string, reasons: string[]): string {
  return [
    "# Questions For Human Vision Owner",
    "",
    `Generated: ${generatedAt}`,
    "",
    "- Should this HIGH/CRITICAL task be approved, rejected, modified in scope, or sent back to GPT PM?",
    ...reasons.map((reason) => `- Risk reason: ${reason}`),
    "",
  ].join("\n");
}

function mergeHumanQuestions(generatedAt: string, response: string): string {
  const match = response.match(/## Questions For Human\s*([\s\S]*?)(?=\n##\s+|$)/i);
  return ["# Questions For Human Vision Owner", "", `Generated: ${generatedAt}`, "", match?.[1]?.trim() || "- none", ""].join("\n");
}

function renderGptResponseFile(result: GptConnectorResult): string {
  return [
    "# GPT API Connector Result",
    "",
    `Generated: ${result.generatedAt}`,
    `- Mode: ${result.mode}`,
    `- Model: ${result.model}`,
    `- API call performed: ${result.calledApi ? "yes" : "no"}`,
    "- API key exposed: no",
    `- Human approval required: ${result.blockedForHuman ? "yes" : "no"}`,
    "",
    "## Response",
    result.responseMarkdown,
    "",
  ].join("\n");
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  runGptPmConnector(process.cwd(), { live: process.argv.includes("--live") }).then((result) => {
    console.log(`GPT connector complete: ${result.mode}`);
    console.log(`API call performed: ${result.calledApi ? "yes" : "no"}`);
    console.log(`Wrote: ${GPT_RESPONSE_PATH}`);
  });
}
