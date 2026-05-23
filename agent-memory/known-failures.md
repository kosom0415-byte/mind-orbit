# Known Failures

## Self-Heal Capable Error Classes
- cannot_access_before_initialization: critical, Move ref/state initialization before useMemo/useCallback usage. Avoid reading values returned by later hook destructuring during earlier render calculations.
- hydration_mismatch: high, Move browser-only reads behind client effects. Avoid time/random/localStorage dependent initial render output.
- excessive_rerender: critical, Remove state updates from render path. Check useEffect dependency loops.

## Most Dangerous Failure Type
- critical render/runtime failures: `cannot_access_before_initialization`, `render_crash`, `excessive_rerender`

## Current Guardrails
- Production-safe recovery mode is always enabled.
- Critical failures prefer rollback recommendation before broad fixes.
- Retry limit is 2 before blocked escalation.