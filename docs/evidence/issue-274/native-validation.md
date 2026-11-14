# Native Library validation

## Status

**Incomplete:** a genuine native Before capture is available; the matched After and native interaction/accessibility checks are still pending the next coordinated phone slot. This record does not claim readiness.

## Actual application and source identity

- Physical iPhone 15 Pro, iOS 27.2, portrait 393×852 logical points / 1179×2556 pixels.
- Isolated signed development app **Tarkman Find QA**, `app.tarkman.libraryfindqa`, version 0.2.7 (build 1), Expo SDK 58. The installed production `app.tarkman` and its data were not replaced, cleared or used.
- One native Debug client loads both baseline and changed JavaScript. Baseline application source is `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`; changed application source is `ec8876e13b84964ba0ac5ef83a9db95e945ecaf7`.
- All 276 baseline and 279 changed files under the application routes, components, design, features and shared packages were compared against their exact Git blobs, with no mismatches. QA-only differences are the isolated native identity/configuration, dependency-resolution guards and native build/cache tooling—not rendering source.
- QA configuration removes production update/EAS/universal-link claims, disables updates and Sentry reporting, and uses only synthetic content. Existing authorized development signing was used; no store submission or production credential change occurred.

## Matched scenario

Use the same client, phone, portrait viewport, English reading language, fresh default reading preferences (standard size, system appearance observed light) and saved synthetic bundle for `/liturgies/701`.

The fixture has occurrence 901 and 902 both displaying `Peace` and sharing reusable part ID 801; occurrence 903 has missing English text and shows the existing session-context fallback. Bundle revision is `9717a46f8c3240847650a86b214fc52056cccfd31402b7dfdcc655c5aa02df88`.

The schema-2 native SQLite database was seeded **only in this isolated QA app**, with the normal store's exact SHA-256 integrity format verified using JavaScript JSON serialization. The Library API environment is the intentionally unroutable `https://library274-fixture.invalid`; Metro supplies application JavaScript, not Library content. The native `Saved on this device` reader proves actual SQLite hydration. This is a seeded saved-copy test, **not a claim that the fixture was downloaded through the app's network UI**.

### Before — native main reader

[Before capture](./before-ios-393-light.png) shows the actual main-baseline reader, `Synthetic service`, `Saved on this device`, both repeated `Peace` passages and the existing fallback. The first-run developer education sheet was independently observed dismissed before capture. The SDK's floating developer gear is QA tooling, not a production control.

### After — pending

The first changed-client attempt displayed Expo Router's welcome screen because a shared transform cache retained the baseline archive's absolute route context. This is not accepted as an After capture. Physical, byte-identical isolation of the Router package plus private transform/file-map caches corrected the generated bundle to the changed archive's real 30-route context. No product source or global cache was changed. The corrected bundle still requires actual native rendering and interaction verification.

## Verification record

| Check | Current evidence |
| --- | --- |
| Native baseline / saved-copy hydration | Observed and captured |
| Matched native After | Pending |
| Native repeated-occurrence find and keyboard Return | Pending; signed standalone XCTest transport prepared, not yet run |
| Native long-paragraph passage geometry | Pending; distinct synthetic liturgy 702 prepared with a late `lantern` match |
| VoiceOver focus, labels and announcements | Pending; enabling VoiceOver alone will not count as validation |
| Offline native search | Pending; API is intentionally unavailable and content is already saved |

The external XCTest transport has no app target/dependency and targets only the already-running QA identifier. It does not launch/reset/uninstall the production app. Its generic iOS build and signature verification pass; actual device execution/permissions are not inferred from that build.

Local mobile verification passes: 100 suites / 1,341 tests, typecheck, lint, web export and reader boundary guard. The posted application head also passes repository CI and a complete independent GPT-6.1 Sol P0–P2 review. These do not replace the outstanding native checks.

## Earlier Simulator limitation

Initial Simulator attempts could not operate the development-link confirmation because Simulator.app/native input tooling was unavailable. That limitation is superseded by the owner-provided physical phone and isolated signed client; mobile-sized web captures are never presented as iOS evidence.
