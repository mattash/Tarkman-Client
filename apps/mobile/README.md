# Tarkman mobile

Managed Expo SDK 57, React Native and Expo Router. The home route is a public, read-only live-session reader behind three tabs (Today, Services, Settings). The development-only `/gallery` route
retains the Expo 05 static liturgy examples (`en`, `ru`, `grabar`, `translit`) and
works without network configuration. The production website remains the
separate Vite app in `../web`.

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

Core is a source-linked `file:` dependency. After installing both apps, run
`npm run core:test` and `npm run core:check-consumers` at repository root. The
reader and gallery use core language types; their narrower response models match
nullable Rails fields. Metro needs no custom core resolver.

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
- `AppModal`: native Modal presented as an iOS page sheet or Android bottom surface, with scrollable content,
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

`app.json` retains the existing owner, EAS project link, identifiers and scheme.
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

Connect/reconnect, `part_change`, `status_change`, `explanation_updated`, network
restoration and foreground return refetch all reader data. A 30-second foreground
poll catches missed events and service-list changes. A canonical session recheck
detects transitions during the parallel reads; invalidated responses are discarded
and coalesced into one rerun. Requests time out after 12 seconds. Backgrounding,
network loss, route exit and session changes dispose sockets/timers and abort
requests. Explanation failures remain separate from readable parts; stale
explanations are hidden until recovery. No content survives process exit.

Rails discovery currently means sessions on the client's date, not a guaranteed
in-progress service. There is no authoritative ended timestamp in this contract.
A service leaving discovery is labeled “no longer listed live”; its readings
remain available. Server status messages are displayed as text, without projector
or control behavior. The APIs have no atomic snapshot/version contract, so the
session recheck plus periodic recovery reduces, but cannot eliminate, every
cross-request race.

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

Offline downloads are **deferred**. Expo 01 (issue #69) decided that offline
reading waits beyond the first vertical slice and that only safe local
preferences are kept on the device, so there is no downloaded liturgy content,
no content versioning, and no download progress in this app. Reading requires a
connection; a service that has not loaded fails with a visible message rather
than showing stale text as if it were live.

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

- `apps/web/public/.well-known/apple-app-site-association` claims
  `/sessions/*/parts` and `/sessions/*/part/*` for `FHF872BAQR.app.tarkman`, and
  `vercel.json` serves it as `application/json`. The church display routes are
  deliberately **not** claimed: a kiosk link must keep opening in the browser.
- `app.json` declares `applinks:web.tarkman.app`, and the Expo Router paths
  mirror the website's, so an opened link lands on the matching screen.

`apps/web/app/__tests__/universal-links.test.ts` keeps the two in step: it fails
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

### What CI runs

The `mobile` job runs `npm ci`, `npm ls --all`, `expo-doctor`, lint, typecheck,
the Jest suite, the UI and font guards, `expo config`, the Expo web export, and
an iOS config smoke check that prebuilds the native project and asserts the
associated-domains entitlement and bundle identifier survive. The `build` matrix
runs the web client's typecheck, build and tests on Node 18, 20 and 22.

The smoke check runs last because `expo prebuild` rewrites `package.json`
scripts; it catches a broken app config or config plugin in CI rather than
during a release build. It does not compile Swift, so it is not a substitute for
an EAS build.

### Configuration by environment

Only `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ACTIONCABLE_URL` are set, per
environment, in the local shell or an untracked `.env`. They are bundled and
public by design; both must be HTTPS/WSS outside development, which
`features/live/config.ts` enforces. Nothing private belongs in the bundle: the
sign-in token is entered by the reader at runtime and kept in the keychain, and
any future build-time secret (a Sentry auth token, an App Store Connect API key)
belongs in EAS secrets, never in `app.json`, `eas.json` or source control.

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
with no user attached. That control never renders outside `__DEV__`.

Source maps are not uploaded yet. The Sentry Expo plugin is configured with the
organisation and project; uploading also needs `SENTRY_AUTH_TOKEN` as an EAS
secret, after which release builds get readable stack traces. Until then, native
frames in release builds stay minified.

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
loads the service and waits for **Read along**, because a camera can pick up a
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
plain `maestro` cask is an unrelated product — then run them all:

```sh
maestro test maestro/
```

`launch.yaml` loads the app and is reused by the others through `runFlow`. In
development it points the development client at Metro on port 8081; a standalone
build ignores that link and simply launches, so the same flows run against both.
`read-a-service.yaml` opens a service by ID, changes language, opens a part and
comes back. `part-link.yaml` opens a part straight from a link. Both are signed
out and read-only, so no flow can change a live service and none needs
credentials.

The flows read session 4006 on the production API, so they depend on that
service existing. They are not wired into CI: that needs a macOS runner, which
bills at ten times the Linux rate on a private repository, and a build to
install. Run them locally before distributing a build.

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
