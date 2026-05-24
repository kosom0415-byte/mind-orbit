# Approval Request

Updated: 2026-05-24T06:18:56.301Z

## Pending Approval
- Task: mock-modify-scope-task
  - Title: Human response task mock-modify-scope-task
  - Risk: CRITICAL
  - Score: 100
  - Reason: Touches production/deployment surface.; Touches secret/env/security surface.
  - Required response format:
    - Approval ID: approval-mock-modify-scope-task
    - Task: mock-modify-scope-task
    - Status: approved | rejected
    - Approved By: <human name>
    - Approved Scope: <task-only | listed files | exact command>
    - Expires At: <ISO timestamp>
    - Reason: <why this is safe or denied>
  - Recommended choices:
    - A. approve
    - B. reject
    - C. modify scope
    - D. rollback
    - E. ask GPT PM

## Safety
- Approval request does not perform deploy, git push, env/API access, or destructive commands.
