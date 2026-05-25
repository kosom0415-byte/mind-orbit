# Terminal Runtime

Generated: 2026-05-25T04:39:26.540Z

## Safe Terminal Mode
- Status: enabled
- Computer Use terminal commands must pass whitelist validation before central execution.
- Production deploy, rollback, git push, env/API key edits, sudo, rm, and destructive commands are blocked.

## Summary
- Recent terminal actions: 5
- Recent blocked actions: 2
- Current risk: HIGH

## Recent Activity
- 2026-05-25T01:49:46.858Z | allowed | LOW | git status | Command is allowed by Safe Terminal Mode whitelist.
- 2026-05-25T01:49:46.860Z | blocked | HIGH | git push | git push is forbidden in Safe Terminal Mode.
- 2026-05-25T01:49:46.863Z | blocked | HIGH | git push | git push is forbidden in Safe Terminal Mode.
- 2026-05-25T01:49:46.877Z | allowed | LOW | git status | Command is allowed by Safe Terminal Mode whitelist.
- 2026-05-25T04:39:26.539Z | allowed | MEDIUM | npm run build | Command is allowed by Safe Terminal Mode whitelist.

## Allowed Commands
- npm run build
- npm run agent:dashboard
- npm run agent:state
- npm run agent:mobile
- npm run agent:continue
- npm run agent:daemon -- --once
- npm run agent:validate
- npm run agent:browser-validation
- npm run agent:runtime-memory
- npm run agent:product-cycle
- ls logs
- git status
- npm run agent:daemon -- --once --max-cycles=1..10
- npm run agent:daemon -- --max-cycles=1..10 --interval=5..300
