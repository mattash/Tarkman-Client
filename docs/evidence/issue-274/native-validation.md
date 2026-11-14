# Native Library validation

## Status

**Incomplete:** matched native comparisons, repeated-occurrence/keyboard navigation and the corrected long-passage repeat-selection case pass. VoiceOver audible/focus validation is **UNVERIFIED**. The owner requested restoration of changed phone accessibility settings; the broader physical-testing pause and phone handback were orchestration coordination decisions, not a separate owner instruction to stop every device action. VoiceOver was restored to its recorded OFF state and queried as disabled; no other phone accessibility setting or notification choice was changed by Library. No operator prompt is pending. The coordination hold remains until a specific slot is released; no new VoiceOver enablement is authorized, and its acceptance decision remains pending.

## Actual application and source identity

- Physical iPhone 15 Pro, iOS 27.2, portrait 393×852 logical points / 1179×2556 pixels.
- Isolated signed development app **Tarkman Find QA**, `app.tarkman.libraryfindqa`, version 0.2.7 (build 1), Expo SDK 58. The installed production `app.tarkman` and its data were not replaced, cleared or used.
- One native Debug client loads both baseline and changed JavaScript. Baseline source is `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`. Initial changed captures used `ec8876e13b84964ba0ac5ef83a9db95e945ecaf7` (same tree as `15daa79` after reviewer-credit message rewriting); the corrected late-passage captures use `bdc1c45f44b69e9b0cb503c894279a75ae3ecf12`.
- All 276 baseline and 279 changed rendering/shared files were compared against their exact Git blobs, with no mismatches, including a fresh comparison against corrected source `bdc1c45`. QA-only differences are the isolated native identity/configuration, dependency-resolution guards and native build/cache tooling—not rendering source.
- QA configuration removes production update/EAS/universal-link claims, disables updates and Sentry reporting, and uses only synthetic content. Existing authorized development signing was used; no store submission or production credential change occurred.

## Matched scenario

Use the same client, phone, portrait viewport, English reading language, fresh default reading preferences (standard size, system appearance observed light) and saved synthetic bundle for `/liturgies/701`.

The fixture has occurrence 901 and 902 both displaying `Peace` and sharing reusable part ID 801; occurrence 903 has missing English text and shows the existing session-context fallback. Bundle revision is `9717a46f8c3240847650a86b214fc52056cccfd31402b7dfdcc655c5aa02df88`.

The schema-2 native SQLite database was seeded **only in this isolated QA app**, with the normal store's exact SHA-256 integrity format verified using JavaScript JSON serialization. The Library API environment is the intentionally unroutable `https://library274-fixture.invalid`; Metro supplies application JavaScript, not Library content. The native `Saved on this device` reader proves actual SQLite hydration. This is a seeded saved-copy test, **not a claim that the fixture was downloaded through the app's network UI**.

### Before — native main reader

[Before capture](./before-ios-393-light.png) shows the actual main-baseline reader, `Synthetic service`, `Saved on this device`, both repeated `Peace` passages and the existing fallback. The first-run developer education sheet was independently observed dismissed before capture. The SDK's floating developer gear is QA tooling, not a production control.

### After — actual changed reader

[Matched After capture](./after-ios-393-light.png) shows the same native reader and saved copy with Find available. The full-device Before/After pair is 1179×2556 pixels, with the same viewport, theme, language and reading size.

Native XCTest then opened Find, entered exact `Peace` using native keyboard events with per-character value verification, observed `1 of 2 matches`, and used keyboard Search to select `2 of 2`. Previous/Next and both wrap directions passed; Close preserved the readable content. [First occurrence](./after-ios-find-first.png) and [second occurrence selected by keyboard Search](./after-ios-find-second.png) visibly distinguish the repeated passages. These additional app-window XCTest captures are 1178×2556 pixels (native window rounding), not resized web images.

