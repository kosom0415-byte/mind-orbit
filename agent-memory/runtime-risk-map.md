# Runtime Risk Map

Generated: 2026-05-24T05:45:20.073Z

## Highest-Risk Files
1. app/page.tsx | critical | impact 24
2. app/globals.css | critical | impact 10
3. app/components/EdgeLayer.tsx | high | impact 14
4. app/components/NodeLayer.tsx | high | impact 12
5. hooks/useGestures.ts | high | impact 7
6. hooks/useInteractionState.ts | high | impact 7
7. hooks/useSelection.ts | high | impact 7
8. hooks/useViewport.ts | high | impact 7
9. app/components/HUDLayer.tsx | high | impact 6
10. app/components/MinimapLayer.tsx | high | impact 6
11. app/api/analyze/route.ts | high | impact 3

## Dependency Risk Rules
- `app/page.tsx`, `app/globals.css`, providers, core hooks, NodeLayer, EdgeLayer are approval-gated.
- Camera/depth/animation changes are experimental and require runtime validation.
- Build success alone does not prove runtime safety.

## Suggested Safe Refactor Order
- Prefer ai-workflow docs/scripts before app runtime files.
- Split graph engine changes into pure lib modules before UI rendering changes.
- Validate runtime in browser before release evaluation.
