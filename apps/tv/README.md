# Tarkman for Apple TV

A read-only Apple TV app for following a live service on a television (#213).
It is a separate Expo app from `apps/mobile`, ships on the **same App Store
record** (bundle ID `app.tarkman`), and shares only source packages with mobile:
never `node_modules`, an EAS project, update channels or OTA bundles.

Scope today is the foundation: a shell that lists services through the shared
reader engine. The live reader is #214; saved church and display setup is #215.
watchOS, Android TV, controller features and `apps/web` are out of scope.

## Compatibility gate

| | Version | Why |
| --- | --- | --- |
| Expo SDK | `~57.0.25` | Same SDK as mobile |
| React Native | `npm:react-native-tvos@0.86.3-0` (installed as `react-native`) | SDK 57 ships RN 0.86; the TV fork tracks mobile's `0.86.3` exactly |
| React | `19.2.3` | Same as mobile |
| `@react-native-tvos/config-tv` | `0.1.6` (exact) | Prebuild plugin; `isTV: true` is set in `app.json`, and scripts also set `EXPO_TV=1` |
| Xcode / tvOS SDK | Xcode 27.0, tvOS 27.0 SDK and simulator runtime | Verified locally, see [Evidence](#evidence) |
| Deployment target | tvOS 16.4 | Set by the plugin |

`package.json` sets `"overrides": { "react-native": "$react-native" }`. Without it,
npm installs a **second, upstream** `react-native@0.86.3` nested under
`@react-native-tvos/virtualized-lists`. That package's exact peer `0.86.3` is not
satisfied by the fork's prerelease version `0.86.3-0`. The bundle then contains two React Natives,
and the app dies at launch with *View config getter callback for component
`RCTText` must be a function*. This happened while building this app; the override,
the Metro guard and `check:runtime` each now reject it.

`npm run check:runtime` fails if there is not exactly one `react-native` install,
if the installed `react-native` is not the fork,
if Expo is not SDK 57, or if the fork or React stop matching mobile. Upgrade
both apps together: mobile's `react-native` `X.Y.Z` pairs with
`react-native-tvos@X.Y.Z-n`. Run `npx expo install --check` in `apps/tv` after
any change; it accepts this pairing today.

**UIScene lifecycle.** Apps linked against the tvOS 27 SDK (Xcode 27) must
adopt the UIScene lifecycle; UIKit traps at launch otherwise
(`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Expo SDK 57's
template still creates its window in the app delegate, so
`plugins/withSceneLifecycle.js` adds a scene manifest and a `SceneDelegate` that
starts React Native in the scene's window. The plugin throws if the Expo template
changes; remove it once the template adopts scenes.

Expo Router is not on Expo's tvOS support list, so the TV app uses a plain root
component (`index.ts` → `src/App.tsx`). Every native module added here must be
on that list (currently `expo-network`, `expo-status-bar` and `expo-updates`).

## One React Native per app

Expo recommends that, in a monorepo, every Expo project use the TV fork once
one of them does. That advice is for hoisted workspaces, where apps share one
`node_modules`. This repository has no workspaces and no root install: each app
has its own lockfile and `node_modules`. **Mobile stays on upstream
`react-native`, and TV uses `react-native-tvos`.** The only code the two apps
share is source in `packages/*`. Separate `node_modules` alone would not prove
isolation, so three guards make it an enforced invariant:

1. **Shared packages import no runtime.** `packages/tarkman-reader` imports only
   its own files and *type-only* `@tarkman/core`, so Babel erases every
   cross-package import (`npm run reader:check` from the root). `@tarkman/core`
   has its own platform-free boundary check. Neither package may declare
   dependencies.
2. **Metro rejects a foreign React.** Both apps' `metro.config.js` wrap resolution with
   `tools/metro/single-react-native.js`. Any `react`, `react-native`,
   `react-dom` or `scheduler` request, from any file in the graph including
   `packages/*`, must resolve inside that app's own `node_modules`, and the
   installed `react-native` must be the package the app declares
   (`react-native` for mobile, `react-native-tvos` for TV). A stray root or
   package-level install fails the bundle. Tests: `npm run metro:test`.
3. **Bundles are checked.** CI greps the tvOS bundle for `TVFocusGuideView`,
   code that exists only in the fork.

TypeScript resolves `@tarkman/core` from shared source through `paths` in each
app's `tsconfig.json`; nothing is resolved from the repository root.

Mobile changes: its `features/live/*` modules now bind the shared engine to
mobile's catalogs, benchmark bridge and lifecycle, with unchanged exports, and
its Metro config adds the guard above. Mobile Jest, typecheck, lint and
production web and iOS exports pass.

## Shared reader engine

`@tarkman/reader` (`packages/tarkman-reader`) owns revision/gap recovery,
content-context invalidation, occurrence-aware cursor identity, cancellation
and stale-state handling, the public read API client and the ActionCable client.
Hosts inject:

| Adapter | Mobile | TV |
| --- | --- | --- |
| `ReaderText` (copy) | `t()` from the mobile i18n catalogs | `src/text.ts` (English, typed exhaustively) |
| `ReaderObservability` | latency benchmark bridge | none (silent default) |
| `Lifecycle` | `createAppLifecycle(AppState, expo-network)` | same |
| `ReaderCache` | saved-service store (offline copy) | none: TV keeps no offline copy |

Endpoint environment variables are read in each app (`src/reader.ts`), where
the Expo bundler inlines them.

## Develop

```sh
npm ci --prefix apps/tv
cd apps/tv
export EXPO_PUBLIC_API_URL=https://www.tarkman.app EXPO_PUBLIC_ACTIONCABLE_URL=wss://www.tarkman.app/cable
npm run typecheck && npm run check:runtime && npm run check:identity
npm run tvos          # prebuild + build + launch on an Apple TV simulator (EXPO_TV=1)
npm start             # Metro only, for an installed development build
```

From the root: `npm run tv`, `npm run tv:tvos`, `npm run tv:typecheck`,
`npm run tv:export`, `npm run tv:check`.

A simulator needs the tvOS runtime: `xcodebuild -downloadPlatform tvOS`.
CocoaPods needs a UTF-8 locale (`export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`).
`ios/` is generated by `npm run prebuild:tvos` and ignored.

Unsigned simulator build without Expo CLI (as CI does it):

```sh
npm run prebuild:tvos -- --no-install && (cd ios && pod install)
xcodebuild -workspace ios/Tarkman.xcworkspace -scheme Tarkman -configuration Release \
  -sdk appletvsimulator -destination 'generic/platform=tvOS Simulator' \
  -derivedDataPath ios/build EXPO_TV=1 CODE_SIGNING_ALLOWED=NO build
```

## EAS project and updates

TV has **its own EAS project**, separate from mobile's
(`c76aa8c8-…`, slug `tarkman`), so a phone OTA bundle can never reach a TV
binary. Both projects submit to the same App Store Connect app; the Expo project is
not the App Store record.

The project is **`@mesropash/tarkman-tv`**
(`970aa9d7-0c63-448e-aa5d-189625964c5a`, created 2026-09-28 with `eas init`).
Its updates URL is `https://u.expo.dev/970aa9d7-…`, and builds embed it with
`EXUpdatesEnabled` and runtime version = app version. Channels are
`tv-development`, `tv-preview` and `tv-production`. Publish TV updates only from
`apps/tv`, for example `npx eas-cli update --channel tv-preview` with `EXPO_TV=1`.

`check:identity` fails if TV points at mobile's project or updates URL, uses a
non-`tv-` channel or one of mobile's channels, omits `EXPO_TV=1` from a build
profile, or submits anywhere other than mobile's App Store Connect app and team.
Runtime version follows `appVersion`, like mobile, but lives in a different project.

## Signing

tvOS uses the same bundle ID, team (`FHF872BAQR`) and distribution certificate
as iOS, but needs its **own tvOS App Store provisioning profile**. EAS CLI only
generates iOS profiles, so:

1. In the Apple Developer portal, create a **tvOS** App Store profile for
   `app.tarkman` using the existing distribution certificate (and a tvOS
   development or ad hoc profile for devices, if needed).
2. Either upload it to the TV EAS project's credentials (`eas credentials`,
   platform iOS) or use local credentials (`credentials.json` +
   `"credentialsSource": "local"` in the build profile, never committed).
3. Do not replace or revoke mobile's iOS profiles or certificate.

## App Store: add tvOS to the existing record

These steps change the production record and need the release workflow's
explicit authorization. Merging this README does not grant it.

1. Verify the live record: App Store Connect → Apps → Tarkman (ID `6810790124`)
   shows bundle ID `app.tarkman` under team `FHF872BAQR`.
2. **Add Platform → tvOS** on that record. The tvOS version has its own version
   number, build numbers, screenshots and review. The iOS version is unaffected.
3. Metadata: tvOS screenshots (1920×1080 or 3840×2160), description, and the
   App Store icon plus top shelf image. tvOS icons are layered 16:10 image stacks,
   not the square iOS icon; provide them via the plugin's `appleTVImages`
   option before the first submission.
4. Build and upload: `npx eas-cli build -p ios --profile production`, then
   `npx eas-cli submit -p ios --profile production` (from `apps/tv`, with
   `EXPO_TV=1` set by the profile). Or archive in Xcode and upload with Transporter.
5. TestFlight: install on a physical Apple TV and verify launch, remote focus,
   service list and reconnect after network loss.
6. Release verification: the iOS app's version, build and update channel are
   unchanged; the TV build reports the TV EAS project and a `tv-*` channel.

## Evidence

Record each result separately. A simulator launch is not App Store acceptance.

| Check | Result |
| --- | --- |
| `expo install --check` (SDK 57 + react-native-tvos 0.86.3-0) | Pass, 2026-09-28 |
| JS bundle: TV contains `TVFocusGuideView`/`TVEventHandler`; mobile contains neither | Pass, 2026-09-28 |
| Prebuild: `SDKROOT = appletvos`, device family 3, `platform :tvos` | Pass, 2026-09-28 |
| `expo-doctor` | 21/21 pass, 2026-09-28 |
| Xcode 27.0 Release build, tvOS 27.0 simulator SDK (`app.tarkman`, `appletvsimulator`, min tvOS 16.4) | Pass, 2026-09-28 |
| Launch on Apple TV 4K (3rd gen, 1080p) simulator, tvOS 27.0, production API | Pass, 2026-09-28: renders, completes a reader recovery, "No services right now." matches the API's empty response |
| EAS project `@mesropash/tarkman-tv` created; updates URL embedded in prebuild | Done, 2026-09-28 |
| Physical Apple TV build and launch | Not yet done (needs a tvOS development profile) |
| TestFlight / App Store acceptance | Not yet done (needs release authorization) |
