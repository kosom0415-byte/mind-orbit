# Failure History

## 2026-05-23T09:13:10.709Z - production-tdz-runtime

- Type: cannot_access_before_initialization
- Severity: critical
- Confidence: 0.94
- Retry count: 1
- Retry allowed: yes
- Blocked escalation: yes
- Recent stable commit: 87db483 Add long-term memory compression layer
- Rollback candidate: 87db483 Add long-term memory compression layer

## 2026-05-23T09:13:10.718Z - hydration-warning

- Type: hydration_mismatch
- Severity: high
- Confidence: 0.88
- Retry count: 1
- Retry allowed: no
- Blocked escalation: no
- Recent stable commit: 87db483 Add long-term memory compression layer
- Rollback candidate: Prefer narrow fix before rollback.

## 2026-05-23T09:13:10.727Z - excessive-rerender

- Type: excessive_rerender
- Severity: critical
- Confidence: 0.9
- Retry count: 1
- Retry allowed: yes
- Blocked escalation: yes
- Recent stable commit: 87db483 Add long-term memory compression layer
- Rollback candidate: 87db483 Add long-term memory compression layer
