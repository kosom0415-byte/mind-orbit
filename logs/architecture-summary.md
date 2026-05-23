# Architecture Summary

Generated: 2026-05-23T08:46:51.810Z

## Current Project Structure
- `app/page.tsx` is the primary app shell and graph interaction coordinator.
- `app/components/*Layer.tsx` files render graph nodes, edges, HUD, and minimap surfaces.
- `hooks/*` files hold interaction, viewport, gesture, and selection state behavior.
- `lib/mind/*` files hold graph edge, visibility, render, and relation scoring logic.
- `ai-workflow/*` files implement the local GPT/Codex workflow automation layer.

## Refactoring Priority Recommendation
1. Continue extracting pure graph/state logic away from `app/page.tsx`.
2. Add focused tests or dry-run checks around `lib/mind/*` edge and visibility engines.
3. Keep `hooks/useGestures.ts`, `hooks/useSelection.ts`, and `hooks/useViewport.ts` stable before adding new interaction effects.
4. Treat `app/globals.css` transform/animation edits as production-risk changes.
5. Keep AI workflow files isolated from app runtime code until automation behavior is proven.

## Performance Bottleneck Possibilities
- `app/page.tsx` remains the broadest render coordination point.
- Node/edge layer rendering can become expensive as graph size grows.
- Global CSS and transform changes can cause large visual/layout shifts.
- Gesture and viewport hooks can affect frequent pointer/scroll updates.

## Next Automation Recommendation
- Add a pre-edit guard that blocks Codex from modifying TOP10 risk files unless the task queue includes explicit approval and validation steps.

## Generated Metrics
- Indexed files: 46
- Import graph sources: 46
- High/critical risk files: 11
- Shared hooks: 4
