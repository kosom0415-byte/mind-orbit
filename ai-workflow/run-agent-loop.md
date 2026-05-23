# Run Agent Loop

이 문서는 실제 API 자동화가 아니라, 로컬 문서 기반으로 PM Agent와 Engineer Agent가 협업하는 운영 루프입니다.

## Loop Overview

```text
PM Agent defines task
  -> Engineer Agent inspects code
  -> Engineer Agent decides: proceed, ask GPT, or request human approval
  -> PM Agent clarifies priority and approval boundaries
  -> Engineer Agent edits on dev
  -> Engineer Agent runs build/test
  -> Computer Use verifies browser / Vercel when needed
  -> Engineer Agent reports result to GPT PM Agent
  -> PM Agent creates next Codex handoff if needed
  -> Human approves Production action if needed
```

## Step 1. PM Agent Creates Task

PM Agent는 `task-template.md`를 복사해 작업을 정의합니다.

필수 항목:

- 목표
- 작업 범위
- 성공 기준
- 승인 필요 항목
- 검증 방법
- Production 영향 여부
- Codex가 혼자 판단해도 되는 범위
- GPT에게 다시 질문해야 하는 조건

## Step 2. Engineer Agent Reviews Task

Engineer Agent는 작업 전 아래를 확인합니다.

- 현재 브랜치가 `dev`인지 확인
- `git status` 확인
- 관련 파일 읽기
- 기존 저장 구조와 핵심 기능 영향 확인
- build/test 계획 수립

### Codex Can Proceed Without Asking GPT

아래 조건을 모두 만족하면 Codex Engineer Agent는 혼자 진행할 수 있습니다.

- 작업이 `dev` 브랜치에서만 진행됨
- 변경 범위가 문서, 테스트, 타입, 작은 버그 수정, 작은 리팩터링에 한정됨
- 기존 UI/저장/배포 구조를 바꾸지 않음
- env/API key, 인증, 결제, 권한, 도메인, Supabase schema와 무관함
- `npm run build` 또는 명확한 테스트로 검증 가능함
- 실패해도 쉽게 되돌릴 수 있음

### Ask GPT PM Agent Before Continuing

아래 상황에서는 Codex가 멈추고 GPT PM Agent에게 질문합니다.

- 요구사항이 충돌함
- 성공 기준이 모호함
- 제품 방향 또는 UX 선택이 필요함
- Production 변경이 필요해 보임
- env/API key 변경이 필요해 보임
- 데이터 삭제, migration, 저장 구조 변경 가능성이 있음
- 큰 UX 효과, camera/depth/motion/animation 변경이 포함됨
- 작업이 예상보다 커져 단계 분리가 필요함
- 같은 build/runtime 오류를 2회 수정해도 해결되지 않음

### Human Approval Gate

아래 상황은 GPT PM Agent 판단만으로 진행하지 않고 사람 승인을 받아야 합니다.

- Production deploy
- Production rollback
- Vercel promote, alias, domain 변경
- GitHub repository 권한 변경
- env/API key 생성, 교체, 삭제
- Supabase schema, table, permission 변경
- 결제, 업그레이드, 유료 기능 활성화
- 사용자 데이터 삭제 또는 대량 변경

## Step 3. Engineer Agent Implements On Dev

수정 규칙:

- 작은 단위로 변경
- 기존 기능 보존
- 불필요한 UI 변경 금지
- 앱 로드 안정성 우선
- fancy effect는 실패 시 가장 먼저 비활성화

금지:

- API 호출 자동화 추가
- env 자동 수정
- Production deploy/rollback 자동 실행
- build/test 없이 push

## Step 4. Retry And Failure Handling

실패 시 재시도 한도:

- build/test 실패: 최대 2회 수정 후 재실행
- runtime 오류: 최대 2회 수정 후 재확인
- Preview 확인 실패: 최대 1회 재시도
- Production 장애: 1회 안전 수정 후 실패하면 rollback 또는 사람 판단 요청
- env/API key/권한 오류: 재시도하지 않고 즉시 질문

각 재시도마다 기록할 것:

- 실패한 명령 또는 화면
- 오류 메시지
- 원인 추정
- 적용한 수정
- 다음 판단

재시도 한도를 넘으면 Codex는 더 수정하지 않고 GPT PM Agent에게 보고합니다.

## Step 5. Validate

기본 검증:

1. `npm run build`
2. 필요한 경우 로컬 실행 확인
3. dev Preview 확인
4. Console / Network 오류 확인

Production 검증은 사람 승인 이후에만 진행합니다.

## Step 6. Report To GPT PM Agent

Engineer Agent는 작업 완료 또는 중단 시 아래 형식으로 GPT PM Agent에게 보고합니다.

```md
## Engineer Report

### Task
- 요청 요약:
- Branch:

### Changes
- 

### Files Changed
- 

### Validation
- `npm run build`:
- 로컬 확인:
- Preview 확인:
- Production 확인:

### Commit / Push
- Commit:
- Push:

### Decisions Made By Codex
- 

### Questions For GPT PM
- 

### Human Approval Needed
- 

### Risks / Rollback
- 
```

## Step 7. Handoff Back To Codex

PM Agent가 다음 작업을 Codex Engineer Agent에게 다시 넘길 때 아래 형식을 사용합니다.

```md
## Codex Handoff

### Goal
-

### Context
-

### Scope
- In:
- Out:

### Must Preserve
-

### Allowed Decisions
-

### Ask GPT Before
-

### Human Approval Required
-

### Validation Required
- Build:
- Local:
- Preview:

### Commit Message
-
```

## Step 8. Human Approval Gate

아래 작업은 루프가 자동으로 진행하지 않습니다.

- Production deploy
- Production rollback
- env/API key 변경
- Vercel/GitHub/Supabase 권한 변경
- 유료 기능 활성화

승인 전 PM Agent는 다음을 사람에게 보고합니다.

- 변경 목적
- 변경 파일
- 검증 결과
- Preview URL
- Production 영향
- rollback 가능 여부

## Production Protection Rules

- Production deploy/rollback/promote는 사람 승인 후에만 진행합니다.
- Production 확인은 공개 URL과 브라우저 Console 기준으로 합니다.
- Production 장애 중에는 새 UX 개선을 추가하지 않습니다.
- 앱 로드 실패 시 fancy effect, depth transform, camera motion, animation을 먼저 제거하거나 비활성화합니다.
- 원인이 불명확하면 새 기능 보존보다 rollback 또는 최소 수정 복구를 우선합니다.

## Failure Handling Summary

실패 시 순서:

1. 앱 로드 가능 상태 회복
2. 최근 변경 중 위험 효과 비활성화
3. 필요 시 rollback 제안
4. 원인 요약
5. 재발 방지 규칙 추가

Production 장애에서는 새 기능 완성보다 정상 접속을 먼저 보장합니다.
