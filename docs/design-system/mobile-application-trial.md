# Mobile reading application trial

Status: implemented and checked in an iOS development client; ready for draft review, 2026-09-12. Branch: `codex/design-system-mobile-trial`, based on `codex/design-system-foundation`. This work is separate from web PR #110. Specimens remain provisional; this trial does not authorize a release or prescribe screenshot baselines.

## Scope and selected behavior

Apply the shared burgundy light/dark palette, pinned literary reading fonts and native reading preferences to the existing Expo live reader. Native controls retain system sans typography, scalable touch targets and platform modal behavior. Preserve the live-reader controller, network lifecycle, occurrence identity, manual reading and Return to live. Projector behavior, service-control commands, authentication flows and discovery information architecture are not redesigned.

Phone portrait and other narrow reading areas show one active language, with switching among the user's selected languages. Wider comparison is allowed only when each selected translation has readable space at the current text scale. Language selection and the active language are separate. Removing the active language selects the first remaining choice in product order; missing text is shown explicitly in its language's slot. Appearance supports System, Light and Dark. Existing saved single-language records must remain usable.

The native palette and text primitives are shared across the app, so their color and reading-font changes also appear in discovery, details, settings and existing operator controls. This is broader visual influence than a route-scoped web stylesheet, without changing those screens' task flows.

## Evidence boundaries

Use the real reader against the read-only sample fixture at `apps/mobile/qa/design-system/mock-reader-server.cjs`. Its numeric session 9001, parish, prayers and explanation are labeled sample content. Local welcome, subscription confirmation and pings establish fixture connectivity only; they do not verify a Rails production handshake, live service events or reconnect correctness.

Native acceptance uses a local development client. Expo web exports establish bundling compatibility, not native rendering. Generated iOS build files remain in a separate temporary build copy, outside the mobile branch. No EAS, credential, provisioning, app identifier, deployment or release change is part of this trial.

Verify both appearances, English/Russian/Armenian, missing translation, selected-set Apply/Cancel/minimum, active switching, explanation dismissal, manual/Return-to-live behavior, enlarged text and available-width adaptation. Screenshots are review evidence. Physical-device VoiceOver/TalkBack, actual service synchronization and hardware performance remain separate validation.

## Implemented and checked

- The mobile adapter imports `@tarkman/design/tokens` through a local file dependency. Source Serif 4 regular/semibold matches the pinned specimen bytes; licenses and source provenance accompany the assets. Existing Noto Serif Armenian files remain unchanged. UI labels retain system fonts. Markdown emphasis uses an explicit platform italic fallback until a literary italic asset is selected.
- The existing v1 record safely gains selected languages and appearance while preserving its saved language. Local choices take precedence over late hydration; failed writes do not interrupt reading. Forget my reading choices resets active/selected languages while retaining explicit appearance.
- A short native language sheet switches the active language. A separate selection view has checkbox semantics, draft Apply/Cancel and minimum-one validation. Comparison subtracts list/card insets, borders and gaps before requiring at least `300 × fontScale` points per language; this metric remains provisional.
- iOS uses a page sheet with native dismissal; Android retains no exit animation to preserve the existing focus-return sequence. Scrollable sheet content leaves Close outside the scroll. Text inputs follow the explicit keyboard appearance. The iOS sheet layout and Close action were checked in the native client; Android runtime validation remains pending.
- The separate passage-detail route still shows all available translations. The live reader retains its active language on return; this trial does not redesign detail-page language behavior.

Passed: full mobile Jest (18 suites, 132 tests), TypeScript, full ESLint including the QA fixture, UI guard, pinned-font guard and whitespace checks. Jest exited successfully after reporting an open-handle warning; that warning is not native-runtime evidence. iOS, Android and web exports all completed from the updated branch, including both literary and Armenian fonts. Output: `/private/tmp/tarkman-mobile-design-export`.

