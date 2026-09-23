# Display-link manager review (#173)

The fixture is synthetic and binds to loopback only. It does not contact or control
an actual service. Start with a fresh fixture for each run:

```sh
node apps/mobile/qa/display/server.cjs
EXPO_PUBLIC_API_URL=http://127.0.0.1:8101 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8101/cable \
EXPO_PUBLIC_DEFAULT_CHURCH_ID=7 \
npm run web --prefix apps/mobile -- --port 8082
```

Open `http://127.0.0.1:8101`. Open the two **Token A** links and **Token B** in three
windows. Open **My display links**, signing in with the synthetic
`operator@display.test` / `fixture` account. This fixture account is an admin;
`scope=mine` still excludes its `other-owner` record. Begin with A at 100%, edit
**Sanctuary A** to 130%, and save. Both A windows should reflow the same reading;
B should stay unchanged. No save requires an active service. The fixture’s public
resolver, mine list, POST, PATCH/409/422, confirmation and config broadcasts all
use the feature contract; it is not evidence of backend #446 deployment.

`manager-web.cjs` automates that scenario using Playwright supplied by the review
environment (no project dependency added). It blocks all canonical configuration
GETs after bootstrap, so the update must arrive by cable. Run with a fresh fixture
and Expo server: `node apps/mobile/qa/display/manager-web.cjs`. It asserts unchanged
B text size and document sentinels, applies a two-second adoption target, and prints
observed milliseconds after the successful PATCH. Record a screen capture of the
editor and all three displays as separate rendering evidence; the script does not
claim native layout, clock continuity or manual-scroll evidence.

The fixture controls also simulate Rails-side edits, dropped events, failed GETs,
channel rejection, service rollover and deletion. For extra cases, POST JSON to
`http://127.0.0.1:8101/review/config` (fixture only):

- `{ "token": "token-A", "fields": { "font_scale": 130 } }` simulates an external editor.
- `{ "dropEvents": true }` isolates serial 10-second polling; restore with `false`.
- `{ "failReads": true }` retains last valid config while reads fail.
- `{ "rejectChannel": true }` rejects new token subscriptions; canonical GET still works.
- `{ "mutationStatus": 401 }`, `403`, `404`, or `422` forces a write failure; `0` clears it.
- `{ "delayMutation": 15000 }` commits but delays the response, exercising uncertain writes; `0` clears it.
- `{ "fields": { "expires_at": "<near-future ISO timestamp>" } }` tests natural expiry. Clearing it with `null` requires a new canonical validation to resume.
- `{ "delete": true }` terminally deletes A. Restart the fixture to reset.

For conflict review, leave A's editor dirty and change A through the fixture
controls before saving. Confirm the draft stays intact, compare saved and draft
values, select only intended fields, then explicitly Save again. For an uncertain
creation, review the refreshed list; the client deliberately does not retry POST
from the uncertain form because the server has no idempotency key contract.

## Rendering and recovery checklist

- Start midway through the long reading. Change size, margins, device, languages,
  single/parallel, movement and status. Verify current occurrence and clock remain;
  manual scrolling retains its proportional reading position and timed pages are
  recomputed from elapsed time. Verify operator messages and paused state too.
- Enable explanations only on A. See an availability indicator only when the
  fixture’s current occurrence has an explanation; no automatic explanation sheet.
- Edit a stored `hyw` link without changing language. It must retain `hyw`, show
  the warning, and offer only supported languages for a new selection.
- Check no service, a later start, rollover, and `/sessions/9001/display?token=token-A`.
  The named route stays named. Tokenless routes never subscribe to DisplayLinkChannel.
- Test offline/background/foreground and reconnection. Requests and subscriptions
  stop while inactive/offline and resume once; transient failures retain output.
- Sign out/switch accounts during list reads and saves. No old list/draft/result
  appears for the next account. Direct manager links wait for auth hydration.
- Test Cancel, browser Back, native back/swipe, closing the tab, conflict review,
  duplicate Save/Share taps, denied clipboard, and no Web Share support.
- Test light/dark, Russian draft, long Armenian titles, narrow phone and wide iPad,
  landscape, maximum Dynamic Type, keyboard-only web, and VoiceOver error reading
  and modal focus restoration. Personal reading Settings/reset must stay separate.

## Physical iPhone / iPad share checklist (not yet executed)

Install a rebuilt iOS development client after adding `expo-clipboard` (~57.0.2).
Use a controlled HTTPS fixture/backend and persisted HTTPS frontend URLs. The
loopback fixture defaults `display_url` to `https://localhost:8082`; for real
sharing, set `DISPLAY_FIXTURE_SHARE_ORIGIN` to the controlled HTTPS frontend before
starting it. Reach loopback through an explicitly configured development tunnel;
this fixture intentionally does not bind to the public LAN.

1. Create/save, then tap the separate Share action. Confirm the real iOS sheet
   contains the persisted browser display URL, title/subject, and no auth credential.
2. On iPad portrait and landscape, verify the popover originates at the tapped
   Share control, including a row near the screen edge. Rotate and test again.
3. Double-tap Share rapidly: only one sheet. Dismiss it: no error or success toast.
4. Copy, paste into Safari, reopen the original URL after editing, and verify the
   latest settings. Test clipboard failure/manual selectable URL where possible.
5. Confirm dirty/new/in-flight/expired links cannot share. Save does not itself
   open the sheet. Verify browser-friendly display routing remains excluded from
   native reader universal-link capture.
6. Record device model, OS, app build, orientation, text size, result and recording
   filename. Simulator/Jest results do not satisfy these physical checks.

## Parent validation

Run mobile `lint`, `typecheck`, `test`, `check:ui`, `check:i18n`, `export:web`, and
applicable core tests/typecheck. No web-app checks or release/EAS changes are part
of this work. Dependencies were not installed in the worker. Expo Clipboard's
lock entry pins the documented SDK version/resolved archive but lacks registry
integrity metadata because registry DNS was unavailable; refresh/verify that entry
when dependencies are available. The worker's system-TypeScript syntax/UI/i18n
checks do not replace the pinned compiler, Jest, browser, backend or device runs.


### Worker source-check results

- All changed TypeScript/TSX files parsed with zero syntax diagnostics using the
  system TypeScript compiler (not the app's installed compiler).
- Mobile UI and i18n guards passed with a temporary loader pointing only their
  TypeScript import at the system compiler. No application dependencies installed.
- Core compilation and its boundary check passed. The core test glob returned
  **12 passed, 1 failed**: the package-link install probe could not launch its npm
  CLI because `npm_execpath` was absent. It installed nothing and was not retried.
- A temporary controller/API smoke harness passed bootstrap race closure, version
  ordering, terminal invalidation, explicit conflict review, field allowlisting,
  partial PATCH, null/zero preservation and local expiration validation. It stubbed
  only i18n/auth UI imports; it does not validate native/React behavior.
- Fixture and Playwright runner JavaScript syntax checks and `git diff --check`
  passed. Mobile Jest, pinned typecheck/lint, export, live backend integration,
  browser execution and physical-device checks remain for the parent.
