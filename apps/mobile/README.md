# Tarkman mobile

Managed Expo SDK 57, React Native and Expo Router. The home route is a public, read-only live-session reader behind three tabs (Today, Services, Settings). The development-only `/gallery` route
retains the Expo 05 static liturgy examples (`en`, `ru`, `grabar`, `translit`) and
works without network configuration. This app's Expo web export is the
production website at `web.tarkman.app` (cutover #177); the Vite app in `../web`
is deprecated.

## v1 platform scope

Tarkman mobile v1 supports **iOS**; the mobile web export remains supported as
part of the web experience. Android status: **testable Android build; not yet a
Play release** (#191, stage 1 of #189). The same app (`app.tarkman`) builds an
installable APK from the `development` and `preview` EAS profiles, and CI
compiles it; see [Android APK builds](#android-apk-builds--191). There is no
Google Play listing, production AAB, or verified HTTPS App Link yet, and the
device verification matrix (reader, part detail, service control, sheets, Back
gesture) is tracked in #191 rather than claimed here.

## Develop and verify

Use Node >=22.13; install each app independently. No workspaces or root install.

```sh
cd apps/mobile
npm ci
npm start -- --dev-client   # existing local development client
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios # local build/install
npm run web
npm run lint
npm run typecheck
npm test
npm run check:ui
npm run check:fonts
npm run config
CI=1 npm run export:web
npm ls --all
```

### FlashList Jest measurement stand-in

FlashList obtains layout from native measurements that Jest's renderer does not
provide. `tests/setup.ts` therefore replaces only FlashList's measurement helpers
with stable dimensions; it keeps list behavior under test without using
FlashList's bundled `jestSetup`, which expects a RecyclerView export unavailable
in the pinned version. The stand-in currently returns a 402 × 2000 parent and
402 × 100 item size; these are test scaffolding, not evidence of real item
heights, viewport calculations, or scroll positions. Keep this narrowly scoped
stand-in unless a compatible FlashList test setup is deliberately adopted.

Core is a source-linked `file:` dependency. After installing mobile, run
`npm run core:test` at repository root; `npm run core:check-consumers` also
needs the legacy web install. The
reader and gallery use core language types; their narrower response models match
nullable Rails fields. Metro uses a package-scoped resolver so only core's
NodeNext `.js` internals load from TypeScript source; app and third-party imports
are untouched.

NativeWind **4** with Tailwind **3** is configured through `global.css`, the
NativeWind preset, Babel and `withNativeWind` in Metro. Scanning is limited to
mobile `app`, `components` and `design`. Restart Metro after configuration edits.
NativeWind supplies layout utilities; native style objects use semantic tokens
for theme colors, typography and platform-specific elevation.

## Design primitives

`design/tokens.ts` adapts the light/dark burgundy roles exported by
`@tarkman/design/tokens` and owns native point-based spacing, radii,
typography/line heights and the 48pt minimum target. `ThemeProvider` follows
system appearance unless the reader persisted an explicit light/dark choice;
its optional `scheme` still isolates test/gallery samples. The root owns safe areas,
status bar appearance and local font loading, without gating the router. A loading/failure notice explains system-font fallback and possible Armenian mark differences; failure offers an accessible retry without remounting the gallery.

- `AppText`: title, heading, body, liturgy, label and caption; semantic tone
  and language metadata. English, Russian and transliteration reading use Source
  Serif 4; Armenian uses Noto Serif Armenian. UI body and controls stay platform
  sans. Dynamic Type stays enabled. On iOS, a live content-size change remounts
  only the native Text leaf to clear stale frames observed after dismissing a
  page sheet; parent controls, inputs, lists and application state stay mounted.
  This may reset active text selection or screen-reader focus on that leaf and
  therefore still needs physical-device accessibility review.
- `AppButton`: native Pressable; primary, secondary, quiet and destructive.
  Loading/disabled suppress actions and expose disabled/busy accessibility states.
  Labels wrap; controls have minimum dimensions, never fixed text heights.
- `Surface` / `Card`: themed native containers; card spacing/radius/elevation.
- `TextField`: visible and accessible label, focus/error styling, native keyboard
  props, text scaling and disabled state. Return/submit behavior belongs to the
  caller; the gallery dismisses single-line keyboards on Done.
- `AppModal`: native Modal presented as an iOS page sheet or a 90%-height Android bottom surface (bounding its flexible scroll area), with scrollable content,
  safe-area padding and keyboard avoidance. Close button, backdrop, Android back,
  web Escape and accessibility escape dismiss it. Initial focus targets Close; callers
  pass an `openerRef` for return focus. Web uses host focus and RN Web’s focus trap;
  native requests accessibility focus through AccessibilityInfo. Android restores
  on the frame after removal and therefore keeps its no-exit-animation contract;
  iOS/web use onDismiss. iOS supports native swipe dismissal. Native
  assistive-tech behavior still needs device QA.
- `LiturgyText`: selectable by default; preserves the complete plain string,
  paragraphs and line breaks. Null/empty/whitespace shows an explicit English
  fallback with an English language tag. Uses the limited native Markdown strategy below.

## Limited native Markdown

`LiturgyText` renders nested React Native Text runs, with no HTML parser, DOM
renderer, sanitization dependency, remote images, or heavyweight Markdown library.
Paragraphs and line breaks remain intact. Supported inline forms are `**bold**`,
`*emphasis*`, single-backtick code (a subtle background, preserving the reading
font), and `[label](https://example.org/path)`. Formatting does not nest or cross
newlines, and emphasis pairs only when it opens before a non-space character and
closes after one, so an unpaired asterisk stays literal instead of emphasising
text up to the next one. Windows line endings are normalised, so an authored
paragraph break renders as one break. Link labels are plain text; URLs cannot contain parentheses. Only
absolute HTTPS URLs with a hostname, no credentials, whitespace, control
characters or backslashes are actionable. Native uses Linking.openURL with a
visible failure message; web uses keyboard-accessible anchors with noopener and
noreferrer. Accessible labels include the destination and native links include
an opening hint. There is no URL autolinking.

The selected Source Serif assets include regular and semibold, but no italic.
Emphasis therefore uses the platform's real italic face instead of synthesizing
an italic Source Serif file. This preserves emphasis semantics while the eventual
web/native optical-font comparison and a pinned literary italic remain pending.

Backslash-escaped punctuation displays literally (the escape backslash is
removed). HTML tags, images, fenced code, headings/list markers, underscore
formatting and strikethrough remain plain text; they do not create HTML, images,
or block layouts. Invalid links retain their source text and stay inert. This is
a small inline grammar, not CommonMark compatibility; unsupported block markers
can coexist with supported inline text. Examples:

```text
First line
Second line

**Bold reading**, *gentle emphasis*, and `inline code`.
[Noto Armenian](https://notofonts.github.io/armenian/)
\*literal stars\*  <No HTML is rendered.>
[Unsafe link](javascript:alert)  ![No image](https://example.org/image.png)
```

Cards use the shared raised surface and divider roles rather than passing CSS
shadow strings into React Native. The mobile export serves a local copy
of the existing Tarkman favicon to avoid the browser's implicit favicon 404.

The mobile lint gate uses ESLint 10, TypeScript and React Hooks flat configs.
Jest/Expo and React Native Testing Library cover actions, fallback text, language,
selection, text scaling, input behavior and modal dismissal. Watchman is disabled
for deterministic one-shot tests. `check:ui` is a bounded source/dependency guard,
not a general security scanner or proof of runtime compatibility.

## Font provenance and license

Bundled **static Regular and Bold Noto Serif Armenian v2.008** come exclusively
from the [official Noto Armenian project release](https://github.com/notofonts/armenian/releases/tag/NotoSerifArmenian-v2.008),
under SIL OFL 1.1. Copyright 2022 The Noto Project Authors.
The gallery’s “Font license & attribution” sheet embeds the full license in the
app/export via `license.json`; the font guard verifies it matches OFL exactly.
Keep [OFL.txt](assets/fonts/OFL.txt), [AUTHORS.txt](assets/fonts/AUTHORS.txt) and
[source paths, license review and hashes](assets/fonts/SOURCE.md) with the fonts.
The full static `googlefonts/ttf` files in that official archive include combining
marks omitted by its smaller Armenian-only builds. No variable fonts or remote
font requests are used. `check:fonts` checks hashes, static tables and glyph maps.

Bundled **static Regular and Semibold Source Serif 4.005** come unchanged from
Adobe's official desktop release under SIL OFL 1.1. Keep
[the Source Serif provenance and hashes](assets/fonts/SOURCE-SERIF.md) and
[license](assets/fonts/SourceSerif-LICENSE.md) with both TTFs. The font guard
checks the exact hashes and rejects variable files.

The real Grabar sample is the public-domain Lord's Prayer excerpt beginning
“Հայր մեր, որ յերկինս ես”. A separately labeled stress sample includes Armenian
`։`, `՛`, `՜`, `՞` and decomposed U+0301/U+0304. It is a shaping test, not an
editorial claim about liturgical accent placement.

## Visual QA checklist

- Phone (390px), tablet (820px), desktop preview (1440px): inspect each section,
  long text, all four languages, null/empty fallbacks and theme samples. No
  horizontal overflow, clipped ascenders/marks or unreadable text contrast.
- Confirm both bundled fonts loaded; inspect Grabar punctuation and decomposed
  accents. Select/copy a multiline paragraph without losing line breaks.
- Change OS appearance; check background, surface, muted text, fields and sheets.
- At large and maximum accessibility text sizes, read and scroll all content;
  ensure labels grow and every control remains at least 48×48pt.
- Use keyboard Tab/Enter on web; verify focus, disabled/loading buttons, input
  values, Done behavior and email keyboard on native. Try input near screen bottom.
- Open the sheet, type a multiline note, dismiss the keyboard, scroll the reading,
  and close by button/backdrop/back/Escape. Reopen and check focus containment and
  return to the opener. Check portrait, landscape and home-indicator/notch insets.
- VoiceOver/TalkBack: headings, language pronunciation, labels, errors, disabled/
  busy states, modal isolation and accessibility escape. Native assistive-tech
  behavior needs device verification; browser checks alone cannot establish it.

## Configuration boundaries

`app.json` retains the existing owner, EAS project link, identifiers and scheme,
including the Android platform entry for future/internal work. That entry is not
a v1 Android support or release commitment, and it does not add a build guard.
This gallery adds only automatic appearance and the Expo font plugin. No EAS
commands, credentials, build profiles or deployment settings change. Run any
future EAS operations only from `apps/mobile` under separate release authorization.

The gallery needs no environment file. Live-reader endpoint configuration is
described below. Authentication and native publication remain separate tasks.

See [review validation and screenshots](qa/expo73/VALIDATION.md) for the latest browser evidence and remaining native QA.


## Public live reader / Expo 06

Set only `EXPO_PUBLIC_API_URL` (API base URL) and
`EXPO_PUBLIC_ACTIONCABLE_URL` (complete cable URL) in your local development
shell or untracked local environment. No endpoint is guessed and no environment
values are committed by this feature. Missing/invalid settings show a safe
configuration screen; the gallery still works. Restart Metro after changes; use
`--clear` when exporting with different environment values to avoid stale Metro
transforms. These values are bundled and **public**, never secrets.

HTTPS/WSS are required outside development. In development only, HTTP/WS are
accepted for localhost, loopback, private IPv4 LAN addresses and `.local` hosts.
Credentials, query strings and fragments are rejected for both endpoints. The
API base may contain a path prefix; the cable endpoint must be explicit. Use a
reachable local backend on a physical device (its localhost is the phone).
Existing Rails origin policy must already permit the chosen client origin; this
slice does not change backend or production configuration.

Public reads only: `/services.json?tz=...`, `/s/:id.json`, `/s/:id/parts.json`, and
`/s/:id/explanations/current.json`. Requests omit credentials, disallow redirects
and disable HTTP caching. No login, session controls/creation, private sessions,
auth identifiers, offline storage, EAS/release work, or display-mode parity.
Rails itself may record analytics on public GETs; the client does not send writes.
Variable English fields that Rails emits as HTML remain inert literal text under
the existing limited Markdown renderer; this slice does not add an HTML engine.

Today (`/`) leads with the service at the church the reader is in when location
knows it, and otherwise with the services live today, a Scan row and Continue
reading (stored on the device). Services (`/live`) lists every public service for
today. Settings (`/settings`) holds reading choices and, last, sign-in or My
services; no other screen shows an account affordance. A numeric session ID is
entered from the scanner's fallback. Parts
retain Rails ordering and occurrence identity (`liturgy_part_id`), including
multi-liturgy repetitions. Current-part resolution uses part and liturgy together;
position is a secondary discriminator. Scrolling by touch, wheel or keyboard
pauses automatic targeting. Return to live resumes it; a live event never clears
the manual-reading preference. Native FlatList targeting uses measured list
estimates and bounded retries, without DOM measurements. Language and explanation
sheets reuse Expo 05 modal focus/dismissal and typography primitives.

`features/live` separates defensive parsing/configuration, GET transport, a
mockable cable interface, lifecycle ownership, recovery state and UI. Built-in
fetch/WebSocket need no client libraries. `expo-network ~57.0.2` matches the SDK
57 bundled module manifest and [Expo Network documentation](https://docs.expo.dev/versions/latest/sdk/network/).
The cable adapter implements Rails `actioncable-v1-json`: welcome, subscription
confirmation, pings, messages, rejection, disconnect and bounded reconnection.
The identifier is exactly `{ channel: "SessionChannel", id: sessionId }`.

With the revisioned backend contract (Tarkman #436), startup reads
`/s/:id/state.json`, loads metadata and the parts manifest, then checks state
again. Content tokens must agree across the manifest fetch. The cursor is
resolved by `liturgy_part_id`; its position is the backend's deduplicated reading
position, which must not be used as an index into the full occurrence manifest.

Complete `part_change`, `status_change`, and command acknowledgements carry
`revision`, `cursor`, `content_context`, `session_status`, `status_message`,
`posture`, and `date`. A contiguous newer revision with the same content token
is applied immediately without a verification GET. Older/duplicate publications
are ignored. Gaps, incomplete publications, changed content, unknown occurrences,
and reconnects recover through the small state endpoint. Changed content is
reloaded and bracketed by state reads again. Commands include `expected_revision`
as well as the existing expected part and are never automatically retried.

A 30-second foreground poll catches missed events, content edits and service-list
changes; it reuses the manifest while its content token is unchanged. Backgrounding,
network loss, route exit and session changes dispose sockets/timers and abort
requests. Requests time out after 12 seconds. Explanation work runs after the
reading is accepted; its failures never block the reading. Manual reading mode
survives updates and recovery. Saved copies never establish a live revision.

A missing state endpoint (404/405) retains the legacy canonical session recheck
and bounded manifest reuse; the next full poll checks for the new contract again.
Other errors remain visible failures. Partial publication payloads use state
recovery, so backend and mobile deployment order remains compatible. The fast
path requires the complete publication contract; deploying only the backend does
not update an already installed mobile bundle.

Rails discovery means sessions on the client's date, not a guaranteed in-progress
service. A service leaving discovery remains readable. Server status messages are
displayed as text. Repeated-occurrence navigation semantics remain tracked in
Tarkman #435; this client does not infer a different server navigation order.

Run the local build with the already configured development client:

```sh
cd apps/mobile
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios
```

Do not use Expo Go for native acceptance or substitute an EAS cloud build. See
[Expo 06 validation](qa/expo74/VALIDATION.md) for exact checks and screenshots.
**Native handshake follow-up:** a real iPhone must connect to an appropriate
existing Rails endpoint and verify subscription confirmation, part/status and
explanation updates, lock/background/foreground, airplane-mode/Wi-Fi restoration,
long multi-liturgy targeting, Dynamic Type, VoiceOver and modal/keyboard focus.
Simulator build success and mocked web tests do not prove that handshake.

## Offline reading and local preferences / Expo 08

Full offline downloads are **deferred**. Expo 01 (issue #69) decided against
download queues, content versioning, and download progress in this app. One
bounded, expiring copy of the most recently recovered service is still kept as
a narrow fallback: when that same service cannot load after a cold launch, the
reader labels it **Saved copy — not live** and never presents its position or
status as current. A service without a matching saved copy fails with a visible
connection message rather than showing stale text as if it were live.

What the device does keep:

- The active reading language, selected-language set and System/Light/Dark
  appearance choice, saved as one small record and restored on launch.
- Existing `{ language }` records migrate in place, preserving the active
  language and keeping the four formerly available languages selected. Invalid
  records fall back safely, and a late startup read cannot overwrite a choice
  made while hydration is still running.
- The sign-in token is separate and lives in the keychain.
- "Forget my reading choices" resets the active/selected languages and preserves
  an explicit appearance choice; with System appearance it can remove the record.
- One saved service copy, limited in size and age, with its parts and any
  last-seen explanations. Settings can remove it without changing reading
  choices or sign-in. Clearing it affects the next offline launch; a copy that
  is already visible stays readable until the reader leaves or recovers live data.

Storage differs by platform, because the native key-value store does not run in
a browser: native builds use `expo-sqlite`'s key-value store, and web uses
`localStorage` through `features/preferences/storage.web.ts`. Both satisfy the
same `KeyValueAdapter` contract and tolerate a failed write, so a rejected save
never interrupts reading.

On compact widths the live reader renders one active language. The Reading
language sheet switches immediately among the selected set without dispatching
controller/follow actions. Choose languages uses a separate draft with
Apply/Cancel and enforces at least one selection; removing the active language
falls back to the first selected language in stable product order. Wider windows
compare selected languages only when the card's actual content width, padding,
borders, inter-column gaps and current OS font scale leave at least 300 points
per language.

Native validation still needs compact and wide devices in both orientations,
explicit and system appearance across background/resume, maximum text traversal,
iOS swipe dismissal, Android system/predictive Back, keyboard behavior, and
VoiceOver/TalkBack focus, pronunciation and selected-state listening. The
Source Serif web/native optical comparison and authoritative long multilingual
service content also remain pending.

Connection recovery is unchanged and still required: the reader labels stale and
disconnected states, falls back to polling when the live socket is unavailable,
and refetches authoritative state on reconnect. Live-control commands are never
queued or replayed after a reconnect; see `features/services/useControls.ts`.

## Universal links / Expo 09

Links to the reading routes on `web.tarkman.app` open this app when it is
installed, and stay in the browser when it is not. Two things make that work,
and both must agree:

- `apps/mobile/public/.well-known/apple-app-site-association` claims
  `/sessions/*/parts` and `/sessions/*/part/*` for `FHF872BAQR.app.tarkman`, and
  `vercel.json` serves it as `application/json`. The church display routes are
  deliberately **not** claimed: a kiosk link must keep opening in the browser.
- `app.json` declares `applinks:web.tarkman.app`, and the Expo Router paths
  mirror the website's, so an opened link lands on the matching screen.

`tests/universal-links.test.ts` keeps the two in step: it fails
if the bundle identifier drifts, if the claimed paths stop matching the app's
routes, if a display route is ever claimed, or if the JSON content type is
dropped.

Activating them needs three steps outside this repository:

1. Deploy the web app, then confirm
   `https://web.tarkman.app/.well-known/apple-app-site-association` returns the
   JSON over HTTPS with no redirect. Apple fetches it directly, not through a
   redirect, and caches it.
2. Add the Associated Domains capability to the app identifier and refresh the
   provisioning profile (`eas credentials`), then build.
3. Verify on a **physical iPhone**: simulators do not enforce the domain
   association, so a passing Simulator check proves nothing here. Tap a
   `web.tarkman.app/sessions/…/parts` link from Messages or Notes and confirm the
   app opens on that service, then confirm the same link opens the website with
   the app uninstalled.

## Release checks and observability / Expo 10

## Screen wake lock

The live reader and service-control route keep the screen awake while they are
foregrounded. Each route releases its own wake lock when the app backgrounds or
the route exits; its sheets remain covered by the service-control route lock.
Today, Services, Settings, and part detail do not request it. There is no
reader opt-out in v1: opening a live-reading screen is the explicit signal that
the device is being used to follow a service, while service control must remain
awake for the operator.

### What CI runs

The `mobile` job runs `npm ci`, `npm ls --all`, `expo-doctor`, lint, typecheck,
the Jest suite, the UI, interface-copy and font guards, `expo config`, the Expo web export, and
an iOS config smoke check that prebuilds the native project and asserts the
associated-domains entitlement and bundle identifier survive. The `mobile` job
also runs `npm run core:test` (shared core build, tests and boundary guard), which
needs only the mobile install. The `design` job checks generated tokens and color
contrast; `mobile` uses Node 24. The deprecated `apps/web` client is validated by
the separate, non-required [Legacy web CI](../../.github/workflows/legacy-web.yml)
workflow only when it or shared core changes.

The smoke check runs last because `expo prebuild` rewrites `package.json`
scripts; it catches a broken app config or config plugin in CI rather than
during a release build. It generates native configuration but does not compile
Swift/Objective-C/C++ with Xcode.

For every PR to `main`, [Node.js CI](../../.github/workflows/node.js.yml) reports
stable **`ios-build`** and **`android-build`** checks. Full native compilation is
**opt-in**: add **`[native-build]`** anywhere in the PR title (case-insensitive)
to request both platforms (and the tvOS compile for `apps/tv`, gated by `tv-build`).
For example: `[native-build] Upgrade Expo`.
Adding or removing the tag reruns CI through the `pull_request.edited` event.
Without the tag, even native dependency/config changes skip full compilation.
The regular mobile tests, lint, typecheck, store/config checks and iOS prebuild
smoke check still run; mobile changes also run both JavaScript bundle checks.
The tag requests those bundles even on an otherwise non-mobile PR.

When requested, iOS compiles on macOS 26 using Node 24, a clean dependency
install, Expo prebuild, CocoaPods and unsigned Debug `xcodebuild` for a generic
iOS Simulator. Android checks the merged release manifest and compiles a debug
APK. These jobs do not launch, sign or submit a release. The aggregate gates
accept intentional opt-out, but still reject detection failures, failed bundles,
and failed/cancelled/unexpectedly skipped builds when compilation was requested.
The existing push-to-`main` validation remains unchanged.

**Native input classification and reuse (#204).** Native inputs include the
workflow, classifier, `app.json`/`app.config.*`, `package.json`, lockfiles,
plugins, icons and platform-specific `ios/` or `android/` files. A change only
to `expo.version` in `app.json` or the root `version` in `package.json` is reported
as non-native when both versions are valid numeric `major.minor.patch` strings.
Missing/invalid JSON or versions and other field changes retain native
classification. Classification is informational; the title tag controls builds.

CI invokes Expo prebuild and Xcode/Gradle directly, without an EAS profile or
archive upload. `eas.json`, `.easignore` and the validation-only store checker
are excluded from native fingerprints. If a plugin/build step starts consuming
one of these files, it must be added back to the inputs.

[`scripts/native-inputs.mjs`](scripts/native-inputs.mjs) fingerprints complete
native input files in the PR merge commit, per platform and ISO week. Versions
remain in the fingerprint because an explicitly requested build should verify
the actual generated version/runtime metadata. A successful compile saves a
marker in that PR's Actions cache. A subsequent tagged run reuses it only when
platform, result and fingerprint match; missing/mismatched markers require a
fresh compile. Base native changes and workflow/toolchain edits invalidate the
marker, and the weekly salt refreshes opted-in builds for runner image drift.
Markers never cross PRs. To force a fresh tagged build, delete its
`native-compile-ok-<platform>-*` cache entry and rerun the workflow.
`npm run test:native-inputs` covers classification, fingerprints, opt-in decisions
and aggregate failure handling.

After merge, the owner must select the exact check **`ios-build`** from
**GitHub Actions** in `main` branch protection/rulesets, alongside the existing
required checks. Select the aggregate, not `ios-compile`. This repository change
does not enable branch protection; verify the setting live before closing #119.
A green compile proves native compilation, not simulator launch, device behavior,
or distribution readiness.

### Configuration by environment

Only `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ACTIONCABLE_URL` are set, per
environment, in the local shell or an untracked `.env`. They are bundled and
public by design; both must be HTTPS/WSS outside development, which
`features/live/config.ts` enforces. Nothing private belongs in the bundle: the
sign-in token is entered by the reader at runtime and kept in the keychain, and
any future build-time secret (a Sentry auth token, an App Store Connect API key)
belongs in EAS secrets, never in `app.json`, `eas.json` or source control.

### EAS iOS build image

iOS builds (mobile `development`, `preview` and `production`, and the TV profiles) are pinned to one exact
EAS image, `macos-tahoe-26.5-xcode-26.6` (Xcode 26.6, the iOS 26.5 SDK), in `eas.json`, never an alias such as
`auto`, `latest` or `sdk-57`. Expo SDK 57 does not adopt the UIScene lifecycle, so an app built with Xcode 27
(the iOS 27 SDK) crashes at launch on iOS 27. `npm run check:store-config` (and the TV identity check) fail if
the image is an alias, is Xcode 27 or later, or differs between profiles or apps. Move the image only together
with the Expo SDK 58 upgrade, and change every profile in both apps at once. The image used by a build is
printed in the first lines of its build log ("Using VM template ...").

### EAS Update release workflow (iOS)

This app uses the EAS project ID in `app.json`. New `preview` and `production`
builds contain `expo-updates`, the project's update URL, and separate update
channels. Existing installed builds must be replaced with a new build before
they can receive EAS Updates. Android is outside the v1 release scope.

The runtime version follows the user-visible app version (`expo.version`, now
`0.1.1` for the first update-enabled binary). Increment that version and ship
a new binary whenever a native dependency, config plugin, or native app
setting changes. A build-number increment alone does not change the runtime.
Publish only JavaScript and asset changes against an existing runtime; compare
the proposed update with the installed build before publishing.

Before the first build or update, work from `apps/mobile` and confirm `eas
whoami` can access the project in `app.json`. Both EAS `preview` and
`production` environments need `EXPO_PUBLIC_API_URL`,
`EXPO_PUBLIC_ACTIONCABLE_URL`, `EXPO_PUBLIC_SENTRY_DSN`, and
`EXPO_PUBLIC_SENTRY_ENVIRONMENT` (matching the environment name). The public
API/cable endpoints must use HTTPS/WSS outside development. Inspect names with
`eas env:list --environment preview` and the production equivalent; do not
print sensitive values into logs. `eas.json` also sets the Sentry environment
for builds, but its `env` entries are not used by `eas update`.

For the first delivery, build and install a fresh iOS preview binary from the
committed configuration. Then publish a small JavaScript-only change from its
reviewed Git commit:

```sh
eas build --platform ios --profile preview
eas workflow:run .eas/workflows/update-preview.yml --ref REVIEWED_SHA -F message="Describe the change" --wait
```

The manually triggered workflow publishes only iOS to the matching channel and
EAS environment. Its update job uploads Sentry source maps and fails if the
upload fails. Publication happens before that upload: a failed workflow can
leave an update available to installed builds. Before retrying a failed run,
inspect its logs and the relevant channel with `eas channel:view preview` or
`eas channel:view production` to determine whether an update group was
published. Treat a published update as live; assess it and roll it back if
needed. Rerunning the workflow publishes another update. The workflow runs on
EAS so it can use the existing `SENTRY_AUTH_TOKEN` with **Secret** visibility;
a local upload cannot read that token. Using `--ref` pins the update to a
committed revision and avoids uploading untracked local files. Verify the
preview build receives the new bundle after a force quit and up to two
launches, then confirm a preview JavaScript error has readable frames in
Sentry. The development client can also load an update from
its Extensions tab.

Only after that device check, build and distribute a compatible `0.1.1`
production binary through the normal store release process. Once that binary
is available to users, publish the same reviewed JavaScript change to
`production` from that reviewed Git commit:

```sh
eas workflow:run .eas/workflows/update-production.yml --ref REVIEWED_SHA -F message="Describe the reviewed change" --wait
```

Verify the resulting update group and monitor errors. Use
`eas update:rollback` to return a channel to a previous
update or the binary's embedded bundle if needed. Publishing and rollback are
manual release actions; a passing CI bundle export does not publish anything.

### Beta exit criteria

The canonical [beta exit criteria](../../docs/beta-exit-criteria.md) define the
physical-device scenarios, evidence, severity, acceptable gaps and release
blockers for Expo 10 ([#78](https://github.com/mattash/Tarkman-Client/issues/78))
and the first TestFlight beta ([#79](https://github.com/mattash/Tarkman-Client/issues/79)).
They do not authorise a build, upload, or tester invitation.

### Error reporting

`@sentry/react-native` reports to the `tarkman-mobile` project in the
`st-john-armenian-church` Sentry organisation. Reporting starts before the first
screen, so a crash during startup is still captured, and it only starts when
`EXPO_PUBLIC_SENTRY_DSN` holds a complete HTTPS DSN; a missing or malformed value
disables it rather than half-enabling it. `EXPO_PUBLIC_SENTRY_ENVIRONMENT` names
the environment and defaults to `development`. Traces sample only in production,
so a service is never slowed for telemetry.

What is deliberately not sent: no user identity or IP (`sendDefaultPii: false`,
and `user` and `request` are stripped from every event), no screenshots or view
hierarchies, no failed-request capture, no console breadcrumbs (they can contain
anything a developer logged, including a reader's text), and no `Authorization`
header in breadcrumb data.

Verified on 2026-09-11: the development-only "Send a test error" control in the
design gallery produced `TARKMAN-MOBILE-1` in the `development` environment,
with no user attached.

#### Release stack traces

`metro.config.js` builds on `getSentryExpoConfig`, which stamps each bundle and
its source map with the same Sentry debug ID. During an EAS build the Sentry
Expo plugin uploads the source maps and native debug symbols, using the
`SENTRY_AUTH_TOKEN` secret stored in the EAS `development`, `preview` and
`production` environments (never in the repository or the bundle). Releases and
distributions are left to the SDK defaults, so the app and the uploaded
artifacts share the same `bundle-id@version+build` name.

`eas.json` sets `EXPO_PUBLIC_SENTRY_ENVIRONMENT` for each build profile. The DSN
is not committed: set `EXPO_PUBLIC_SENTRY_DSN` as a plain EAS environment
variable in each environment, or EAS builds report nothing.

To prove symbolication, install a `preview` build and open **Settings → Error
reporting (preview builds)**. "Send a test error" reports a JavaScript error;
"Crash the app (native)" crashes natively and is reported on the next launch.
Both should appear in Sentry with readable frames, the `preview` environment and
the build's release. These controls render only in development and preview
builds, never in production.

### Local EAS builds and Sentry

`eas build --local` cannot read the `SENTRY_AUTH_TOKEN` secret; EAS provides
secrets only to its cloud builders. Without the token, the Sentry source-map
upload fails the archive. For local builds, turn the upload off:

```sh
SENTRY_DISABLE_AUTO_UPLOAD=true eas build --profile preview --platform ios --local
```

A local build still reports errors, but its stack traces are not symbolicated.
Use an EAS cloud build to verify symbolication. Keep this setting out of
`eas.json` so a broken upload still fails cloud builds.

### Building locally after the associated-domains entitlement

`npx expo run:ios` fails with "No code signing certificates are available" once
the entitlement is generated, because Xcode signs entitlements even for a
simulator build. A simulator build does not need signing at all, so build it
directly (CocoaPods requires a UTF-8 locale, hence `LANG`):

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo prebuild --platform ios --clean
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ..
xcodebuild -workspace ios/Tarkman.xcworkspace -scheme Tarkman -configuration Debug \
  -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/Tarkman.app
```

For a device build, set a development team in Xcode or build through EAS with the
`development-simulator` or `development` profile. An existing `ios/` directory
hides entitlement changes: `expo run:ios` reuses it without re-applying config
plugins, so a new entitlement only appears after `expo prebuild --clean`.

### Scanning a service code

`app/scan.tsx` is a full-screen, always-dark modal that reads a QR code with
`expo-camera`. The codes printed for the congregation point at
`https://www.tarkman.app/s/:id/explain`, the web projector display shows
`https://web.tarkman.app/sessions/:id/explanations`, and reading links on
`web.tarkman.app` work too. A found code is never entered silently: the scanner
loads the service and waits for **Pray along**, because a camera can pick up a
code from across the room or from last week's slide.

A scanned code is untrusted input, because a sticker in a public place can be
replaced by anyone. `features/scan/links.ts` accepts only HTTPS URLs on a Tarkman
host whose path is one of those reading routes, and rejects everything else,
including look-alike hosts such as `tarkman.app.evil.example`, credentials in the
URL, and the church display routes. A refused code is shown as plain text and
never opened, followed, or loaded in a web view.

The camera is requested when someone opens the scanner, not at launch. When it
is refused, the scanner names the routes that still work — the services list and
session ID entry — and links to Settings. Repeated unreadable codes raise one
alert, not one per frame. The camera is only
used to read a code: nothing is recorded or sent anywhere. A simulator has no
camera, so scanning can only be confirmed on a physical iPhone.

### Device flows

`maestro/` holds Maestro flows that drive the app on a simulator. Install the CLI
with `curl -fsSL "https://get.maestro.mobile.dev" | bash` — note that Homebrew's
plain `maestro` cask is an unrelated product. Do not run the whole directory at
once: the unprefixed flows (`read-a-service.yaml`, `part-link.yaml`) target
production session 4006 and need a production-configured build, while the
`fixture-*.yaml` flows need the local fixture documented below and fail against
production. Run one family or the other, never `maestro test maestro/`.

`launch.yaml` loads the app and is reused by the others through `runFlow`. On
iOS it points the development client at Metro on port 8081; a standalone iOS
build ignores that link and simply launches. The Android branch is for a
dedicated development client and clears app data; see the Android instructions below.
`read-a-service.yaml` opens a service by ID, changes language, opens a part and
comes back. `part-link.yaml` opens a part straight from a link. Both are signed
out and read-only, so no flow can change a live service and none needs
credentials.

The existing flows target production session 4006 and depend on mutable live
service state. Maestro CI is deferred until those flows can start the app and
run against the deterministic local
[mock-reader fixture](qa/design-system/mock-reader-server.cjs), without live
credentials or production state. A scheduled fixture-backed Maestro job belongs
to a separate PR; this compile gate does not run those flows or contact that
service. Read-only production flows are still unsuitable as deterministic CI
tests. macOS also has materially higher runner cost than Linux.

### Fixture-backed flows

The `fixture-*.yaml` flows cover the release-check matrix against the
deterministic [mock-reader fixture](qa/design-system/mock-reader-server.cjs)
instead of production: joining from Today (`fixture-join`), language switching
(`fixture-languages`), explanations (`fixture-explanations`), authentication
(`fixture-auth`), and core controls (`fixture-controls`).
`fixture-open-service.yaml` and `fixture-sign-in.yaml` are shared helpers
included through `runFlow`, not standalone checks. Run them with the app pointed
at the fixture — from the repository root, in three terminals:

```sh
node apps/mobile/qa/design-system/mock-reader-server.cjs
EXPO_PUBLIC_API_URL=http://127.0.0.1:8100 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable \
npm run mobile
maestro test -s 1 apps/mobile/maestro/fixture-join.yaml \
  apps/mobile/maestro/fixture-languages.yaml \
  apps/mobile/maestro/fixture-explanations.yaml \
  apps/mobile/maestro/fixture-auth.yaml \
  apps/mobile/maestro/fixture-controls.yaml
```

`-s 1` explicitly runs the flows serially on one shard. Keep this suite serial
because the flows share one app instance and mutable fixture state.
Grant the simulator camera before the first run (the scan fallback in
`fixture-open-service.yaml` needs the scanner to open without the permission
prompt covering it):

```sh
xcrun simctl privacy booted grant camera app.tarkman
```

List the flows explicitly: `maestro test maestro/` would also pick up the
production-targeting `read-a-service.yaml` and `part-link.yaml`, which fail
against the fixture. The fixture's operator account is synthetic and only
serves the loopback process. Signed-in flows sign out at the end, so each flow
starts signed out; if a run stops mid-flow, sign out manually before rerunning.
The fixture confirms the ActionCable subscription but never broadcasts, so
these flows do not exercise live-following updates — that remains manual or
production QA.

### Android fixture run (internal test automation)

This reuses the shared fixture flows, including `fixture-onboarding`; it does not
add Android release support. Use a **dedicated test emulator/device**: Android's
shared launch helper clears `app.tarkman` data before each flow (including sign-in,
preferences and explanation read state) and grants camera again after the reset.
It uses standalone `clearState` then `setPermissions`, leaving the app stopped
until `openLink` cold-launches the development client into Metro. Resetting data
also resets Expo's developer-menu preferences, so each launch waits up to 60 seconds
for the first-run `Continue` control and taps it, then waits up to 15 seconds for
`Close` (its Android content description). Before closing the menu, it scrolls to
`Tools button` and turns it off: the reset enables this floating control, whose
upper-right touch surface overlaps the reader's preferences button. It then taps
`Close` before waiting for `Today`. This Android path requires a development client.
Android dismisses the keyboard before manual-ID and sign-in submission.
The iOS launch and keyboard behavior are unchanged. Android opens
`tarkman://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`, using
`expo.scheme` from `app.json`; iOS retains its existing `exp+tarkman` link.
The scanner uses manual session ID 9001; no camera image or production service
is needed. Set the test device language to English and unlock it before running.

Prerequisites: Node >=22.13, `npm ci --prefix apps/mobile`, Maestro CLI **2.10.0** on PATH,
OpenJDK 17, Android SDK platform-tools/emulator, an existing AVD, and an installed
**development client** with package `app.tarkman` matching this checkout's native
dependencies. A release APK or Expo Go will not work. To build a client yourself,
use a disposable checkout at this revision, run `npm ci` and
`npx expo run:android --device --no-bundler` from its `apps/mobile` directory.
That build generates native projects/APKs; keep them outside the review worktree.
Alternatively install an independently built matching development APK from an
external path with `adb -s SERIAL install -r /absolute/path/to/development.apk`.
No PR-specific APK path, EAS operation, credentials or env file is required.

From the repository root, select the SDK/JDK in your shell (these are this Mac's
paths; use your own on another machine):

```sh
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$PATH"
"$ANDROID_HOME/emulator/emulator" -list-avds
# In its own terminal, only if the intended AVD is not already running:
"$ANDROID_HOME/emulator/emulator" -avd YOUR_AVD_NAME
```

Start these prerequisites in **two separate foreground terminals**, from the
repository root. Stop any prior fixture/Metro using Ctrl-C in their owning
terminals first; do not reuse a Metro previously configured for production.
Restart the fixture for each suite run to reset its mutable service state.

```sh
# Terminal 1: fresh single-service fixture on loopback port 8100
FIXTURE_SERVICES=single node apps/mobile/qa/design-system/mock-reader-server.cjs
```

```sh
# Terminal 2: fixture-only Metro on 8081, ignoring local env files and stale transforms
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SENTRY_DSN= \
EXPO_PUBLIC_API_URL=http://127.0.0.1:8100 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable \
npm run mobile -- --dev-client --localhost --port 8081 --clear
```

In a third terminal with the SDK/JDK environment above:

```sh
adb devices -l
npm run maestro:android --prefix apps/mobile -- --device emulator-5554
# Substitute the exact serial from adb devices -l. With just one attached device:
# npm run maestro:android --prefix apps/mobile
```

The runner honors `--device`, then `ANDROID_SERIAL`, otherwise requires exactly
one ready device. It never boots or chooses an AVD by guesswork. It rejects
missing/unready devices, non-debuggable/missing apps, SDK conflicts, unavailable
Maestro or missing Java executable, unavailable Metro, and a fixture not listing
its single active service at part 901 (position 1). The host Metro readiness check
uses `http://localhost:8081/status` because Expo `--localhost` may listen only on
IPv6 loopback (`::1`) on macOS. The fixture check stays at
`http://127.0.0.1:8100/services.json`, and the Android Metro deep link stays at
`http://127.0.0.1:8081` for `adb reverse`. Metro's status endpoint cannot
prove which API URLs were bundled: the
fresh Metro command above is mandatory. It sets `adb -s SERIAL reverse` for
8081 and 8100, refuses conflicting mappings, grants Android camera permission,
and runs only the six standalone fixture flows serially with `-s 1`.
The wrapper option is `--device`; it invokes Maestro as
`maestro test --udid SERIAL -s 1 ...`. This syntax, multiple flow paths,
`--test-output-dir`, `--debug-output`, `--format JUNIT`, and `--output` were
checked against saved Maestro 2.10.0 `test --help` output without executing
Maestro in the Codex sandbox.

Maestro runs from a printed temporary directory outside the checkout, with
explicit artifact/debug directories and a JUnit `report.xml` there. A `TMPDIR`
inside the repository is rejected. Screenshots/reports/logs stay out of the diff
(Maestro may also use `~/.maestro`).
The runner propagates failures and forwards Ctrl-C only to its own Maestro child.
It does not own or kill the fixture, Metro, adb server or emulator. Stop your
foreground servers with Ctrl-C when done. Camera permission and matching reverse
mappings remain available for reruns; remove the mappings explicitly when finished:

```sh
adb -s emulator-5554 reverse --remove tcp:8081
adb -s emulator-5554 reverse --remove tcp:8100
npm run test:maestro-android --prefix apps/mobile
```

Keep dependency installs, native build output, Expo caches and Maestro artifacts
out of the reviewed diff. A source/static check is not Android device-run evidence;
the PM must run the suite on the selected development client and collect its output.
### Android APK builds / #191

For production AAB signing and an unpublished Play internal-track draft, see
[Android release setup / #192](docs/android-release.md).

Android uses the existing Expo app, package `app.tarkman`, EAS project and
`runtimeVersion` policy. Nothing Android-specific lives in source control
except app and EAS configuration: `android/` is generated by
`expo prebuild` and ignored by Git.

| Profile | Command (from `apps/mobile`) | Output |
|---|---|---|
| `development` | `eas build --platform android --profile development` | Development-client APK; needs Metro (`npm start -- --dev-client`) |
| `preview` | `eas build --platform android --profile preview` | Standalone APK with the embedded bundle, `preview` update channel; starts without Metro |

Both profiles are `buildType: "apk"` and internal distribution. Production
settings are unchanged and not required for this stage. Install an EAS APK by
opening its build page on the device, or with `adb install <file>.apk`.

**Prerequisites.** EAS access to the `mesropash/tarkman` project and an Android
upload keystore held by EAS. Reuse existing EAS Android credentials if they
exist (`eas credentials --platform android`); otherwise the project owner lets
EAS generate one on the first build. Never reset or replace an existing
keystore, and keep keystores, passwords and service-account keys out of source
control, logs, issues and `EXPO_PUBLIC_*` variables. No Google Play account is
needed for an APK.

**Replacing installs.** Development and preview builds share the package name,
so each replaces the other. If two builds were signed with different keys,
Android refuses the update; the only way forward is to uninstall, which deletes
that device's saved services, preferences and sign-in. Tell testers that before
asking them to uninstall.

**Local compile** (JDK 17 and an Android SDK; `ANDROID_HOME` set):

```sh
cd apps/mobile
npm ci
npx expo export --platform android --clear --output-dir /tmp/tarkman-android-bundle
npx expo prebuild --platform android --clean --no-install
(cd android && ./gradlew :app:assembleDebug)
```

A debug APK loads JavaScript from Metro; use the `preview` profile (or
`SENTRY_DISABLE_AUTO_UPLOAD=true eas build --platform android --profile preview --local`)
for a standalone build. `expo prebuild` rewrites `package.json` scripts; discard
that change.

**Test APK without EAS.** The manually run **Android test APK** workflow
(`.github/workflows/android-apk.yml`, Actions → *Android test APK* → *Run
workflow*) runs a clean prebuild and `:app:assembleRelease` for `arm64-v8a`
(phones) and `x86_64` (emulators), checks the package, that it is not
debuggable, its signature and the embedded JavaScript bundle, and uploads
`tarkman-test-<sha>.apk` with its SHA-256 and badging as the
`tarkman-android-test-apk` artifact (30 days). It embeds the public endpoints
given as inputs (default `https://www.tarkman.app`), sets the Sentry environment
to `preview` without a DSN, and starts without Metro. The same build locally:

```sh
cd apps/mobile
export EXPO_NO_DOTENV=1 SENTRY_DISABLE_AUTO_UPLOAD=true \
  EXPO_PUBLIC_API_URL=https://www.tarkman.app \
  EXPO_PUBLIC_ACTIONCABLE_URL=wss://www.tarkman.app/cable
npx expo prebuild --platform android --clean --no-install
(cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64)
# android/app/build/outputs/apk/release/app-release.apk
```

That APK is signed with the generated project's debug keystore. It is for
sideloaded testing only: it is not a Play upload, it is not bound to the
`preview` EAS Update channel, and because its signature differs
from EAS-built APKs, Android refuses to install it over one (or vice versa)
without an uninstall, with the data loss described above.

**Permissions.** The release manifest requests only `INTERNET`, `CAMERA`
(QR scanning), foreground `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`
(asked only when the reader looks for a nearby church) and `VIBRATE`, plus
install-time permissions merged from libraries that never prompt:
`ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `USE_BIOMETRIC`/`USE_FINGERPRINT`
(SecureStore) and the app-private `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.
`android.blockedPermissions` in `app.json` removes microphone, background
location, legacy external storage and `SYSTEM_ALERT_WINDOW`, including any a
library manifest would merge in; `npm run check:store-config` guards the
profiles and these blocks.

**CI.** For every PR, the stable **`android-build`** check aggregates
`android-changes`, `android-bundle-smoke` and `android-compile`, with the same
rules as `ios-build`. Mobile changes export the Android JavaScript bundle on
Linux. Adding `[native-build]` to the PR title also requests a clean
Android prebuild, check the merged release manifest (package, `tarkman`
scheme, permissions, not debuggable) and compile a debug APK for one ABI
(`x86_64`) on JDK 17. The job uses no signing keys, EAS or Play secrets,
dummy endpoints, `EXPO_NO_DOTENV=1` and no Sentry upload, and uploads the
manifest, permission list and APK badging as the `android-compile-evidence`
artifact. A successful compile is reused for later commits whose native
inputs are unchanged, under the same rules as `ios-build` above. The owner
selects **`android-build`** in branch protection;
this change does not. A green check proves compilation, not device behavior.

**Known Android limitations.** A production AAB was accepted as an internal draft
under #192; no tester or public Play release has occurred. `https://web.tarkman.app`
links are not verified Android App Links. The device scenario matrix is not yet
recorded. See the [stage 3 beta/release packet](qa/android/RELEASE.md) for the exact
artifact baseline, pending physical QA, App Links and owner approval gates.

### Known gaps

Recorded rather than implied: source maps are not uploaded, so release stack
traces are minified; device flows run locally and are not enforced by CI; universal links are unverified on a device
(#101); large text sizes still break reader layout (#91); block-level Markdown in
explanations renders literally (#99); My services cursor pagination still needs device and backend rollout verification
(#92). Jest covers behaviour, not rendering on a device, so it is not evidence
for any item in this section.

## The church you are standing in / Expo #106

When a live service's church has been geocoded, the API publishes
`church_latitude` / `church_longitude` alongside it, and the services list
offers to work out which of those churches the reader is in.

Nothing is asked until someone taps **Find the church you’re at** on Today. The location permission
is requested then — when in use only, never "always" — so a reader who never
taps it is never asked. `app.json` carries the reason string, and
`locationAlwaysAndWhenInUsePermission` is explicitly `false`.

**A reader's position never leaves the phone.** `features/nearby/distance.ts`
compares the device position with the coordinates already in the services list
and picks the nearest church within `NEARBY_RADIUS_METRES` (250m — a building
plus its car park, with room for poor GPS indoors). No request carries a
location, nothing is persisted, and the position is discarded once the match is
made. The permission string and the card both say so.

A match is offered, never applied: Today says "You’re at …" above that service's
card, and the other live services stay listed below it as the correction, so a
wrong guess costs one tap. Once permission has been given, Today checks again
whenever it is shown, without prompting.
Refused permission, an unavailable position, and no church in range each say so
in place and leave the list exactly as it was; when permission has been denied
for good, the button is withdrawn rather than repeatedly failing.

Churches without coordinates simply cannot match, and the location line is hidden
when no listed service has any — which is the state of production today.
Geocoding runs on the backend only when a profile's address changes, so existing
churches need a backfill or a re-save before this can light up. Verifying the
found path end to end therefore needs a geocoded church with a live service;
a simulator can supply the position
(`xcrun simctl location booted set <lat>,<lon>`), but the permission prompt
itself is worth seeing once on a physical iPhone.

## My services pagination / #92

The signed-in list opts in to `GET /s.json?pagination=cursor&limit=20`, adding
an encoded `cursor` for subsequent pages. The backend must return newest-first
`{ sessions: [{ session: ... }], page: { limit, has_more, next_cursor } }`.
Legacy `{ sessions: [...] }` and `{ error: "No sessions found" }` responses
remain supported as complete lists with no client-side cap.

`features/services/useMyServices.ts` serializes page requests and keeps loaded
cards visible during refresh and failures. Load-more Retry repeats the failed
cursor; a 400 `{ error: "invalid_cursor" }` triggers one page-one recovery.
Repeated cursors anywhere in the current chain are rejected before appending;
history resets only after a successful first-page replacement or recovery.
Failed recovery exposes ordinary Retry without automatically looping. FlashList
renders the cards, pull-to-refresh, and accessible load-more/end controls.
Native accessibility announces “All services loaded” once after a terminal
load-more response, excluding initial complete lists and first-page recovery.
Web retains its polite live region. Jest covers these transitions; native scrolling and assistive technology still
need device verification against the paginated backend.

## My Sessions: Add Session / #199

My Sessions (the signed-in list, route `/services`) leads with **Add Session**, above every card
and in every list state. It opens `app/(signed-in)/session-management/new.tsx`, which sits outside
`services/[id]/_layout.tsx`: the form never starts a reader, controller presence, keep-awake or a
live command. Modules live in `features/services/management/`:

- `contracts.ts` validates the mattash/Tarkman#454 version-1 shapes: bootstrap (`GET /s/new.json`,
  `schema_version`/`session_management_version` 1, `time_zone`, `defaults`, `limits`), the keyset
  picker catalog (`GET /s/liturgy_options.json?limit&after_id&q`), and the canonical nested `session`.
  Any other version, HTML, or a generic 404/405/406 reads as "management unavailable", never as an
  empty form or a raw POST.
- `api.ts` sends only `{ client_request_id, session: { date, liturgy_ids, options } }`.
- `creation.ts` owns one draft: defaults initialize untouched fields only (a stale bootstrap is
  refreshed on focus without overwriting edits); a synchronous in-flight lock; an uncertain outcome
  (network, abort, 5xx, unreadable success) keeps the exact key and payload for **Retry safely**
  within 24 hours and locks the form; 422 maps `errors_by_field` and focuses the first field.
- `catalog.ts`/`LiturgyPicker.tsx`: server search and load-more; selections live in the draft, so
  they survive searching and paging. The numbered order has labelled Move up/down/Remove controls.
- `mutations.ts` announces a confirmed write, scoped to API environment and account; My Sessions
  reconciles once via `useMyServices().reconcile()` (aborts any page in flight, resets the cursor
  chain, fetches page one) and shows **Session created** with a separate **Open controls**.

A today-dated creation asks for confirmation (it can appear to readers and become the current
session immediately). The loopback fixture (`qa/design-system/mock-reader-server.cjs`) serves the
synthetic management routes; `FIXTURE_MANAGEMENT=off` simulates an older backend. Browser evidence:
[qa/issue199](qa/issue199/). The backend contract is not yet implemented, so real-backend and native
device checks remain outstanding.

## My Sessions: edit and delete / #200

Each My Sessions card keeps **Open controls** as its main action, with secondary **Edit** and **Delete**
(labels include the title and date). `app/(signed-in)/session-management/[id]/edit.tsx` reuses #199's
form outside the live-control layout. `features/services/management/editing.ts` loads `GET /s/:id/edit.json`
(keeping `selectable: false` liturgies), separates saved baseline from draft, and sends
`PATCH /s/:id.json` with top-level `expected_revision` and only key-wise changes. A 409 `stale_session`
keeps the draft for **Reload saved version** or **Review my changes on the saved version**; a 409
`cursor_reset_required` asks before **Save and reset current part** (`confirm_cursor_reset` at the reviewed
revision); an unknown PATCH outcome is reconciled from the saved snapshot, never resent.

`deletion.ts` + `DeleteSessionDialog.tsx`: a fresh snapshot, a confirmation naming the exact session and
date (Cancel first), one locked `DELETE` with the captured revision, and an empty 200 that is never parsed.
Stale, typed 404 and unknown outcomes reconcile without deleting again. A confirmed deletion removes that ID
from My Sessions (a late page cannot bring it back) and only its shortcuts.

Live clients: a revision-checked `session_deleted` event, or a typed `session_not_found` read when the
event was missed, makes the reader terminal (`ReaderState.deleted`): cable, polling, commands and
controller presence stop, and the control screen, reader and named display show the service as
unavailable. Owner-current display links keep their preset and re-resolve through discovery.
Browser evidence: [qa/issue200](qa/issue200/).

## Interface languages / #123

Interface copy (buttons, statuses, errors, sheets, Settings and VoiceOver labels) lives in typed catalogs under
`features/i18n/catalogs`. The English catalog `en.ts` is the source wording; liturgical text and anything the
server sends (service titles, part roles, announcements) is not interface copy and is shown as received.

- **Using copy.** Components call `const { t } = useI18n()` and `t('section.key', { name })`. Code outside React
  (API errors, parsed fallbacks) imports `t` from `features/i18n`, which uses the language the root provider last
  resolved. Placeholders are `{name}`; a message with `one`/`other` forms (plus `few`/`many` for Russian) is
  chosen by its `count` parameter.
- **Choosing the language.** `I18nProvider` in `app/_layout.tsx` uses the reader's saved `interfaceLanguage`
  when set, otherwise the first device language the app ships, otherwise English. A missing message always falls
  back to English. English keeps the device's regional date format; other interface languages format dates in
  that language.
- **Adding a language.** Add `catalogs/<code>.ts` typed as `Catalog` (a missing key fails `tsc`), register it in
  `INTERFACE_CATALOGS` with `reviewed: false`, and add its plural forms to `pluralCategory` if they differ.
  Unreviewed catalogs are offered only in development builds. Set `reviewed: true` only after a fluent reader
  has checked the wording on a device.
- **Guards.** `tests/i18n.test.tsx` fails when a catalog lacks a message, a plural form or a placeholder that
  English has. `npm run check:i18n` fails CI when reader-facing English is written inline outside the catalogs;
  mark a deliberate exception with `// i18n-ignore` on that line.

### Russian catalog

A fluent Russian reader completed review of `catalogs/ru.ts`, and the product owner approved it on September 18,
2026. It is registered with `reviewed: true`, so production builds offer **Русский** under **Settings → Interface
language** without a draft marker and may choose it automatically on a device set to Russian. Liturgical text and
server-provided copy remain outside this interface catalog.


### Unattended Expo web displays (#158)

Public routes open without sign-in:

| Route | Screen |
| --- | --- |
| `/sessions/:id/display` | Follow a named service |
| `/sessions/display` | Follow the current service for a church/user |
| `/sessions/status/display` | Current service's hymnal page and posture |
| `/sessions/:id/status/display` | Named service's hymnal page and posture |

Add `?token=...` to resolve stored display preferences. Stored preferences win over
all URL preferences, including defaults for malformed stored values. Revisioned updates arrive through token-scoped DisplayLinkChannel subscriptions, with canonical reads on confirmation/recovery. Links are
revalidated every 10 seconds, so changed preferences and expired/revoked links
reach a screen left open. Invalid/expired links have a clear replacement-link
message; temporary failures retry automatically with a bounded 12-second request.

Without a token, direct preferences are `mode=parallel|single`,
`lang1=translit|en|grabar|hye|hyw`, `lang2=...`, `show_notifications=true|false|1|0`,
`show_explanations=true|false|1|0`, and
`status_view=full|pages_only|posture_only|none`. Invalid values use defaults:
parallel transliteration/English, notifications on, explanations off, full display.
`none` keeps reading text while hiding operator messages. Service projection
shows only the reading and speaker role; `show_explanations` loads the existing current-occurrence explanations only for token projections and shows an availability indicator when content exists. Direct tokenless projections keep their prior behavior. `pages_only` and `posture_only` select minimal screens even on a
text-display route. `hye` selects Eastern Armenian from `hy_east`; `hyw` selects
Western Armenian from `hy_west`. Neither substitutes another language when its
translation is missing or blank; the display shows the missing-text message.

Current-service discovery checks the public `/s/:user_id/current.json` endpoint
every 5 seconds, includes the viewer's time zone, and switches automatically to
the next service. Tokenless links accept `?user_id=...`; otherwise
`EXPO_PUBLIC_DEFAULT_CHURCH_ID` selects the owner (default `2`, as on legacy web).
A token's stored owner is authoritative. An inactive response clears the old
service and waits. A temporary discovery failure retains the last service in memory and shows
a large recovery notice until updates resume. Requests pause in the background/offline and resume when the
screen returns. Named-service live updates retain the shared occurrence-aware
ActionCable controller, its 30-second recovery polling, and revision checks.

Displays use the existing dark reading palette and bundled literary fonts, with
viewport-scaled text, narrow outer margins, and one large speaker label. Church,
service, language and footer labels are omitted for distance viewing. Parallel
languages remain side by side on tablets and
projectors; narrow screens stack two independently advancing reading regions.
Long readings use the API's `effective_duration_ms`, carried through the shared
part model and saved snapshots. A single monotonic clock drives both language
columns. The estimated reading position follows the center of each viewport,
leaving reading time at both the opening and the end. Scrolling stops at the
bottom and never loops or advances the service itself. Resizing, font loading,
and duplicate live/poll updates remeasure without restarting the clock. A new
occurrence (including a repeated reusable part) starts from the top. Pauses,
operator messages, recovery notices, and backgrounding suspend the reading clock;
returning to the same occurrence resumes its progress.

Missing or malformed duration data falls back to an estimate of 160 words/minute
for the longest selected translation, with a 3-second minimum. Operator messages
use that estimate independently of the underlying part. Reduced-motion settings
use duration-based pages with up to two lines of overlap; continuous motion uses
an animation frame loop and cancels when paused, finished, or unmounted.

The public API supplies an estimated duration but no occurrence-start timestamp.
A newly opened display therefore begins at the start of the received part, not
at an inferred position based on a poll revision or session update timestamp.
The duration is a pacing estimate, not synchronization to the actual speaker. Operator messages
replace the reading while active. Welcome/farewell use the first/last occurrence
of the current one-based manifest (also accepting a legacy zero-position welcome).
Status screens fill the viewport with the page number and the same standing,
sitting and kneeling pictograms as the Vite web display, without small captions.
The Expo web pictograms have accessible posture names; native routes retain a
large text fallback. Page and posture update from the same accepted live state.
Routine reconnecting labels are omitted while recovery polling continues; failed
updates show a large recovery notice and restore the display automatically.

The screen requests a wake lock while active. Browser support, HTTPS, device sleep
settings and browser fullscreen/kiosk configuration still govern unattended use;
fullscreen is not forced because browsers require a user gesture. No new packages,
authentication, EAS configuration or Vercel routing changes are required. These
routes ship with the Expo web build, which Vercel serves at `web.tarkman.app`.

#### Local apps/web display review (deprecated Vite app)

The shared fixture is synthetic and binds only to loopback. The active PR #171 runbook targets the Vite client
in `apps/web`, not Expo web. From the repository root:

```sh
npm ci --prefix apps/web
NODE_PATH="$PWD/apps/web/node_modules" node apps/mobile/qa/display/server.cjs
VITE_API_URL=http://127.0.0.1:8101 \
VITE_ACTIONCABLE_URL=ws://127.0.0.1:8101/cable \
npm run dev --prefix apps/web -- --host 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:8101` for links and controls. Leave a display open in a second tab; try the long reading, every operator message, service end/start, switching services, link expiry/recovery and connection loss. The two named fixture service IDs are **9001** (Divine Liturgy) and **9002** (Evening Prayer). If Expo uses another port, open the fixture with `?app=http://localhost:PORT`.

The active Vite display review adds exact scenario isolation, browser-control authentication, scroll instrumentation, publication overrides, fallback modes, and ordered-log instructions in `qa/display/REVIEW.md` and `../../docs/performance/web-session-state-qa.md`.
The standalone fixture page's **My display links** link targets the Expo web app on port 8082 (`?expo=http://localhost:PORT` overrides it); the Vite display links target port 3000 (`?app=http://127.0.0.1:PORT` overrides that base).

### My display links (#173)

About → Account → My display links opens the authenticated mine collection, including expired links. List/new/edit routes use the existing signed-in layout. Local drafts have an explicit Create/Save, versioned partial PATCH, inline synthetic preview, conflict review and unsaved-navigation guard. Unknown mutation outcomes require canonical reconciliation; uncertain POSTs are never automatically retried. State is scoped to API environment and signed-in identity and fenced on navigation. Display preferences never enter personal reader preferences or saved-service storage.

Sharing uses only the persisted HTTPS `display_url`. iOS uses anchored RN Share; web invokes Web Share directly from the tap, with Copy/manual-copy fallback. Expo Clipboard is the only added native dependency and requires a rebuilt client. [Fixture, Expo-web scenario and physical share checklist](qa/display/README.md) describe the review matrix. Backend #446 and physical-device behavior still require parent validation; no device recording is claimed by the source implementation.

## Controller presence / #184

The signed-in service-control route and its Service/Languages sheets share one owner-only
presence lifecycle. An in-memory cryptographic UUID identifies this app runtime/sign-in/API
environment (independent browser tabs have separate IDs); each session's positive safe
sequence increases across route remounts. No identifier or snapshot is persisted. While the
control group is active, the app is foreground/visible and network reachability is known,
`PUT /s/:id/controller_presence/:uuid.json` sends `{sequence,active:true}` immediately
and serially at the server interval (normally 10 seconds). A higher-sequence best-effort
`active:false` is issued before sign-out, route exit or backgrounding; it never delays those
transitions. The server lease lasts 45 seconds and is authoritative for crashes; local
status becomes unavailable after two missed intervals or immediately on failure/offline.
Requests time out after 12 seconds. Transient failures retry with bounded backoff, while
403/404/405 latch for this route lifetime, suppressing both further registration and
leave PUTs even across foreground/network churn until explicit route re-entry; 401
ends the current sign-in. HTTP 200 without
acknowledgment of the newly sent sequence and self presence does not renew local status.
On a presence 404, one bounded authenticated session read distinguishes a missing session
(404) from an older backend with a valid session (200); failed reads remain ambiguous.
405 is unsupported. These diagnostic reasons remain internal: the public status is
unavailable in every case, never a fabricated zero. Explicit route re-entry retries.

This is **participating client** status, not an operator count, permission gate or lock.
Older mobile builds and the legacy web client do not report; recently disconnected clients
may remain until their lease expires. Neither the reader socket nor commands are changed.
The API in Tarkman PR #449 must be deployed before this indicator can show a count.

For independent rendered QA, run the existing synthetic fixture server at
`node apps/mobile/qa/design-system/mock-reader-server.cjs` from the repository root.
In a second terminal from `apps/mobile`, set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8100`
and `EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable`, then run `npm run web`.
Sign in in two independent browser tabs with `operator@example.test` /
`fixture-only-password` (both receive the exact same synthetic bearer token) and open
controls for session `9001`. Both should show one other controller and a total of two;
the fixture serves an ordered 45-second lease and no public service is changed. For iPhone/
iPad simulator, build a local development client using the unsigned simulator build
instructions above, then run `npm start -- --dev-client` with the same fixture endpoints
on the simulator host, or point devices at an authorized LAN-reachable isolated backend
(not the device's own localhost). Verify background/foreground,
Service/Languages sheets, route exit, disconnect/lease expiry, Dynamic Type, Split View,
VoiceOver, light/dark and connection-vs-presence labels. Never use or advance a public
worship service. Automated Jest tests exercise protocol and ordering, not rendered or
physical lifecycle behavior; UI Operator owns screenshots and device evidence.
