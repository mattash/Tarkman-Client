# Isolated opening-only Siri prototype

This directory is an inert overlay, **not** part of the normal mobile app or its
native dependency graph. Expo autolinks installed native dependencies even when
a config plugin/JS handler is disabled; an environment flag alone is not isolation.
Do not install `expo-app-intents` in the normal mobile manifest.

## Prepare external copies

From the repository root, choose two **new absolute directories outside the
repository**, with existing, real (non-symlink) parent directories. On macOS use
`/private/tmp`, not the `/tmp` symlink. Example:

```sh
node spikes/siri-shortcuts/prepare.mjs --baseline /private/tmp/tarkman-siri-before-275
node spikes/siri-shortcuts/prepare.mjs /private/tmp/tarkman-siri-after-275
```

The script exports only `apps/mobile`, `packages`, and root `vercel.json`
(required by the universal-links tests) from immutable base commit
`d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`, then runs `npm ci` in the copied
mobile app. The prototype additionally overlays Swift, its JS opening handler,
and tests, patches the root layout exactly once, and runs
`npm install --save-exact expo-app-intents@0.5.17` **only in that copy**.
No existing destination is reused/overwritten/deleted; failed partial outputs are
left for inspection. No signing, build, prebuild, device, EAS or GitHub commands
are run by preparation. No credentials or local native output are copied.

Both copies **unconditionally** use name `Tarkman Siri Spike`, bundle ID
`app.tarkman.sirispike`, slug/scheme `tarkman-siri-spike`, no universal-link
association, no production EAS project, and disabled updates without the production
update URL. Missing environment variables cannot select the production identity.
Do not provision a production EAS project for either copy.

`--baseline` is the genuine Before app: no intent dependency/plugin/watched Swift
directory, no handler import/mount, and no prototype tests or native declarations.
The two copies intentionally use the same isolated identity for controlled
before/after captures; they cannot coexist as separate installed apps. Existing
spike app data can survive replacement: record install/reset state.
Neither copy uses production app storage because its bundle ID differs.

## Native verification (manual, after preparation)

Run mobile commands only from the selected copy's `apps/mobile` directory. No
`TARKMAN_SIRI_SPIKE` flag is needed; both configs are always isolated.

```sh
export SENTRY_DISABLE_AUTO_UPLOAD=true
export EXPO_PUBLIC_LIBRARY_ENABLED=1 EXPO_PUBLIC_API_URL=https://www.tarkman.app
npx expo config --type public
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -list -workspace ios/TarkmanSiriSpike.xcworkspace
# Use a team authorized for the generated app.tarkman.sirispike bundle ID:
xcodebuild -workspace ios/TarkmanSiriSpike.xcworkspace -scheme TarkmanSiriSpike \
  -configuration Release -destination 'generic/platform=iOS' -jobs 2 \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=FHF872BAQR build
```

Signing and physical cold/warm/error verification require an authorized developer
account and device. Inspect the resolved isolated identity before building; never
reuse a provisioning profile restricted to production `app.tarkman`. Preparation
does not perform these operations or install/reset either app.
The prototype is opening-only: no entities, indexing, donations, playback, or
service control. Native dispatch queues a request, not a claim that content loaded.

## Checks (no dependency installation)

```sh
node --test spikes/siri-shortcuts/prepare.test.mjs
```

These tests export disposable pinned copies without npm/network work and verify
unconditional isolated configuration, baseline absence of native/JS integration,
path rejection and unchanged production source bytes. Test copies remain in the
OS temporary directory for inspection. After preparation, the prototype copy can
run its existing tests using `npx jest tests/siri-opening.test.ts tests/siri-handler.test.tsx --runInBand`.
