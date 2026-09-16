# Native SessionReader design fixture

This is a bounded local sample API for manual native and Expo web QA of the
reader and service controls. It serves numeric session `9001`, three Lord’s Prayer part
occurrences, a missing Russian translation on part 2, long Grabar on part 3,
and one sample explanation. The title and church name identify the content as
sample data.

From the repository root, start it with:

```sh
node apps/mobile/qa/design-system/mock-reader-server.cjs
```

In the Expo native process, set the development endpoints to:

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:8100 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable \
npm run mobile
```

Then open the numeric deep link `/sessions/9001/parts` (or use the app’s
manual session entry) and confirm discovery, English/Russian/Grabar rendering,
the missing-Russian state, long-text scrolling, explanation sheet, and live
connection state. On an Android emulator, use `adb reverse tcp:8100 tcp:8100`
first if loopback does not resolve to the host.

Public-reader endpoints use `GET` and `OPTIONS` for `/services.json`,
`/s/9001.json`, `/s/9001/parts.json`, part detail paths, and current or numeric
explanation paths. For local control QA only, the fixture also accepts the
synthetic credentials `operator@example.test` / `fixture-only-password`. That
session can list `/s.json` and mutate only the in-memory session through the
same sign-in, next, previous, set-part, and status routes as the app. It binds
only to `127.0.0.1`, never contacts a live backend, and resets every time the
process starts. CORS is intentionally wildcard for this local fixture. If the
already-installed `ws` package can be resolved, `/cable`
provides the minimal ActionCable welcome, `SessionChannel` subscription
confirmation, and rejection frames; otherwise HTTP QA still works and live
verification is unavailable.

Fixture checks on 2026-09-12: Node syntax and whitespace checks passed. Local
HTTP reads returned 200 for discovery, session, parts and current explanations.
The local cable sent welcome, confirmed the numeric session subscription and
sent a ping. This verifies the sample server only, not the native app or a live
Rails service. The fixture accepts either the installed ws 7 `Server` API or
ws 8 `WebSocketServer` API without adding a dependency.

Native iOS review on 2026-09-12 used an iPhone 17 Pro / iOS 26.5 development
client, Metro port 8101 and this sample API on 8100. The explanation belongs to
current occurrence 99001. Screenshots are under `evidence/`; exact checks,
corrections and remaining platform limits are recorded in
`docs/design-system/mobile-application-trial.md` at the repository root.
These captures are provisional review evidence, not fixed visual baselines.
