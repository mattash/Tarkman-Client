# Repository Guidelines

## Repository layout

- `apps/mobile` is the production client: a managed Expo Router app that ships
  to iOS and, as an Expo web export, to `web.tarkman.app` (cutover #177, PR #194).
  Root `npm run dev/build/test/typecheck/lint` run in `apps/mobile`; the
  `mobile:*` scripts remain. See `apps/mobile/README.md`. Run mobile EAS
  commands only in `apps/mobile`.
- `apps/tv` is the read-only Apple TV app (Expo + react-native-tvos, #213). It
  ships on the same App Store record as mobile (`app.tarkman`) but has its own
  EAS project, update channels (`tv-*`) and lockfile. Run TV EAS commands only in
  `apps/tv`, never with mobile's project or channels. Its scripts are `npm run tv:*`.
  See `apps/tv/README.md`.
- `packages/tarkman-reader` is the platform-free live reader engine both apps
  bundle from source. It must not import React, React Native or Expo; its guard
  is `npm run reader:check`. Mobile's `features/live/*` bind it to mobile copy.
- `apps/web` is the **deprecated** Vite client. It no longer deploys anywhere; it is
  kept only until the post-cutover rollback window closes, then removed. Do not add
  features to it. Its scripts are `npm run legacy-web:*`. Everything below the
  "Legacy apps/web" heading describes this app, and web-relative paths there
  (`app/`, `public/`, `.env*`, configs and `dist/`) are relative to `apps/web`.
- Each app has its own `package-lock.json` and `node_modules`; there are no npm
  workspaces or root dependencies. Install with `npm ci --prefix apps/mobile`
  (`npm ci --prefix apps/tv` when touching TV or shared packages, and
  `npm ci --prefix apps/web` only when touching the legacy app).
- Vercel uses the repository root `vercel.json`: it builds `npm run mobile:export`,
  serves `apps/mobile/dist`, and redirects legacy Vite paths
  (`/sessions/:id/explanations`, `/login`, `/dashboard`, `/part/:id`).
  Tests for the redirects and the Apple association file live in
  `apps/mobile/tests/universal-links.test.ts`.

# Legacy apps/web (deprecated)

The sections below describe the deprecated Vite client in `apps/web`. Run the
commands below from `apps/web`, or use `npm run legacy-web:*` from the root.

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
