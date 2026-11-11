# Issue 268 — actual Expo web Before / After QA

## Revisions and provenance

- Before: `725e7d4883a2d6d996002a538871be23934903f3`, exported from an isolated `git archive` in `/tmp/issue268-baseline.3COAkh`, **not** reconstructed UI or the changed working tree. Installed dependencies were copied after a whole-node_modules symlink failed isolation (Metro followed the original shared-package paths).
- After: `f5e3be071c3bc6066e6c2b4b4f7685b8a28f8404`. Captured after the main agent's implementation-ready signal; production-source SHA-256 fingerprints were verified byte-identical to this subsequent commit. See [revision/source/export fingerprints](<revisions.json>).
- Executed 2026-11-09 America/Los_Angeles / 2026-11-10 UTC. Playwright Chromium `156.0.8078.4`, headless, DPR 1, en-US, America/Los_Angeles, fresh browser context for each scenario. Theme follows emulated system preference.
- Both are actual Expo Router application exports, not HTML mockups. Same fixture process, synthetic numeric session 9001, fixed service date 2026-11-10, identical account/data/display configuration. The different app ports identify separate exports, not different application scenarios.
- Fixture only: `operator@display.test` / `fixture`, loopback API 8101. No real accounts, services, production API calls or production page captures. Packaged lectionary lookup runs locally. Synthetic Isaiah text is manually supplied fixture content, not an assertion about this date's lectionary.

## Paired visual evidence

| Scenario and state | Before | After |
| --- | --- | --- |
| Edit form, 1440×1100, light, readings section aligned to top | [Before](<before-form-desktop-light.png>) | [After](<after-form-desktop-light.png>) |
| Edit form, 390×844, dark, Gospel field aligned to top | [Before](<before-form-phone-dark.png>) | [After](<after-form-phone-dark.png>) |
| Operator Service sheet, 390×844, light, active session | [Before](<before-operator-phone-light.png>) | [After](<after-operator-phone-light.png>) |
| Display, 1920×1080, dark, same `showing_prophetic` state and token-A configuration | [Before](<before-display-kiosk-dark.png>) | [After](<after-display-kiosk-dark.png>) |

Supplemental: [after-only lectionary picker, 1440×1100 light](<after-picker-desktop-light.png>). Baseline has no picker on this edit route; no false baseline modal is supplied. Nine PNGs total, unmodified browser screenshots (viewport captures, not full-page composites).

[Before browser observations](<before-capture.json>) and [after browser observations](<after-capture.json>) include actual visible text, viewport/document widths and page errors. [Picker assertions](<picker-check.json>) record an executed UI interaction, not a source-only test.

## Results and layout observations

- New prophetic field is visible in desktop light and phone dark layouts. Existing field alignment, borders, spacing, sticky Save and phone contrast remain consistent. No horizontal document overflow or browser page errors in the eight paired captures.
- Operator adds Prophetic Reading without horizontal clipping at 390px; the lower part-navigation row requires normal vertical scrolling. “Controller status unavailable” is the fixture's absent controller-presence endpoint, present before and after, not a new app failure.
- Identical `showing_prophetic` state: baseline correctly shows its old fallback prayer; changed app shows complete centered synthetic Isaiah text, with comfortable contrast and no clipping at 1920×1080.
- Actual edit-picker interaction passed: zero automatic selections, preview leaves draft unchanged; manually selecting only `Hosea 14.9-10` applies only prophetic, preserves dirty Gospel/Epistle values, and sends **no save request**. The picker clearly explains that source roles are unknown. Its long content scrolls vertically to Apply; the screenshot intentionally shows the selected reference rather than the offscreen bottom action.
- Usability caveat: prophetic is a single-line input like the existing Gospel/Epistle reference fields. Long synthetic text is horizontally scrollable within the input, not fully readable at once on phone. This is not document overflow; no production layout change was made by QA.

## Reproduction

From repository root, export each revision from its own checkout/archive, with dependencies installed or copied so `@tarkman/*` resolves inside that revision:

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:8101 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8101/cable \
EXPO_PUBLIC_DEFAULT_CHURCH_ID=7 \
npm --prefix apps/mobile run export:web -- --dev --output-dir /tmp/issue268-before-export
# Repeat from changed checkout with output /tmp/issue268-after-export.
```

`--dev` is required for these HTTP/WS loopback endpoints. A production-mode export was initially tried, but correctly rejected insecure endpoints and showed sign-in not configured; it was not used for evidence. Both evidence builds use the identical documented development export mode.

```sh
DISPLAY_FIXTURE_MANAGEMENT=1 node apps/mobile/qa/display/server.cjs
node apps/mobile/qa/display/static-export-server.cjs /tmp/issue268-before-export 8082
node apps/mobile/qa/display/static-export-server.cjs /tmp/issue268-after-export 8081
# Supply Playwright through NODE_PATH if not installed in the execution environment.
# Optional QA_CHROMIUM points to an already-installed Chromium executable.
QA_PHASE=before node apps/mobile/qa/display/issue268-capture.cjs
QA_PHASE=after QA_APP=http://127.0.0.1:8081 node apps/mobile/qa/display/issue268-capture.cjs
QA_APP=http://127.0.0.1:8081 node apps/mobile/qa/display/issue268-picker.cjs
```

QA changes are limited to the synthetic [management fixture](<../../../apps/mobile/qa/design-system/management-fixture.cjs>), opt-in [display fixture](<../../../apps/mobile/qa/display/server.cjs>), [export host](<../../../apps/mobile/qa/display/static-export-server.cjs>), [paired capture runner](<../../../apps/mobile/qa/display/issue268-capture.cjs>) and [picker runner](<../../../apps/mobile/qa/display/issue268-picker.cjs>). The same extended fixture serves both revisions; adding a prophetic field to synthetic responses does not change the baseline application source. All servers were managed jobs and stopped after QA.

## Validation and limits

- Both selected Expo exports passed; paired browser captures and picker assertions passed; QA-file ESLint and `git diff --check` passed.
- Existing display-fixture suite is **5 passed / 1 failed** in both untouched baseline archive and changed checkout: publication test expects string `'9001'`, server emits numeric `9001`. Confirmed pre-existing; not silently repaired by QA.
- Not validated here: real backend acceptance/deployment, native devices, TV, physical projector, VoiceOver, Russian/Armenian layout, maximum Dynamic Type, all viewport/theme permutations, long-message projector scrolling or live operator-to-display latency. Kiosk state is set deterministically through the fixture API, not by pretending a UI click happened.
- No release build, production deployment, source implementation edits or commits were made by this QA worker.
