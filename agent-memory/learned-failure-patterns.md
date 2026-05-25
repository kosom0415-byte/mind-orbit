# Learned Failure Patterns

Generated: 2026-05-25T00:36:50.512Z

- temporal-dead-zone: confidence 0.92, action: Move initialization before use and avoid circular hook references.
- hydration-mismatch: confidence 0.84, action: Move browser-only reads behind client effects.
- render-loop: confidence 0.9, action: Remove state updates from render path and check effect dependencies.
