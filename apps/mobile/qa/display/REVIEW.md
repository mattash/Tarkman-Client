# Issue 158 review — Expo web service displays

## Review of the starting branch

The named-service slice in PR #163 was retained for its canonical routes and use
of the established live reader. Its presentation needed replacement: it rendered
only one language at ordinary reader size, required tokens on public named-service
links, and left current-service discovery as a placeholder. The token shell and
normalizer were extended rather than discarded. The live model also needed page,
posture and display-message fields that it previously omitted.

The completed implementation covers named/current service projection, status
projection, all five operator interrupt states, welcome/farewell boundaries,
direct/token preferences and automatic recovery. Service projection reserves the
canvas for the reading and one speaker label. Status projection uses the original
web posture pictograms and a viewport-sized page number, without small labels. It uses
current one-based occurrence identity confirmed against the adjacent Rails source,
not the legacy display's outdated zero-based farewell calculation.

## Validation on September 19, 2026

- `npm run typecheck --prefix apps/mobile` — passed.
- `npm run lint --prefix apps/mobile` — passed.
- `npm run check:i18n --prefix apps/mobile` — passed.
- `npm run check:ui --prefix apps/mobile` — passed.
- `npm test --prefix apps/mobile -- --coverage` — **545 tests, 46 suites passed**;
  98.37% line coverage for `features/displayLinks`. The existing full-suite Jest
  open-handle advisory remains; the focused display suites exit normally.
- `npm run export:web --prefix apps/mobile` — passed (compile check with secure
  API/cable configuration; the exported build was not deployed).
- `npm test -- --run` — **359 web tests, 40 suites passed**.
- `npm run build` — existing Vite production build passed.
- `git diff --check` — passed.

Browser verification used Expo web at port **8082** and the synthetic loopback
fixture at **8101**, with no signed-in account or live church service. Checked
1920×1080, 1024×768, 768×1024 and 390×844. The distance-viewing revision was
rechecked at these sizes, including all three posture pictograms and minimal modes. No browser errors were reported.
Verified public tokenless single-language links, token precedence, parallel
Armenian/English, page-only, posture-only, combined status, unavailable translation,
invalid links, live announcement replacement, service end/wait/start/switch and
duration-based overflow scrolling (both translations reached the same normalized
reading progress despite different text heights). Pause/resume retained progress,
resizing retained progress, and completed text stayed at the bottom.

The fixture deliberately repeats a reusable part at a different occurrence and
includes a long reading. Its controls allow every operator status and connection
loss to be reviewed. Regression tests cover all interrupts, notification suppression,
occurrence boundary messages, page/posture publications, projection recovery
notices, expiry, late responses, configuration timeouts and automatic retries.

## Duration-based scrolling review

The legacy algorithm held the initial visible fraction, then reached the bottom
only as the estimated duration ended. The new calculation follows the estimated
spoken line near the center of each viewport. It preserves a dwell at the start,
reveals the last lines before the expected finish, and holds the final screen.
Both translations share an occurrence clock and duration, while their scroll
distances follow their individual measured text heights. It never advances the
service itself or loops back to the start.

`effective_duration_ms` now survives live part normalization and saved snapshots.
Missing/invalid values use a 160-word/minute estimate of the longest selected
translation (3-second minimum). Operator messages get a separate estimate.
Reduced-motion mode uses timed overlapping pages. Timers and animation frames
cancel when paused, hidden, finished, or unmounted. Occurrence identity resets
timing; poll revisions, font/layout changes and viewport resizing do not.

Tests cover timing endpoints, differing translation heights, resize remapping,
fallbacks and old saved records, delayed frames, cleanup, reduced-motion pages,
shared language clocks, repeated-part identity, pauses, recovery and backgrounding.
The synthetic long-reading fixture uses an accelerated 30-second duration.

The API exposes no occurrence-start timestamp. New displays start timing when
they receive a part; this is estimated pacing, not synchronization to a speaker.
A backend timestamp would be needed for reliable joining mid-part across devices.

## Captured screens

These captures contain **synthetic review content**, not live church content.

[Projector reading](evidence/projector.png) ·
[Portrait tablet reading](evidence/tablet-portrait.png) ·
[Projector status](evidence/status-projector.png) ·
[Announcement](evidence/announcement.png) ·
[Final screen of a long reading](evidence/duration-scroll.png) ·
[Measured scroll positions](evidence/scroll-timing.json)

## Review boundaries

This is Expo web implementation and browser evidence. Physical projector viewing
distance, native iOS/Android rendering, device wake-lock behavior and fluent-reader
review of the draft Russian interface copy were not verified. Western Armenian
text remains the explicitly agreed unavailable state (`hyw`), not another language
silently substituted. The standard Vercel preview still serves `apps/web`; use the
local fixture instructions in the mobile README to review these Expo screens.
