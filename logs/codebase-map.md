# Codebase Map

Generated: 2026-05-23T08:46:51.810Z

## File Structure By Role

### doc
- DEVELOPMENT_WORKFLOW.md
- README.md
- docs/AI_WORKFLOW.md
- docs/ARCHITECTURE.md
- docs/DEBUGGING.md
- docs/DEPLOYMENT.md

### workflow-agent
- ai-workflow/README.md
- ai-workflow/WORKFLOW_RULES.md
- ai-workflow/agent-watch.ts
- ai-workflow/bug-report-template.md
- ai-workflow/codebase-index.ts
- ai-workflow/loop-runner.ts
- ai-workflow/orchestrator.ts
- ai-workflow/priority-engine.ts
- ai-workflow/report-generator.ts
- ai-workflow/run-agent-loop.md
- ai-workflow/task-queue.ts
- ai-workflow/task-template.md

### app-route
- app/api/analyze/route.ts

### component
- app/components/EdgeLayer.tsx
- app/components/EmptyState.tsx
- app/components/ErrorState.tsx
- app/components/HUDLayer.tsx
- app/components/MinimapLayer.tsx
- app/components/NodeLayer.tsx

### other
- app/error.tsx
- app/layout.tsx
- app/loading.tsx
- next-env.d.ts

### style
- app/globals.css

### app-page
- app/page.tsx

### hook
- hooks/useGestures.ts
- hooks/useInteractionState.ts
- hooks/useSelection.ts
- hooks/useViewport.ts

### mind-engine
- lib/mind/edgeEngine.ts
- lib/mind/edgeRender.ts
- lib/mind/relationScore.ts
- lib/mind/types.ts
- lib/mind/visibilityEngine.ts

### config
- next.config.ts
- package-lock.json
- package.json
- postcss.config.mjs
- tailwind.config.ts
- tsconfig.json

## Most Imported Files
- lib/mind/types.ts: 6
- ai-workflow/orchestrator.ts: 4
- ai-workflow/priority-engine.ts: 3
- ai-workflow/loop-runner.ts: 2
- ai-workflow/report-generator.ts: 2
- ai-workflow/codebase-index.ts: 1
- app/components/EdgeLayer.tsx: 1
- app/components/EmptyState.tsx: 1
- app/components/ErrorState.tsx: 1
- app/components/HUDLayer.tsx: 1
- app/components/MinimapLayer.tsx: 1
- app/components/NodeLayer.tsx: 1

## Related Files Recommendations

### app/page.tsx
- app/components/EdgeLayer.tsx
- app/components/EmptyState.tsx
- app/components/HUDLayer.tsx
- app/components/MinimapLayer.tsx
- app/components/NodeLayer.tsx
- hooks/useGestures.ts
- hooks/useInteractionState.ts
- hooks/useSelection.ts
- hooks/useViewport.ts
- lib/mind/edgeEngine.ts
- lib/mind/edgeRender.ts
- lib/mind/relationScore.ts

### app/globals.css
- none

### app/components/EdgeLayer.tsx
- app/page.tsx
- lib/mind/edgeEngine.ts
- lib/mind/edgeRender.ts
- lib/mind/relationScore.ts
- lib/mind/types.ts
- lib/mind/visibilityEngine.ts

### app/components/NodeLayer.tsx
- app/page.tsx

### hooks/useGestures.ts
- app/page.tsx

### hooks/useInteractionState.ts
- app/page.tsx

### hooks/useSelection.ts
- app/page.tsx

### hooks/useViewport.ts
- app/page.tsx

### app/components/HUDLayer.tsx
- app/page.tsx

### app/components/MinimapLayer.tsx
- app/page.tsx

### app/api/analyze/route.ts
- none
