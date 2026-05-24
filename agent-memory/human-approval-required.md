# Human Approval Required

Updated: 2026-05-24T05:22:37.891Z

## Pending Approval
- Task: mock-modify-scope-task
  - Title: Human response task mock-modify-scope-task
  - Reason: Approval gate blocked CRITICAL risk task: Touches production/deployment surface.; Touches secret/env/security surface.
  - Approval types: high_risk_task
- Task: mock-ask-gpt-task
  - Title: Human response task mock-ask-gpt-task
  - Reason: Touches production/deployment surface.; Touches secret/env/security surface.
  - Approval types: human_review
- Task: mock-ask-gpt-task
  - Title: Human response task mock-modify-scope-task
  - Reason: Touches production/deployment surface.; Touches secret/env/security surface.
  - Approval types: human_review
- Task: mock-modify-scope-task
  - Title: Approval request
  - Reason: <why this is safe or denied>
  - Approval types: human_review
- Task: Touches production/deployment surface.; Touches secret/env/security surface.
  - Title: Approval request
  - Reason: <why>
  - Approval types: human_review

## Guardrails
- Production deploy/rollback requires explicit human approval.
- env/API key access is never automated.
- Git push is not automated by the bridge.
- Destructive commands are forbidden.
