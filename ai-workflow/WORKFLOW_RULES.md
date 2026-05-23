# AI Workflow Rules

Mind Orbit 프로젝트에서 모든 AI 도구는 아래 규칙을 우선합니다.

## 1. Core Principles

- 안정성이 UX 효과보다 우선입니다.
- AI 자동 수정은 `dev` 브랜치 기준으로 진행합니다.
- Production 변경은 사람 승인 후에만 진행합니다.
- build/test 없이 push하지 않습니다.
- 큰 변경은 작은 단위로 나누어 적용합니다.
- 문제가 생기면 rollback 또는 안정 복구를 우선합니다.

## 2. Human Approval Required

아래 작업은 반드시 사람이 승인해야 합니다.

- Production deploy
- Production rollback
- Vercel Production 설정 변경
- GitHub repository 권한 변경
- env 또는 API key 수정
- Supabase schema, table, permission 변경
- 결제, 업그레이드, 유료 기능 활성화
- 도메인, alias, DNS 변경
- `main` 브랜치 직접 push
- 공개 URL, 인증, 결제, 권한, 보안 정책에 영향을 주는 변경
- 사용자 데이터 삭제, 대량 변환, 마이그레이션

승인 요청에는 반드시 목적, 영향 범위, 검증 결과, 되돌리는 방법을 포함합니다.

## 3. Automation Allowed

아래 작업은 dev 기준에서 자동화할 수 있습니다.

- 코드베이스 읽기와 구조 분석
- 문서 생성과 업데이트
- 작은 범위의 코드 수정
- 타입 오류와 빌드 오류 수정
- `npm run build`
- 로컬 실행과 Preview URL 확인
- 작업 결과 보고서 작성
- 안전한 git status, diff, log 확인
- 문서 기반 task, bug report, handoff 작성
- 명확한 lint/build 오류의 작은 수정
- 기존 패턴과 동일한 컴포넌트, 타입, 순수 함수 추가

Codex Engineer Agent가 혼자 판단해도 되는 상황:

- 요청 범위가 문서, 테스트, 타입, 작은 버그 수정에 한정된 경우
- 변경이 `dev` 브랜치 안에서만 일어나고 Production 설정에 닿지 않는 경우
- 기존 코드 패턴을 그대로 따르는 작은 리팩터링인 경우
- 실패해도 쉽게 되돌릴 수 있고 사용자 데이터에 영향이 없는 경우
- 보안 정보, env, API key, 결제, 권한, 도메인과 무관한 경우
- `npm run build` 또는 해당 테스트로 검증 가능한 경우

GPT PM Agent에게 질문해야 하는 상황:

- 요구사항이 서로 충돌하거나 성공 기준이 모호한 경우
- UX 방향, 제품 우선순위, 사용자 경험 선택지가 둘 이상인 경우
- 데이터 구조, 저장 방식, migration 여부를 결정해야 하는 경우
- Production, Vercel, GitHub, Supabase 설정 변경이 필요해 보이는 경우
- env/API key, 인증, 보안, 결제, 권한과 관련된 경우
- 큰 UX 효과, camera/depth/motion/animation 변경이 포함된 경우
- 작업이 예상보다 커져 여러 커밋이나 단계 분리가 필요한 경우
- 빌드 실패 원인이 불명확하거나 2회 재시도 후에도 해결되지 않는 경우

## 4. Forbidden Actions

- API key, token, password, secret을 채팅, 로그, 문서, 스크린샷에 노출
- env 값을 자동으로 생성, 교체, 삭제
- 사람 승인 없이 Production deploy 또는 rollback
- 사람 승인 없이 `main` push
- build/test 없이 push
- 사용자 변경사항 임의 되돌리기
- `git reset --hard`, force push, 배포 삭제
- Vercel 유료 기능 클릭
- 보안 승인, 2FA, 비밀번호 절차 우회
- 원인 분석 없는 대형 리팩터링
- 실패를 숨기고 성공한 것처럼 보고
- Preview 확인 없이 Production 정상으로 판단
- 문서에 실제 secret 값 저장

## 5. Production Protection

- `main`은 Production 브랜치입니다.
- `dev`는 Preview 검증 브랜치입니다.
- Production 변경 전 Preview에서 실제 브라우저 확인을 완료해야 합니다.
- Production 변경 전 사람에게 변경 목적, 커밋, Preview 결과를 보고합니다.
- Production 장애가 발생하면 새 기능 유지보다 정상 로드를 우선합니다.
- 앱 로드 실패 시 fancy effect, depth transform, camera motion, animation을 먼저 의심하고 안전하게 비활성화합니다.
- Production deploy, rollback, promote, alias 변경은 자동 루프가 직접 실행하지 않습니다.
- Production 확인은 실제 공개 URL과 브라우저 Console 기준으로 판단합니다.
- Production 복구 작업은 최소 변경, 빠른 검증, 명확한 보고를 우선합니다.
- 장애 복구 중에는 새 UX 개선을 추가하지 않습니다.
- AI는 production deploy를 직접 실행하지 않습니다.
- AI는 env/API key에 접근하지 않습니다.
- AI는 destructive command를 실행하지 않습니다.
- build 성공만으로 production safe라고 판단하지 않습니다.
- Production 판단 전 browser runtime validation이 필요합니다.
- rollback은 사람 승인 없이는 실행하지 않습니다.

## 6. Development Rules

- `app/page.tsx` 전체 재작성 금지
- `app/page.tsx`, `globals.css`, core hooks 수정은 approval risk check를 통과해야 합니다.
- 기존 localStorage와 Supabase 저장 구조 보존
- 노드 생성, 선택, 삭제, 드래그, edge 표시, 이미지/링크 노드, AI 구조화 기능 보존
- 순수 로직은 가능한 경우 `lib/`로 분리
- UI 변경은 요청 범위 안에서만 진행
- 큰 UX 효과는 작은 단위로 적용하고 Preview에서 확인
- animation/depth/camera 작업은 experimental task로 분류합니다.
- high-risk task는 반드시 GPT PM에게 먼저 질문합니다.
- 런타임 안정성이 의심되면 임시 비활성화를 허용
- runtime crash 발생 시 fancy effect보다 app load stability를 우선합니다.

## 7. Retry Policy

실패 시 재시도는 아래 한도를 따릅니다.

- 같은 build/test 실패 수정: 최대 2회
- 같은 runtime 오류 수정: 최대 2회
- 같은 배포 확인 실패: 최대 1회
- Production 장애 복구: 1회 안전 수정 후 실패하면 rollback 또는 사람 판단 요청
- env/API key/권한 문제: 재시도하지 말고 즉시 사람에게 질문

재시도마다 다음을 기록합니다.

- 실패한 명령 또는 화면
- 관찰된 오류
- 시도한 수정
- 다음 판단

재시도 한도를 넘으면 더 진행하지 말고 GPT PM Agent에게 상황을 보고합니다.

## 8. ChatGPT Report Format

Codex Engineer Agent가 작업 결과를 GPT PM Agent에게 전달할 때 아래 형식을 사용합니다.

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
- Build:
- Local:
- Preview:
- Production:

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

## 9. Codex Handoff Format

GPT PM Agent가 다음 작업을 Codex Engineer Agent에게 다시 넣을 때 아래 형식을 사용합니다.

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
