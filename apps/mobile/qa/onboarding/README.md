# Reader onboarding (#170)

Implemented for the Expo app only. The guide uses the existing UI labels and icons,
local onboarding storage is independent of preferences and authentication, and
reader education does not own a controller, connection, or operator command.
The optional explanation popup is deliberately omitted; the accessible available
state and explanation tour step teach that topic without competing with Return to live.

## Verified in this checkout

- Local Expo mobile-web preview against the existing synthetic service fixture at
  `http://127.0.0.1:8100`, with Metro at `http://localhost:8111`.
- Today help opens, closes, and explicitly asks for service selection before the tour.
- Reload leaves an interrupted tour closed; reader preferences resumes its checkpoint.
- 390 x 844: real header controls are highlighted and remain clickable. The language
  target opens the existing language sheet once and resumes step 2 after dismissal.
- Explanation action opens the actual current-part fixture content, then resumes step 3.
- Preferences opens the existing sheet, preserves the selected appearance, resumes
  step 4, and Finish returns to reading with focus on the preferences control.
- 640 x 360: the tooltip becomes a scrollable AppModal; Finish remains reachable.
- Dark narrow and light compact captures are included in this directory. They show
  fixture text, not live parish content. These are review evidence, not golden tests.
- Focused tests cover record validation, late/failed reads, ordered writes, card
  persistence, invitation suppression, interruptions, hint eligibility and cancellation,
  and manual replay preserving learned topics. Existing reader/saved-copy/detail tests
  remain in the full regression suite.

## Still required before release

- Run `maestro/fixture-onboarding.yaml` against an iOS development client using the fixture.
  A booted simulator was discovered, but the available UI-control surface did not expose
  Simulator, and Maestro was not installed. Native interactions were not verified.
- iPhone and iPad, portrait and landscape, Dynamic Type accessibility sizes, VoiceOver,
  Reduce Motion, safe areas, and native page-sheet swipe dismissal/focus handoff.
- Browser keyboard and assistive-technology review, plus larger text screenshots.
- Observe first-time readers completing the tasks specified in issue #170, including
  someone using larger text. Do not substitute tour completion for task success.
- Fluent review of the new draft Russian strings. Existing draft-locale gating is preserved.

## Architecture notes

`OnboardingProvider` serializes writes and protects local actions from late hydration.
The web adapter deliberately propagates storage read failures so automatic education
can be suppressed for that run. Known learned topics survive a newer content record;
future content releases must add explicit topic-level migrations, not reset this record.

`useReaderEducation` consumes explicit reader intent only after hydration, layout, and
sheet dismissal. A native drag remains ineligible until end/settlement; wheel/key
browsing uses a debounce, and programmatic scrolling cannot create browse intent.

`CoachmarkOverlay` measures real refs relative to the reader root. React Native Web's
screen-reader query always resolves true in the pinned dependency, so browser users
receive a keyboard-accessible anchored tour plus an explicit “Read as a guide” action.
Native VoiceOver uses the linear sheet. No animation or added SDK is involved.
