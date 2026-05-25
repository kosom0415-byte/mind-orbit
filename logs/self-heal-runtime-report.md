# Self-Heal Runtime Report

Generated: 2026-05-25T04:10:17.112Z
- Issue class: release-risk
- Approval needed: no
- Confidence: 0.76
- Safe recovery suggestion: Prefer a narrow dev-only fix, disable experimental motion/depth first if implicated, and rerun build/browser validation.
- Retry candidate: npm run agent:validate -- --skip-build
- Rollback candidate: fc58517 Add safe terminal mode for computer use
- Rollback executed: no
