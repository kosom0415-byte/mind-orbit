# Architecture

## Project structure

- `app/`
  - `page.tsx`: main client page and UI composition.
  - `globals.css`: global styling and application-wide CSS rules.
  - `layout.tsx`: page layout wrapper.
  - `api/`: server route handlers.

- `hooks/`
  - `useSelection.ts`: selection state and drag selection logic.
  - `useGestures.ts`: pointer gestures, panning, zooming, and drag workflow.

- `lib/mind/`
  - `edgeEngine.ts`: edge generation and sanitization.
  - `visibilityEngine.ts`: edge visibility logic and opacity rules.
  - `types.ts`: shared graph and node types.
  - `edgeRender.ts`: edge styling helpers.

- `README.md`: project overview and developer notes.
- `package.json`: dependencies and npm scripts.
- `tsconfig.json`: TypeScript configuration.

## Key architecture points

- The project uses Next.js app router with React client components.
- Selection and gesture logic are separated into custom hooks for reuse and maintainability.
- Graph edges are generated, merged, and filtered by dedicated engine modules.
- Visibility rules are encapsulated in `visibilityEngine.ts` to preserve existing rendering behavior.
- Styling is maintained in CSS and lifted as reusable classes where appropriate.
