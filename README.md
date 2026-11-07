# Tarkman Client

Clients for the [Tarkman](https://tarkman.app) platform – a digital companion for Armenian Church services that delivers real-time liturgical texts, translations, and explanations.

> **Production client:** `apps/mobile`, an Expo Router app for iOS and, via its web
> export, `web.tarkman.app` (since the September 25, 2026 cutover, #177 / #194).
> See [apps/mobile/README.md](apps/mobile/README.md).
>
> **Deprecated:** `apps/web`, the original React + Vite client. It no longer deploys
> and is kept only for the rollback window; most of this README describes it.

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

# install the production app (Node >=22.13)
npm ci --prefix apps/mobile
# install the deprecated Vite app only when touching it
npm ci --prefix apps/web
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
| `mobile:ios` / `mobile:android` | Start Expo for an iOS simulator or the internal/future Android emulator path |
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

## Mobile (production)

`apps/mobile` is the production Expo Router app. From the root, `npm run dev`
starts it for the web, `npm run mobile` starts Metro, and `npm run build`,
`npm test`, `npm run typecheck` and `npm run lint` run in `apps/mobile`. The
deprecated Vite app's scripts are `npm run legacy-web:*`.

See [mobile setup and EAS configuration](apps/mobile/README.md). Mobile EAS
configuration belongs under `apps/mobile`; run mobile EAS commands there. Mobile
public environment placeholders are in `apps/mobile/.env.example`.

The read-only Apple TV app lives in `apps/tv` with its own install, EAS project
and update channels; see [the TV README](apps/tv/README.md) and the `tv:*` scripts.
Both apps bundle the live reader engine from `packages/tarkman-reader`.

---

## ☁️ Deployment

Vercel uses the root `vercel.json` with the project's **Root Directory at
repository root**. It installs `npm ci --prefix apps/mobile`, builds
`npm run mobile:export`, and serves `apps/mobile/dist` with an SPA rewrite to
`/index.html`. Merges to `main` deploy to production at `web.tarkman.app`.

`vercel.json` also:

- serves `/.well-known/apple-app-site-association` as JSON for iOS universal links;
- redirects legacy Vite paths still found in QR codes and bookmarks:
  `/sessions/:id/explanations` → `/sessions/:id/parts`, `/login` → `/sign-in`,
  and `/dashboard` and `/part/:id` → `/`. The redirects are temporary (307) so a
  rollback is not fought by cached redirects.

`apps/mobile/tests/universal-links.test.ts` covers both.

**Rollback.** Until `apps/web` is removed, the last Vite production deployment
(commit `8e57c50`, `tarkman-client-ieyoyof0a-mattashs-projects.vercel.app`) can be
promoted back in Vercel. Record any change to that target in #177.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repo & create your branch (`git checkout -b feature/awesome-feature`).
2. Follow the existing coding conventions (see `.cursorrules`).
3. Run `npm run dev` and ensure no linter/typescript errors.
4. Submit a pull request describing your changes.

---

## 📜 License

Original Tarkman Client source code is licensed under [ISC](LICENSE).

Copyright © 2024–2026 Fr. Mesrop Ash and contributors.

Third-party code, data, and assets retain their respective licenses and notices,
including the lectionary package's [Apache-2.0 license](packages/tarkman-lectionary/LICENSE)
and [NOTICE](packages/tarkman-lectionary/NOTICE), and the
[Noto Serif Armenian](apps/mobile/assets/fonts/OFL.txt) and
[Source Serif 4](apps/mobile/assets/fonts/SourceSerif-LICENSE.md) font licenses.
