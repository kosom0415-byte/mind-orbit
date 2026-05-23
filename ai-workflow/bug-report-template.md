# Bug Report Template

## Bug Title

-

## Environment

- Branch:
- URL:
- Browser:
- Deployment:
- Commit:

## Severity

- [ ] Production down
- [ ] Feature broken
- [ ] Visual regression
- [ ] Data/storage issue
- [ ] Performance issue
- [ ] Other:

## What Happened

-

## Expected Behavior

-

## Reproduction Steps

1.
2.
3.

## Console / Network / Logs

- Console:
- Network:
- Vercel Runtime Logs:
- Observability:

## Suspected Cause

-

## Recent Changes To Check

- [ ] camera motion
- [ ] depth transform
- [ ] perspective / translateZ / rotateX / rotateY
- [ ] animation / motion smoothing
- [ ] useMemo / useCallback dependency order
- [ ] import / initialization order
- [ ] localStorage migration
- [ ] Supabase call
- [ ] API route
- [ ] env variable

## Recovery Priority

- First priority: restore app load and core workflow.
- Remove or disable fancy effects if they block app load.
- Rollback first if the failure source is unclear and Production is affected.

## Human Approval Needed

- [ ] Production rollback
- [ ] Production deploy
- [ ] env/API key change
- [ ] Vercel setting change
- [ ] Supabase setting change

## Fix Plan

1.
2.
3.

## Verification

- Build:
- Local:
- Preview:
- Production:

## Resolution Summary

-
