# Runtime Hotfix Suggester

Generated: 2026-05-25T04:09:44.474Z

- Confidence: 0.78
- Auto retry allowed: no
- Safe patch strategy: Do not patch broad UI. Isolate experimental layer, preserve app shell, then run build and browser observation.

## Blocked Areas
- production deploy
- rollback execution
- env/API keys
- app/page.tsx broad rewrite
- globals.css broad rewrite
- camera/depth/animation rewrite
