# Workflow State

## Current Mode

- Branch target: `dev`
- Production-safe mode: enabled
- API automation: disabled
- Human approval gate: enabled

## Active Queue

| ID | Status | Owner | Summary |
| --- | --- | --- | --- |
| task-001 | queued | codex-engineer | Validate local AI orchestration foundation |

## Retry Policy

- Build/test failure: 2 attempts
- Runtime failure: 2 attempts
- Preview verification failure: 1 attempt
- Production incident: 1 safe fix, then rollback or human approval
- env/API key/permission issue: no retry, ask human

## Next Suggested Task

- Add a compact search result count to the existing node index search panel while preserving current search behavior.
