# Mind Orbit Development Workflow

이 문서는 Mind Orbit 프로젝트에서 ChatGPT, Codex, Computer Use, Cursor, Claude Code가 같은 개발 규칙을 따르도록 하기 위한 공통 작업 기준입니다.

## 1. AI Tool Roles

### ChatGPT

- 제품 방향, 기능 기획, UX 흐름, 문서화, 문제 정리 담당
- 큰 구조 변경 전 요구사항과 우선순위를 정리
- Production 영향이 있는 변경은 사람 승인 여부를 먼저 확인

### Codex

- 코드베이스 분석, 파일 수정, 리팩터링, 빌드 확인 담당
- 기존 구조를 최대한 유지하면서 작은 단위로 변경
- 작업 후 변경 파일, 검증 결과, 남은 리스크를 보고

### Computer Use

- 브라우저 기반 확인, Vercel/GitHub UI 점검, Production/Preview 실제 접속 확인 담당
- Console, Network, Runtime Logs, 배포 상태를 직접 확인
- 비밀번호, 2FA, 결제, 권한 승인 화면이 나오면 즉시 중단하고 사람에게 요청

### Cursor

- 사람이 직접 확인하면서 빠르게 수정하는 편집 환경
- 큰 파일 수정 시 변경 범위를 눈으로 검토
- 자동완성 결과를 그대로 적용하지 않고 기존 프로젝트 규칙과 충돌 여부 확인

### Claude Code

- 대형 리팩터링 제안, 복잡한 원인 분석, 문서/테스트 보강 담당
- 실제 수정 전 현재 구현과 저장 구조를 먼저 읽고 변경 범위를 제한
- Codex 또는 사람의 최종 빌드/배포 검증 없이 Production 반영 금지

## 2. Branch And Deployment Rules

- `main`은 Production 브랜치입니다.
- `dev`는 Preview / 개발 검증 브랜치입니다.
- `feature/*`는 실험 기능 또는 큰 변경을 위한 브랜치입니다.
- 모든 기능 작업은 기본적으로 `dev` 또는 `feature/*`에서 진행합니다.
- `main`에 직접 수정하거나 직접 push하지 않습니다.
- `dev` push 후 Vercel Preview URL에서 실제 동작을 확인합니다.
- Production 변경은 반드시 사람 승인 후 진행합니다.
- 큰 UX 효과, camera/depth/motion/animation 변경은 반드시 `dev` Preview에서 검증 후 Production에 반영합니다.

## 3. Pre-Work Checklist

작업 전 아래를 확인합니다.

- 현재 브랜치가 `dev` 또는 적절한 `feature/*`인지 확인
- `git status`로 기존 변경사항 확인
- 사용자가 만든 변경을 되돌리지 않기
- 관련 파일을 먼저 읽고 현재 구조 파악
- Production, Vercel, GitHub, env 변경이 필요한지 판단
- API key, token, password, secret을 화면/로그/채팅에 노출하지 않기
- 작업 범위가 UX 개선인지, 안정성 복구인지, 배포 작업인지 명확히 구분

## 4. Code Change Rules

- 한 번에 너무 많은 구조를 바꾸지 않습니다.
- 기존 동작을 유지하면서 최소 단위로 수정합니다.
- `app/page.tsx` 전체 재작성 금지
- 저장 구조, `localStorage`, Supabase 연동 구조를 임의로 삭제하지 않습니다.
- 노드 생성, 선택, 삭제, 드래그, edge 표시, 이미지/링크 노드, AI 구조화 기능을 항상 보존합니다.
- 순수 로직은 가능하면 `lib/` 또는 독립 모듈로 분리합니다.
- UI 디자인 변경은 요청된 범위 안에서만 수행합니다.
- 런타임 안정성이 의심되면 fancy animation보다 앱 부팅 성공을 우선합니다.
- camera, perspective, translateZ, rotateX/Y, motion smoothing, transform 변경은 Preview에서 충분히 확인합니다.
- 타입 변경 시 기존 데이터와의 호환성을 확인합니다.

## 5. Forbidden Actions

- 사람 승인 없이 Production 설정 변경
- 사람 승인 없이 `main` 직접 push
- 사람 승인 없이 Vercel Production rollback, promote, domain 변경
- 유료 기능, 결제, 업그레이드 버튼 클릭
- 비밀번호, 2FA, 보안 승인 우회 시도
- API key, env 값, token, secret을 채팅/로그/스크린샷에 노출
- 사용자 변경사항을 임의로 되돌리기
- `git reset --hard`, 강제 push, 배포 삭제
- Supabase 테이블/데이터 구조 삭제 또는 위험한 마이그레이션
- 오류 원인을 확인하지 않은 상태에서 무리한 대형 리팩터링

## 6. Build, Test, Deploy Order

기본 순서는 아래를 따릅니다.

1. 현재 브랜치와 변경사항 확인
2. 관련 코드 읽기
3. 작은 단위로 수정
4. `npm run build`
5. 필요 시 로컬 실행으로 브라우저 확인
6. `git status` 확인
7. 변경사항 요약 작성
8. `git add .`
9. 의미 있는 커밋 메시지로 commit
10. `git push`
11. Vercel Preview 배포 확인
12. Preview URL에서 실제 기능 확인
13. 사람 승인 후 Production 반영
14. Production URL에서 실제 로드 확인

## 7. Production Safety Policy

- Production 변경은 반드시 사람 승인이 필요합니다.
- Production 장애가 발생하면 UX 개선보다 rollback 또는 안정 복구를 우선합니다.
- 원인이 불명확한 경우 최근 변경 중 camera/depth/transform/motion/import/init order를 우선 점검합니다.
- Production 복구 시 임시 비활성화가 허용됩니다.
- 복구 후에는 원인, 수정 파일, 커밋, 정상 URL을 보고합니다.

## 8. API Key And Environment Rules

- `OPENAI_API_KEY`, Supabase key, Vercel token 등은 절대 채팅에 그대로 쓰지 않습니다.
- `.env*` 파일은 필요 최소한으로만 다룹니다.
- env 값 변경은 Vercel의 Production / Preview / Development 적용 범위를 확인합니다.
- key 교체 작업 중 화면에 key가 보이면 캡처하거나 로그로 남기지 않습니다.
- 노출 가능성이 있는 key는 폐기하고 새 key를 발급합니다.

## 9. Rollback Policy

- 앱 로드 실패, 저장 실패, AI 분석 실패, 배포 실패가 발생하면 먼저 안정 상태 복구를 목표로 합니다.
- Production 장애에서는 새 기능 유지보다 정상 접속을 우선합니다.
- 문제가 특정 변경에서 발생했다면 해당 변경을 임시 비활성화하거나 되돌립니다.
- rollback 이후에도 Production URL과 브라우저 Console을 다시 확인합니다.

## 10. Completion Report Template

작업 완료 시 아래 형식으로 보고합니다.

```md
## 작업 완료 보고

### 목표
- 

### 변경 사항
- 

### 수정 파일
- 

### 검증 결과
- `npm run build`: 
- 로컬 확인: 
- Preview 확인: 
- Production 확인: 

### 배포 정보
- Branch: 
- Commit: 
- Preview URL: 
- Production URL: 

### 주의사항 / 남은 리스크
- 
```

## 11. Current URLs

- Production: https://mind-orbit-lilac.vercel.app
- Preview: Vercel에서 `dev` push 후 생성되는 Preview Deployment URL 사용
