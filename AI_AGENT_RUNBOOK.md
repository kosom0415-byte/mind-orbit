# AI Agent Runbook

This runbook keeps GPT PM, Codex Engineer, Computer Use, Claude Reviewer, Cursor UI Agent, and Human Vision Owner aligned without manual copy/paste between every step.

## Morning Start

1. Run `npm run agent:continue`.
2. Read `dashboard/mobile-status.md`.
3. If `dashboard/human-supervision-center.md` shows approval waiting, Human Vision Owner decides approve/reject/modify-scope/ask-gpt.
4. If no human approval is waiting, Codex may continue only with `agent-memory/next-executable-task.md`.

## Midpoint Check

1. Run `npm run agent:state`.
2. Run `npm run agent:direct-bridge`.
3. Check `agent-memory/questions-for-gpt.md` and `agent-memory/questions-for-human.md`.
4. Do not execute HIGH/CRITICAL tasks without explicit approval.

## When Codex Is Blocked

1. Record the blocked reason in the queue or engineer report.
2. Run `npm run agent:task-bus`.
3. Run `npm run agent:direct-bridge`.
4. GPT PM answers questions in project memory/report files.
5. Human Vision Owner only intervenes for approval, rejection, direction, or scope.

## GPT Question Format

- Task:
- Decision needed:
- Risk:
- Safe alternatives:
- Recommended answer:

## Human Approval Format

Use `agent-memory/human-response-template.md`, paste into `agent-memory/human-response.md`, then run `npm run agent:approve`.

## Runtime Crash Procedure

1. Stop UX changes.
2. Run `npm run agent:self-heal`.
3. Run `npm run agent:validate`.
4. Disable experimental camera/depth/motion before broad refactor.
5. Production rollback is a human-approved manual action only.

## Production Rules

- AI never deploys production.
- AI never runs rollback.
- AI never touches env/API keys.
- AI never uses destructive commands.
- Build success alone is not release approval.

## Computer Use Criteria

Use Computer Use or Browser Use for:
- local browser validation
- console/runtime observation
- screenshot evidence
- UI issue reporting

Do not use it for:
- billing/account changes
- secrets/env entry
- production deploy/rollback

## Mobile Operation

Read these files:
- `dashboard/mobile-status.md`
- `dashboard/human-supervision-center.md`
- `dashboard/live-ai-organization-dashboard.md`

Write only this file when approving:
- `agent-memory/human-response.md`

## Long Task Instruction Rules

- State forbidden areas.
- State approval requirements.
- State validation commands.
- Include commit message.
- Keep app UI changes isolated unless explicitly approved.

## Small Task Instruction Rules

- One goal.
- One scope.
- One validation command.
- One expected report.

## Never Touch Without Approval

- `app/page.tsx`
- `app/globals.css`
- providers
- core hooks
- camera/depth/render pipeline
- env/API keys
- production deploy/rollback
- billing/account

## Today’s Next Task Selection

1. Prefer `agent-memory/next-executable-task.md`.
2. If empty, read `agent-memory/questions-for-gpt.md`.
3. If human approval waiting, stop and ask Human Vision Owner.
4. If runtime/release is dangerous, run self-heal and report before coding.
