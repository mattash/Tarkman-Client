# Component review gallery — first group

Status: ready for visual review, 2026-09-12. Uses the [approved foundations](foundations.md). Component behavior and platform adaptations are candidates; no application implementation is included.

Review update: the user accepted this visual group and authorized the [second component gallery](components-two.md). This establishes a visual baseline, not native-runtime or accessibility sign-off. Native icon-library selection remains open.

Conversation specimen: [tarkman-components.html](specimens/tarkman-components.html). It contains Reading text, Buttons & icons, and Language selection. Review controls offer system/light/dark appearance, web/native-style presentation, 100/150/200% text scaling, and deliberately long control labels. The scale control enlarges specimen text; it is not OS Dynamic Type or browser zoom. Review navigation remains normal size.

## Contracts under review

| Component | Proposed contract | Demonstrated states |
| --- | --- | --- |
| ReadingText | Selected literary families, 24/38 baseline, selectable text, language tags, real regular/bold, original fixture line and stanza breaks; natural wrapping within 60ch maximum | All four languages, regular/bold punctuation checks, missing Russian translation with explicit notice |
| Button | Primary for the main action, bordered secondary, quiet supporting action; wrapping labels and 48 minimum target; semantic palette states | Default, actual hover/press, browser focus, disabled with reason, temporary loading, selected following-live toggle, destructive action specimen |
| IconButton | Accessible action name independent of artwork; 24 icon within 48 target; shared semantic role mapped per platform | Reading settings with Lucide on web and Ionicons candidate in native-style mode |
| LanguagePicker, web | Single reading-language choice in a compact disclosure; labeled native radio group; applies immediately and returns focus to trigger | Open/closed, selected language, long labels, reading preview updates |
| LanguagePicker, native-style | Draft radio selection in an in-flow sheet specimen; explicit Use language and Cancel; reopen from committed value | Selection, apply, cancel without changing reading, Escape dismissal, trigger focus restoration |

The native-style sheet is intentionally an in-flow review specimen, not a working native modal. Actual modal focus containment, safe areas, platform back gestures and announcements remain implementation work. The web disclosure likewise illustrates the picker; outside dismissal and complete production popover behavior are not represented.

The reading comparison shows all four language specimens together. The picker demonstrates a single reading-language preference; it does not define or remove parallel-reading capabilities. Long picker descriptions are labeled QA fixtures, not approved translations or revised application copy. No service operation, navigation, or persisted setting is performed by sample actions.

## Icon comparison

Lucide and Ionicons artwork are shown side by side for reading, language, settings, back and close. Native icon choice remains open. Icons are compared at the same visible size with theme-aware color; numeric Lucide stroke width is not applied to Ionicons font glyphs.

The Ionicons samples use official, version-pinned `ionicons@7.4.0/dist/svg/` artwork: `book-outline`, `language-outline`, `options-outline`, `chevron-back-outline`, and `close-outline`. Each URL returned HTTP 200 and SVG content. [Official Ionicons repository](https://github.com/ionic-team/ionicons). These are static masks for visual comparison, not a native library installation or font-rendering test. Map semantic names to the selected Expo-compatible package and test actual glyph weight/baselines before adoption.

## Font finding and resolution

The first inspection exposed missing glyphs in the Google Fonts Armenian subset for decomposed combining-mark fixtures. The corrected gallery embeds the existing full-coverage static Armenian regular/bold TTFs unchanged, along with their full OFL and author attribution. The application font files were only read, never modified.

Source: `apps/mobile/assets/fonts/SOURCE.md`, official Noto Serif Armenian v2.008. Embedded bytes match the repository's pinned hashes:

- Regular: `2c489e2ed0cd0fe7a302e5e04cab452633afe77a51e96a4592eb2ef533300cf3`
- Bold: `e7e59b075ee1cb526fe570491325c60574878b18756e83bff784bccc653de043`

Source Serif 4 remains Google Fonts web delivery. The corrected Armenian fixture displayed U+0301/U+0304 without the previously observed boxes in regular and bold at 48px. This does not establish complete glyph attribution, linguistic correctness, or iOS/Android shaping approval. Earlier boards remain historical direction specimens; this gallery supersedes their Armenian combining-mark evidence.

Prayer and transliteration strings are copied from `apps/mobile/design/samples.ts` without normalization or spelling edits. The Grabar mark fixture is also copied from that source. Russian/English punctuation checks are explicitly non-liturgical QA strings. Actual long service passages remain part of the later complete-screen pass.

## Verification

- Inspected 1024px desktop and 390px/320px narrow views, including dark native-style presentation with 200% specimen text. Long language rows and action labels reflowed; inspected root/stage dimensions showed no horizontal overflow. This is sampled coverage, not an exhaustive combinations matrix.
- Browser interaction checks: section switching, theme and presentation selection, web immediate selection, native cancellation retaining the prior language, native apply updating the Armenian reading preview, following-live toggle, temporary loading state and recovery, punctuation mode, and missing-translation notice.
- Fixed loading layout shift. A 320px/200% long-label button measured 225 × 209.97px before loading and 225 × 210px during loading; the minor difference is pixel rounding.
- `node apps/mobile/scripts/check-fonts.mjs` passed unchanged-asset hashes, static-font checks and required glyph coverage for both Armenian weights.
- Impeccable 4.3.1 detector returned `[]`. JavaScript parsed successfully. Embedded foundation manifest equals `foundations.tokens.json`.
- [Eight additional color pairs](component-contrast.json) for quiet actions, icon colors and destructive text meet 4.5:1. Existing foundation evidence covers the remaining shared pairs. No claim of full accessibility compliance.

Still pending: actual iOS/Android runtime, Dynamic Type and browser zoom, screen-reader workflows, comprehensive keyboard behavior, reduced-motion runtime verification, OS appearance transitions, exact Source Serif asset pinning, and fluent-reader review of script harmony. The browser-rendered Ionicons artwork does not verify a native icon-font integration.

## Next review

Review the hierarchy between primary/secondary/quiet buttons, the literary reading rhythm, and the web versus native language-selection behavior. Resolve the native icon family after visual comparison. Then extend the standalone gallery to fields, notices, surfaces, dialogs and sheets before complete-screen review. App integration requires its own explicit authorization.
