# Tarkman mobile

Minimal managed Expo SDK 57 + TypeScript + Expo Router foundation. The only route
is a placeholder home screen. App name: `Tarkman`; slug/scheme: `tarkman`; iOS
bundle identifier and Android package: `app.tarkman`. No owner, EAS project ID,
credentials, or update URL is configured.

## Local development

Use Node >=22.13 and npm. Install dependencies in the mobile app root:

```sh
cd apps/mobile
npm ci
npm start
# Alternatively: npm run ios / npm run android
npm run lint
npm run typecheck
npm run web
npm run export:web
npm run config
npx expo install --check
npm ls --all
npx expo-doctor
```

Expo Go can open this placeholder without EAS initialization. Simulator/emulator
launches require the appropriate local platform tooling. The development build
profile uses `expo-dev-client`; after a development client has been built and
installed in a later task, use `npm start -- --dev-client`. No custom Metro or
Babel configuration is needed. The apps are independently installed, each with
its own lockfile and `node_modules`; there is no root npm workspace tree. Install
web separately with `npm ci --prefix apps/web` from the repository root. Remove
old root `node_modules` when migrating from the combined install so Expo cannot
resolve the web app's React 18. React Native Web
serves the same placeholder in the browser and exports to `apps/mobile/dist`.
The deployed website remains the Vite app in `../web`.

Mobile lint uses ESLint 10 with the recommended [TypeScript](https://typescript-eslint.io/getting-started/)
and [React Hooks](https://react.dev/reference/eslint-plugin-react-hooks) flat
configs. Expo's preset currently depends on React/import plugins whose peer
ranges exclude ESLint 10, so those plugins are not installed. Run `npm run lint`
from `apps/mobile`; CI runs the same command before typecheck and fails on
warnings as well as errors.
Generated Expo files and web exports are ignored. No formatting or Tailwind
class rules are added, leaving the NativeWind v4 direction unconstrained.
This implements only the lint gate portion of [#78](https://github.com/mattash/Tarkman-Client/issues/78).

SDK 57 requires Node >=22.13 according to the
[Expo compatibility table](https://docs.expo.dev/versions/latest/). Its engine
constraint and CI job apply only to mobile. The existing web CI matrix is
preserved, and Vercel runs `npm ci --prefix apps/web`; its Node 24 runtime upgrade
remains separate in [#68](https://github.com/mattash/Tarkman-Client/issues/68).

## Public environment configuration

The placeholder makes no network requests and needs no environment variables.
`.env.example` reserves `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ACTIONCABLE_URL`, and
`EXPO_PUBLIC_DEFAULT_CHURCH_ID` for later integration; it contains no live values.
Copy it to ignored `.env.local` for development. For future preview/production
exports, supply that environment's public values through the invoking process;
after owner selection, configure the matching EAS environments for native builds.
All `EXPO_PUBLIC_*` values are readable in the client bundle and must not contain
secrets. Future code reads them via `process.env.EXPO_PUBLIC_API_URL` (and the
corresponding other keys), never Vite's `import.meta.env`.

Use absolute HTTPS API and WSS ActionCable URLs reachable from the device. A
browser-relative `/cable` URL has no native origin, and `localhost` on an iPhone
refers to the phone. Environment-specific endpoints and device reachability
remain to be verified when live API integration is authorized.

## Future EAS initialization — owner action

First choose the Expo account/team that should own Tarkman. Only after that
choice, start from the repository root and run:

```sh
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest project:info
```

Confirm the selected account/team during initialization and review the generated
`owner` / `extra.eas.projectId` before accepting those configuration changes.
Always run EAS commands from `apps/mobile`, never the repository root or
`apps/web`: the latter contains a legacy Vinxi `app.config.ts`, not an Expo config.
Before initialization, `project:info` may report no linked project or require
login. Do not initialize just to make that validation pass.

`eas.json` is ready for later setup:

- `development`: internal distribution, development client, iOS simulator (no
  Apple signing needed for that simulator target).
- `preview`: internal distribution for iOS device testing; signing/provisioning
  must be arranged later.
- `production`: store distribution; versions are managed locally in app config.

These profiles do not create builds by themselves. Initialization, account/team
selection, Apple credentials, builds, submissions, updates, and deployment are
separate future actions. No credentials belong in this repository. The placeholder
requires no `.env` file; web environment examples remain in `../web`.

## Scope and follow-up

Consulted issues: [#69](https://github.com/mattash/Tarkman-Client/issues/69),
[#70](https://github.com/mattash/Tarkman-Client/issues/70),
[#71](https://github.com/mattash/Tarkman-Client/issues/71), and the
[#81 roadmap](https://github.com/mattash/Tarkman-Client/issues/81).
This foundation does not close those issues: styling, route parity, shared-core
architecture, and OS/device support decisions remain open. The small built-in
StyleSheet only positions the placeholder; it does not select a styling system.
iOS is the initial native publication target. Android compatibility is retained
without Android store/release work. Simulator/device launch and the iOS
development build required by #71 remain later validation; this task does not
initialize EAS, provision credentials, or create builds.

References: [Expo Router installation](https://docs.expo.dev/router/installation/),
[Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/), and
[EAS monorepo setup](https://docs.expo.dev/build-reference/build-with-monorepos/).
