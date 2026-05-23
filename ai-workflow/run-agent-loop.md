# Run Agent Loop

이 문서는 실제 API 자동화가 아니라, 로컬 문서 기반으로 PM Agent와 Engineer Agent가 협업하는 운영 루프입니다.

## Loop Overview

```text
PM Agent defines task
  -> Engineer Agent inspects code
  -> Engineer Agent asks questions if blocked
  -> PM Agent clarifies priority and approval boundaries
  -> Engineer Agent edits on dev
  -> Engineer Agent runs build/test
  -> Computer Use verifies browser / Vercel when needed
  -> Engineer Agent reports result
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

## Step 2. Engineer Agent Reviews Task

Engineer Agent는 작업 전 아래를 확인합니다.

- 현재 브랜치가 `dev`인지 확인
- `git status` 확인
- 관련 파일 읽기
- 기존 저장 구조와 핵심 기능 영향 확인
- build/test 계획 수립

Engineer Agent가 질문을 남겨야 하는 경우:

- 요구사항이 충돌할 때
- Production 변경이 필요할 때
- env/API key 변경이 필요할 때
- 큰 UX 변경이 포함될 때
- 데이터 삭제나 migration이 필요할 때

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

## Step 4. Validate

기본 검증:

1. `npm run build`
2. 필요한 경우 로컬 실행 확인
3. dev Preview 확인
4. Console / Network 오류 확인

Production 검증은 사람 승인 이후에만 진행합니다.

## Step 5. Report

Engineer Agent는 아래 형식으로 결과를 보고합니다.

```md
## 작업 결과

### 수행한 작업
- 

### 변경 파일
- 

### 검증 결과
- `npm run build`:
- 로컬 확인:
- Preview 확인:

### Commit
- 

### 사람 승인 필요
- 

### 남은 리스크
- 
```

## Step 6. Human Approval Gate

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

## Failure Handling

실패 시 순서:

1. 앱 로드 가능 상태 회복
2. 최근 변경 중 위험 효과 비활성화
3. 필요 시 rollback 제안
4. 원인 요약
5. 재발 방지 규칙 추가

Production 장애에서는 새 기능 완성보다 정상 접속을 먼저 보장합니다.
