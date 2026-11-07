# #259 — rendered linked-scroll verification

The screenshots are **actual production Expo web application renders**, not HTML/CSS replicas, test-component renders, or the deprecated Vite application. The browser opens `/sessions/259/display?token=fixture259` in an Expo `export --platform web` static build. Playwright intercepts only the public API and WebSocket endpoints; it does not replace the rendering or scrolling implementation.

## Reproduce

```sh
npm ci --prefix apps/mobile
npm install --prefix /tmp/scroll-tools playwright
# Run inside apps/mobile; --clear matters when changing EXPO_PUBLIC_*.
EXPO_PUBLIC_API_URL=https://fixture.tarkman.test \
EXPO_PUBLIC_ACTIONCABLE_URL=wss://fixture.tarkman.test/cable \
  npm run export:web -- --clear --output-dir /tmp/scroll-export
# Run from repository root. Chrome must be installed.
PLAYWRIGHT_MODULE=/tmp/scroll-tools/node_modules/playwright/index.mjs \
SCROLL_EVIDENCE_DIR=/tmp/scroll-evidence \
  node tools/validate-linked-scroll.mjs /tmp/scroll-export after default
```

The reusable [browser harness](../../tools/validate-linked-scroll.mjs) includes the complete deterministic text fixture and API responses. Other scenarios: `swap`, `stacked`, `reflow`, `background`, `fallback`, `fitting`, `independent`, `paged`, `manual`. No production service requests, credentials, or mutations are used. Playwright is deliberately not added to application dependencies.

## Evidence storage and timing behavior