The repository-level web gates also passed on this foundation-based branch: 39 files / 351 tests and the TypeScript/Vite production build. Web dependencies and source were unchanged.

An independent Sol source review found no remaining material issue after corrections to comparison width, italic distinction, keyboard appearance and Android dismissal sequencing. Root handled integration/verification. The native checks below supplement that source review.

## Native review evidence

The local iOS development client built with signing disabled in `/private/tmp/tarkman-mobile-native-host`, with derived output in `/private/tmp/tarkman-mobile-native-derived`. The actual app ran on iPhone 17 Pro / iOS 26.5 (`FF50CD96-278B-4E33-B9BB-82E374EE0126`), loading the updated branch through Metro on port 8101 and the local sample API on 8100. Generated native projects and the temporary XCUITest driver are outside this branch. After the computer-use connection repeatedly reported the Mac locked, the user explicitly approved Xcode simulator commands and UI tests.

Verified in the native app:

- English, Russian and Armenian portrait reading show one active language. Russian's missing translation is explicit. The active language and explicit Dark preference survived a client relaunch. Returning from the existing all-language passage detail retained Armenian as the active reader language.
- Quick switching, clearing every draft language and seeing minimum-one validation, Cancel restoring the saved set, and Apply saving a Russian/Armenian pair. Rotating that pair to landscape produced two readable columns; portrait returned to one active language.
- Manual scrolling exposes Return to live; activating it returns to the current passage. Language and appearance actions preserve the controller state.
- The populated current-part explanation opens and closes. The fixture explanation was corrected to reference the actual current occurrence; the reader correctly filtered the originally mismatched occurrence.
- At maximum iOS accessibility text size, sheet content scrolls and Close remains usable. The reader header can be scrolled to the preferences control, and both its opener and Close work.

Native QA found and corrected two issues. The iOS page-sheet shell now starts its content at the top and keeps Close at the bottom. A live text-size change behind an open sheet previously enlarged glyphs while retaining old reader text frames. A fresh launch at the same size laid out correctly. The narrowly scoped iOS workaround refreshes only native Text leaves when `fontScale` changes; parent controls, routes and reader state stay mounted. Repeating the failing sequence now reflows the text correctly and preserves manual mode, with Return to live still usable. This may clear an active text selection or text-level accessibility focus when the system text size changes; physical VoiceOver review remains pending.

Raw simulator captures are in `apps/mobile/qa/design-system/evidence/`:

- `ios-light-english.png`, `ios-light-russian.png`, `ios-dark-armenian.png`: the three reading scripts and both palettes.
- `ios-dark-preferences.png`: corrected page-sheet layout.
- `ios-dark-landscape.png`: two-language comparison. The raw simulator capture retains the device's portrait pixel orientation; the UI itself is landscape.
- `ios-dark-large-explanation.png`, `ios-dark-large-reader.png`, `ios-dark-large-header.png`: maximum accessibility-size stress checks. These are review evidence, not attractive-layout targets or fixed baselines.

Remaining boundaries: Android native runtime, physical-device VoiceOver/TalkBack, text-selection continuity, native swipe-to-dismiss acceptance, keyboard interaction, real Rails service synchronization and hardware performance are not signed off. The native Close action was verified; a general scroll gesture is not evidence of sheet swipe dismissal. The automated suite separately covers migration and reader behavior. No release, merge or screenshot-prescriptive design rule is implied.

## Reproduce

Start the sample fixture, then Metro from `apps/mobile` with `EXPO_PUBLIC_API_URL=http://127.0.0.1:8100`, `EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable`, empty `EXPO_PUBLIC_SENTRY_DSN`, `NODE_OPTIONS=--dns-result-order=ipv4first`, and `npx expo start --dev-client --localhost --port 8101 --clear`. Open service 9001 in a local development client. Keep file watching enabled while reviewing source changes; a CI-mode Metro process must be restarted to clear its cached transform after an edit. Hide Expo's floating Tools button for screenshots and control testing, since it overlaps the top-right reader action.
