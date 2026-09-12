# Native design validation — first experiment

Date: 2026-09-12. Status: native experiment implemented and inspected; validation is partial, with the limits below. This is not production sign-off. Specimens remain provisional until the system has been applied in actual app screens.

## What ran

The isolated [native specimen](native-specimen/README.md) ran in Expo Go SDK 57 on:

- iPhone 17 Pro simulator, iOS 26.5, UDID `FF50CD96-278B-4E33-B9BB-82E374EE0126`, 1206×2622 screenshot pixels.
- Android `Medium_Phone_API_36`, emulator `emulator-5554`, 1080×2400 screenshot pixels.

The specimen pins Expo 57.0.22, React Native 0.86.3 and React 19.2.3, matching the current mobile app's framework versions. Expo's dependency map required `expo-system-ui` 57.0.4 and React types 19.2.4 in the specimen. No production package or lockfile was altered.

This is JavaScript running on native Expo Go views, not a browser mockup and not a standalone app build. Expo Go's floating gear is host development chrome, visible over some captures. The lab's separate bundle identifiers are reserved for a future standalone build; this run did not install a separate Tarkman binary.

## Checks and evidence

| Area | Observed result | Limit |
| --- | --- | --- |
| Native bundling | TypeScript passed; iOS and Android exports produced Hermes bundles and font assets | Does not establish standalone Xcode/Gradle or release-build behavior |
| Fonts | All four font hashes match; Latin/Cyrillic sample and Armenian punctuation/combining-mark cmap checks passed; actual three-language text rendered on both runtimes | Font coverage does not establish shaping quality, language correctness or spoken pronunciation; full mark-fixture visual inspection remains pending |
| Light/dark | iOS light language sheet/dark explanation and Android light reading/dark enlarged reading captured | Increased-contrast settings, cold-start theme persistence and background/resume are not covered |
| iOS languages | Unchecking all three then Apply reports the at-least-one-language error; Cancel preserves the three prior selections | Spoken error announcement and changed-selection Apply path need a dedicated accessibility pass |
| iOS reading position | Next → explanation → Back to reading retained passage 2, all three languages and manual-reading state in the native accessibility tree | Sample state only; real service synchronization was not connected |
| iOS modal accessibility | Accessibility tree exposes the sheet while hiding underlying reading; named Close/Cancel controls remain present; action names are now plain labels without icon glyphs | This is tree inspection, not a VoiceOver listening or focus-return pass |
| Large OS text | iOS normal → maximum → normal transitions ran without reload after the lab correction; visible Close/System labels remeasured, normal control geometry returned, and the note and passage-2/manual state survived. Android font scale 2.0 rendered in the earlier pass | Full maximum-size sheet traversal, every action and screen-reader focus across transitions remain unverified; the large title wraps heavily |
| iOS software keyboard | A six-line note’s final line/caret was visible above the software keyboard. Dragging the sheet dismissed the keyboard and exposed the entire field and Done. A subsequent Done action returned to passage 2 with all three languages and manual-reading state | Done with the keyboard still visible, landscape and maximum-size editing remain unverified |
| Android review | Native reading rendered in the earlier pass; the user subsequently inspected the Android simulator and reported that it looked fine | User visual review is recorded separately from interaction/accessibility testing. The computer-use tool could not attach; sheet, Back, keyboard and TalkBack checks remain unverified |

Primary captures at repository root:

- [Android light reading](evidence/native/android-reading-light.png)
- [Android dark with enlarged OS text](evidence/native/android-dark-large.png)
- [iOS light language sheet](evidence/native/ios-languages-light.png)
- [iOS dark explanation, passage 2](evidence/native/ios-explanation-dark.png)
- [iOS dark software keyboard](evidence/native/ios-keyboard-dark.png)
- [Font hash and coverage results](evidence/native/font-check.json)

`ios-sheet-max-text-before.png` and `ios-sheet-max-text.png` record an intermediate title-layout investigation, before the final scroll-container correction. `ios-reading-light-scrolled.png` and `android-initial.png` are early development captures; the Android initial capture contains a development-server warning. They are not final layout references. No capture is a golden-image baseline.

Follow-up captures in `docs/design-system/evidence/native-followup`:

- [Six-line field and Done after keyboard dismissal](evidence/native-followup/ios-multiline-done.png)
- [Maximum text after remeasurement correction](evidence/native-followup/ios-live-max-fixed.png) — partial scrolled viewport, showing Close/System; not a full-sheet pass.
- [Normal text and retained note after the return transition](evidence/native-followup/ios-live-normal-fixed.png) — no reload between the up/down transitions.

