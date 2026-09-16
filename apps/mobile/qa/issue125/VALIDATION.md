# Issue 125: Expo web control and reader QA

Checked 2026-09-15 against the local Expo web preview on port 8095 and the
loopback fixture on port 8100. The fixture account is synthetic:
`operator@example.test` / `fixture-only-password`; it is not a Tarkman
credential and the server resets all control state when stopped.

## Results

| Viewport | Service controls | Service sheet | Horizontal overflow |
| --- | --- | --- | --- |
| Phone: 390 x 844 | Stacked control deck; current part visible | Opened and dismissed | None (`scrollWidth = 390`) |
| Tablet: 820 x 1180 | Rail layout and current part visible | Opened and dismissed | None (`scrollWidth = 820`) |
| Desktop: 1440 x 1000 | Rail layout and current part visible | Opened and dismissed | None (`scrollWidth = 1440`) |

The authenticated web flow completed: sign in, list the fixture service, open
controls, open Service and Languages, jump from part 2 to part 3, and change
the status to Paused. Each successful sheet command closed its sheet and the
reader refreshed to the updated session state.

At a compact 390 x 480 phone viewport, the Languages sheet had a 549px scroll
height in a 480px client area. `PageDown` moved its scroll position from 0 to
69px; Done then dismissed it. This verifies a real web scroll container rather
than only a visually open sheet.

For FlashList, the fixture was set to part 3 before opening the public reader.
The reader showed the Choir row as the current part (`PAUSED HERE`) on entry.
Its `reading-list` started at `scrollTop = 351` with 1139px of content in a
788px viewport; a user-style `PageDown` advanced it to 424.5px. There were no
browser console warnings or errors in the final run.

## Remaining limits

This checks Expo web only. Native iOS form-sheet detents and swipe-to-dismiss,
physical-device rendering, and a live Rails/ActionCable service remain outside
this fixture-based evidence.

## Repeat

From the repository root, start the fixture and then Expo web:

```sh
node apps/mobile/qa/design-system/mock-reader-server.cjs
EXPO_PUBLIC_API_URL=http://127.0.0.1:8100 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable \
npm run web --prefix apps/mobile -- --port 8095
```

Use the synthetic account above, then test the service controls and public
reader at the three table widths. Stop both local processes after the run.
