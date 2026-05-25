# Codebase Summary

Generated: 2026-05-25T00:34:20.537Z

## Core Surfaces
- `app/page.tsx`: primary app shell and highest render-risk surface.
- `app/components/*Layer.tsx`: node/edge/render interaction layers.
- `hooks/use*.ts`: shared interaction state and runtime behavior.
- `lib/mind/*`: semantic graph and edge engine.
- `ai-workflow/*`: autonomous engineering operating system.

## Most Imported Files
- ai-workflow/workflow-utils.ts: imported by 30
- ai-workflow/approval-gate.ts: imported by 13
- ai-workflow/orchestrator.ts: imported by 9
- lib/mind/types.ts: imported by 6
- ai-workflow/codebase-index.ts: imported by 4
- ai-workflow/agent-registry.ts: imported by 3
- ai-workflow/command-firewall.ts: imported by 3
- ai-workflow/execution-audit.ts: imported by 3
- ai-workflow/execution-registry.ts: imported by 3
- ai-workflow/message-bus.ts: imported by 3

## Highest Render Impact
- ai-workflow/workflow-utils.ts: impact 60, risk medium
- ai-workflow/approval-gate.ts: impact 27, risk medium
- app/page.tsx: impact 24, risk critical
- ai-workflow/orchestrator.ts: impact 18, risk medium
- app/components/EdgeLayer.tsx: impact 14, risk high
- ai-workflow/autonomous-cycle-manager.ts: impact 13, risk low
- app/components/NodeLayer.tsx: impact 12, risk high
- lib/mind/types.ts: impact 12, risk medium
- ai-workflow/auto-validation-pipeline.ts: impact 10, risk low
- app/globals.css: impact 10, risk critical

## AI Operating Principle
- UX/runtime app files remain human-gated.
- Workflow automation can evolve on dev branch with build and runtime validation.
