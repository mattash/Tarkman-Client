# Repository Guidelines

## Repository layout

- `apps/web` contains the existing Vite client. All web-relative paths below
  (`app/`, `public/`, `.env*`, configs and `dist/`) are relative to `apps/web`.
- Root `npm run dev/build/preview/typecheck/test/test:coverage/test:integration`
  scripts run in `apps/web` via explicit npm prefixes. Each app has its own
  `package-lock.json` and `node_modules`; there are no npm workspaces or root
  dependencies. Install with `npm ci --prefix apps/web` and, separately,
  `npm ci --prefix apps/mobile` from the repository root.
  Run direct `npx vitest` commands from `apps/web`.
- `apps/mobile` is a separate managed Expo Router app. Use `npm run mobile` from
  root; see `apps/mobile/README.md`. Run all EAS commands only in `apps/mobile`.
  EAS is intentionally unlinked until the owner chooses an Expo account/team.
- Vercel uses repository root configuration and serves `apps/web/dist`.

## Project Structure & Module Organization
- Frontend lives in `app/` (React + TypeScript). Key folders: `components/` (UI atoms/organisms), `routes/` (TanStack Router tree compiled into `routeTree.gen.ts`), `queries/` (API wrappers + TanStack Query keys), `contexts/` and `hooks/` for shared state and utilities, `types/` for shared interfaces.
- Vite entry points: `document.tsx` and `entry-client.tsx`. Styles are centralized in `app/styles.css` with Tailwind layers; design tokens in `tailwind.config.js`.
- Static assets sit in `public/`; production artifacts build to `dist/`. Path alias `@/*` resolves to `app/*`.

## Build, Test, and Development Commands
- `npm run dev` — start the Vite dev server with HMR.
- `npm run build` — generate a production bundle in `dist/`.
- `npm run preview` — serve the built bundle locally for smoke tests.
- `npm run test` — run Vitest (jsdom environment, globals from `vitest.setup.ts`).
- `npm run test:coverage` — Vitest with coverage reporting.
- `npm run test:integration` — focused integration suite for query flows.

## Coding Style & Naming Conventions
- TypeScript throughout; `strictNullChecks` is enabled. Prefer typed props and explicit return types on shared utilities.
- Components: PascalCase filenames (`SessionList.tsx`); hooks: camelCase with `use*` prefix. Keep modules cohesive (UI logic in `components`, data fetching in `queries`).
- Styling: Tailwind utility-first; compose with `clsx`/`cva` where needed. Co-locate component styles; avoid ad hoc inline styles when a Tailwind token exists.
- Imports should honor the `@/` alias for app-local modules; favor absolute imports over deep relative paths.

## Testing Guidelines
- Test files live in `app/queries/__tests__/` with `*.test.ts` for unit-level checks and `*.integration.test.ts` for API/query orchestration.
- Keep tests deterministic (mock network/pusher). Add coverage for new query keys and route loaders; prefer interaction-level assertions over implementation details.
- Run `npm run test` before submitting; add `npm run test:coverage` when touching critical flows.

## Commit & Pull Request Guidelines
- Commits in history use clear, present-tense summaries (e.g., “Update text size in SessionPartsParallel”). Follow that pattern; scope to one concern.
- PRs should include: what changed and why, tests run (with command output), linked issues, and screenshots/GIFs for UI-affecting changes (especially route or component updates).
- Note any config/env changes (`.env.local` variables like `VITE_API_URL`, `VITE_PUSHER_APP_KEY`) and backward-compatibility considerations.

## Environment & Deployment Notes
- Local env goes in `.env.local`; keys are consumed via Vite `import.meta.env`. Never commit secrets.
- Vercel deploys are supported via `vercel.json`; ensure production builds with `npm run build` succeed before pushing.
