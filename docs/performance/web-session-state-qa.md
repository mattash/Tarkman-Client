# Web revisioned session-state QA

Issue: Tarkman-Client #156
Date: 2026-09-23
Source branch: `openclaw/16fa4a69-6bd0-4e96-8ffd-9d9729e09b79`
Application SHA: `a49bb788f962e3084a56f0fe86303dec70a02c40`

## Automated proof

- `docs/validation-web-session-state-tests.log` — complete web unit suite.
- `docs/validation-web-session-state-build.log` — TypeScript and production Vite build.
- `docs/validation-web-session-state-typecheck.log` — standalone TypeScript check.
- `docs/validation-web-session-state-integration.log` — integration attempt; live explanation requests fail because test credentials/API configuration are absent and `VITE_API_URL` is stubbed to `example.test`. Session/part integration cases are skipped by their existing credential guards.
- `docs/validation-web-session-state-audit.json` — production-dependency audit baseline; no dependency changes are included in this issue.

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

Open the fixture controls at `http://127.0.0.1:8101` and these display routes in separate tabs:

- Parallel: `http://127.0.0.1:3000/sessions/9001/display?mode=parallel&lang1=grabar&lang2=en`
- Single: `http://127.0.0.1:3000/sessions/9001/display?mode=single&lang1=en`
- Pages only: `http://127.0.0.1:3000/sessions/9001/display?mode=single&status_view=pages_only`
- Posture only: `http://127.0.0.1:3000/sessions/9001/display?mode=single&status_view=posture_only`

Use browser DevTools Network with **Preserve log** enabled and filter successively by `state.json`, `parts.json`, and `/s/9001.json`.

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

Rendered QA against `b7f064e797c4db9c4ded7498f9745251a31a21b1` isolated a browser-only shared
ActionCable lifecycle race: reconnect confirmation and its first contiguous publication can be React-batched.
The publication effect establishes canonical state, then the connection effect previously issued a redundant
`state.json` recovery. Application commit `a49bb788f962e3084a56f0fe86303dec70a02c40`
lets that same-batch contiguous publication satisfy reconnect while preserving recovery when reconnect has no
publication, or when its publication has a gap, context mismatch, or unknown cursor. Fresh independent browser
evidence is required against the corrected head; this document does not claim that rerun complete.
