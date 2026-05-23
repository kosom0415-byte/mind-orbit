# Dependency Graph

Generated: 2026-05-23T08:46:51.810Z

## Import Graph

### DEVELOPMENT_WORKFLOW.md
- imports none

### README.md
- imports none

### ai-workflow/README.md
- imports none

### ai-workflow/WORKFLOW_RULES.md
- imports none

### ai-workflow/agent-watch.ts
- imports ai-workflow/loop-runner.ts

### ai-workflow/bug-report-template.md
- imports none

### ai-workflow/codebase-index.ts
- imports none

### ai-workflow/loop-runner.ts
- imports ai-workflow/orchestrator.ts
- imports ai-workflow/priority-engine.ts
- imports ai-workflow/report-generator.ts

### ai-workflow/orchestrator.ts
- imports none

### ai-workflow/priority-engine.ts
- imports ai-workflow/orchestrator.ts

### ai-workflow/report-generator.ts
- imports ai-workflow/orchestrator.ts
- imports ai-workflow/priority-engine.ts

### ai-workflow/run-agent-loop.md
- imports none

### ai-workflow/task-queue.ts
- imports ai-workflow/codebase-index.ts
- imports ai-workflow/loop-runner.ts
- imports ai-workflow/orchestrator.ts
- imports ai-workflow/priority-engine.ts
- imports ai-workflow/report-generator.ts

### ai-workflow/task-template.md
- imports none

### app/api/analyze/route.ts
- imports none

### app/components/EdgeLayer.tsx
- imports lib/mind/edgeRender.ts
- imports lib/mind/types.ts

### app/components/EmptyState.tsx
- imports none

### app/components/ErrorState.tsx
- imports none

### app/components/HUDLayer.tsx
- imports none

### app/components/MinimapLayer.tsx
- imports none

### app/components/NodeLayer.tsx
- imports none

### app/error.tsx
- imports app/components/ErrorState.tsx

### app/globals.css
- imports none

### app/layout.tsx
- imports none

### app/loading.tsx
- imports none

### app/page.tsx
- imports app/components/EdgeLayer.tsx
- imports app/components/EmptyState.tsx
- imports app/components/HUDLayer.tsx
- imports app/components/MinimapLayer.tsx
- imports app/components/NodeLayer.tsx
- imports hooks/useGestures.ts
- imports hooks/useInteractionState.ts
- imports hooks/useSelection.ts
- imports hooks/useViewport.ts
- imports lib/mind/edgeEngine.ts
- imports lib/mind/types.ts
- imports lib/mind/visibilityEngine.ts

### docs/AI_WORKFLOW.md
- imports none

### docs/ARCHITECTURE.md
- imports none

### docs/DEBUGGING.md
- imports none

### docs/DEPLOYMENT.md
- imports none

### hooks/useGestures.ts
- imports none

### hooks/useInteractionState.ts
- imports none

### hooks/useSelection.ts
- imports none

### hooks/useViewport.ts
- imports none

### lib/mind/edgeEngine.ts
- imports lib/mind/relationScore.ts
- imports lib/mind/types.ts

### lib/mind/edgeRender.ts
- imports lib/mind/types.ts

### lib/mind/relationScore.ts
- imports lib/mind/types.ts

### lib/mind/types.ts
- imports none

### lib/mind/visibilityEngine.ts
- imports lib/mind/types.ts

### next-env.d.ts
- imports none

### next.config.ts
- imports none

### package-lock.json
- imports none

### package.json
- imports none

### postcss.config.mjs
- imports none

### tailwind.config.ts
- imports none

### tsconfig.json
- imports none

## Highest Fan-In
- lib/mind/types.ts: imported by 6 file(s)
- ai-workflow/orchestrator.ts: imported by 4 file(s)
- ai-workflow/priority-engine.ts: imported by 3 file(s)
- ai-workflow/loop-runner.ts: imported by 2 file(s)
- ai-workflow/report-generator.ts: imported by 2 file(s)
- ai-workflow/codebase-index.ts: imported by 1 file(s)
- app/components/EdgeLayer.tsx: imported by 1 file(s)
- app/components/EmptyState.tsx: imported by 1 file(s)
- app/components/ErrorState.tsx: imported by 1 file(s)
- app/components/HUDLayer.tsx: imported by 1 file(s)
- app/components/MinimapLayer.tsx: imported by 1 file(s)
- app/components/NodeLayer.tsx: imported by 1 file(s)
