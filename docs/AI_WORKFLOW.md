# AI Workflow

## AI task rules

- Work on `dev` or `feature/*` branches.
- Preserve existing app state, storage, and database structures.
- Do not rewrite `app/page.tsx` completely.
- Do not delete or replace persisted storage structures.
- Keep `localStorage` and Supabase workflows intact.
- Always run `npm run build` before finalizing changes.
- Provide a concise summary of changes after each task.

## Branch strategy

- `main` = Production
- `dev` = Preview / development
- `feature/*` = experimental feature branches

## Computer Use guidelines

- Use Computer Use first for Vercel deployment checks, GitHub PRs, QA browser checks, and console verification.
- Stop if prompts require password entry, 2FA, payment, or security approvals, and ask the user.

## Common AI workflow commands

- `git checkout dev`
- `git status`
- `npm run build`
- `git add .`
- `git commit -m "message"`
- `git push origin dev`
- `git checkout main`
- `git merge dev`
