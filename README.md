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

- **Node.js ≥ 18** (tested on 20.x)
- A package manager – npm (shipped with Node), Yarn, or pnpm

### 2. Clone & Install

```bash
# clone the repo
git clone https://github.com/your-org/tarkman-client.git
cd tarkman-client

# install dependencies
npm install # or pnpm install / yarn
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and set the required API URL. The other
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

### 4. Run the Dev Server

```bash
npm run dev
```

Vite starts on http://localhost:3000 by default.

### 5. Production Build

```bash
npm run build     # create optimized assets in /dist
npm run preview   # serve the production build locally
```

---

## 📂 Project Structure (excerpt)

```
app/
 ├─ components/         # Reusable UI components
 ├─ contexts/           # React context providers (auth, language)
 ├─ hooks/              # Custom hooks (ActionCable, polling, etc.)
 ├─ queries/            # API abstraction & TanStack Query keys
 ├─ routes/             # File-based routes (compiled by TanStack Router)
 ├─ types/              # Shared TypeScript interfaces
 └─ entry-client.tsx    # React/Vite bootstrap
public/                 # Static assets served as-is
```

---

## 🏃‍♂️ Available NPM Scripts

| Script        | Purpose                                 |
| ------------- | --------------------------------------- |
| `dev`         | Start Vite dev server with HMR          |
| `build`       | Bundle the app for production           |
| `preview`     | Preview the production bundle locally   |

---

## ☁️ Deployment

This repository includes a minimal `vercel.json`. Deploying to [Vercel](https://vercel.com/) is as simple as pushing to master/main

Other static hosts (Netlify, Cloudflare Pages, Render, etc.) work just as well – simply serve the `dist/` output directory.

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
