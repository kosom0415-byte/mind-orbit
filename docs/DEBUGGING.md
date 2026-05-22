# Debugging

## Debugging checklist

- Run `git status` to verify the working tree.
- Confirm the branch: `git branch --show-current`.
- Run `npm run build` to catch TypeScript and production build issues.
- Review console output for Next.js build errors.
- Inspect browser console for runtime errors when running `npm run dev`.
- Check `localStorage` data structure only when needed; do not remove existing persistence logic.

## Common issues

- Next.js build fails due to duplicate identifiers or missing imports.
- Runtime errors from invalid DOM refs or client-only code executed on the server.
- Edge rendering issues caused by missing edge style helpers or incorrect SVG props.
- Breaking selection/gesture flow by wholesale rewriting of `app/page.tsx`.

## Troubleshooting steps

1. Reproduce the issue locally.
2. Run `npm run build`.
3. Narrow the error to the component or hook.
4. Preserve existing state persistence and storage code.
5. Make minimal targeted changes.
6. Rebuild and verify again.
