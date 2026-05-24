# Architecture Map

Generated: 2026-05-24T05:45:20.069Z

## Product Runtime
- app/api/analyze/route.ts: app-route, risk high
- app/components/EdgeLayer.tsx: component, risk high
- app/components/EmptyState.tsx: component, risk low
- app/components/ErrorState.tsx: component, risk low
- app/components/HUDLayer.tsx: component, risk high
- app/components/MinimapLayer.tsx: component, risk high
- app/components/NodeLayer.tsx: component, risk high
- app/error.tsx: other, risk low
- app/globals.css: style, risk critical
- app/layout.tsx: other, risk low
- app/loading.tsx: other, risk low
- app/page.tsx: app-page, risk critical

## AI Engineering OS
- ai-workflow/README.md: imports 0, imported by 0
- ai-workflow/WORKFLOW_RULES.md: imports 0, imported by 0
- ai-workflow/agent-executor.ts: imports 5, imported by 0
- ai-workflow/agent-registry.ts: imports 0, imported by 3
- ai-workflow/agent-watch.ts: imports 2, imported by 0
- ai-workflow/apply-human-approval.ts: imports 3, imported by 0
- ai-workflow/approval-gate.ts: imports 1, imported by 8
- ai-workflow/approval-response-parser.ts: imports 0, imported by 1
- ai-workflow/architecture-map.ts: imports 1, imported by 1
- ai-workflow/auto-validation-pipeline.ts: imports 10, imported by 0
- ai-workflow/browser-runtime-agent.ts: imports 3, imported by 1
- ai-workflow/bug-report-template.md: imports 0, imported by 0
- ai-workflow/central-executor.ts: imports 3, imported by 0
- ai-workflow/central-shell-executor.ts: imports 4, imported by 1
- ai-workflow/codebase-index.ts: imports 0, imported by 4
- ai-workflow/codebase-summary-generator.ts: imports 1, imported by 1
- ai-workflow/command-firewall.ts: imports 1, imported by 2
- ai-workflow/dependency-risk-map.ts: imports 1, imported by 1
- ai-workflow/execution-audit.ts: imports 1, imported by 3
- ai-workflow/execution-registry.ts: imports 0, imported by 3
- ai-workflow/feature-history-tracker.ts: imports 0, imported by 1
- ai-workflow/gpt-codex-bridge.ts: imports 1, imported by 2
- ai-workflow/human-confirmation-flow.ts: imports 2, imported by 1
- ai-workflow/loop-runner.ts: imports 3, imported by 2
- ai-workflow/memory-compressor.ts: imports 0, imported by 0
- ai-workflow/message-bus.ts: imports 2, imported by 2
- ai-workflow/orchestrator.ts: imports 0, imported by 9
- ai-workflow/organization-dashboard.ts: imports 2, imported by 2
- ai-workflow/priority-engine.ts: imports 1, imported by 3
- ai-workflow/release-manager.ts: imports 1, imported by 1
- ai-workflow/report-generator.ts: imports 2, imported by 2
- ai-workflow/run-agent-loop.md: imports 0, imported by 0
- ai-workflow/runtime-error-detector.ts: imports 0, imported by 1
- ai-workflow/runtime-screenshot-compare.ts: imports 0, imported by 1
- ai-workflow/self-heal-engine.ts: imports 0, imported by 0
- ai-workflow/task-executor.ts: imports 1, imported by 0
- ai-workflow/task-queue.ts: imports 6, imported by 0
- ai-workflow/task-state-machine.ts: imports 0, imported by 1
- ai-workflow/task-template.md: imports 0, imported by 0

## Control Flow
1. GPT PM frames task and approval questions.
2. Codex Engineer changes dev-only workflow files.
3. Central Executor records safe validation actions.
4. Browser Runtime Agent evaluates local load/runtime risk.
5. Release Manager scores readiness without deploying.
6. Human Vision Owner approves high-risk actions manually.
