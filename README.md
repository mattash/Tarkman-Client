# Tarkman Client

A modern React + Vite front-end for the [Tarkman](https://tarkman.app) platform – a digital companion for Armenian Church services that delivers real-time liturgical texts, translations, and explanations.

---

## ✨ Features

- **Real-time service tracking** powered by ActionCable
- **Multilingual support** (Classical Armenian, English, Russian)
- **Large-screen display mode** for in-church projectors (`/sessions/display` route)
- **Rich explanations drawer** with on-demand liturgical context
- **Fast client-side routing** via TanStack Router
- **Data-fetching & caching** via TanStack Query
- **Tailwind CSS design system** with dark-mode support

## 🛠 Tech Stack

| Category      | Library / Tool                              |
| ------------- | ------------------------------------------- |
| Framework     | [React 18](https://react.dev/)              |
| Build Tool    | [Vite 5](https://vitejs.dev/)               |
| Language      | TypeScript                                  |
| Routing       | [@tanstack/react-router](https://tanstack.com/router) |
| Data Fetching | [@tanstack/react-query](https://tanstack.com/query)    |
| Styling       | [Tailwind CSS v3](https://tailwindcss.com/) |
| Realtime      | ActionCable (WebSocket)                     |
| UI Primitives | [Radix UI](https://www.radix-ui.com/) + [Vaul](https://vaul.sh/) |

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js ≥ 22.13** for the Expo app. The existing
  web CI matrix remains Node 18/20/22; the Vercel runtime upgrade stays in #68.
- **npm** (each app has its own `package-lock.json`)

### 2. Clone & Install

```bash
# clone the repo
git clone https://github.com/your-org/tarkman-client.git
cd tarkman-client

# install the web app dependencies
npm ci --prefix apps/web
# install mobile separately when needed (Node >=22.13)
npm ci --prefix apps/mobile
```

### 3. Configure Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and set the required API URL. The other
runtime settings are optional:

```env
VITE_API_URL=https://api.example.com

# Optional: defaults to 2 when unset
VITE_DEFAULT_CHURCH_ID=2

# Optional: defaults to same-origin /cable when unset
# VITE_ACTIONCABLE_URL=wss://api.example.com/cable

# Optional: runtime error reporting configuration
# VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
# VITE_SENTRY_ENVIRONMENT=production
```

`VITE_APP_VERSION` is supplied by the production build and should not be set manually.

### 4. Run the Dev Server

```bash
npm run dev
```

Vite starts on http://localhost:3000 by default.

### 5. Production Build

```bash
npm run build     # create optimized assets in apps/web/dist
npm run preview   # serve the production build locally
```

---

## 📂 Project Structure (excerpt)

```
apps/web/app/
 ├─ components/         # Reusable UI components
 ├─ contexts/           # React context providers (auth, language)
 ├─ hooks/              # Custom hooks (ActionCable, polling, etc.)
 ├─ queries/            # API abstraction & TanStack Query keys
 ├─ routes/             # File-based routes (compiled by TanStack Router)
 ├─ types/              # Shared TypeScript interfaces
 └─ entry-client.tsx    # React/Vite bootstrap
apps/web/public/        # Static assets served as-is
apps/mobile/            # Managed Expo Router app (placeholder only)
apps/web/package-lock.json    # Vite app dependency lock (React 18)
apps/mobile/package-lock.json # Expo app dependency lock (React 19)
package.json                  # Convenience scripts only; no root dependencies
```

---

## 🏃‍♂️ Available NPM Scripts

| Script        | Purpose                                 |
| ------------- | --------------------------------------- |
| `dev`         | Start Vite dev server with HMR          |
| `build`       | Bundle the app for production           |
| `preview`     | Preview the production bundle locally   |
| `typecheck`   | Typecheck the web app                    |
| `test`        | Run web unit tests once                  |
| `test:coverage` | Run web tests with coverage             |
| `test:integration` | Run web integration tests            |
| `mobile`      | Start Expo Metro / Expo Go               |
| `mobile:ios` / `mobile:android` | Start Expo for a simulator/emulator |
| `mobile:web` | Start the Expo placeholder in a browser |
| `mobile:export` | Export the Expo placeholder to apps/mobile/dist |
| `mobile:typecheck` | Typecheck the Expo app                |
| `mobile:config` | Print public Expo config                |

Root web scripts forward arguments to `apps/web` using explicit npm prefixes. For example,
`npm run dev -- --host` or `npm run test -- app/queries/__tests__/sessionQueries.test.ts`.
Direct app commands also work: `cd apps/web && npm run build`.
These are two independently installed apps in one repository, with no npm
workspaces, combined lockfile, or root dependencies. Run `npm ci --prefix apps/web`
and `npm ci --prefix apps/mobile` separately; each uses its own lockfile and
`node_modules`. When migrating an existing checkout, remove the old root
`node_modules` before installing so Expo cannot resolve hoisted React 18.
The web app keeps React 18 and its original compatible dependency lock; the Expo
app keeps React 19 isolated for native builds.

## Mobile foundation

`apps/mobile` is a separate TypeScript managed Expo app using Expo Router, with
one placeholder home screen. No web screens have been migrated. Start it with
`npm run mobile` from the root, or `cd apps/mobile && npm start`. Use a compatible
Expo Go app or an iOS simulator / Android emulator. The `ios` and `android` scripts
start Metro; they do not create native projects or cloud builds.

See [mobile setup and future EAS initialization](apps/mobile/README.md). The app
is deliberately unlinked: the owner must choose an Expo account/team before
running `eas init`, **only from `apps/mobile`**. The old Vinxi `app.config.ts`
lives exclusively under `apps/web`, outside Expo's app root.

Mobile public environment placeholders are in `apps/mobile/.env.example`;
see its README for development, preview, and production configuration.
Web environment examples are under `apps/web`; integration-test setup uses
`apps/web/.env.test.example`. Existing real `.env*` files are not moved or copied.
If you have local settings at the old root, configure `apps/web/.env.local`
yourself. The mobile placeholder requires no environment variables.

---

## ☁️ Deployment

Vercel uses the root `vercel.json`. Keep the Vercel project's **Root Directory at
repository root** (blank / `.`), framework **Vite**, install command
`npm ci --prefix apps/web`,
build command `npm run build --prefix apps/web`, and output directory `apps/web/dist`. Remove any
project-level overrides pointing to the old `dist` location. The existing SPA
rewrite to `/index.html` is preserved. Keep web environment variables in the
Vercel project settings. No deployment or remote settings are changed by this
reorganization.

The web-only install isolates Vercel from Expo's Node requirement. The root
manifest intentionally has no new Node engine constraint; runtime changes belong
to [#68](https://github.com/mattash/Tarkman-Client/issues/68).

Other static hosts should also serve `apps/web/dist`.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repo & create your branch (`git checkout -b feature/awesome-feature`).
2. Follow the existing coding conventions (see `.cursorrules`).
3. Run `npm run dev` and ensure no linter/typescript errors.
4. Submit a pull request describing your changes.

---

## 📜 License

[ISC](LICENSE)

Copyright © 2024
