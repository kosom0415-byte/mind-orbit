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

## 5. Production Protection

- `main`은 Production 브랜치입니다.
- `dev`는 Preview 검증 브랜치입니다.
- Production 변경 전 Preview에서 실제 브라우저 확인을 완료해야 합니다.
- Production 변경 전 사람에게 변경 목적, 커밋, Preview 결과를 보고합니다.
- Production 장애가 발생하면 새 기능 유지보다 정상 로드를 우선합니다.
- 앱 로드 실패 시 fancy effect, depth transform, camera motion, animation을 먼저 의심하고 안전하게 비활성화합니다.

## 6. Development Rules

- `app/page.tsx` 전체 재작성 금지
- 기존 localStorage와 Supabase 저장 구조 보존
- 노드 생성, 선택, 삭제, 드래그, edge 표시, 이미지/링크 노드, AI 구조화 기능 보존
- 순수 로직은 가능한 경우 `lib/`로 분리
- UI 변경은 요청 범위 안에서만 진행
- 큰 UX 효과는 작은 단위로 적용하고 Preview에서 확인
- 런타임 안정성이 의심되면 임시 비활성화를 허용

## 7. Result Report Format

작업 완료 보고는 아래 항목을 포함합니다.

```md
## 작업 결과

### 수행한 작업
- 

### 변경 파일
- 

### 검증
- Build:
- Local:
- Preview:
- Production:

### Commit
- Branch:
- Commit:

### 승인 필요 항목
- 

### 남은 리스크
- 
```
