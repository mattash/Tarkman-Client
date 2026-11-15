# Isolated HTTPS routing preparation (#277): no public activation

This packet prepares **one explicit HTTPS origin** for both the existing read-only
reader and the disposable backend. The ordinary application, native configuration,
UI, production routing and provider factory remain unchanged. No tunnel, public
endpoint, DNS, certificate, trust-store, account/config discovery, signing or device
operation is performed. Syntax/configuration and loopback HTTP are **not HTTPS or
system-trust evidence**. Hostnames below ending `.invalid` are dry-run/local-test
identities only; they cannot be published or claimed trusted.

Read the [device guide](<service-progress-device-build.md>),
[checkpoint](<service-progress-feasibility-checkpoint.md>) and
[disposable backend guide](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/README.md>).

## Source interfaces

From `apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture`:

- [routing_plan.py](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/routing_plan.py>): default-off,
  `--enabled --dry-run` required; no filesystem/resource reads or subprocess/network
  actions. Emits explicit origin/namespace/database/session/part-ID/source binding,
  reader URL, native origin inputs, clean export recipe, and **future** cloudflared
  configuration text/command. Never invokes cloudflared or writes credentials.
- [routing_quick.py](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/routing_quick.py>): default-off,
  dry-run-only account-free Quick Tunnel bootstrap/assigned-origin preparation.
  No tunnel execution, account credentials or owned DNS domain requirement.
- [routing_export.py](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/routing_export.py>): default-off,
  `--enabled --execute-export --root ... --toolchain-path ...`. Builds the **unchanged
  existing Expo web application** to a new root-owned output directory, with no
  inherited environment or dotenv. Requires the exact client HEAD and an unchanged
  tracked UI/config/shared-reader graph. Checks both selected endpoints occur in the
  compiled production `readerConfig` function. Records exact argv/environment,
  source and export-tree hashes. No alternative reader HTML or UI redesign.
- [routing_gateway.py](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/routing_gateway.py>): default-off,
  `--enabled --serve-owned-loopback --root ... --fixture-root ...`. Reads only the
  explicit private routing packet/export and the explicit fixture's **nonsecret**
  source-runner runtime file/lock. Requires matching database, backend SHA, HTTP
  port and an already-held runtime lock before binding its exact `127.0.0.1` port.
  No port reuse, daemon, restart, tunnel, TLS bypass or arbitrary proxy target.
  TTL 1–300 seconds, requests 1–1000, mutations 1–100, identities <=20; defaults
  60/100/20. SIGINT/TERM, TTL or request cap close the listener. A main-thread POSIX
  timer enforces absolute run and <=3-second request deadlines, not merely per-recv
  timeouts: it interrupts exactly tracked owned accepted/upstream sockets using
  shutdown, including slow-drip headers/body/upstream, then closes them normally.
- [routing_probe.py](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/routing_probe.py>): default-off,
  `--enabled --root ... --fixture-root ... --output ...`. Real gateway-to-backend
  HTTP registration/revocation matrix, fresh synthetic identity/token/capability,
  stage-before-PUT, exact fenced-receipt cleanup and redacted result only.
- [routing_test.py](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/routing_test.py>): offline
  guards, actual bounded gateway CLI, owned ephemeral socket fixtures, cleanup and
  fixed-error/output-redaction tests. Synthetic unit export bytes are **not a UI**
  and are not substituted for the separate actual Expo export.

The packet's namespace is a run label, not an HTTP query or a claim of DB ownership.
Actual resource scope comes from the existing runner's verified dedicated database,
its nonsecret runtime binding/held lock and the exact selected backend loopback
origin. The gateway does not independently query PostgreSQL or discover resources.
A same-UID adversary rewriting reviewed files/processes is outside this small fixture.

## Exact route/build bindings

Choose a **known explicit operator-authorized origin later**: either an authorized
owned-domain origin or the actual assigned Quick Tunnel origin below. There is no
inferred/default owned hostname and no need to acquire named-tunnel credentials
merely to prepare the account-free alternative. Set both `SERVICE_PROGRESS_DEVELOPMENT_ORIGIN` and
`SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN` to that **same** origin when evaluating
future isolated native generation. This packet does not run native generation or
sign anything. Existing native reader links then target
`https://<explicit-owned-host>/sessions/42/parts`, **never production session42**.

