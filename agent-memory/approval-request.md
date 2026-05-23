# Approval Request

Updated: 2026-05-23T23:04:46.433Z

## Pending Approval
- Task: approval-test-high-page
  - Title: Refactor app/page.tsx camera system
  - Risk: CRITICAL
  - Score: 170
  - Reason: Touches primary app page.; Touches camera/depth transform system.; Contains broad refactor/architecture language.; Touches animation or overwrite behavior.; Touches state architecture.
  - Required response format:
    - Approval ID: approval-approval-test-high-page
    - Task: approval-test-high-page
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
- Task: approval-test-retry-limit
  - Title: Retry failed build fix
  - Risk: HIGH
  - Score: 55
  - Reason: Retry limit reached or exceeded.
  - Required response format:
    - Approval ID: approval-approval-test-retry-limit
    - Task: approval-test-retry-limit
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
