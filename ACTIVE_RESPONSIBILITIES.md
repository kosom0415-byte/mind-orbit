# Active Responsibilities

Updated: 2026-05-23

## Responsibility Matrix

| Area | Primary Owner | Support | Human Approval |
| --- | --- | --- | --- |
| Product direction | Human Vision Owner | GPT PM | Always for major direction |
| Task priority | GPT PM | Codex Engineer | When product tradeoff is unclear |
| Dev implementation | Codex Engineer | Claude Reviewer | Only if high-risk |
| UI iteration | Cursor UI Agent | Codex Engineer | For major UX direction |
| Architecture review | Claude Reviewer | Codex Engineer | For broad refactor |
| Browser verification | Computer Use | Codex Engineer | If credentials/security appear |
| Production deploy | Human Vision Owner | Computer Use | Required |
| Production rollback | Human Vision Owner | Computer Use | Required |
| env/API key | Human Vision Owner | Computer Use | Required |
| Queue maintenance | Codex Engineer | GPT PM | If blocked or approval-gated |
| Memory retention | Codex Engineer | GPT PM | If deleting important history |

## Active Duties By Agent

### GPT PM

- Keep tasks small and prioritized.
- Convert blocked engineering states into clear decisions.
- Maintain product philosophy priority.
- Avoid asking Codex to perform approval-gated work.

### Codex Engineer

- Check repository state before edits.
- Preserve app stability and existing user workflows.
- Run required validation.
- Report changed files, commit hash, push status, risks, and next steps.
- Mark blocked/human approval states rather than forcing progress.

### Claude Reviewer

- Review high-risk plans and changes.
- Identify missing validation.
- Flag hallucinated or unsupported assumptions.
- Recommend smaller reversible work when risk is high.

### Cursor UI Agent

- Assist human-led visual refinement.
- Keep UI changes isolated from workflow automation changes.
- Avoid broad generated edits without review.

### Human Vision Owner

- Decide production actions.
- Resolve agent disagreement.
- Approve security, billing, env/API, domain, and user data changes.
- Decide when cinematic UX is worth the risk.

## Currently Protected Areas

- `app/page.tsx`
- `app/globals.css`
- providers and root app setup
- core hooks
- storage and Supabase integration
- Vercel project settings
- GitHub repository permissions
- env/API key values
- Production deployment state

## Current Product Philosophy

Mind Orbit should feel spatial, cinematic, and AI-native, but it must first be reliable as a thinking tool. The interface can become more cinematic only after the graph, memo, AI analysis, and storage layers are stable.

## Current Autonomous Development Philosophy

Agents should increase throughput by making state visible:

- Queue status is explicit.
- Questions are explicit.
- Human approval is explicit.
- Known failures are explicit.
- Recovery paths are explicit.

The system should prefer a blocked state over unsafe autonomy.
