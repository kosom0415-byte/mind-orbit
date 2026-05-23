# AI Workflow Orchestration

이 폴더는 Mind Orbit 프로젝트에서 GPT PM Agent, Codex Engineer Agent, Computer Use가 같은 규칙으로 협업하기 위한 로컬 운영 구조입니다.

아직 실제 OpenAI API 호출 자동화는 포함하지 않습니다. 현재 단계의 목표는 사람이 검토할 수 있는 작업 로그, 질문, 수정 결과, 승인 기준을 문서 기반으로 표준화하고, 나중에 API를 연결하기 쉬운 인터페이스를 유지하는 것입니다.

## Agent Roles

### GPT PM Agent

- 요구사항을 작업 단위로 나눕니다.
- 우선순위, 성공 기준, 승인 필요 여부를 정리합니다.
- Engineer Agent가 막힌 지점을 질문으로 받아 의사결정을 돕습니다.
- Production 영향이 있는 작업은 사람 승인이 필요한 항목으로 표시합니다.

### Codex Engineer Agent

- 코드베이스를 읽고 실제 수정 계획을 세웁니다.
- dev 브랜치 기준으로 작은 단위의 코드 변경을 수행합니다.
- 빌드와 테스트 없이 push하지 않습니다.
- 작업 결과, 변경 파일, 검증 결과, 남은 리스크를 보고합니다.

### Computer Use

- 브라우저, Vercel, GitHub, Console, Network, Runtime Logs 확인을 담당합니다.
- Preview / Production URL이 실제로 열리는지 확인합니다.
- 비밀번호, 2FA, 보안 승인, 결제, 유료 기능 화면이 나오면 즉시 중단하고 사람에게 요청합니다.

## Folder Contents

- `WORKFLOW_RULES.md`: 모든 Agent가 따라야 하는 공통 규칙
- `task-template.md`: 새 작업을 정의할 때 사용하는 템플릿
- `bug-report-template.md`: 버그 재현과 복구 작업을 기록하는 템플릿
- `run-agent-loop.md`: PM Agent와 Engineer Agent가 문서로 주고받는 운영 루프
- `loop-runner.ts`: agent-memory를 읽어 다음 mock 작업과 보고서를 생성
- `task-queue.ts`: pending / blocked / completed / human approval queue 관리
- `gpt-codex-bridge.ts`: GPT PM Report, Codex Engineer Report, task queue를 연결해 질문과 다음 handoff 생성
- `agent-watch.ts`: agent-memory 변경 감지 후 loop 실행, 옵션으로 bridge까지 실행
- `report-generator.ts`: GPT PM용 보고서와 Codex Engineer용 보고서를 분리 생성

## Basic Flow

1. PM Agent가 `task-template.md` 형식으로 작업을 정의합니다.
2. Engineer Agent가 작업 범위, 위험도, 검증 방법을 확인합니다.
3. 필요한 경우 PM Agent에게 질문을 남깁니다.
4. Engineer Agent는 dev 브랜치에서 작은 단위로 수정합니다.
5. `npm run build`와 필요한 로컬 확인을 마친 뒤 결과를 보고합니다.
6. Preview에서 검증합니다.
7. Production 반영은 사람 승인 후에만 진행합니다.

## Automated Mock Flow

현재 운영 루프는 mock 기반입니다. 실제 OpenAI API 호출은 하지 않습니다.

1. `npm run agent:loop`
   - `agent-memory/workflow-state.md`와 `agent-memory/open-questions.md`를 읽습니다.
   - `logs/engineer-report-latest.md`와 `logs/gpt-pm-report-latest.md`를 생성합니다.
2. `npm run agent:queue`
   - 다음 작업을 queue 상태로 정리합니다.
   - blocked task와 human approval task를 분리합니다.
3. `npm run agent:bridge`
   - GPT PM Report를 읽고 다음 Codex handoff를 생성합니다.
   - Codex Engineer Report와 blocked task를 읽고 GPT PM 질문 목록을 만듭니다.
   - 사람 승인이 필요한 항목을 `agent-memory/human-approval-required.md`에 분리합니다.
4. `npm run agent:report`
   - GPT PM용 보고서와 Codex Engineer용 보고서를 다시 생성합니다.
5. `npm run agent:watch -- --with-bridge`
   - `agent-memory/*.md` 변경 시 loop를 실행하고 bridge까지 이어서 실행합니다.

## Bridge Files

### Inputs

- `logs/gpt-pm-report-latest.md`
- `logs/engineer-report-latest.md`
- `logs/task-queue.md`
- `agent-memory/open-questions.md`

### Outputs

- `agent-memory/open-questions.md`
- `agent-memory/human-approval-required.md`
- `agent-memory/next-codex-handoff.md`
- `logs/gpt-codex-bridge.md`

## Blocked Task Handling

- `task-queue.ts`가 task를 `blocked`로 표시하면 `gpt-codex-bridge.ts`가 이를 GPT PM 질문으로 변환합니다.
- 변환된 질문은 `agent-memory/open-questions.md`의 `Pending` 섹션에 기록됩니다.
- GPT PM Agent가 답변하면 mock parser가 답변 텍스트를 다음 Codex handoff 후보로 변환합니다.
- 실제 API 연결 전까지는 사람이 GPT 답변을 확인하고 다음 지시문을 Codex에 넣는 방식으로 운영합니다.

## Human Approval Handling

- Production deploy / rollback, env/API key, Vercel/GitHub 설정, Supabase 권한, 결제/유료 기능은 자동 진행하지 않습니다.
- 승인 필요 항목은 `agent-memory/human-approval-required.md`에 별도 기록합니다.
- Codex Engineer Agent는 이 파일에 pending approval이 있으면 production 관련 작업을 진행하지 않습니다.

## Future OpenAI API Interface

`gpt-codex-bridge.ts`는 `AgentBridgePort` 인터페이스를 둡니다. 나중에 실제 API를 붙일 때는 아래 두 함수를 구현하면 됩니다.

- `parseGptAnswer(markdown)`: GPT 답변을 Codex task로 변환
- `createCodexHandoff(task)`: task를 Codex handoff markdown으로 변환

API 연결 시에도 env/API key 값은 로그, 화면, 보고서에 출력하지 않습니다.

## Safety First

- API key/env 수정은 자동화 금지입니다.
- Production deploy/rollback은 사람 승인 없이는 진행하지 않습니다.
- 앱 로드 실패가 발생하면 UX 효과보다 안정성 복구를 우선합니다.
- 큰 UX 효과는 작은 단위로 적용하고 dev Preview에서 검증합니다.