The web build sets `EXPO_PUBLIC_API_URL` to that same exact origin and
`EXPO_PUBLIC_ACTIONCABLE_URL` to its `wss://` equivalent plus `/cable`, using
`EXPO_NO_DOTENV=1`, a new private HOME, and an allowlisted environment. No inherited
API/provider variables, login state, telemetry DSN or production fallback. The
ordinary app config flag is `0` for this web-only export; no native graph is changed.
The existing public [reader route](<../apps/mobile/app/sessions/[id]/parts.tsx>) and
[config binding](<../apps/mobile/features/live/config.ts>) are reused unchanged.
The Expo export includes ordinary application code/assets; this is not an assertion
that unused route code is stripped. Network entrypoints remain fenced below.

- Only `GET /sessions/42/parts` gets the existing export's index fallback. Other
  sessions, `/`, login/admin/control and arbitrary SPA fallback routes are denied.
  Static GETs must match exact recorded export files under `/_expo/static/` or
  `/assets/` (optional exact favicon); no source maps/metadata/extra HTML.
- Public API: exact `GET /s/42.json`, `/s/42/state.json`, `/s/42/parts.json`,
  and explicitly supplied actual fixture part IDs, no query; plus exactly
  `/services.json?tz=America%2FLos_Angeles`. The current unchanged backend creates
  **42 only**; the CLI requires that ID explicitly and rejects others. It does not
  invent dynamic sessions. A future fixture ID change requires coordinated source.
- Mutation routes: only UUID registration PUT/DELETE and UUID `/revoke` POST,
  no query, <=4096 bytes, exact native JSON keys and session42. DELETE is bodyless
  with no Content-Length/Transfer-Encoding upstream. One bounded printable
  `X-Service-Activity-Secret` capability header is preserved **only** on those
  mutations; it is rejected on reads/static and never printed. The real backend,
  not this proxy, decides capability ownership and authoritative revocation fences.
- Reject account Authorization/Proxy-Authorization/Cookie, transfer encoding,
  forwarded-host/method-override/rewrite/Access-JWT headers, duplicate headers/JSON
  keys, traversal/encoded paths and redirects. Benign tunnel IP/protocol metadata
  is ignored and never forwarded. Every upstream Set-Cookie is stripped (Rails
  public middleware can mint one without incoming auth); no cookie value is logged
  or retained as client state. Responses lacking an explicit no-store directive
  fail closed. No TLS termination or redirect-following exists in this process.
- `/cable` and explanations are intentionally unavailable in the fixture. Existing
  reader polling/unavailable-explanation behavior remains honest, not healthy
  real-time/display proof. Client-side reader navigation does not expand backend
  authority; no authenticated/control API is exposed.

## Reproduce preparation without public network

All commands below are from the fixture directory. A pure plan creates nothing:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 routing_plan.py --enabled --dry-run \
  --origin https://fixture.example.invalid \
  --backend http://127.0.0.1:18779 --gateway http://127.0.0.1:18780 \
  --namespace sp277-routing-gateway --database sp277_routing_gateway \
  --session-id 42 --part-id 1 --part-id 2 --part-id 3 \
  --client-sha 3ed66950d0d325f7931a7bb4647c7cf6fc0edb4e \
  --owned-root /private/tmp/sp277-routing-not-created \
  --tunnel-id 11111111-1111-4111-8111-111111111111
PYTHONDONTWRITEBYTECODE=1 python3 routing_test.py -v
python3 routing_gateway.py
python3 routing_export.py
python3 routing_probe.py
# Last three print disabled; no file/process/network access.
```

For a reviewed **local-only** export/socket experiment, create a new canonical
mode0700 routing root, save that plan's JSON to `routing-manifest.json` mode0600
with `--owned-root` changed to that exact new root, and use the actual source SHA,
fixture DB/ports and known part IDs. Do not reuse a previous export or receipt.
The source-owned executable commands are:

```sh
python3 routing_export.py --enabled --execute-export --root "$ROUTING_ROOT" \
  --toolchain-path /opt/homebrew/bin:/usr/bin:/bin
python3 routing_gateway.py --enabled --serve-owned-loopback \
  --root "$ROUTING_ROOT" --fixture-root "$BACKEND_ROOT" \
  --ttl 120 --max-requests 100 --max-mutations 20
# Run gateway as a parent-managed foreground job; record/collect its job ID.
python3 routing_probe.py --enabled --root "$ROUTING_ROOT" \
  --fixture-root "$BACKEND_ROOT" --output "$ROUTING_ROOT/gateway-probe.json"
