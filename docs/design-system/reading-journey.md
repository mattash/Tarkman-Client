# Complete reading journey

Status: visually accepted for further exploration, 2026-09-12. Standalone proposal assembled from the selected foundations and two visually accepted component groups. Neither app was changed. No production behavior, API integration, dependency, font installation, or preference migration is included. The user's subsequent clarification keeps specimens provisional until real application use; this is not a definitive screen layout.

Conversation specimen: [tarkman-reading-journey.html](specimens/tarkman-reading-journey.html). It opens on service discovery and supports web and native-style presentation, 100/150/200% specimen text, and explicit review scenarios. These outer controls are review tools, not proposed app controls.

## Journey contracts

| Step | Proposed behavior |
| --- | --- |
| Discover | A sample service names its state and available languages. Loading, empty, and failed list states have distinct wording. Retry demonstrates loading followed by the sample service. |
| Choose languages | English, Russian and Armenian start selected. Transliteration is optional. At least one selection is required. Cancel discards draft changes. |
| Open service | A short loading state can be cancelled. Preferences are unavailable during joining so the completion transition cannot interrupt preference editing. |
| Read | Two sample passages support previous/next navigation. Manual navigation is explicitly distinguished from following live. Return to live restores the sample live position. |
| Explain | Open the current passage in a separate reading surface; return preserves passage, languages, and following/manual state and restores focus to the explanation action. Explanatory copy is only a layout sample. |
| Adjust preferences | System/light/dark and three reading sizes apply within the preview. Returning preserves the previous view and its reading state. Nothing persists beyond the preview instance. |
| Recover | Service pause keeps connection status separate. Reconnecting and connection-lost states retain the last received text with a staleness qualifier. Simulated reconnect preserves current position and languages. |
| Missing translation | Russian-unavailable review state explicitly identifies missing content without silently substituting a different language. Other chosen languages remain visible. |

This is a finite demonstration, not a synchronization engine. The sample live position remains passage 1. Scenario controls jump to a known reading or discovery state and cancel pending demonstration timers. No service requests, subscriptions, caching, or actual offline storage occur.

## Design and content

- The embedded review manifest matches `foundations.tokens.json`; no new palette or geometry direction was introduced. Existing contrast reports cover the reused opaque foreground/background pairs. This is not a full rendered accessibility audit.
- Source Serif 4 serves English, Russian and transliteration. Armenian uses the exact repository regular/bold Noto Serif Armenian files with full OFL and author attribution embedded. Source Serif 4 is delivered through Google Fonts.
- The two passages split the existing prayer fixture in `apps/mobile/design/samples.ts` at stanza boundaries. English, Russian and Armenian appear together by default. This specimen does not approve translations or theological copy for publication.
- Web uses parallel language columns when space allows. Native-style and enlarged-text modes stack languages. Control labels wrap, with the selected 48-unit target and 17px native-style body baseline.
- Labeled actions keep the unresolved native icon-library choice open.

## Verification

- JavaScript parsing and exact embedded token equality passed. Embedded font bytes originate unchanged from the pinned repository assets. The browser reported reading fonts loaded.
- Browser interaction checks covered the at-least-one-language error, successful joining/loading transition, next passage, explanation return, draft-language cancellation, dark appearance and larger reading size, connection loss/reconnecting/recovery, and service-list error/retry/loading.
- Explanation return and connection recovery both retained passage 2, all three selected languages, and manual-reading state. Escape closed the explanation. Focus returned to its opening action.
- Visually inspected the light web reading layout at a 1024px viewport and dark native-style explanation at 390px. At a 320px viewport with 200% specimen text and the larger reading size, inspected Armenian rendering and measured no horizontal overflow in the reading and language-selection states. Root content width was 273px after preview framing/scrollbar space. Very large text naturally wraps into short lines; this is a stress case, not the proposed default.
- Russian-unavailable feedback remained explicit while the other languages and position were preserved. Its English feedback carries an English language tag.
- Impeccable static detector returned no findings. No app build or test run was needed for isolated proposal artifacts.

## Remaining gate

The [working implementation specification](implementation-spec.md) and [first native experiment](native-validation.md) now document platform contracts and runtime findings. Resolve those bounded validation gaps before reusing the experiment in either app; application integration remains separate work.

Native-style here means browser rendering. Actual iOS/Android font rendering, Dynamic Type, safe areas, keyboard avoidance, back/swipe behavior, native sheets, OS appearance transitions, screen-reader announcements, real browser zoom, live synchronization and real connection recovery remain unverified. The explanation and preferences use ordinary document flow; they do not claim production modal focus trapping or sheet gestures. Projector and operator workflows remain separate scope.
