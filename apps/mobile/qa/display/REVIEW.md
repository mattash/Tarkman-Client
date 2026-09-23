# apps/web session-display review fixture

This directory contains a synthetic, loopback-only backend/control page used to review the Vite client in
`apps/web`. It does not connect to a real account or church service. Do not use the Expo web application for
Tarkman-Client issue #156 or PR #171 verification.

## Start the target application

From the repository root:

```sh
npm ci --prefix apps/web
NODE_PATH="$PWD/apps/web/node_modules" node apps/mobile/qa/display/server.cjs
```

In a second terminal:

```sh
VITE_API_URL=http://127.0.0.1:8101 \
VITE_ACTIONCABLE_URL=ws://127.0.0.1:8101/cable \
npm run dev --prefix apps/web -- --host 127.0.0.1 --port 3000
```

Open the fixture controls at `http://127.0.0.1:8101`. Its links target
`http://127.0.0.1:3000` by default. The primary routes are:

- `http://127.0.0.1:3000/sessions/9001/display?mode=parallel&lang1=grabar&lang2=en`
- `http://127.0.0.1:3000/sessions/9001/display?mode=single&lang1=en`
- `http://127.0.0.1:3000/sessions/9001/parts`

## Scenario discipline

Reset and run **one recovery scenario at a time**. Wait for initial metadata, manifest, state recovery, scrolling,
and explanation requests to settle before clearing the network log and starting the next scenario. Do not batch
`gap`, `malformed`, `context_mismatch`, and `unknown_occurrence` publications within a few seconds; doing so
only tests recovery coalescing and makes per-scenario request evidence invalid.

Use `POST /qa/reset` before each scenario and `GET /qa/log` afterward. The complete publication, fallback,
command, and ordered-log contract is documented in `docs/performance/web-session-state-qa.md`.

## Browser control UI

The fixture ignores Authorization values, but the apps/web `AuthProvider` requires local state before it renders
operator controls. On the **loopback apps/web origin** (`http://127.0.0.1:3000`), run this in DevTools and reload:

```js
localStorage.setItem('token', 'local-fixture-only')
localStorage.setItem('user', JSON.stringify({
  id: 7,
  email: 'fixture@example.test',
  name: 'Fixture Operator',
  roles: ['admin']
}))
location.assign('/sessions/9001/parts')
```

These values are synthetic and accepted only because the local fixture does not authenticate requests. Never
use or request production credentials. Use the real status and navigation controls on `/sessions/9001/parts`
to verify accepted acknowledgments and refused/409 behavior, then inspect `/qa/log` for one command attempt and
ordered metadata-before-parts reconciliation.

## Scroll evidence

The apps/web live display uses `smoothScrollToPart`, which calls `window.scrollTo` and schedules long-reading
movement through `requestAnimationFrame`; it does **not** call `scrollIntoView`. Instrument `window.scrollTo`
and RAF before publishing a duplicate or long reading. Duplicate publications must not restart the RAF chain or
add another snap-scroll call.

## Boundaries

The fixture server is hard-bound to `127.0.0.1`; credentialed CORS is limited to the documented loopback Vite
origins. It contains only synthetic liturgy text and IDs. No production write, deployment, backend setting,
mobile runtime, Expo configuration, or authentication bypass is part of this review flow.
