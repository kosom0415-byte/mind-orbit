# Runtime Failure Patterns

Generated: 2026-05-24T05:39:21.631Z

## Active Runtime Patterns
- production-tdz-runtime: cannot_access_before_initialization / critical
- hydration-warning: hydration_mismatch / high
- excessive-rerender: excessive_rerender / critical

## Critical Recovery Bias
- production-tdz-runtime
  - Disable experimental depth/camera/motion layer if present.
  - Disable recently added transform/animation code if present.
  - Fall back to hierarchy edges and simple render path first.
- excessive-rerender
  - Disable experimental depth/camera/motion layer if present.
  - Disable recently added transform/animation code if present.
  - Fall back to hierarchy edges and simple render path first.

## Safe Retry Policy
- Retry at most two times per repeated failure type.
- If the same runtime crash repeats, stop and escalate to GPT PM plus Human Vision Owner.
- Prefer disabling experimental render/camera/motion layers before broad rewrites.
- Build success is not enough; browser runtime validation must pass.
