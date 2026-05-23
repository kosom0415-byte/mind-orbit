# Current Agent Status

Updated: 2026-05-23

## GPT PM

- Status: active
- Current role: product priority, task framing, blocked question resolution
- Reads: `logs/gpt-pm-report-latest.md`, `agent-memory/open-questions.md`, `logs/gpt-codex-bridge.md`
- Writes through human/Codex handoff: next task instructions
- Approval authority: product priority only, not production

## Codex Engineer

- Status: active
- Current role: dev-branch implementation, workflow automation, build validation, reporting
- Reads: repository files, `agent-memory/*`, `logs/*`
- Writes: scoped code/docs/logs on `dev`
- Approval authority: small safe dev changes

## Claude Reviewer

- Status: available when requested
- Current role: architectural risk review, hallucination check, high-risk diff review
- Reads: plans, diffs, reports, risk logs
- Writes: review findings and recommendations
- Approval authority: advisory

## Cursor UI Agent

- Status: human-supervised
- Current role: UI editing assistance and direct visual iteration
- Reads: UI files selected by human
- Writes: UI edits under human control
- Approval authority: none for production

## Computer Use

- Status: available for browser and desktop verification
- Current role: Preview/Production browser checks, Vercel/GitHub UI inspection, console/network observation
- Stops on: password, 2FA, billing, security approval, secret visibility

## Human Vision Owner

- Status: final authority
- Current role: product vision, production approval, security approval, cinematic direction
- Owns: Production decisions, env/API key changes, billing, permissions, user data, final conflict resolution

## Automation Health

- Watcher: available
- Loop runner: available
- Queue: available
- GPT Codex bridge: available
- Report generator: available
- Self-healing dry-run: available
- Memory compression: available
- Codebase intelligence: available

## Current Constraint

No agent may perform production deploy, production rollback, env/API key changes, billing changes, destructive commands, or `main` push without explicit Human Vision Owner approval.