```

`BACKEND_ROOT` must be the explicitly reviewed existing source-runner root with
its dedicated synthetic DB/server already running; never discover/adopt arbitrary
resources. Do not start PG/Rails via these routing scripts. The backend guide owns
those procedures. A receipt binds reviewed inputs/bytes, not a signed independent
build attestation; preserve build logs and original failures for review.

## Account-free Quick Tunnel alternative — dry-run only

The [primary Cloudflare documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
states `cloudflared tunnel --url <local-origin>` assigns a temporary random
`trycloudflare.com` URL without an account or domain; anyone with that URL can
access the local service, and the hostname changes on each new tunnel. It has no
uptime guarantee, a 200 in-flight request limit, and no SSE. Do not enable email
login/Access authentication: it adds browser/account cookies and is incompatible
with this native capability-only contract. The strict gateway is still required.

Only installed `cloudflared tunnel --help` was executed, with `env -i` and a new
nonexistent isolated HOME/XDG path. It verifies the recipe's `--config`, `--url`,
`--no-autoupdate`, loopback `--metrics`, disabled `--management-diagnostics`, bounded
log-level and label flags exist. It did **not** read an existing account/config,
create a tunnel, make a public endpoint request or verify a certificate.
The primary docs were fetched read-only; no search result was treated as authority.

```sh
python3 routing_quick.py --enabled --dry-run \
  --root /private/tmp/sp277-quick-not-created \
  --backend http://127.0.0.1:18779 --gateway http://127.0.0.1:18780 \
  --namespace sp277-routing-gateway --database sp277_routing_gateway \
  --session-id 42 --part-id 1 --part-id 2 --part-id 3 \
  --client-sha 3ed66950d0d325f7931a7bb4647c7cf6fc0edb4e
