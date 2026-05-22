# Development Workflow

This document defines the project workflow, automation rules, and common commands for the Mind Orbit project.

## 1. Branch Strategy

- `main` = Production
- `dev` = Preview / development
- `feature/*` = experimental feature branches

## 2. Workflow

- All feature work must be done on `dev` or a `feature/*` branch.
- Do not modify `main` directly.
- After pushing to `dev`, verify the Preview URL in Vercel.
- Once validation is complete, merge `dev` into `main`.

## 3. VS Code Autopilot Rules

- Do not rewrite the entire `app/page.tsx` file.
- Do not delete existing persisted storage structures.
- Preserve `localStorage` and Supabase integration structures.
- Run `npm run build` before finalizing changes.
- Provide a summary of changes with every update.

## 4. Computer Use Guidelines

- Prefer using Computer Use for: Vercel, GitHub, browser QA, console verification, and deployment checks.
- If you encounter password prompts, 2FA flows, payment screens, or security approval dialogs, stop and ask the user before continuing.

## 5. Common Commands

- `git checkout dev`
- `git status`
- `npm run build`
- `git add .`
- `git commit -m "message"`
- `git push`
- `git checkout main`
- `git merge dev`

## 6. Preview / Production URLs

- Production: `https://mind-orbit-lilac.vercel.app`
- Preview: Use the Vercel preview deployment URL generated after pushing to `dev`
