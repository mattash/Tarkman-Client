# Issue #211 validation

Local implementation, September 29, 2026, based on Tarkman-Client
`277e5ab1f75e7ad64d08a30f85efd0ec1f4c1eaf`. No production session or live control
was modified. Upstream data rights remain pending maintainer clarification; the repository owner has authorized PR publication.

## Data and contract

- The downloaded archive matched the pinned SHA-256 in `scripts/generate.py`.
- Repeated generation and `--check` produced identical four packs and manifest.
- All 1,460 public TypeScript results were deep-compared with fresh pinned Python
  output. Arrays, scalar types, localized Unicode, optional fields, identities,
  composite back-pointers and provenance matched. Python 3.9.6, standard library only.
- Nine package tests cover every record, checksums, dates/leap rules, both year
  boundaries, four time zones including DST transitions, missing/malformed packs,
  retryable failures, concurrent caching, mutation isolation and additive metadata.
- Focused examples: January 5 composites and five Gospels; January 26 intentional
  empty readings; April 7 Easter/Annunciation collision; August 5 best-guess tier.

## Creation and web

The complete mobile suite passed on Node 24.21.0: **80 suites / 1,071 tests**. TypeScript, ESLint,
i18n and UI guards passed. Shared core tests/boundary, reader boundary, TV typecheck
and native-input classification tests passed. Focused tests were rerun after the
final coverage-copy/API-guard changes: **51 passed**, with package tests also passing.
Jest emitted an existing open-handle warning after the complete suite, then exited
successfully; the focused suite exited normally.

Creation tests verify selection order, unchanged messages/unselected fields,
unchanged manual values on date changes, stale/locked applications, late responses,
Armenian content selection, unavailable/empty data and midnight bootstrap ownership.
The synthetic API saves and returns the actual submitted setup, verifying persisted
values match the applied draft and ordered liturgies. This is synthetic persistence,
not evidence of a write to a deployed Rails server.

Real Chromium verification used the production Expo web export with synthetic
`api.test` routes and a synthetic local account:

1. Previewed January 5 with all five Gospel choices, the Epistle and reference-only
   Old Testament readings. Nothing was selected initially.
2. Selected Matthew before Luke, applied, then created a session. Reading it back
   returned `Luke 1.26-38; Matthew 2.1-12`, unchanged manual Epistle and message.
3. Reloaded a new form, selected June 1 and Classical Armenian, set the browser
   offline **before the first lookup**, then previewed and applied Armenian text.
4. Changed to October 4, 2030. The unavailable-coverage notice appeared and the
   manually editable fields retained their values.
5. Visually checked both languages at 390 × 844; Armenian references wrap with the
   bundled Armenian font. Local screenshots are in `output/playwright/`.

This proves available-module offline web lookup. It does not claim offline browser
cold-start/PWA support. Creation still requires its authenticated backend.

## Bundles and performance

Expo exports succeeded for web, iOS and Android, including Hermes bytecode.
The final production web export also passed with normal minification. A temporary
package probe and native QA entry are excluded from the production app.

Measurements are kept outside `data/` in `evidence/`. Four JSON packs total
2,023,494 bytes, or 218,984 bytes when individually gzip-compressed at level 9.
These include per-date keys and versioned pack envelopes; the issue's smaller
2,003,935-byte number measured upstream responses without those wrappers.

The before/after non-minified Expo comparison includes the library, picker and
localized interface copy. See `evidence/bundle-measurements.json` for exact bytes
and the minor public-endpoint configuration difference between exports. It is not
an IPA/APK size, a network download measurement, or a whole-app startup comparison.

Desktop Node/V8 measurements (`scripts/benchmark.cjs`, ten separate processes,
darwin/arm64, Node 26.8.1) recorded median package initialization 1.31 ms, first
Armenian lookup 7.83 ms, cached lookup 0.0082 ms and JSON pack parsing 1.11 ms.
No year packs loaded during package initialization. Retained heap after module
initialization and one Armenian pack, after GC, was about 1.94 MB. This is not
Hermes heap, installed size or a physical-device startup result.

## Native probe

The iOS Release simulator build succeeded with Xcode 27.0 / SDK 27.0, arm64,
unsigned. `scripts/native-qa-entry.tsx.template` embeds the production picker and
library, blocks JS fetch/XMLHttpRequest/WebSocket and records lookup diagnostics.
OTA checks were disabled only in the generated QA native project and test app.

The iOS 27 simulator aborted before loading JavaScript because the existing
generated native shell lacks the newly required UIScene lifecycle. The native log
reported `UIScene life cycle is required for apps built with this SDK`. No app
configuration or scene-lifecycle changes are included in #211. A successful bundle
or native compilation does not resolve this separate launch issue.

The same binary cold-launched successfully on iOS 26.5, using embedded data with
OTA disabled and all JS network APIs blocked. Hermes verified all four packs with
**zero network attempts**. First Armenian lookup took **11.60 ms**; 100 cached
lookups averaged **0.0301 ms**. The Armenian day and production picker rendered
in the native screenshot. Selection/application is covered by component tests
and Chromium interaction; simulator touch interaction was not verified.

Hermes allocated bytes increased from 3,062,200 to 4,342,840 across the first
lookup (+1,280,640); external bytes increased by 940,336. Heap capacity stayed
8,388,608 bytes, with two garbage collections. These are one cold simulator
process's instrumented VM counters, not retained-memory-after-GC or physical-device
measurements. See `evidence/native-hermes.json`. Whole-app startup delta remains
unmeasured. The local screenshot is `output/playwright/lectionary-native-cold.png`.

### Reproduce native diagnostics

From a disposable checkout with mobile dependencies installed and Xcode/CocoaPods:

```sh
cp packages/tarkman-lectionary/scripts/native-qa-entry.tsx.template apps/mobile/lectionary-qa-entry.tsx
cd apps/mobile
CI=1 npx expo prebuild --platform ios --no-install
cd ios
pod install
cd ..
/usr/libexec/PlistBuddy -c 'Set :EXUpdatesEnabled false' ios/Tarkman/Supporting/Expo.plist
/usr/libexec/PlistBuddy -c 'Set :EXUpdatesCheckOnLaunch NEVER' ios/Tarkman/Supporting/Expo.plist
ENTRY_FILE="$PWD/lectionary-qa-entry.tsx" SENTRY_DISABLE_AUTO_UPLOAD=true \
  xcodebuild -workspace ios/Tarkman.xcworkspace -scheme Tarkman \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/lectionary-qa-build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO ARCHS=arm64 build
```

Install the resulting app only on a disposable simulator. Confirm Expo.plist in
the built app disables updates, cold-launch it and capture `LECTIONARY_QA` plus
the visible picker. Remove the temporary app entry afterward and restore any
incidental package-script changes from prebuild. Never ship this QA entry.

## Release gates

Maintainer confirmation of modern/source-derived data redistribution rights is
still required by #211 before package publication or production deployment.
The repository owner explicitly authorized pushing the implementation and generated
data for PR review on September 29, 2026; this is not a claim of maintainer clearance. LICENSE, NOTICE and the source limitations accompany the
package. Exact Python parity is not independent validation of every 2027 date.
No physical-device timing, full-app native startup delta, deployed-backend write
or successful iOS 27 launch is claimed by these checks.
