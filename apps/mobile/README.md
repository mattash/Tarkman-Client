# Tarkman mobile

Managed Expo SDK 57, React Native and Expo Router. The home route is a public, read-only live-session reader. The `/gallery` route
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

`design/tokens.ts` owns light/dark roles, Tarkman purple (`#6B46C1`), point-based
spacing, radii, typography/line heights, elevation and the 44pt minimum target.
These preserve the web's role vocabulary and brand accent without importing or
changing web styles. `ThemeProvider` follows system appearance; its optional
`scheme` isolates the gallery's light/dark samples. The root owns safe areas,
status bar appearance and local font loading, without gating the router. A loading/failure notice explains system-font fallback and possible Armenian mark differences; failure offers an accessible retry without remounting the gallery.

- `AppText`: title, heading, body, liturgy, label and caption; semantic tone,
  language tag and Armenian static-font selection only after both fonts load. English, Russian
  and transliteration use the platform system font. Dynamic Type stays enabled.
- `AppButton`: native Pressable; primary, secondary, quiet and destructive.
  Loading/disabled suppress actions and expose disabled/busy accessibility states.
  Labels wrap; controls have minimum dimensions, never fixed text heights.
- `Surface` / `Card`: themed native containers; card spacing/radius/elevation.
- `TextField`: visible and accessible label, focus/error styling, native keyboard
  props, text scaling and disabled state. Return/submit behavior belongs to the
  caller; the gallery dismisses single-line keyboards on Done.
- `AppModal`: native Modal presented as a bottom sheet, scrollable content,
  safe-area padding and keyboard avoidance. Close button, backdrop, Android back,
  web Escape and accessibility escape dismiss it. Initial focus targets Close; callers
  pass an `openerRef` for return focus. Web uses host focus and RN Web’s focus trap;
  native requests accessibility focus through AccessibilityInfo. Android restores
  on the frame after removal; iOS/web use onDismiss. No exit animation or
  drag-to-dismiss gesture. Native assistive-tech behavior still needs device QA.
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

Card shadows use React Native/RN Web `boxShadow` (SDK 57's New Architecture),
not deprecated RN Web shadow properties. The mobile export serves a local copy
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
  ensure labels grow and every control remains at least 44×44pt.
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

The `/` screen discovers public services or opens a numeric session ID. Parts
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

- The reading language, saved as one small record and restored on launch. An
  unreadable or unknown record is discarded and reading continues in English.
- Nothing else. The sign-in token is separate and lives in the keychain.
- "Forget my reading choices" in the reading-language sheet clears the record.

Storage differs by platform, because the native key-value store does not run in
a browser: native builds use `expo-sqlite`'s key-value store, and web uses
`localStorage` through `features/preferences/storage.web.ts`. Both satisfy the
same `KeyValueAdapter` contract and tolerate a failed write, so a rejected save
never interrupts reading.

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

A build may go to testers when, on real hardware:

1. A live service reads correctly end to end: joining, following the current
   part, switching language, and opening explanations and part details.
2. Returning from background and recovering from lost connectivity restore the
   correct current part without a reload, and stale state is labelled.
3. Signed-out readers can do everything above; only service controls require
   signing in, and an expired sign-in returns to the sign-in screen.
4. Service controls move the service exactly once per press, refuse to send
   while offline, and report a refused, missing or stale command.
5. CI is green on the commit being distributed.

Blocker severity: **blocking** means wrong or duplicated live-service commands,
a reader stuck on stale text presented as live, a crash in any of the flows
above, or credentials leaving the device improperly. **Not blocking** means
layout and formatting problems, missing translations from the API, and anything
only reachable outside these flows.

### Known gaps

Recorded rather than implied: native crash and error reporting is not yet
configured (no Sentry in the app); there are no automated device flows, so the
hardware checks above are manual; universal links are unverified on a device
(#101); large text sizes still break reader layout (#91); block-level Markdown in
explanations renders literally (#99); the services list shows only the first ten
(#92). Jest covers behaviour, not rendering on a device, so it is not evidence
for any item in this section.
