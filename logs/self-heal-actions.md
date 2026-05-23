# Self-Heal Actions

## Safety
- Dry-run only
- Production deploy: not automated
- git push: not automated
- env/API access: not used
- destructive commands: forbidden

## production-tdz-runtime

### Recommended Actions
- Classify as cannot_access_before_initialization.
- Capture error text, affected files, and recent diff before changes.
- Move ref/state initialization before useMemo/useCallback usage.
- Avoid reading values returned by later hook destructuring during earlier render calculations.
- Prefer rollback recommendation before broad fix.
- Run npm run build after any candidate fix.

### Auto-Disable Experimental Layer
- Disable experimental depth/camera/motion layer if present.
- Disable recently added transform/animation code if present.
- Fall back to hierarchy edges and simple render path first.

### Human Approval Required
- Production deploy/rollback requires human approval.
- Critical runtime recovery requires human review before production action.
- Risky file edits require explicit validation plan.

## hydration-warning

### Recommended Actions
- Classify as hydration_mismatch.
- Capture error text, affected files, and recent diff before changes.
- Move browser-only reads behind client effects.
- Avoid time/random/localStorage dependent initial render output.
- Stop auto-retry and escalate to GPT PM Agent/human.
- Run npm run build after any candidate fix.

### Auto-Disable Experimental Layer
- Disable experimental depth/camera/motion layer if present.
- Disable recently added transform/animation code if present.
- Fall back to hierarchy edges and simple render path first.

### Human Approval Required
- Production deploy/rollback requires human approval.
- Risky file edits require explicit validation plan.

## excessive-rerender

### Recommended Actions
- Classify as excessive_rerender.
- Capture error text, affected files, and recent diff before changes.
- Remove state updates from render path.
- Check useEffect dependency loops.
- Prefer rollback recommendation before broad fix.
- Run npm run build after any candidate fix.

### Auto-Disable Experimental Layer
- Disable experimental depth/camera/motion layer if present.
- Disable recently added transform/animation code if present.
- Fall back to hierarchy edges and simple render path first.

### Human Approval Required
- Production deploy/rollback requires human approval.
- Critical runtime recovery requires human review before production action.
- Risky file edits require explicit validation plan.
