# Human Response Template

Copy one block into `agent-memory/human-response.md`, edit the values, then run:

```bash
npm run agent:approve
```

## Fields

- approvalId: unique approval id from the confirmation request
- taskId: task id being approved or rejected
- decision: approve | reject | modify-scope | ask-gpt
- approvedScope: exact scope allowed by the Human Vision Owner
- reason: why this decision is safe or why it is rejected
- requestedChanges: changes requested before Codex continues
- approvedBy: Human Vision Owner name
- timestamp: ISO timestamp

## Mobile One-Tap Style Blocks

Copy one of these short blocks on mobile, then replace `approval-task-id` and `task-id` from the dashboard.

### One-Tap Approve

- approvalId: approval-task-id
- taskId: task-id
- decision: approve
- approvedScope: docs-only; dev-branch-only; build-required
- reason: Approved for the limited safe scope shown in the dashboard.
- requestedChanges: none
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

### One-Tap Reject

- approvalId: approval-task-id
- taskId: task-id
- decision: reject
- approvedScope: none
- reason: Risk is too high or the scope is unclear.
- requestedChanges: Propose a smaller task.
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

### One-Tap Safer Alternative

- approvalId: approval-task-id
- taskId: task-id
- decision: modify-scope
- approvedScope: documentation-only; no app runtime files; no deploy
- reason: Narrow the task before Codex proceeds.
- requestedChanges: Split into docs/logs/dashboard only and return for review.
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

### One-Tap Ask GPT

- approvalId: approval-task-id
- taskId: task-id
- decision: ask-gpt
- approvedScope: none yet
- reason: GPT PM should clarify product/risk tradeoff first.
- requestedChanges: Ask GPT PM for a safer handoff.
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

## Risk Summary Checklist

- Risk level:
- Impact summary:
- Affected files:
- Rollback candidate:
- Browser validation required: yes
- Production action allowed: no

## APPROVE Example

- approvalId: approval-human-confirmation-from-engineer-report
- taskId: human-confirmation-from-engineer-report
- decision: approve
- approvedScope: docs-only workflow update; no production deploy; no env/API access
- reason: Safe to continue as markdown-only automation work.
- requestedChanges: none
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

## REJECT Example

- approvalId: approval-human-confirmation-from-engineer-report
- taskId: human-confirmation-from-engineer-report
- decision: reject
- approvedScope: none
- reason: Scope is too risky or unclear.
- requestedChanges: Stop this task and ask GPT PM for a safer alternative.
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

## MODIFY SCOPE Example

- approvalId: approval-human-confirmation-from-engineer-report
- taskId: human-confirmation-from-engineer-report
- decision: modify-scope
- approvedScope: documentation only
- reason: Continue only if app code and production settings are untouched.
- requestedChanges: Remove runtime/code execution from this task and return with a narrower Codex handoff.
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z

## ASK GPT Example

- approvalId: approval-human-confirmation-from-engineer-report
- taskId: human-confirmation-from-engineer-report
- decision: ask-gpt
- approvedScope: none yet
- reason: Need GPT PM to clarify scope and risk.
- requestedChanges: Ask GPT PM to produce a safer plan and explain why this task is needed.
- approvedBy: Human Vision Owner
- timestamp: 2026-05-24T00:00:00.000Z