```

This prints **only a future recipe**. No assigned hostname is fabricated. Its
future command uses a newly reviewed root-local explicit empty YAML config `{}`,
new HOME/XDG_CONFIG_HOME/TMPDIR, env allowlist (no inherited TUNNEL_TOKEN, credential,
proxy or login variables), metrics `127.0.0.1:0`, no management diagnostics and no
verbose header tracing. It neither discovers nor copies any existing configuration.
No credentials/login/DNS command, hostname override, TLS bypass or public server is
included. Empty-config/Quick Tunnel live startup remains unexecuted, not proven by
help text. Future bootstrap must be a parent-managed, bounded-duration job, not a
service/restart loop.

Future fail-closed sequence, after separate live-operation release:

1. Create/review that new private root and its exact empty config/home directories.
   Keep the selected loopback gateway **not listening** while the temporary origin
   is assigned: there is no fixture API, static reader or registration to expose.
2. Receive the **actual** assigned URL from the owned tunnel process. Pass it as
   `--assigned-origin "$ACTUAL_ASSIGNED_ORIGIN"` to the same dry-run planner.
   Validation accepts only canonical bare HTTPS with one assigned subdomain of
   `trycloudflare.com`; credentials/ports/path/query/fragment/lookalikes are rejected.
   Validation is syntactic, not an ownership/DNS/TLS trust assertion.
3. Save the returned `routing_manifest_packet` to the new private manifest. Build
   the actual unchanged reader via the existing export command; its API origin,
   WSS placeholder, reader URL and both future native origin inputs bind to that
   **same exact assigned origin and backend namespace**. Verify export receipt and
   ordinary system certificate trust/SAN/expiry before any reader/native/API use.
   The gateway refuses to start with absent/unbound/tampered build/manifest/fixture.
4. Only then start the bounded manifest-bound loopback gateway. Do not set an
   HTTP-Host override to a placeholder; validate real forwarding still presents
   the exact assigned Host, otherwise fail closed. No actual forwarding proof is
   claimed now. Check redirect/Date/no-Age/no-cookie and exact fence contracts.
5. Pin the assigned URL using `--expected-origin "$ACTUAL_ASSIGNED_ORIGIN"` on any
   later plan check. A new URL is rejected, not silently rebound. Stop on any
   origin change/restart: do not continue using an old export/native build or move
   outstanding registration journals to a new origin. Resolve exact old fences
   before erasure; retain unresolved state. Stop/collect the owned tunnel first,
   then gateway/backend jobs, and verify owned listeners are closed.

Named tunnels below remain an alternative, **not an unavoidable credential/DNS
blocker**. Neither alternative is activated by these dry-run tools.

## Future named-tunnel HTTPS gate — NOT executed or released here

The printed cloudflared YAML refers only to a **fresh reviewed owned routing root**:
explicit tunnel UUID, credentials file **inside that root**, one explicit hostname
pointing to the loopback gateway, final `http_status:404`. The printed command uses
`/opt/homebrew/bin/cloudflared --config <exact-new-root>/cloudflared.yml tunnel run
<explicit-uuid>`. Its accompanying environment is **not inherited**: only a fresh
root-local HOME/TMPDIR and minimal PATH, never inherited tunnel tokens/credentials.
No default config, existing account, credential, tunnel or login resource is inspected. The tool's earlier command-v discovery establishes only a
binary path, not authorization/configuration. No credentials file is generated.

Before any future public operation, require separately released operator ownership,
known explicit origin/tunnel bindings, reviewed fresh-root config/credentials, DNS
mapping, real CA-valid certificate SAN/chain/expiry and ordinary device/system-trust
verification with **no bypass**. Check redirect rejection and the exact existing
reader-build/API/backend namespace using public GETs and bounded registration
receipts. No `.invalid` hostname or synthetic UUID is a live recipe. No public
endpoint/trust/resource verification has occurred and no operator prompt is needed
for this source preparation.

## Executed source/HTTP evidence (not HTTPS)

- 24 source/offline/real-loopback tests pass, including actual default-off CLI,
  runtime binding/lock, occupied-port rejection, request-cap listener shutdown,
  namespace/origin/tree tampering, cookie stripping, redirects, credential/method
  metadata rejection, mutation-capability bounds, routes, bodies and redaction.
  The initial test run had two macOS temporary-path canonicalization errors;
  resolving owned test roots fixed the tests, without relaxing canonical guards.
  Parent review found the first per-recv timeout was not an absolute deadline.
  Actual CLI partial-header/body and drip-upstream tests now stop at TTL1; an
  independent request-deadline case stops near3 seconds despite runTTL10, and
  SIGTERM interrupts partial input. All prove exit0, no stderr and closed listener.
  The first asynchronous-exception prototype exposed a SIGTERM socket-finalizer
  race (and a test initially treated reset as nonclosure); the final implementation
  uses signal-driven shutdown of tracked owned sockets, never arbitrary exceptions
  through Python socket constructors. Those failed iterations are not TLS evidence.
- The actual unchanged Expo export builds successfully: 62 files,
  export-tree SHA256 `2459a2f8dacad8d82b50a7bae17767f0138dfc23c2cdfa8c540e6ccabdb4d25f`,
  client source `3ed66950d0d325f7931a7bb4647c7cf6fc0edb4e`. The exact selected
  HTTPS/WSS placeholders are inlined in its production readerConfig function.
  A headless export-contract check passed all 57 admitted asset paths. This does
  not claim a browser render or actual HTTPS connection to the placeholder.
- A genuine source-runner Rails database `sp277_routing_gateway`, backend port18779,
  routed through the actual gateway CLI18780. **The first probe failed at public
  GET403 before any registration attempt**: the gateway incorrectly required
  Cache-Control equal only `no-store` and rejected Rails' middleware Set-Cookie.
  That failed cohort is retained separately, with no unresolved registration.
  The corrected gateway checks the explicit no-store directive and strips every
  Set-Cookie; it never forwards incoming account authentication/cookies.
- The separate corrected genuine probe passes eight cases: public GET200, PUT200,
  wrong-capability bodyless DELETE403, bodyless DELETE204, exact matching fenced
  POST200, late PUT409, wrong-session403 and login403. A final new-identity genuine
  rerun also passes all eight after preserving exactly one backend Date header and
  rejecting upstream Age/encoding; each case verifies single-Date/no-Age/no-cookie.
  Fresh token/capability remain
  memory-only; this tests **real existing backend ownership/fencing**, not synthetic
  HTTP substitution. The backend's one-shot provider response remains synthetic,
  never APNs/device delivery. Parent owns scoped database aggregate verification.
- That same real gateway serves actual exported reader HTML1553 bytes, CSS7908 bytes
  and genuine public parts1034 bytes with status200/no Set-Cookie; wrong reader,
  login and cable return403. Both owned gateway jobs were stopped/collected and
  port18780 was verified closed. Parent-owned Rails/PostgreSQL were not stopped by
  this routing child. Private export/probe roots are retained for review, not erased.

## Evidence, stop and cleanup

Preserve exact binding/tree/source digests, redacted case aliases/statuses and
exact-fence booleans; never save capability/token/auth/key/header/body dumps.
Stop immediately on binding/trust/isolation/receipt failure. Stage before any PUT;
require exact identity-owned fenced POST receipt before erasing any journal.
The loopback probe is memory-only: process crash can leave unresolved registration;
retain the dedicated DB and recovery evidence, never silently rekey/reset/prune.
After scoped unresolved/ciphertext/prepared counts are checked by the backend owner,
stop/collect the gateway job first, then the owned Rails/PG jobs per backend guide;
verify only those listeners/socket are closed. Retain private export/root artifacts
for review; no deletion command or secure-erasure claim is supplied.

Current evidence distinguishes: actual unchanged Expo export/source inlining and
headless static-route contracts; synthetic owned loopback HTTP/unit/CLI contracts;
and any separately reported genuine Rails probe. None establishes browser-rendered
UI, CA trust, DNS, HTTPS, physical-device delivery/display or production readiness.
