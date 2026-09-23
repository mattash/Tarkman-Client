# Web revisioned session-state QA

Issue: Tarkman-Client #156
Date: 2026-09-23
Source branch: `openclaw/16fa4a69-6bd0-4e96-8ffd-9d9729e09b79`
Application SHA: `d49ebe63d4499802ba244ddd5efbdef224a28712`
Fixture capability SHA: `d6f9e2a0742d640394a101a7cf874343d7ce92b2`

## Automated proof

- `docs/validation-web-session-state-tests.log` — complete web unit suite.
- `docs/validation-web-session-state-build.log` — TypeScript and production Vite build.
- `docs/validation-web-session-state-typecheck.log` — standalone TypeScript check.
- `docs/validation-web-session-state-integration.log` — integration attempt; live explanation requests fail because test credentials/API configuration are absent and `VITE_API_URL` is stubbed to `example.test`. Session/part integration cases are skipped by their existing credential guards.
- `docs/validation-web-session-state-audit.json` — production-dependency audit baseline; no dependency changes are included in this issue.
- `docs/validation-display-fixture.log` — Node contract tests for the loopback-only QA controls and ordered log.
- `docs/validation-mobile-fixture-lint.log` — mobile-tree lint proof for fixture UI/runbook changes.

## Reproducible browser fixture

The existing synthetic fixture is loopback-only and performs no production writes. It reflects only the
credentialed loopback origins used below (`127.0.0.1:3000` or `localhost:3000`) instead of using wildcard
CORS, so the application's credentialed API requests are accepted by browsers.

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

Open the fixture controls at `http://127.0.0.1:8101`. For request-count evidence, keep exactly **one** display
route open at a time; multiple display tabs each own a 30-second safety poll and make an aggregate network log
ambiguous. Review these routes sequentially:

- Parallel: `http://127.0.0.1:3000/sessions/9001/display?mode=parallel&lang1=grabar&lang2=en`
- Single: `http://127.0.0.1:3000/sessions/9001/display?mode=single&lang1=en`
- Pages only: `http://127.0.0.1:3000/sessions/9001/display?mode=single&status_view=pages_only`
- Posture only: `http://127.0.0.1:3000/sessions/9001/display?mode=single&status_view=posture_only`

Use browser DevTools Network with **Preserve log** enabled and filter successively by `state.json`, `parts.json`, and `/s/9001.json`.

### Scenario isolation

Reset and run **one recovery scenario at a time**. Wait for initial load or the preceding recovery to settle,
then clear the target tab's Network log before publishing the next scenario. Do not send gap, malformed,
context-mismatch, and unknown-occurrence publications back-to-back within a few seconds: that tests intentional
recovery coalescing, not the bounded request behavior of each individual scenario.

### Browser control UI

To render the real apps/web navigation and status controls, seed synthetic auth on the loopback Vite origin and
reload the parts route. The fixture ignores the Authorization value; these are not production credentials:

```js
localStorage.setItem('token', 'local-fixture-only')
localStorage.setItem('user', JSON.stringify({
  id: 7, email: 'fixture@example.test', name: 'Fixture Operator', roles: ['admin']
}))
location.assign('/sessions/9001/parts')
```

Use the actual status/navigation controls there for accepted and refused/409 proof. After a refusal, verify one
command attempt and ordered `session` then `parts` events in `/qa/log`; never use a production account or token.

### Scroll observability

The apps/web live reader's `smoothScrollToPart` uses `window.scrollTo` for the initial snap and a
`requestAnimationFrame` chain for long-reading movement. It does **not** use `scrollIntoView`. Monkeypatch or
count `window.scrollTo`, `requestAnimationFrame`, and `cancelAnimationFrame` before the duplicate/long-reading
scenario. A duplicate must not add a second snap call or restart the existing RAF chain.

## Namespaced QA control contract

All advanced controls are synthetic, bind only through the loopback fixture, and live under `/qa/*`.
Reset before each scenario and inspect the monotonic event log afterward:

```sh
curl -sS -X POST http://127.0.0.1:8101/qa/reset -H 'Content-Type: application/json' -d '{}'
curl -sS http://127.0.0.1:8101/qa/log
```

The fixture control page exposes buttons for the standard scenarios. For an exact raw envelope, run from a
terminal or the already-open display tab's DevTools console:

```js
await fetch('http://127.0.0.1:8101/qa/publications', {
  method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenario: 'raw', envelope: {
    id: '9001', session: '9001', revision: 42,
    content_context: 'display-review-v1', cursor: null,
    session_status: 'active', status_message: null, posture: null, date: '2026-09-19'
  } })
}).then(response => response.json())
```

Publication scenarios return the exact `emitted` envelope and resulting revision:

```sh
for scenario in contiguous duplicate gap malformed context_mismatch unknown_occurrence; do
  curl -sS -X POST http://127.0.0.1:8101/qa/publications \
    -H 'Content-Type: application/json' -d "{\"scenario\":\"$scenario\"}"
done
```

