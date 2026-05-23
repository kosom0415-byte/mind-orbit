# Recovery Patterns

## Safe Auto-Fix Candidates
- Build fail from narrow type/import issue
- Undefined access with local null guard
- Hook dependency warning that can be solved by extracting pure helper
- Hydration mismatch caused by browser-only read during first render

## Manual Review Required
- Edits to `app/page.tsx`, `app/globals.css`, core hooks, NodeLayer, EdgeLayer
- Any production deploy, rollback, promote, or alias change
- Any env/API key/auth/security setting
- Any dependency major upgrade or force install

## Rollback Recommendation Rules
- Production load failure or critical runtime crash: recommend recent stable commit first
- Unknown failure after two retries: stop and escalate
- Experimental depth/camera/motion/animation layer suspected: disable before UX improvements

## Next Automation Recommendation
- Connect self-heal dry-run output to task queue so risky auto-fix candidates become blocked tasks with approval requirements.