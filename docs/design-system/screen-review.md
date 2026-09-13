# Reading-screen design review

Status: visual proposal only, 2026-09-12. No app implementation is authorized or included.

The following records the initial screen study. The newer [complete reading journey](reading-journey.md) incorporates the subsequently selected foundations and components, full pinned Armenian fonts, discovery, and connection-recovery states. Use that assembled proposal for current journey review; the original study remains historical evidence.

The literary-serif direction is now represented in a complete reading-screen mockup with Web and Native mobile presentation modes. The inline review is [tarkman-reading-screens.html](specimens/tarkman-reading-screens.html) preserved in the repository specimens directory; it is separate from application routes and bundles.

## Included for review

- Web reading: restrained navigation, serif title, following-live status treatment, three parallel language columns when space permits, and an explanation action.
- Native mobile reading: the same roles and typography in a narrow stacked layout with touch controls and a smaller title.
- English, Russian, and Armenian are shown by default. Transliteration can be enabled through the language picker. All text is from the existing gallery's sample prayer excerpts.
- A sample explanation view includes all three scripts; its short explanatory copy is mock content for design review, not an authoritative service explanation.
- Reading preferences show System/Light/Dark and Standard/Larger/Extra large sizes with a multilingual preview.
- Language selection, at-least-one-language behavior, settings, explanation, return controls, and Escape work locally in the mockup. Preferences last only for the preview instance and do not update either app or device settings.

## Decisions to assess

1. Does the serif title and prayer text give the reading screen enough character without making controls harder to scan?
2. Do English, Russian, and Armenian have compatible perceived size and visual weight?
3. Are three web columns comfortable, or should the default favor two reading languages with a comparison mode reserved for QA?
4. Does the native stacked presentation feel appropriately spacious, including larger text?
5. Do the explanation and settings surfaces remain recognizably Tarkman in both themes?

## Verification limits

Candidate web font loading and the light web composition were inspected in the browser. Native-mode preferences and dark theme selection were also inspected as a browser-rendered mockup. This is not an iOS/Android runtime, actual modal/sheet gesture implementation, Dynamic Type test, or complete accessibility audit. The preview uses ordinary document flow to keep full content inspectable; native screen transitions, safe-area behavior, and sheet mechanics still require separate specification.

The live badge and service behavior are illustrative only; the preview has no network connection to a service. It does not advance readings, preserve a real service position, persist preferences, or represent projector behavior.

This pass covers reading, explanation, language selection and preferences. Discovery, operator controls, long authoritative liturgical passages, connection/error states, the complete token/state contract, and exact native font assets remain separate review work.