`ios-live-size-change.png` is the pre-fix clipping reproduction. `ios-keyboard-initial.png` is an intermediate field-position capture. Neither is a final layout reference.

## Findings and changes

1. **Icon glyphs entered button names.** The initial iOS accessibility tree concatenated icon glyphs with labels. Added explicit `accessibilityLabel` to the shared lab action. The final tree reports Preferences, Languages and Explanation without glyphs. Spoken screen-reader behavior remains a separate check.
2. **Large sheet headings consumed fixed space.** At maximum iOS text size, a fixed title used much of the sheet. Above font scale 1.5 the title now belongs to the scrolling content, with dismissal outside it. This is a provisional adaptation to test in real use, not a prescribed breakpoint for every component.
3. **Keyboard/scroll layout needed correction.** The sheet constrains content with flex layout and uses iOS automatic keyboard insets. Follow-up inspection confirmed the final line/caret of a six-line note above the keyboard; dragging dismissed the keyboard and exposed the complete field and Done. Close was also visible in that dismissed-keyboard capture. Done was activated successfully in the subsequent retained-note check. This establishes a completion path through keyboard dismissal, not unobscured access to every action with the keyboard open.
4. **Live OS text changes retained stale native text measurements.** The follow-up reproduced clipped action labels when increasing the size. The isolated lab now remounts native Text leaves on iOS font-scale changes, keeping the parent controls, scroll containers, controlled TextInput and application state mounted. A normal → maximum → normal check without reload confirmed visible Close/System labels fit at maximum, normal geometry returned, the two-line note survived, and Done returned to passage 2/manual reading with English, Russian and Armenian intact. This is a provisional runtime workaround, not a design-system rule or a proven upstream fix. Remounting text can reset active text selection or accessibility focus on those leaves; physical-device screen-reader and selection checks are required before reuse. The title still wraps heavily at maximum size, and complete maximum-size traversal was not established by the control tool.
5. **Local tooling and capture timing.** Metro initially listened only on IPv6 while Expo opened IPv4. The lab start command now uses IPv4-first DNS. An Android capture was taken before the dark-to-light transition settled; independent review caught it and the light capture was replaced after visual confirmation.

## Remaining validation before reuse

- VoiceOver/TalkBack listening: language pronunciation, reading order, selected/disabled/error states, modal isolation, initial focus and return focus, including across live size changes. Simulator accessibility-tree output is not a substitute. Apple directs VoiceOver testing to a physical device because it is unavailable in Simulator; see [Apple accessibility testing guidance](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app).
- iOS maximum text: traverse the complete sheet and reach every action; assess the heavily wrapped title in use. Extend the observed up/down transition to every sheet and verify long Armenian text and marks at each size.
- Keyboard: actions while the software keyboard remains visible, maximum-size editing and landscape safe areas. Multiline entry and drag-to-dismiss completion were observed at normal size. Android needs the whole interaction pass.
- Native gestures: iOS swipe dismissal and Android system/predictive Back. Source wiring is present; gestures have not been verified.
- Smaller phones, rotation, tablets if later targeted, hardware performance, reduced motion, text selection/copy, OS theme/background transitions, and authoritative long service content.
- Compare the pinned native static Source Serif files against the eventual web assets; the earlier variable-font web delivery is not necessarily optically identical.

No screenshot enforcement or definitive specimen rules were introduced. The next application trial should be allowed to revise sizes, density, layout and component APIs based on these findings.

## Environment and cleanup

Original test settings were iOS light / `large` content size and Android night `no` / font scale `1.0`. They were restored after testing. Only the isolated lab dependencies, Expo Go host on test devices, and local development tooling were used. No live service was contacted by the specimen, no EAS/release operation ran, and neither app's source, installed dependencies, fonts or preferences were changed.

Metro, the task-started iOS simulator and Android emulator were stopped, and the Android port forwarding was removed. Typecheck and export logs are retained beside the captures. An independent finish review accepted the corrected evidence wording for experimental handoff; a separate documentation review found no material source/documentation mismatch or broken local links. Neither review grants production or full accessibility readiness.

Follow-up: only iOS was restarted for the additional checks. Android appearance was accepted through the user’s own simulator inspection; no alternate Android UI-control method was used. The text-size workaround is lab-only and does not change the working specification’s component contract. Follow-up TypeScript and both native exports passed; logs are in `docs/design-system/evidence/native-followup`. Independent review found no material blocker for this scoped provisional handoff and retained the selection/focus and maximum-traversal limits above. Metro was stopped and the task-started iOS simulator was restored to light / `large` and shut down.
