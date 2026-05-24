# Codebase Summary

Generated: 2026-05-24T05:45:20.059Z

## Core Surfaces
- `app/page.tsx`: primary app shell and highest render-risk surface.
- `app/components/*Layer.tsx`: node/edge/render interaction layers.
- `hooks/use*.ts`: shared interaction state and runtime behavior.
- `lib/mind/*`: semantic graph and edge engine.
- `ai-workflow/*`: autonomous engineering operating system.

## Most Imported Files
- ai-workflow/orchestrator.ts: imported by 9
- ai-workflow/approval-gate.ts: imported by 8
- lib/mind/types.ts: imported by 6
- ai-workflow/codebase-index.ts: imported by 4
- ai-workflow/agent-registry.ts: imported by 3
- ai-workflow/execution-audit.ts: imported by 3
- ai-workflow/execution-registry.ts: imported by 3
- ai-workflow/priority-engine.ts: imported by 3
- ai-workflow/command-firewall.ts: imported by 2
- ai-workflow/gpt-codex-bridge.ts: imported by 2

## Highest Render Impact
- app/page.tsx: impact 24, risk critical
- ai-workflow/orchestrator.ts: impact 18, risk medium
- ai-workflow/approval-gate.ts: impact 17, risk medium
- app/components/EdgeLayer.tsx: impact 14, risk high
- app/components/NodeLayer.tsx: impact 12, risk high
- lib/mind/types.ts: impact 12, risk medium
- ai-workflow/auto-validation-pipeline.ts: impact 10, risk low
- app/globals.css: impact 10, risk critical
- ai-workflow/codebase-index.ts: impact 8, risk medium
- ai-workflow/execution-audit.ts: impact 7, risk medium

## AI Operating Principle
- UX/runtime app files remain human-gated.
- Workflow automation can evolve on dev branch with build and runtime validation.
