import { pathToFileURL } from "node:url";
import { parseQueueState, readOptional, writeText } from "./workflow-utils";

const HUMAN_CENTER_PATH = "dashboard/human-supervision-center.md";

export function generateHumanSupervisionCenter(projectRoot: string): string {
  const generatedAt = new Date().toISOString();
  const queue = parseQueueState(readOptional(projectRoot, "logs/task-queue.md"));
  const humanQuestions = readOptional(projectRoot, "agent-memory/questions-for-human.md");
  const runtime = readOptional(projectRoot, "logs/runtime-vision.md");
  const release = readOptional(projectRoot, "logs/release-candidates.md");
  const responseTemplate = readOptional(projectRoot, "agent-memory/human-response-template.md");
  const waiting = queue.tasks.filter((task) => task.queueStatus === "human_approval_required" || task.humanApprovalRequired);
  const blocked = queue.tasks.filter((task) => task.queueStatus === "blocked" || task.status === "blocked");
  const safe = queue.tasks.filter((task) => task.queueStatus === "pending" && !task.humanApprovalRequired);
  const markdown = [
    "# Human Supervision Center",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## 지금 내가 승인해야 할 것",
    ...(waiting.length ? waiting.map((task) => `- ${task.id}: ${task.title} (${task.riskLevel ?? "risk unknown"})`) : ["- none"]),
    "",
    "## 지금 AI끼리 해결 가능한 것",
    ...(safe.length ? safe.map((task) => `- ${task.id}: ${task.title}`) : ["- none"]),
    "",
    "## 지금 위험한 것",
    ...(waiting.concat(blocked).length ? waiting.concat(blocked).map((task) => `- ${task.id}: ${task.blockedReason ?? task.riskReasons?.join("; ") ?? "blocked"}`) : ["- none"]),
    "",
    "## 지금 멈춘 것",
    ...(blocked.length ? blocked.map((task) => `- ${task.id}: ${task.title}`) : ["- none"]),
    "",
    "## 지금 다음으로 하면 좋은 것",
    waiting.length ? "- Human Vision Owner approval response를 남긴 뒤 `npm run agent:continue` 실행" : "- `npm run agent:continue`로 다음 안전 task를 갱신",
    "",
    "## Production / env 경고",
    "- Production deploy: 사람이 직접 승인하고 수동 실행해야 함",
    "- Rollback: 사람이 직접 승인하고 수동 실행해야 함",
    "- env/API key: AI workflow 자동 처리 금지",
    "- Billing/account: AI workflow 자동 처리 금지",
    "",
    "## 앱 기능 수정 여부",
    "- 이번 supervision flow는 앱 UI/app/page.tsx/globals.css 수정을 요구하지 않음",
    "",
    "## 최근 Runtime 상태",
    runtime.trim() ? runtime.split("\n").slice(0, 18).join("\n") : "- runtime report missing",
    "",
    "## Release 상태",
    release.trim() ? release.split("\n").slice(0, 14).join("\n") : "- release report missing",
    "",
    "## GPT / Human 질문",
    humanQuestions.trim() ? humanQuestions.split("\n").slice(0, 20).join("\n") : "- none",
    "",
    "## 모바일 승인 블록",
    responseTemplate.trim() ? responseTemplate.split("\n").slice(0, 60).join("\n") : "- template missing",
    "",
  ].join("\n");
  writeText(projectRoot, HUMAN_CENTER_PATH, markdown);
  return markdown;
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href);
}

if (isDirectRun()) {
  generateHumanSupervisionCenter(process.cwd());
  console.log(`Human supervision center generated: ${HUMAN_CENTER_PATH}`);
}
