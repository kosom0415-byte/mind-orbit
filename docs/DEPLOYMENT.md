# Deployment

## Vercel flow

- `dev` branch is used for Preview and development.
- `main` branch is used for Production.
- Push to `dev` to trigger a Vercel preview deployment.
- After validation, merge `dev` into `main` to deploy to production.

## Preview vs Production

- Preview: automatically created by Vercel from `dev` pushes and feature branches.
- Production: deployed from `main`.
- Production URL: `https://mind-orbit-lilac.vercel.app`
- Preview URL: obtain the Vercel preview deployment URL after each `dev` push.

## Build and deploy checklist

1. Work in `dev` or `feature/*` branches.
2. Avoid modifying `main` directly.
3. Run `npm run build` locally before pushing.
4. Push to `dev` and verify the preview deployment.
5. Once validated, merge `dev` into `main` and confirm production deployment.

## Recommended commands

- `git checkout dev`
- `git status`
- `npm run build`
- `git add .`
- `git commit -m "message"`
- `git push origin dev`
- `git checkout main`
- `git merge dev`
