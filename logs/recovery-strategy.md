# Recovery Strategy Engine

Generated: 2026-05-25T04:09:44.474Z

- Confidence: 0.92
- Rollback candidate: fc58517 Add safe terminal mode for computer use
- Strategy: Continue monitoring and prefer narrow dev-only workflow tasks.
- Auto retry: allowed for LOW/MEDIUM workflow tasks only
- Human approval required: no

## Matched Patterns
- temporal-dead-zone: Move initialization before use and avoid circular hook references.
- hydration-mismatch: Move browser-only reads behind client effects.
- render-loop: Remove state updates from render path and check effect dependencies.
