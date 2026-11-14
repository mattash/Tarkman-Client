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

## iOS availability and blockers

macOS native accessibility and screen-recording permissions granted. Xcode-select reports `/Applications/Xcode.app/Contents/Developer`. CoreSimulator iOS 27 available. Booted named `Tarkman iOS27`, UDID `48A13996-F47B-44AD-AB5B-08FDEBF9C261`. Existing app `app.tarkman`, v0.2.7 build 1, IsDeveloperApp=1; compatibility/source provenance not established. Simulator screenshot 1206x2622 (402x874 logical at 3x); light appearance.

However actual Simulator.app is missing: `open -a Simulator` says application not found; expected Xcode Developer Applications directory absent; `xcrun --find Simulator` fails. Agent-desktop snapshot returns APP_NOT_FOUND. Maestro and agent-browser are not on PATH; ~/.maestro/bin absent. simctl openurl triggers OS `Open in Tarkman?` confirmation and cannot tap it. Direct launch succeeds but deep link remains blocked by that confirmation. Raw simctl screenshot is a blocker diagnostic, NOT a baseline Library screen, and NOT proof the baseline bundle is running.

Diagnostic captures: `/tmp/library274-ios-status.png`, `/tmp/library274-ios-status2.png`. No actual iOS Before/After pair obtained. Do not label mobile-sized web as iOS evidence. No physical iPhone connection claimed, no Expo Go fallback, no cloud build or huge dependency install.

Alternatives: complete existing Xcode installation with Simulator GUI and operate through agent-desktop; or reuse preinstalled authorized Maestro/idb on another host with matching development client. Then launch baseline fixture Metro first, dismiss link confirmation, open `/liturgies/701`, capture light/en/default-scale at 402x874; reload matching implementation Metro for After. Physical-device test requires approved reachable test endpoint (phone localhost is not Mac loopback), matching signed client and device access. Screenshot evidence alone does not establish VoiceOver, keyboard, offline durability or universal links.
