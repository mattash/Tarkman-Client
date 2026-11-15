# #276 / PR #278 — OWNED iOS SIMULATOR evidence

**Owned-Simulator cases complete within this scope; current delivery checks/review are recorded on the PR.** These are genuine native iOS Simulator captures, not the Chromium evidence in the [web report](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/README.md>). Simulator evidence is **not physical-phone or VoiceOver acceptance**.

## Matched initial 701 comparison — PASS

| Genuine Before (#280) | Actual After (#278) |
| --- | --- |
| [Before, 7aa34e13](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-ios-701-clean.png>) | [After, 7801efd4](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-701-clean.png>) |

Both images were independently opened and visually compared. Same native host, owned iPhone 15 Pro / iOS 27.0 Simulator, 393×852 logical, 1179×2556 PNG, English, standard **in-app** reading size, light appearance, signed out, initial synthetic local SQLite service 701. Title, pinned toolbar, Choir/Peace twice and Priest/calendar text match. After adds the expected **Saved passages** header row; subsequent content shifts downward by about 56 logical points. This is a meaningful intended layout change, not a supposedly pixel-identical body. Neither accepted image is obscured by DevMenu. The earlier obscured-menu diagnostics are invalid baseline evidence and were not copied.

## Native long-row save/open — PASS within this scope

1. [After three native swipes](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-scrolled.png>): actual `test09NativeManualSwipeLongRow` passed after exactly three native `UIScrollView.swipeUp` gestures.
2. [Actual saved sheet](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-saved.png>): `test11ContinueObservedOpenPreferencesAndBookmark` passed; “Passage 1 · English” and excerpt are visible. The sheet explicitly says removing a saved service also clears its saved places.
3. [Actual bookmark-open attachment](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-bookmark-open.png>): `test12OpenBookmarkAfterModalDismissal` passed (one executed, zero failures, no skip reported). Independent image inspection confirms the paragraph 9 phrase “ordinary words and a distinct” highlighted fully below the pinned toolbar, approximately y=131–169 logical, with paragraph 10 following. This is bookmark opening in the existing process, **not by itself relaunch/Resume proof**.

[Normalized native verification](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/native-verification.json>) preserves actual result lines, exact image SHA-256/byte sizes, host-copy integrity, normalized direct native SQLite snapshots and source-anchor verification. After swipes, resume is offsets **1121–1150**, not row start. After bookmarking, bookmark and resume both retain those exact offsets: liturgy `702`, revision `c7d72978f97b0948b0e8062e7b6d76689b12540ec41f775599abb3eccbecf0ac`, part `801`, occurrence `1001`, index `0`, language `en`. Source verification identifies paragraph 9 and the visible phrase. SQLite stores identifiers/offsets, **not the excerpt**; the displayed excerpt is derived from source.

### Process termination, relaunch and explicit Resume — PASS

[Actual relaunched initial reader](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-relaunched.png>) shows paragraph 1 and an available Resume reading action. [Actual explicit Resume result](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-resumed.png>) restores the paragraph 9 phrase “ordinary words and a distinct”, fully highlighted below the toolbar at approximately y=131–169 logical, with paragraph 10 following. Both actual XCTest attachments were independently opened; these are not inferred from test success alone. Direct SQLite snapshots before termination, after termination, after initial relaunch and after Resume preserve the identical original 1121–1150 bookmark and resume anchors: no passive row-start overwrite.

Actual `test31ClearReadingPosition` subsequently passed (one test, zero failures). Direct SQLite after clear has `resume: null` while preserving the original 1121–1150 bookmark. Clear-position behavior is therefore PASS; the separate 703 removal result is documented below.

### Repeated occurrence 703 and per-liturgy isolation — PASS

Two actual `test09` invocations perform three native swipes each (six total). Direct SQLite after the first three identifies occurrence `1101` / index `0`; after six it identifies **1102 / index 1**, same underlying part `801`. [Actual second-occurrence scroll](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-703-scrolled.png>) visibly shows Occurrence 2. Corrected full `test11BookmarkVisibleSourceViaPreferences` and `test12OpenBookmarkAfterModalDismissal` each pass for this scenario.

[Actual second-occurrence bookmark-open attachment](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-703-bookmark-open.png>) was independently opened: “Occurrence 2, paragraph 7” identifies the target; **“Synthetic continuation for exact”** is fully highlighted below the toolbar at approximately y=131–169 logical, with Occurrence 2 paragraphs 8 and 9 following. Direct bookmark/open SQLite retains liturgy `703`, revision `c0de2f7d27b442a18f73fd8663c3c9de9b08bcd479b5cc1ce87fec41a0763409`, occurrence `1102`, part `801`, index `1`, English, offsets **568–600**. Independently slicing the seeded raw source as UTF-16 at those offsets yields the exact highlighted phrase within Occurrence 2 paragraph 7, not occurrence 1 or row start. Source SHA-256 and normalized snapshots are recorded in the verification manifest.

Actual `test30RemoveOnlyBookmark` passes; direct SQLite then has 703 `bookmarks: []`, with its 1102 / index 1 / 568–600 resume retained. Throughout 703 scroll/save/open/remove snapshots, **702 remains `resume: null` with its original 1121–1150 bookmark unchanged**. Thus removal is scoped and the previously cleared 702 resume does not revive: direct per-liturgy isolation evidence, not an inference from a screenshot. This does not imply process-relaunch testing of 703 itself.

### Final clear and reader exit — PASS

After 703 bookmark removal, actual `test31ClearReadingPosition` passes and SQLite prunes 703 entirely. Actual sheet-close `test90` and unrelated 701-reader `test01` also pass. Independently read snapshots after clear and after leaving the reader are identical: **only 702 remains, `resume: null`, original 1121–1150 bookmark intact**. No 703 resume/bookmark revives on unmount/navigation. Normalized snapshots and all four final clear/close/navigation result summaries are retained in the verification manifest.

### Largest in-app reading-size reflow — PASS

Actual `test14ChooseLargestInAppReadingSize` selects **Reading size, Larger** and `test15ReopenExistingBookmarkAtCurrentReadingSize` reopens the existing 702 bookmark; both pass. QA-app-only preference evidence records `readingSize: extraLarge`, with no phone/host preference changes. [Actual largest-size bookmark-open attachment](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-largest-bookmark-open.png>) was independently opened: the original paragraph 9 phrase **“ordinary words and a distinct”** wraps over two fully visible highlighted lines below the toolbar, approximately y=131–239 logical; paragraph 10 follows.

Direct SQLite still stores the original 29-unit bookmark **1121–1150**, same revision, language, part 801, occurrence 1001 / index 0. The new resume **1121–1141** measures the fresh first larger line; it is expected reflow geometry, not bookmark mutation. 703 remains pruned. This is the largest **in-app** size only, **not OS Dynamic Type, physical-device or VoiceOver proof**.

### Issue #276 accessible labels / focus criterion — bounded assessment

- **Native labels/action states:** actual Simulator XCTest and AX attachments verify the reading/preferences/saved-passage controls, enabled/disabled states, removal, dismissal and unobscured reader targets. This is native evidence, not a web/unit substitute.
- **Focus intent/order:** [11 focused PartList cases](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/apps/mobile/tests/passage-focus.test.tsx>) exercise the real list with mocked measurement/platform seams. They verify current visible-target measurement before native focus/announcement API calls, exact raw UTF-16 announcement text, once-per-request behavior, fresh same-range requests, stale/in-flight rejection and no focus stealing for resize/restoration. The [reader integration](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/apps/mobile/tests/library-reading-positions-ui.test.tsx>) verifies `focus: true` is deferred until modal `onAfterDismiss`, with the modal/list boundaries doubled. The focused run passes 24 tests (11 new plus 13 reader cases).
- **Native presentation/target visibility:** real saved-sheet dismissal and correctly visible highlighted destinations are independently verified above. Hittability and viewport restoration are **not actual assistive-technology focus**.
- **Actual UIKit/VoiceOver focus and spoken announcements remain NOT VERIFIED.** No #276 physical-device waiver is assumed. [#284](<https://github.com/mattash/Tarkman-Client/issues/284>) tracks the separate Find-only deferral; it is not a saved-passage VoiceOver pass or new device authorization. Native OS Dynamic Type is also unrun; largest in-app reading size is the narrower verified case.

### Synthetic revision-unavailable UI and cleanup — PASS

The unavailable-version scenario uses a **synthetic local-only** 702 revision change: identical parts, opaque revision changed from `c7d72978…` to `0e7a03b53db05074058cb67f8012cdff9098c5ea28f900d041e3ede7e64cd34e`. Existing parser validation and preparation record confirm the fixture basis. Only the owned Simulator's cached 702 payload/byte integrity row changed, after terminating the owned QA app; reading metadata was preserved and database integrity checked. This is declared fixture staging, **not a network download**.

Actual `test41InspectRevisionUnavailableState` passes. [Actual unavailable-revision sheet](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-ios-702-revision-unavailable.png>) was independently opened: disabled Resume reading and Passage 1, explicit unavailable-version explanations, and visible Remove/Clear controls. Actual native assertions verify both jumps disabled and Remove enabled; **no disabled jump was attempted**. Independently read before/after SQLite snapshots are exactly equal: original S1 bookmark 1121–1150 and resume 1121–1141 remain unchanged, with no silent S2 re-anchor. Subsequent actual `test32RemoveUnavailableBookmarkFromObservedSavedSheet` and `test33ClearUnavailableResumeFromObservedSavedSheet` both pass (one test each, zero failures): actual native actions remove the unavailable bookmark and clear the unavailable resume without attempting a jump. Independently read SQLite after removal retains only the original S1 resume 1121–1141 with `bookmarks: []`; after clear the snapshot is `{}` (reading-metadata row removed entirely). Thus cleanup is proven by actions and direct storage, not merely enabled controls. A separate native missing-occurrence case was **not run**.

### Honest harness failure

The original `test11BookmarkVisibleSourceViaPreferences` failed **before bookmark write**: unscoped “Saved passages” matched both the underlying reader-header button and the active preferences button. Only the external XCTest harness selector was corrected to scope `modal-content`; the continuation resumed the observed already-open preferences state and performed the actual native bookmark successfully. This is retained as `FAIL_EXTERNAL_SELECTOR_BEFORE_WRITE` in the verification manifest, not hidden or represented as a production defect. No production fix was made for it.

### Image transport detail

Copies preserve the **source file bytes**, without cropping, compositing, conversion or resizing. The first four are 1179×2556 PNGs. The actual XCTest open, relaunched-initial and resumed-reader attachments are **1178×2556 PNG**, verified from their PNG signatures and IHDR, and remain PNG here. The image-reading transport reported a normalized JPEG preview; that preview format is not the original artifact's format. The one-pixel attachment-width difference is disclosed rather than claiming a 1179-wide source or renaming PNG bytes to JPEG.

## Capture provenance and safety

[Native source provenance](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/native-source-provenance.json>) retains exact per-file hashes for genuine Before `7aa34e13fb04cfdf6c110255d8591f4467a81e69` (279 files) and current captured After `7801efd40e1606acd9d92dd8bb90f481557c1510` (286 files). Only the Before entry from the original source manifest is valid for this comparison: its old `c2357a91` After is deliberately excluded. After uses the recovered-source manifest. Both lockfiles hash `99ce2a987fb37fdb8fdeb336d6d2404ab4b6551c02305cfa87c56c30af01d2d3`.

The continuation is now reconciled onto actual main / #280 squash `35fbf4961c0e38cd64910a4126f1e8d7c3ee029f`; the [replay verification](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/reconciliation.md>) records the byte-identical full child diff and unchanged preexisting runtime/native inputs. Isolated prototype/evidence additions are not normal-app graph changes. This explains applicability, **not a recapture**: actual capture revisions remain **7aa Before / 7801 After**, never relabelled as future HEADs.

The same existing SDK 58 compiled Debug native host was reused for both JS sources, from known baseline `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d` provenance. Preparation was copy-only under unique identity `app.tarkman.bookmarks276qa`; updates, EAS/production links and embedded Sentry configuration were removed. Original source product was unchanged. Launcher compiled sections, debug dylib and frameworks were unchanged; only allowed metadata, copy-only ad-hoc launcher signature and added resource seal differ. Strict signature verification passed after the original linker-signature/resource-seal failure was investigated and resolved on the copy. No heavy app-native rebuild. Metadata removal does not prove removal of compiled instrumentation or network isolation.

Native Hermes/lazy bundles and the correct 30-route context preflight were validated for both sources. Synthetic raw JSON seeds 701/702/703 passed `parseBundle` and JS integrity validation. The actual native app reads local SQLite and shows “Saved on this device”; **this does not prove network download**, production backend behavior or physical-device offline behavior.

Owned Simulator identifier: `2915F3F2-4C10-4D3D-A261-9580C5F0898D`. App Debug FAB and automatic startup were disabled with process-only `__expo_disable_fab` / `auto_launch` flags; SDK code does not write preferences. Ordinary DevMenu education was closed through real XCTest. No physical-phone operation, VoiceOver enablement or host-preference change is claimed. Native accessibility-tree attachments are supporting native-source evidence, **not VoiceOver proof**.

The public-safe evidence includes original image copies and normalized verification/provenance records; binaries, raw host paths and credentials are excluded.

Only the ticket-owned QA app and Simulator were stopped after capture; original artifacts and synthetic app data are preserved. Both owned Metro servers were stopped. No foreign Simulator, physical phone, production app or host accessibility/preference setting was changed.

## Acceptance status — do not infer passes

| Gate | Status at assembly |
| --- | --- |
| Matched native initial 701 comparison | PASS |
| Actual three native swipes + direct SQLite nonzero resume | PASS |
| Native bookmark write + matching direct SQLite anchor | PASS (after disclosed external selector correction) |
| Native bookmark open + fully visible paragraph 9 highlight | PASS |
| Process kill/relaunch SQLite persistence and passive preservation | PASS — exact resume/bookmark anchors retained |
| Explicit Resume action after relaunch + restored-highlight geometry | PASS (`test21` plus independent actual-attachment inspection) |
| Clear reading position, retaining bookmark | PASS (`test31` plus direct native SQLite) |
| 703 repeated-occurrence restoration | PASS — exact occurrence 2 / paragraph 7 source, native SQLite and visible highlight |
| Remove bookmark, retaining resume and other liturgy | PASS (`test30` plus direct native SQLite) |
| Per-liturgy isolation / cleared 702 resume stays cleared | PASS across 703 scroll/save/open/remove snapshots |
| Final clear prunes 703; leaving reader does not revive it | PASS — direct clear/exit SQLite snapshots identical; 702 bookmark preserved |
| Largest in-app reading-size reflow | PASS (`test14`/`test15`, original bookmark retained, independently inspected two-line highlight); **not OS Dynamic Type** |
| Synthetic revision-unavailable disabled UI / no re-anchor | PASS (`test41`, actual image and exact unchanged SQLite) |
| Actual unavailable-record removal / clear | PASS (`test32`/`test33` plus direct SQLite: bookmark removed, then metadata row removed) |
| Native missing-occurrence variant | **NOT RUN** |
| Physical-device / VoiceOver acceptance | **NOT VERIFIED; not authorized here** |
| #280 accepted dependency | **MERGED** as `35fbf4961c0e38cd64910a4126f1e8d7c3ee029f`; Find-only VoiceOver deferral is not a #276 pass |
| Final-main reconciliation | PASS — exact continuation replay on actual squash `35fbf496`; see reconciliation record |
| Current CI and final posted-head review | Recorded separately on [PR #278](<https://github.com/mattash/Tarkman-Client/pull/278>), not inferred from native captures |

Physical-device/VoiceOver owner deferral tracked under #284 does not turn an unverified gate into PASS or authorize phone actions. The documented owned-Simulator functional cases are complete. This report is finalized only for the documented cases; native missing-occurrence and OS Dynamic Type variants remain unrun.

The owned QA process (PID 83019) was terminated and relaunched as PID 98826, with After loaded and routed to 702. Independently read direct SQLite snapshots before termination, after termination, after relaunched initial reading and after explicit Resume all retain exact resume/bookmark 1121–1150. Actual `test20CaptureParentStagedLifecycleInitialReader` and `test21ResumeReadingAfterParentLifecycle` each passed one test with zero failures; actual exported attachments were subsequently independently inspected and confirm initial paragraph 1 and the correctly restored paragraph 9 highlight below the toolbar. Remaining gates require separate actual results. Separately reported current combined source checks (107 suites / 1466 tests, static/export guards) and scoped independent autoreview of `c325c1d` with no findings are **not native certification**. This native evidence is not a current CI run or actual assistive-technology acceptance.
