# Architecture Map

Generated: 2026-05-25T04:39:32.488Z

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
- ai-workflow/agent-communication-bus.ts: imports 1, imported by 1
- ai-workflow/agent-executor.ts: imports 5, imported by 0
- ai-workflow/agent-memory-sync.ts: imports 1, imported by 1
- ai-workflow/agent-registry.ts: imports 0, imported by 3
- ai-workflow/agent-watch.ts: imports 2, imported by 0
- ai-workflow/api-safety-check.ts: imports 1, imported by 2
- ai-workflow/apply-human-approval.ts: imports 3, imported by 0
- ai-workflow/approval-gate.ts: imports 1, imported by 13
- ai-workflow/approval-response-parser.ts: imports 0, imported by 1
- ai-workflow/approval-runtime-gate.ts: imports 1, imported by 1
- ai-workflow/architecture-map.ts: imports 1, imported by 1
- ai-workflow/auto-validation-pipeline.ts: imports 10, imported by 0
- ai-workflow/autonomous-cycle-manager.ts: imports 13, imported by 0
- ai-workflow/browser-observer.ts: imports 4, imported by 2
- ai-workflow/browser-runtime-agent.ts: imports 3, imported by 2
- ai-workflow/browser-validation-loop.ts: imports 3, imported by 1
- ai-workflow/bug-report-template.md: imports 0, imported by 0
- ai-workflow/central-executor.ts: imports 3, imported by 0
- ai-workflow/central-shell-executor.ts: imports 5, imported by 1
- ai-workflow/codebase-index.ts: imports 0, imported by 4
- ai-workflow/codebase-summary-generator.ts: imports 1, imported by 1
- ai-workflow/codex-connector.ts: imports 3, imported by 1
- ai-workflow/command-firewall.ts: imports 1, imported by 3
- ai-workflow/context-window-compressor.ts: imports 1, imported by 1
- ai-workflow/continue-workflow.ts: imports 1, imported by 0
- ai-workflow/decision-reasoning-log.ts: imports 1, imported by 1
- ai-workflow/dependency-risk-map.ts: imports 1, imported by 1
- ai-workflow/direct-bridge.ts: imports 2, imported by 0
- ai-workflow/env-integrity-check.ts: imports 1, imported by 0
- ai-workflow/execution-audit.ts: imports 1, imported by 3
- ai-workflow/execution-registry.ts: imports 0, imported by 3
- ai-workflow/failure-pattern-learning.ts: imports 1, imported by 1
- ai-workflow/feature-history-tracker.ts: imports 0, imported by 1
- ai-workflow/gpt-codex-bridge.ts: imports 1, imported by 2
- ai-workflow/human-confirmation-flow.ts: imports 2, imported by 1
- ai-workflow/human-supervision-center.ts: imports 1, imported by 0
- ai-workflow/live-codex-readiness.ts: imports 1, imported by 1
- ai-workflow/live-openai-readiness.ts: imports 2, imported by 1

## Control Flow
1. GPT PM frames task and approval questions.
2. Codex Engineer changes dev-only workflow files.
3. Central Executor records safe validation actions.
4. Browser Runtime Agent evaluates local load/runtime risk.
5. Release Manager scores readiness without deploying.
6. Human Vision Owner approves high-risk actions manually.