- `contiguous` — revision +1, current context/cursor, string ActionCable session ID.
- `duplicate` — repeats the canonical revision exactly.
- `gap` — advances canonical state by two revisions before broadcasting.
- `malformed` — omits context/status fields so malformed-publication recovery can be observed.
- `context_mismatch` — advances revision and changes the canonical content context.
- `unknown_occurrence` — broadcasts `liturgy_part_id: 9999`; the subsequently fetched manifest contains that
  exact occurrence, allowing deterministic recovery.
- `raw` — broadcasts the provided envelope without alteration.

Configure modern/reconciliation/legacy state behavior and command acceptance independently:

```sh
# Reconciliation state payload (overrides are merged into the canonical state response)
curl -sS -X POST http://127.0.0.1:8101/qa/config -H 'Content-Type: application/json' \
  -d '{"stateMode":"reconciliation","reconciliation":{"revision":77,"content_context":"qa-reconcile","cursor":null}}'

# Legacy endpoint fallback; use legacy405 instead to test 405
curl -sS -X POST http://127.0.0.1:8101/qa/config -H 'Content-Type: application/json' \
  -d '{"stateMode":"legacy404"}'

# Refuse the next control command with 409; switch back with commandMode=accept
curl -sS -X POST http://127.0.0.1:8101/qa/config -H 'Content-Type: application/json' \
  -d '{"commandMode":"refuse409"}'
```

The fixture implements the application's exact command routes:

- `POST /s/9001/next.json`
- `POST /s/9001/prev.json`
- `POST /s/9001/set_part.json`
- `PATCH /s/9001/update_status.json`

Each attempt is logged once. Refused commands emit no publication. After a 409, `/qa/log` must show `command`,
then `session`, then `parts` when the control UI performs canonical recovery; no second `command` may appear.
Accepted commands log `command` then one `publication`. State, parts, full-session, publication, command, and
WebSocket connect/disconnect/subscribe events all carry monotonic `sequence` values and ISO timestamps.

Run the fixture contract tests directly:

```sh
NODE_PATH="$PWD/apps/web/node_modules" node --test apps/mobile/qa/display/server.test.cjs
```

## Scenarios and expected evidence

1. **Initial load:** one deliberate manifest load is expected. The highlighted row and scroll target use `data-reading-key="lp:9902"`.
2. **Normal advance:** choose another reading in the fixture. The display advances from the ActionCable publication. There must be no routine `state.json`, `parts.json`, or full-session verification request for the matching contiguous revision.
3. **Status-only change:** choose paused, gospel, epistle, welcome, or custom. The overlay/pages/posture state changes. The `parts.json` request count must remain unchanged.
4. **Duplicate publication / long reading:** select the long reading, then submit the same fixture state again. The highlighted occurrence stays stable and continuous scrolling must not restart or jump to the top.
5. **Deliberately missed event:** close the display's socket in DevTools, advance the fixture, then restore network/focus the tab. A lightweight `state.json` recovery must correct the reading without a full manifest download when `content_context` is unchanged.
6. **Disconnect/reconnect:** use the fixture's connection-loss control. A small top-right `Disconnected — retrying` or `Reconnecting…` badge is visible and does not cover the reading. It disappears after recovery.
7. **Repeated identity:** readings with repeated reusable `part_id` values must still highlight and scroll to the exact `liturgy_part_id` occurrence.
8. **Safety poll:** leave the tab idle for at least 30 seconds. Expect a small `state.json` request, not one full `/s/:id.json` request every second.
9. **Layouts and boundaries:** repeat normal advance in single and parallel modes and verify first/last controller boundaries remain disabled appropriately.
10. **Recovery matrix:** reset between scenarios, issue each `/qa/publications` scenario, and compare display state,
    request counts, and `/qa/log` ordering with the contracts above.
11. **Accepted/refused controls:** drive the browser control UI once in each command mode. Confirm accepted acks
    avoid canonical/manifest refetch and refused 409 commands are not replayed while metadata precedes parts.
12. **Legacy fallback:** set `legacy404`, then `legacy405`; each must fall back to full session/parts without
    breaking the display. Restore `stateMode: normal` afterward.

Instrumentation of the exact one-tab loopback route proved the immediate state request was the documented
malformed-publication fallback: the fixture publishes string-valued ActionCable `id`/`session` fields (for
example `"9001"`), while the parser previously accepted only numeric IDs. Application commit
`847e9b74b9cbfd4de3a182673a7cd1146c2108c3` safely normalizes positive integer strings for the session
identifier only and retains strict numeric revision/cursor validation.

Local browser verification after the fix covered an ordinary publication and another publication 101 ms after a
completed safety GET. Both produced the expected explanation refresh and zero immediate state, parts, or full
session reads. Fresh independent browser evidence is still required against the pushed head; this document does
not claim final acceptance.
