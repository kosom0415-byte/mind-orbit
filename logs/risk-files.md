# Risk Files

Generated: 2026-05-23T08:46:51.810Z

## AI Should Avoid Touching Without Extra Review: TOP 10
1. app/page.tsx | critical | render impact 24 | Core app shell or global style can break production load/rendering. Depends on core interaction hooks.
2. app/globals.css | critical | render impact 10 | Core app shell or global style can break production load/rendering.
3. app/components/EdgeLayer.tsx | high | render impact 14 | Shared provider/hook/render layer affects broad interaction behavior.
4. app/components/NodeLayer.tsx | high | render impact 12 | Shared provider/hook/render layer affects broad interaction behavior.
5. hooks/useGestures.ts | high | render impact 7 | Shared provider/hook/render layer affects broad interaction behavior.
6. hooks/useInteractionState.ts | high | render impact 7 | Shared provider/hook/render layer affects broad interaction behavior.
7. hooks/useSelection.ts | high | render impact 7 | Shared provider/hook/render layer affects broad interaction behavior.
8. hooks/useViewport.ts | high | render impact 7 | Shared provider/hook/render layer affects broad interaction behavior.
9. app/components/HUDLayer.tsx | high | render impact 6 | Shared provider/hook/render layer affects broad interaction behavior.
10. app/components/MinimapLayer.tsx | high | render impact 6 | Shared provider/hook/render layer affects broad interaction behavior.

## Core Shared Hook Analysis
- hooks/useGestures.ts: imported by 1, render impact 7
- hooks/useInteractionState.ts: imported by 1, render impact 7
- hooks/useSelection.ts: imported by 1, render impact 7
- hooks/useViewport.ts: imported by 1, render impact 7

## High Render Impact Files
- app/page.tsx: 24
- app/components/EdgeLayer.tsx: 14
- app/components/NodeLayer.tsx: 12
- lib/mind/types.ts: 12
- app/globals.css: 10
- ai-workflow/orchestrator.ts: 8
- ai-workflow/loop-runner.ts: 7
- ai-workflow/priority-engine.ts: 7
- hooks/useGestures.ts: 7
- hooks/useInteractionState.ts: 7
- hooks/useSelection.ts: 7
- hooks/useViewport.ts: 7
- ai-workflow/report-generator.ts: 6
- app/components/EmptyState.tsx: 6
- app/components/ErrorState.tsx: 6

## Production Risk Areas
- app/page.tsx: app shell, state concentration, render ordering, interaction wiring
- app/globals.css: global layout, transforms, animation, visual stability
- hooks/*: drag, selection, viewport, gesture behavior
- app/components/NodeLayer.tsx and EdgeLayer.tsx: graph render stability
- app/api/analyze/route.ts: AI analysis runtime path
