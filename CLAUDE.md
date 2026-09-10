# CLAUDE.md

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

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
npm run dev           # Start Vite dev server with HMR at http://localhost:3000
npm run build         # Bundle the app for production (outputs to dist/)
npm run preview       # Preview the production bundle locally
```

### Testing
```bash
npm test              # Run web unit tests once
npm run test:coverage # Run tests with coverage report
npm run test:integration # Run integration tests only

# Run a single test file
npx vitest run path/to/test.test.ts

# Run tests for a specific query file
npx vitest run app/queries/__tests__/sessionQueries.test.ts
```

#### Integration Test Setup
Integration tests require authentication credentials. To run them:
1. Copy `.env.test.example` to `.env.local` or `.env.test`
2. Add your test credentials to `VITE_TEST_EMAIL` and `VITE_TEST_PASSWORD`
3. Integration tests will be skipped if credentials are not provided

## Architecture Overview

### Tech Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Routing**: TanStack Router (file-based routing)
- **Data Fetching**: TanStack Query with custom query keys and functions
- **Real-time**: ActionCable (WebSocket) for live service updates
- **Styling**: Tailwind CSS + Radix UI primitives
- **API Client**: Axios with interceptors for auth

### Core Architecture Patterns

#### 1. Data Flow Architecture
The application uses a unidirectional data flow:
- **API Layer** (`app/api.ts`): Axios instance with auth interceptors
- **Query Functions** (`app/queries/*.ts`): Fetch functions and query key factories
- **TanStack Query**: Caching, refetching, and state management
- **Components**: Consume data via hooks

#### 2. Query Key Strategy
All queries use hierarchical key factories for consistent cache invalidation:
```typescript
// Pattern used throughout app/queries/
export const queryKeys = {
  all: ['resource'] as const,
  list: () => [...queryKeys.all, 'list'] as const,
  detail: (id: string) => [...queryKeys.all, id] as const,
}
```

#### 3. Authentication Flow
- `AuthContext` provides `user`, `token`, `setAuth()`, `logout()`
- Token stored in localStorage, automatically attached via axios interceptor
- 401 responses trigger automatic token refresh with retry logic
- Refresh failure redirects to `/login`

#### 4. Real-time Updates
- `useActionCable` hook (also exported under a legacy compatibility name) subscribes to Rails ActionCable channels for live service updates
- `useSessionPolling` provides fallback polling for display routes
- Real-time part updates broadcast via ActionCable events (`part_change`, `status_change`, `explanation_updated`)

#### 5. Session and Parts Data Model
The application centers around **Sessions** (church services) that contain **Parts** (liturgical sections):
- Sessions have liturgies, which contain ordered parts
- Multi-liturgy sessions may require fallback to liturgy parts API
- `fetchSessionParts` in `app/queries/sessions.ts` handles this logic automatically
- Parts contain text in multiple languages (Classical Armenian, English, Russian, Transliteration)

#### 6. Language Selection
- `LanguageContext` manages selected language: `en | ru | grabar | translit`
- Language preference persists across navigation
- Components render content based on selected language

#### 7. Display Mode vs Control Mode
Two distinct UI modes:
- **Display Mode** (`/sessions/display`): Large-screen projector view with auto-polling
- **Control Mode** (`/sessions/:id/parts`): Admin interface with `SessionControls` for authenticated users
- Root layout conditionally hides Navbar for display routes

#### 8. Explanations System
Explanations provide liturgical context for parts:
- Can be fetched per-session, per-liturgy, or per-part
- `ExplanationDrawer` component displays explanations for unauthenticated users
- Query functions handle multiple response structures and 404 gracefully

### File Organization
```
app/
├── api.ts                  # Axios instance with auth interceptors
├── components/             # Reusable UI components
├── contexts/              # Global state (AuthContext, LanguageContext)
├── hooks/                 # Custom hooks (useActionCable, useSessionPolling, usePartScroll)
├── queries/               # TanStack Query functions and keys
│   ├── sessions.ts        # Session and parts fetching/mutations
│   ├── partQueries.ts     # Individual part fetching
│   ├── explanationQueries.ts # Explanations fetching
│   └── __tests__/         # Query tests (unit + integration)
├── routes/                # File-based routes (TanStack Router)
│   ├── __root.tsx         # Root layout with QueryClient and AuthProvider
│   ├── sessions.$id.parts.tsx # Control interface
│   └── sessions.display.tsx   # Projector display mode
└── types/                 # TypeScript interfaces
```

### Path Aliases
The project uses `@/*` as an alias for `app/*`:
```typescript
import { useAuth } from '@/contexts/AuthContext'
import { SessionParts } from '@/components/SessionParts'
```

### Environment Variables
Copy `.env.example` to `.env.local` and set the required API URL:
- `VITE_API_URL`: Backend API base URL
- `VITE_DEFAULT_CHURCH_ID` (optional): Fallback church ID; defaults to `2`
- `VITE_ACTIONCABLE_URL` (optional): Full ActionCable WebSocket URL (e.g., `wss://api.example.com/cable`). Defaults to `/cable` on the same origin.
- `VITE_SENTRY_DSN` and `VITE_SENTRY_ENVIRONMENT` (optional): Runtime error reporting configuration.
- `VITE_APP_VERSION`: Supplied by the production build; do not set it manually.

## Code Style (from .cursorrules)

### Response Constraints
- Do not remove existing code unless necessary
- Do not remove comments or commented-out code unless necessary
- Do not change import formatting
- Do not change code formatting unless important for new functionality

### General Principles
- Write concise, technical TypeScript code
- Use functional and declarative patterns; avoid classes
- Prefer iteration and modularization over duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Structure files: exported component, subcomponents, helpers, static content, types
- Prefer TanStack Query and TanStack Router

### TypeScript
- Use TypeScript for all code
- Prefer interfaces over types
- Avoid enums; use maps instead
- Use functional components with TypeScript interfaces

### Syntax
- Use `function` keyword for pure functions
- Use curly braces for all conditionals
- Use declarative JSX

### Naming
- Use lowercase with dashes for directories (e.g., `auth-wizard`)
- Favor named exports for components

### Performance
- Use immutable data structures
- Optimize network requests and data fetching strategies
- Use efficient algorithms and rendering strategies