PNG captures and JSON run records are hosted on the dedicated [PR #260 evidence prerelease](https://github.com/mattash/Tarkman-Client/releases/tag/pr-260-evidence-2026-11-07), not the application release or current source tree. Individual image downloads keep the PR's Before/After comparison accessible. The [complete evidence ZIP](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/linked-scroll-259-evidence.zip), [provenance manifest](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/manifest.json) and [SHA-256 checksums](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/SHA256SUMS.txt) retain the preserved baseline and fresh review runs. The release tag deliberately targets the pre-evidence main commit, not an application/evidence commit containing the old binary history.

Linked continuous pairs derive one phase from the occurrence clock and live geometry reports, rather than locking as a side effect of a column's scroll callback. A missing measurement allows the measured peer to proceed after 250 ms of active reading time. Started geometry holds remain stable across reflow. A corrected duration preserves current progress and re-times the remaining movement; it does not rewind or replay completed text. Single-column displays retain the ungrouped timing path. These correction/readiness behaviors have deterministic/component regression coverage; the ten rendered scenarios below cover the specified fixture and lifecycle cases, not every API correction or remote-control interaction.

## Controlled configuration and measurement

- Baseline: isolated `git archive` of `735d64788c303431bf30feac1bdf58eb0b6e722e`, separately installed/built before changes; the original baseline captures and records are retained unchanged. After: human-review application snapshot `7325f04715fcd7d1b10f680db2f9ce790bb2287e` (captured before evidence-history cleanup; source content hashes are preserved in the release manifest), freshly exported with Expo 57.0.32, expo-constants 57.0.23, expo-dev-client 57.0.21, expo-location 57.0.23, expo-router 57.0.30 and expo-updates 57.0.27. All ten after scenarios were rerun against this production export using the same Expo export command, browser, fixture and geometry.
- Authoritative token settings: parallel transliteration/English, `language_sync: linked`, `text_movement: continuous`, `device_type: projector`, `font_scale: 75`, `margin_percent: 4`, no explanations/status panel. Token JSON is captured in the records; no URL setting override assumption.
- 1920×1080 Chromium, reduced motion off, bundled SourceSerif4 loaded before measuring; body font 63.6923 px / line height 92.3538 px. Both viewports: 930 px tall × 851 px wide. Transliteration content: 2132 px / travel 1202 px. English content: 3795 px / travel 2865 px.
- Occurrence: session 259 / liturgy 1 / liturgy-part 2591 / Part 1 / position 1. API `effective_duration_ms: 60000`. Fixture has six ordered landmarks, with deliberately longer English expansion.
- Browser clock advances all actual application frame/timer callbacks; scroll positions are sampled every 100 ms. Times are relative to the post-font-load measurement origin, not server elapsed time; browser startup adds a small offset. The stricter single-frame invariant belongs to the deterministic timing regression, not these 100 ms samples.
- The JSON records retain configuration, fixture, geometry, first/last movement times, endpoint times, early/middle/late landmark visibility, lifecycle observations and browser errors.

## Results

All after-run assertions pass; every run has zero browser errors. The baseline linked endpoint assertion correctly fails. The harness exits nonzero for failed after assertions, while permitting the intentional baseline failure.

| Scenario | First movement, left/right | First DOM bottom, left/right | Observation |
| --- | --- | --- | --- |
| [Before linked](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-default.json) | 13.0 / 7.3 s | 46.8 / 52.6 s | **5.8 s endpoint gap** |
| [After linked](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default.json) | 7.3 / 7.3 s | 52.5 / 52.6 s | Common interval; about 7.4 s shared final dwell |
| [Swapped](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-swap.json) | 7.3 / 7.3 s | 52.5 / 52.5 s | Symmetric |
| [Stacked, 600×1080](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-stacked.json) | 11.7 / 11.7 s | 48.1 / 48.1 s | Both overflow; 457 px viewports, 688 / 1168 px content |
| [Missing API duration](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-fallback.json) | 8.2 / 8.2 s | 59.1 / 59.1 s | 67.5 s longest-language fallback |
| [Resize during/after movement](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-reflow.json) | 7.3 / 7.3 s | 52.5 / 52.5 s | Phase and landmarks retained; completed reflow remains at bottom |
| [Background 5 s](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-background.json) | 7.3 / 7.3 s | 52.5 / 52.6 s active time | Positions unchanged during hidden interval; resumes without catch-up jump |
| [Fitting transliteration](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-fitting.json) | stationary / 7.3 s | stationary / 52.5 s | No forced movement |
| [Independent](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-independent.json) | 3.8 / 7.3 s | 14.0 / 52.5 s | Matches [baseline](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-independent.json) within one 100 ms sample, intentionally unequal |
| [Paged](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-paged.json) | 11.9 / 11.9 s | 47.9 / 47.9 s | Matches [baseline](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-paged.json), coordinated turns |
| [Manual](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-manual.json) | stationary / stationary | stationary / stationary | Matches [baseline](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-manual.json), no automatic movement |

DOM `scrollTop` is pixel-rounded. Even exact equality with integer `scrollHeight - clientHeight` can appear up to one 100 ms sample earlier for the slower/shorter column; this is not a claim of sub-frame browser measurement. The deterministic scheduler regression is authoritative for simultaneous mathematical completion. The 5.8 s baseline discrepancy is removed.

### Early / middle / late passage observations

- At 10 s after the fix: left/right offsets 74 / 175 px, each about 6.1% of its travel. The short column shows OPENING–PRAISE while the longer column shows MERCY. Both include the early MERCY landmark; different text density remains visible.
- At 30 s: 604 / 1440 px, each about 50.3%. PEACE is visible in both; the short column additionally shows PRAISE/BLESSING. No claim of exact corresponding line placement.
- At 50 s: baseline left is already stopped at 1202 px while English is still at 2706/2865 px. After: left is still moving at 1135/1202 px, English at 2705/2865 px (both about 94.4%); CLOSING is visible in both.
- At 60 s: both are at their maximum with complete final lines visible and padding beneath; no blank overscroll. The opening and final screenfuls receive common holds.
- Mid-reflow at 30 s: 605/1202 and 1441/2865 become 507/1006 and 1205/2392 after resizing to 1600×900. Landmarks remain unchanged. Restoring 1920×1080 after completion returns directly to 1202/2865, not the beginning.

### Actual application captures

| Phase | Before | After |
| --- | --- | --- |
| Opening | [Before](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-default-opening.png) | [After](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default-opening.png) |
| Early, 10 s | [Before](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-default-10000.png) | [After](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default-10000.png) |
| Middle, 30 s | [Before](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-default-30000.png) | [After](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default-30000.png) |
| Late, 50 s | [Before](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-default-50000.png) | [After](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default-50000.png) |
| Final dwell, 60 s | [Before](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/baseline-default-60000.png) | [After](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default-60000.png) |

![After: late passage, both still moving at 50 seconds](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-default-50000.png)

[Stacked middle passage](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-stacked-30000.png) · [Completed reflow, final text preserved](https://github.com/mattash/Tarkman-Client/releases/download/pr-260-evidence-2026-11-07/after-reflow-completed-reflow.png)

## Scope and limitations

This establishes rendered paired completion for a controlled unequal fixture. It does **not** inspect the parish's saved link, deployed build, physical projector, audio delivery, or actual passage duration. Matching endpoints is not word/phrase alignment. A short translation naturally shows more landmarks per screenful; the screenshots and landmark records make this limitation explicit. Initial and final screenfuls remain readable, with no blank overscroll or looping observed.

Background checks synthesize browser visibility events, not physical native-device suspension. The harness records the pre-event position, lets React's AppState transition and pause-clock effect settle for a real 100 ms task without advancing the browser clock, records `background-paused`, then asserts exact position equality after 5 s of hidden browser-clock time. An initial pre-settle check observed a 1 px event-boundary update; measuring the settled paused interval avoids treating that transition as hidden-time movement without relaxing the stationary assertion. Manual checks verify no automatic movement, not every manual gesture. Paged checks record existing behavior; this change does not invent phrase-level synchronization for it. Reflow changes both dimensions during movement, then restores the original size after completion to check that completed content does not replay.
