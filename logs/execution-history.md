# Central Execution History

Generated: 2026-05-25T00:34:20.569Z

## Summary
- Total recorded executions: 16
- Blocked executions: 0
- High-risk attempts: 5
- Executor bypass suspicion: no

## Bypass Checks
- No bypass signal in latest registry window.

## Latest Traces
| Time | Execution | Kind | Status | Risk | Command Hash | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05-24T05:42:42.312Z | exec-2026-05-24T05-42-42-312Z-16c0e430 | shell | running | LOW | 16c0e4305ac2 | Central executor accepted command. |
| 2026-05-24T05:42:48.021Z | exec-2026-05-24T05-42-42-312Z-16c0e430 | shell | completed | LOW | 16c0e4305ac2 | Command completed through central executor. |
| 2026-05-24T05:42:48.022Z | exec-2026-05-24T05-42-48-022Z-1b5645a2 | browser-runtime | failed | CRITICAL | 1b5645a23bd1 | Blank screen or failed load signal detected.; Runtime crash/error text detected. |
| 2026-05-24T05:44:01.261Z | exec-2026-05-24T05-44-01-261Z-16c0e430 | shell | running | LOW | 16c0e4305ac2 | Central executor accepted command. |
| 2026-05-24T05:44:07.075Z | exec-2026-05-24T05-44-01-261Z-16c0e430 | shell | completed | LOW | 16c0e4305ac2 | Command completed through central executor. |
| 2026-05-24T05:44:07.075Z | exec-2026-05-24T05-44-07-075Z-b57a67d8 | browser-runtime | failed | CRITICAL | b57a67d86ddb | Runtime crash/error text detected. |
| 2026-05-24T05:44:21.931Z | exec-2026-05-24T05-44-21-931Z-1b5645a2 | browser-runtime | failed | CRITICAL | 1b5645a23bd1 | Blank screen or failed load signal detected.; Runtime crash/error text detected. |
| 2026-05-24T05:44:32.600Z | exec-2026-05-24T05-44-32-600Z-16c0e430 | shell | running | LOW | 16c0e4305ac2 | Central executor accepted command. |
| 2026-05-24T05:44:38.474Z | exec-2026-05-24T05-44-32-600Z-16c0e430 | shell | completed | LOW | 16c0e4305ac2 | Command completed through central executor. |
| 2026-05-24T05:44:38.475Z | exec-2026-05-24T05-44-38-475Z-b57a67d8 | browser-runtime | failed | CRITICAL | b57a67d86ddb | Runtime crash/error text detected. |
| 2026-05-24T05:45:14.473Z | exec-2026-05-24T05-45-14-473Z-16c0e430 | shell | running | LOW | 16c0e4305ac2 | Central executor accepted command. |
| 2026-05-24T05:45:20.042Z | exec-2026-05-24T05-45-14-473Z-16c0e430 | shell | completed | LOW | 16c0e4305ac2 | Command completed through central executor. |
| 2026-05-24T05:45:20.042Z | exec-2026-05-24T05-45-20-042Z-b57a67d8 | browser-runtime | completed | LOW | b57a67d86ddb | No runtime risk signal detected. |
| 2026-05-25T00:31:54.068Z | exec-2026-05-25T00-31-54-068Z-1b5645a2 | browser-runtime | failed | CRITICAL | 1b5645a23bd1 | Blank screen or failed load signal detected. |
| 2026-05-25T00:32:16.707Z | exec-2026-05-25T00-32-16-707Z-b57a67d8 | browser-runtime | completed | LOW | b57a67d86ddb | No runtime risk signal detected. |
| 2026-05-25T00:34:20.518Z | exec-2026-05-25T00-34-20-518Z-b57a67d8 | browser-runtime | completed | LOW | b57a67d86ddb | No runtime risk signal detected. |

## Rollback Candidates
- none

## Safety
- Production deploy: not performed
- Rollback: not performed
- env/API key access: not used
- Destructive commands: blocked before execution
