import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { firstMatch, readOptional, writeText } from "./workflow-utils";

const MOBILE_STATUS_PATH = "dashboard/mobile-status.md";

export function generateMobileStatus(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const state = readOptional(projectRoot, "agent-memory/shared-state.md");
  const nextTask = readOptional(projectRoot, "agent-memory/next-executable-task.md");
  const gptQuestions = readOptional(projectRoot, "agent-memory/questions-for-gpt.md");
  const humanQuestions = readOptional(projectRoot, "agent-memory/questions-for-human.md");
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const release = readOptional(projectRoot, "logs/release-candidates.md");
  const readiness = readOptional(projectRoot, "logs/live-readiness.md");
  const commit = latestCommit(projectRoot);
  const approvalNeeded = /Human intervention needed:\s+yes|Approval waiting:\s+[1-9]/i.test(state);
  const markdown = [
    "# Mobile Status",
    "",
    `Generated: ${generatedAt}`,
    "",
    `- 현재 상태: ${approvalNeeded ? "사람 승인 대기" : "AI끼리 다음 안전 task 진행 가능"}`,
    `- 지금 할 일: ${firstMatch(state, /Next recommended task:\s*(.+)/i, "agent:continue 실행")}`,
    `- 승인 필요: ${approvalNeeded ? "yes" : "no"}`,
    `- 위험도: ${firstMatch(state, /Current risk:\s*(.+)/i, "unknown")}`,
    `- 앱 정상 여부: ${firstMatch(runtime, /Risk:\s*(.+)/i, "unknown")}`,
    `- Release readiness: ${firstMatch(release, /Decision:\s*(.+)/i, "unknown")}`,
    `- 마지막 커밋: ${commit}`,
    `- Live GPT ready: ${firstMatch(readiness, /Live GPT ready:\s*(.+)/i, "unknown")}`,
    `- Live Codex ready: ${firstMatch(readiness, /Live Codex ready:\s*(.+)/i, "unknown")}`,
    "",
    "## 다음 Codex 지시문",
    nextTask.trim() ? nextTask.split("\n").slice(0, 12).join("\n") : "- none",
    "",
    "## 다음 GPT 질문",
    gptQuestions.trim() ? gptQuestions.split("\n").slice(0, 12).join("\n") : "- none",
    "",
    "## Human 질문",
    humanQuestions.trim() ? humanQuestions.split("\n").slice(0, 12).join("\n") : "- none",
    "",
    "## 다음 추천 액션",
    approvalNeeded ? "- `agent-memory/human-response.md`에 approve/reject/modify-scope/ask-gpt 중 하나를 남긴 뒤 `npm run agent:continue` 실행" : "- `npm run agent:continue`로 루프 갱신",
    "",
  ].join("\n");
  writeText(projectRoot, MOBILE_STATUS_PATH, markdown);
  return markdown;
}

function latestCommit(projectRoot: string): string {
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
  generateMobileStatus(process.cwd());
  console.log(`Mobile status generated: ${MOBILE_STATUS_PATH}`);
}