An initial external QA route-context cache issue was corrected with a byte-identical physical Router copy and private transform/file-map caches. The corrected real 30-route bundle was inspected and the actual changed native reader verified. No product source or global cache was changed.

## Verification record

| Check | Current evidence |
| --- | --- |
| Native baseline / saved-copy hydration | Observed and captured |
| Matched native After | Observed and captured |
| Native repeated-occurrence find and keyboard Search | Passed with exact native input; screenshots show first/second occurrence |
| Previous/Next wrap and dismissal | Passed |
| Native accessibility labels / controls | Actual XCTest accessibility queries pass; not a substitute for VoiceOver |
| Native long-paragraph passage geometry | Corrected `bdc1c45`: both initial late jump and same-target keyboard Search pass, with actual settled screenshots inspected |
| VoiceOver focus and announcements | **UNVERIFIED**; first-use notification prompt appeared. Owner requested restoration; orchestration paused physical testing. VoiceOver restored OFF and verified; coordination hold remains |
| Offline native saved-copy search | Passed with intentionally unavailable content API; seeded-copy provenance above |
| Rapid native input | Also reproduced on pinned main `d459fa5e`; not introduced by this PR. Underlying native/test-input cause remains undetermined |

The external XCTest transport has no app target/dependency and targets only the already-running QA identifier. It does not launch/reset/uninstall the production app. Its generic iOS build/signature verification and five actual native stages pass: reader inspection, exact query, keyboard Search, navigation/wrap, and dismissal. The owner completed the device's UI Automation authorization locally; no passcode was requested, read or logged. Initial failed input/transport attempts are retained internally rather than counted as passes.

A three-trial bulk-input diagnostic produced `Pace`, `Peace`, `Pce` from single-call XCTest `Peace` typing. A valid control in the unchanged catalog search produced `Pe`. The same valid control on pinned-main source `d459fa5e` produced `Pace`. This establishes that the behavior was not introduced by Find; it does not distinguish synthetic-key delivery from shared native controlled-input behavior. Per-character verification passed. No shared input redesign or claimed rapid-input fix is included.

### Preserved same-target native regression

Liturgy 702 contains one 7,230-character English paragraph ending `Exact passage lantern is here.` [Initial late jump](./after-ios-long-initial.png) reaches the highlighted word. With that glyph already measured, keyboard Search issues a fresh request for the same single match. The [pre-correction native result](./before-ios-long-reselect-fix.png), application source `ec8876e`, incorrectly returns to the row start. A passing `1 of 1` counter is not counted as passing geometry.

The source correction caches native line ranges by actual source/layout context, not request object identity; it qualifies them using the outer native Text width and retains current request/node/context guards. Deterministic native VirtualText tests reuse the same measured paragraph with a new request and **no new text-layout event**, test both native layout-event orders, reject stale source/scale/language/width data and verify recovery.

[After correction — same-target native Search](./after-ios-long-reselect-fix.png), source `bdc1c45`, shows the late highlighted `lantern` passage still visible after keyboard dismissal and reselecting the same match. The original and corrected repeat captures use the same fixture, language, reading size, light theme and 1179×2556 viewport. Both initial and repeat native stages passed on the corrected source; geometry was checked visually rather than inferred from the counter. The verified P2 review thread was resolved without a completion reply.

Local mobile verification passes: 101 suites / 1,359 tests, typecheck, full lint and reader boundary guard; prior web/Android exports pass. The earlier application head passed repository CI and an independent GPT-6.1 Sol P0–P2 review before the native repeat-selection regression was established. Corrected application head `bdc1c45` passes hosted CI (15/15) and the preserved real native initial/repeat cases. Final current-head independent review is still to be recorded; these results do not waive the unverified VoiceOver gate.

## Earlier Simulator limitation

Initial Simulator attempts could not operate the development-link confirmation because Simulator.app/native input tooling was unavailable. That limitation is superseded by the owner-provided physical phone and isolated signed client; mobile-sized web captures are never presented as iOS evidence.
