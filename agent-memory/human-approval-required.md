# Human Approval Required

Updated: 2026-05-24T02:21:56.161Z

## Pending Approval
- None.

## Guardrails
- HIGH and CRITICAL tasks cannot run without approval token fields.
- Approval token fields: approvalId, approvedBy, approvedAt, approvalReason, approvedScope, expiresAt, status.
- Production deploy/rollback is never automated.
- env/API key access is never automated.
- Destructive commands are forbidden.
