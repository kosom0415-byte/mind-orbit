# Human Approval Required

Updated: 2026-05-23T15:08:46.936Z

## Pending Approval
- Task: approval-test-high-page
  - Title: Refactor app/page.tsx camera system
  - Risk: CRITICAL
  - Reason: Touches primary app page.; Touches camera/depth transform system.; Contains broad refactor/architecture language.; Touches animation or overwrite behavior.; Touches state architecture.
  - Approval types: high_risk_task
- Task: approval-test-retry-limit
  - Title: Retry failed build fix
  - Risk: HIGH
  - Reason: Retry limit reached or exceeded.
  - Approval types: high_risk_task

## Guardrails
- HIGH and CRITICAL tasks cannot run without approval token fields.
- Approval token fields: approvedBy, approvedAt, approvalReason.
- Production deploy/rollback is never automated.
- env/API key access is never automated.
- Destructive commands are forbidden.
