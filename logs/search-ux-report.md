# Search UX Report

Generated: 2026-05-25T04:35:27.029Z
- Task: Node Search UX Improvement
- Product change: index search now uses deferred query stabilization.
- Loading state: shows `검색 중...` while deferred search catches up.
- Empty state: shows `검색 결과 없음` when no node/project matches.
- Keyboard navigation: Enter focuses first matching node; Escape clears search.
- Scope: small app/page.tsx search panel change only.
