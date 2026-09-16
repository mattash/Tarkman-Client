# Issue 117: physical iPhone and iPad verification

A recorded pass on physical hardware for [#117](https://github.com/mattash/Tarkman-Client/issues/117).
It supplies the physical-device evidence required by the
[beta exit criteria](../../../../docs/beta-exit-criteria.md) and closes the
device-only gaps left by #115 (keep awake), #116 (saved service) and #125
(Expo web could not check native sheets or live ActionCable updates).

## Rules for this pass

- **Service controls only on the owner's designated test session** on
  production, outside worship hours. Never send a control command to a real
  service. Record the session ID used.
- The tester signs in personally; credentials are never typed by an agent or
  recorded here.
- Record each result as **Pass**, **Fail** (with a severity from the beta exit
  criteria and a new issue link) or **N/A** (with a reason).
- Attach a screenshot or screen recording per section (file name or link).
- VoiceOver is low priority for this app. Record what you see, but a VoiceOver
  gap is not a beta blocker on its own. Dynamic Type is **not** deprioritized.

## Run details

| Field | Value |
| --- | --- |
| Date | |
| Tester | |
| Commit / build (EAS build ID or local) | |
| iPhone model and iOS version | |
| iPad model and iPadOS version | |
| Designated test session ID (controls) | |
| Reading session ID (live follow) | |
| Auto-Lock setting used | Shortest available (30 seconds) |

## 1. Live updates while following

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1.1 | Opening a live service shows the subscription as connected (no stale or connecting banner once settled) | | | |
| 1.2 | A part change from the operator moves the reader to the new current part within a few seconds | | | |
| 1.3 | Status changes (live, paused, ended) show on the reader | | | |
| 1.4 | An explanation added or edited on the server appears while following | | | |
| 1.5 | Changing reading languages keeps the current part and live context | | | |

## 2. Lock, background and connectivity recovery

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 2.1 | Lock the device for 1+ minute while the service moves on; after unlocking, the reader shows the correct current part | | | |
| 2.2 | Background the app (switch apps) for 1+ minute; after returning, the reader shows the correct current part | | | |
| 2.3 | Turn on airplane mode: the reader clearly shows it is not live and never presents a stale part as current | | | |
| 2.4 | Turn airplane mode off / restore Wi-Fi: live following resumes without relaunching | | | |
| 2.5 | (#116) Load a service, turn on airplane mode, force-quit and relaunch: saved text is shown and clearly labelled saved, not live | | | |
| 2.6 | (#116) Reconnect after 2.5: live following returns | | | |
| 2.7 | (#116) Settings → Remove saved service copy, then repeat 2.5: no saved text; the reader says a connection is required | | | |

## 3. Keep awake (#115)

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 3.1 | With Auto-Lock at its shortest, the live reader stays on for longer than the Auto-Lock interval without touching it | | | |
| 3.2 | The service control screen stays on for longer than the Auto-Lock interval | | | |
| 3.3 | After leaving the reader or control screen (to Today or Settings), the device dims and locks normally | | | |
| 3.4 | After backgrounding from the reader, the device locks normally on the home screen | | | |

## 4. Long services and the reading list

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 4.1 | Opening a long multi-liturgy service whose live part is far down opens directly on the live part | | | |
| 4.2 | Fast-scroll the whole reading list top to bottom and back: no blank rows, wrong text or jumps | | | |
| 4.3 | Swipe a part open, then fast-scroll: no other row appears swiped open (row recycling) | | | |
| 4.4 | "Return to live" appears after scrolling away and brings the live part back into view | | | |

## 5. Part detail

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 5.1 | Opening a part shows every language; language chips and section jumps work | | | |
| 5.2 | While on part detail, when the service moves on, the return-to-live nudge appears and returns to the live reader | | | |

## 6. Service control (designated test session only)

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 6.1 | Signed out: no control entry points are visible | | | |
| 6.2 | Signed in: My services lists the test session and opens its controls | | | |
| 6.3 | Next and Back each move exactly one part, and a follower device updates to match | | | |
| 6.4 | Service sheet opens at both detents, scrolls, jumps to a part and dismisses (button and swipe down) | | | |
| 6.5 | Languages sheet opens at both detents; with the keyboard up, the field and actions stay reachable | | | |
| 6.6 | 409: move the session from another device first, then press Next on this one; the stale move is refused with a clear message and nothing is sent twice | | | |
| 6.7 | 403: with an account that is not authorized for the session, controls are refused clearly | | | |
| 6.8 | Offline (airplane mode): control commands are disabled or refused, and none are replayed on reconnect | | | |
| 6.9 | iPad two-pane layout is correct in portrait | — | | |
| 6.10 | iPad two-pane layout is correct in landscape, including rotating mid-session | — | | |

## 7. Text size and VoiceOver

Dynamic Type at the largest accessibility size (AX5: Settings → Accessibility →
Display & Text Size → Larger Text). See #91.

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 7.1 | AX5: live reader text is readable, nothing is clipped or overlaps, and controls stay reachable | | | |
| 7.2 | AX5: part detail | | | |
| 7.3 | AX5: service control screen and both sheets | | | |
| 7.4 | VoiceOver (low priority): reader, part detail and control screens can be navigated and buttons are named | | | |

## 8. Error reporting (#118; preview build only)

| # | Check | iPhone | iPad | Evidence / notes |
| --- | --- | --- | --- | --- |
| 8.1 | Settings → Error reporting → Send a test error appears in Sentry with readable JavaScript frames, the `preview` environment and this build's release | | — | |
| 8.2 | Crash the app (native), then relaunch: the crash appears in Sentry with symbolicated native frames | | — | |

## Summary

| Result | Count |
| --- | --- |
| Pass | |
| Fail — Blocker | |
| Fail — Service degradation | |
| Fail — Non-blocking polish | |
| N/A | |

Issues filed for failures:

-
