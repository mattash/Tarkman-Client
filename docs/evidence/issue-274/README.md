# Library #274 evidence handoff

Baseline source: `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`, isolated using `git archive` to `/tmp/library274-baseline` before active implementation changes. No production edits or installs by evidence agent.

## Matched web scenario

Actual production client `apps/mobile` Expo Router app, not legacy Vite and not standalone mock UI. Existing `scripts/library-fixture-server.mjs --scenario=normal` serves synthetic fixtures on `127.0.0.1:4190`. URL `/liturgies/701`; synthetic service title, repeated English `Peace` at occurrence 901/902, session-context fallback at 903. Signed out, fresh browser storage, light color scheme, en-US locale, America/Los_Angeles timezone, device scale 1, font scale default. Viewports 390x844 and 1440x900. Page fonts awaited before screenshots. For After use same service and query `Peace` (two English occurrence matches); capture normal reader and search open/results separately.

Baseline images: `before-web-390-light.png`, `before-web-1440-light.png`; manifest `before-web.json` records no page errors. The desktop default selected-language set renders English reading plus Grabar/translit comparison; search uses English only.

Reusable captures: `capture.cjs` (closed reader), `capture-after.cjs` (closed reader + query/Enter/Next/Escape/no-results), `capture-long.cjs` (derived synthetic 100-paragraph English row, exact `lantern` passage). Run scripts from repository root with `QA_APP=http://localhost:YOUR_PORT`; optional `QA_OUTPUT` overrides output. The closed-reader script additionally accepts `QA_PHASE`. Requires an already installed Playwright and browser; no dependency install. `QA_PLAYWRIGHT` may name the absolute installed Playwright module directory (otherwise normal `require('playwright')` resolution is used), and `QA_CHROMIUM` may name an existing Chrome/Chromium executable (otherwise Playwright's existing browser is used). On this host the run reused `/tmp/issue-271-evidence/harness/node_modules/playwright` and `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. The long-row script intercepts only the loopback synthetic fixture bundle and derives a fresh revision; it does not alter production fixtures/source or use real data.

Start implementation Metro from apps/mobile with `EXPO_NO_DOTENV=1 EXPO_PUBLIC_SENTRY_DSN= EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1 EXPO_PUBLIC_LIBRARY_API_URL=http://127.0.0.1:4190 CI=1 node node_modules/expo/bin/cli start --localhost --port 8083 --clear`.

Baseline dependency reuse required isolated @tarkman package links and one external tool-only change in baseline `tools/metro/single-react-native.js`: derive the accepted dependency directory from realpath of react/package.json. This does not change rendered application source; it permits the shared already-installed dependencies. Baseline Metro on 8082.

## Rendered checks

The 390px long-row run derives 100 English paragraphs before one `lantern` match. The app scrolls within the first occurrence (not just to its row): `after-long.json` records the first highlighted glyph at y=244..277 inside the 844px viewport, with no page errors. `after-web-390-long-passage.png` shows the exact passage and remaining content. This is actual Expo rendering with synthetic request interception, not a drawn mock.

An initial browser run exposed Escape not dismissing find; the implementation owner corrected the RN Web filtered-event issue with TextInput `onKeyPress`. Final rerun passed at both 390px and 1440px: Enter selects the second repeated occurrence, Next wraps back to the first, Escape closes find, and an absent query gives explicit no-match copy. Both widths have zero page errors (`after-web.json`). Matched closed-reader Before/After and first/second-result screenshots are recorded alongside this document. After captures match production UI source committed as `cc72d36ee2ad0ef4d160cb5739fa6c6da5a6cf46` (captured while that identical production source was a working tree; the commit also adds tests). Baseline is `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`.

The supplementary 320px run also passes: toolbar width/scrollWidth both 320, every toolbar button within x=8..312, document overflow false (`after-compact.json`). `after-web-320-larger.png` uses the largest in-app reading-size choice, not simulated OS accessibility scaling.

## Native iOS evidence — incomplete

The initial Simulator limitation has been superseded by the owner-provided physical iPhone and a distinct signed QA client. A genuine main-baseline reader capture is now available at 393×852 logical points / 1179×2556 pixels: [Before iOS](./before-ios-393-light.png).

[Native source identity, scenario and verification record](./native-validation.md) documents the isolated app, actual saved-copy hydration, exact baseline/changed revisions and remaining gates. [Matched native After](./after-ios-393-light.png), repeated-occurrence selection, keyboard Search, navigation/wrap and dismissal are captured and pass. Long-passage geometry, VoiceOver and a rapid-input diagnostic remain outstanding, so this handoff remains incomplete. Mobile-sized web is not labelled iOS, and seeded saved content is not represented as an app-initiated network download.
