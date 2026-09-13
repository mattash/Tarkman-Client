# Claude reading-reference refinement

Reference: [Tarkman Live Reading](https://claude.ai/design/p/3e69c858-1a93-43bf-b55c-21dda11b21d1?file=Tarkman+Live+Reading.dc.html&via=share), inspected September 12, 2026. Scope: the existing Expo reader on `codex/design-system-mobile-trial`.

## Applied

- Persistent, icon-led navigation. Live status sits beside the back action, while language, explanation and reading preferences stay directly visible during scrolling and resizing. Title, parish and detailed status scroll with the readings. At enlarged text sizes, controls can wrap instead of moving into an overflow menu. Live names the connected active service, independently of manual/following mode.
- Separate, labeled service and connection status using the existing paired status colors. Reconnecting retains the current text. Connection loss offers retry. Unlisted services remain readable.
- Unboxed reading rows with dividers, a full-width tonal current-part band and a restrained leading rule. Visible part labels use the provided role; occurrence identity remains in the accessibility label and domain model. Part-detail navigation moves to the role/header target so prayer text can be selected independently.
- One 20pt page inset (16pt above fontScale 2), proportional 19pt stanza spacing, existing source line breaks and selectable stanzas. Unsupported fenced markup stays inert. No Armenian optical-size change.
- A bottom return-to-live pill with an opaque backing, outside the scrolling content. Its caption says the service moved on only when the current occurrence actually changed during manual reading.
- Persistent Standard / Larger / Extra large reading sizes: 24/38, 30/46 and 36/54, composed with OS text scaling. Old preference records migrate without losing language or appearance. Resetting reading choices resets size and languages but preserves appearance, after an explicit in-app confirmation.
- Appearance and size choices use scalable radio groups; language-set editing remains separate from quick switching. The preview uses the first source line of the current part. Missing translations offer only selected languages with available text.
- Sheet dismissal and language Apply move into the header. Explanations use Source Serif at 17/27 rather than full prayer-text size.
- Secondary buttons use neutral surfaces, selection has its own treatment, and pressed/disabled states use explicit paired colors instead of opacity. Native icons use the specification's pinned Ionicons 13.1.4 font loaded with the existing Expo font lifecycle.
- Comparison measures the actual list width after safe-area layout, column insets, OS font scale and the chosen reading size. The active language is first, with explicit reading/comparison labels. Follow scrolling honors Reduce Motion; manual state is preserved across language changes.

## Token decisions

Accepted as native adapter values for this trial: page spacing 20, stanza spacing 19, dark current-rule color `#B07A93`. The muted accent is an indicator, never body text. Shared status colors and the web design package are unchanged. Armenian stays at the existing 24/38; the reference explicitly requires a fluent-reader comparison before adopting 23/38.

## Validation and limits

- Mobile typecheck, lint, UI guard, font checks and the design detector passed. All 138 mobile tests (18 suites) passed with coverage; overall line coverage is 92.93%. Jest exits successfully but prints an open-handle advisory. Mobile tests include migration/persistence, separate service/connection states, retry, manual-state preservation when switching a missing translation, reading-size preview/reset confirmation, and stanza/markup preservation.
- Existing web suite: 39 files, 351 tests passed. Expo web production export passed; the native iOS Metro bundle also built and loaded.
- iPhone 17 Pro / iOS 26.5 simulator: inspected the updated native light reader using the local sample service, including Russian text, live status, icon font, unboxed current part, and missing-translation actions. The running simulator was subsequently being used outside the sample; further checks used the isolated browser preview.
- Expo web at 402×874: inspected light English, dark Grabar, preference controls, selected-language editing, manual scrolling and return-to-live. At 874×402: verified English/Grabar comparison and compact title/live controls; returning to portrait restored one language. Screenshots were inspected in the task conversation.
- These checks do not establish Android, tablet-native, VoiceOver listening, native maximum Dynamic Type, or real-service synchronization sign-off.
- iOS still uses the existing native `pageSheet` with swipe dismissal and focus restoration. The installed React Native Modal does not expose detents. Content-sized native detents/grabbers require a separate sheet/navigation integration; no custom iOS overlay or unsupported prop was substituted. Android/web retain their current modal presentation.
- Custom pill/band cross-fades and sheet motion were not added. Native sheet motion remains OS-owned; current-part scrolling is animated only when Reduce Motion is off.

No live-service data, authentication, operator controls, EAS configuration, or deployment settings were changed.

### Header follow-up

The owner's screenshot feedback supersedes the reference's collapsing header: keep all reader actions visible and place Live beside Back, with no service title or overflow menu in the pinned bar. Live indicates the connected active service even while reading manually. Narrow/accessibility layouts may wrap controls. Verified at 320pt portrait and 874pt landscape in Expo web, including scrolling and opening explanation directly. All 141 mobile tests pass; typecheck and lint pass (generated `coverage/**` excluded from lint).

### Swipe-to-details follow-up

A short left swipe reveals a trailing information action; tapping it opens that part's detail screen. Swiping left at least half the row width (minimum 144pt) opens details directly on release. A right swipe closes an exposed action. The info target is positioned near the swipe's vertical origin so it remains reachable on long prayers. Swipe handling stops automatic following, respects Reduce Motion, and leaves vertical gestures, multiple touches, and press-and-hold selection to native responders. The existing accessible part-header action remains available.

All 148 mobile tests (19 suites), typecheck, lint (excluding generated coverage), and diff whitespace checks pass. Tests cover reveal/tap, full swipe, cancellation, closing, gesture direction/selection, rerender stability, and navigation to a non-current part. Jest was run with `--forceExit` because of the previously observed open-handle advisory. The iPhone simulator loaded the current checkout from port 8081 and part details were inspected, but automated drags did not reliably expose the trailing action; native swipe feel and selection coexistence remain unverified. No Android gesture verification was performed.
