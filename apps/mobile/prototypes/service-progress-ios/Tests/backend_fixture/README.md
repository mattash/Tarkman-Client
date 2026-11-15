# Opt-in disposable Rails evidence fixture (#277)

This is a **real isolated Rails/PostgreSQL HTTP backend**, not a reimplementation of its routes or fencing. It pins [backend source](https://github.com/mattash/Tarkman/tree/46481161509155d04e3fcf60ce7928ea19f9614b), reuses `DevelopmentBootstrap`, `ApnsProvider` and `ApnsCurlHttp2`, and injects synthetic auth plus a synthetic HTTP2 subprocess. **No APNs network, signing, provisioning, phone/settings changes, production DB/services or automatic scheduler.** Default-off commands do not inspect resources or launch processes.

The HTTP origin is explicitly loopback development transport, **not trusted HTTPS acceptance**. It is for the reviewed Debug Mac/owned-Simulator client seam only. System TLS trust, physical delivery/display, persistent native Keychain recovery and production authorization remain separate gates. Never disable TLS verification or install trust/certificates for this fixture.

## Files and guards

- [runner.py](./runner.py): explicit prepare/adopt/verify, foreground PostgreSQL, checked dedicated DB creation, schema/server and immutable existing-spec execution. Backend processes receive an allowlisted environment, not inherited app/provider/database secrets.
- [server.rb](./server.rb): verifies actual DB/data-directory/socket/port and `listen_addresses=''` before schema/data work; synthetic session42; strict public-reader/registration route scope; real bounded one-shot bootstrap.
- [probe.py](./probe.py): actual socket HTTP matrix with fresh synthetic token/capability per scenario, redacted correlation aliases and exact fenced-receipt checks. No capability/token/request-body evidence. Failed runs attempt bounded fenced cleanup; an unsuccessful cleanup remains unresolved, not a pass.
- [specs.rb](./specs.rb): existing backend specs in a separate explicit `_test` database; no test/runtime source rewrites.
- [test_guards.py](./test_guards.py): no network, Rails boot, DB connections or servers; default-off, private-root/manifest/source digest, DB-binding/environment/port/bounds guards, and execution of the actual standalone Ruby route-expression fragment against allowed/forbidden routes.

Prerequisites: Python with tar extraction `filter='data'` support, macOS Ruby **3.3.13** at `/opt/homebrew/opt/ruby@3.3/bin/ruby`, PostgreSQL16 tools under `/opt/homebrew/bin`, compiler/libyaml/libpq for native gems, and `gh`. No global Ruby/gem/config changes are made. GitHub operations use `gh` only. Bundler2.5.9 and gems install only into the new root; Mac platform changes only its disposable lockfile. The public archive SHA256 is pinned too; packaging/hash changes fail closed for review, not silently accepted.

## Source-only checks (safe default)

From this directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 test_guards.py -v
ruby -c server.rb
ruby -c specs.rb
python3 runner.py serve --root /tmp/sp277-not-created
# {"status":"disabled"}; no filesystem/process/network actions
```

## Explicit fresh setup — downloads/builds only when requested

Choose a **nonexistent** dedicated root (do not reuse an ordinary checkout):

```sh
ROOT="/tmp/sp277-$(uuidgen)"
python3 runner.py prepare --enabled --root "$ROOT" --database sp277_native \
  --pg-port 55477 --http-port 18777 --download --install-dependencies --init-cluster
```

This creates mode0700 root/manifest and private `src/home/tmp/gems/bundle/socket/evidence` directories, downloads the immutable public archive, installs scoped dependencies and initializes a fresh socket-only cluster. It does not start PostgreSQL/server, connect to a default database, copy `.env`, call `bin/setup`, seed production material or start workers. A failed partial setup is retained for diagnosis; do not silently reuse/delete it or change the pin. Do not run dependency commands automatically from app/test builds.

For an **already reviewed disposable cache only**, explicit `adopt --enabled --root ...` validates the private root, pinned archive and critical source bytes before writing its manifest. This is not a general existing-checkout/resource discovery command.

## Parent-owned foreground jobs

Start each long-running command in the **root/parent session's managed job**, not a delegated child that may finish. The harness terminates a child's jobs when it becomes inactive. Record job IDs. Never use `brew services`, launch agents, daemonization, another scheduler or an untracked terminal.

1. Foreground PostgreSQL, socket only, no TCP listener:

```sh
python3 runner.py postgres --enabled --root "$ROOT" --database sp277_native \
  --pg-port 55477 --http-port 18777
```

2. Once its ready event arrives, create the dedicated DB. This checks the running server's actual data directory/socket/port/listen-addresses via **only the owned socket** first; `createdb` fails rather than reusing an existing DB:

```sh
python3 runner.py create-db --enabled --root "$ROOT" --database sp277_native \
  --pg-port 55477 --http-port 18777
```

3. Foreground HTTP server (another parent managed job):

```sh
python3 runner.py serve --enabled --root "$ROOT" --database sp277_native \
  --pg-port 55477 --http-port 18777 --ttl 1800 --max-reads 1000
```

The verified empty DB receives schema+migrations and synthetic user/liturgy/three occurrences/session42. No real mail: synthetic user skips confirmation notifications. Existing unresolved registrations reject a new process/key; no transparent lost-key resume. Only the process owns its newly generated encryption key; it is never printed, persisted or passed in argv/config files. The key is used by the existing registration API and passed as raw32bytes to the scoped bootstrap. A runtime lock prevents two runner instances for one DB. The selected fixture slot is explicitly `America/Los_Angeles`: seed42's civil date is the actual current date in that zone, not UTC `Date.current`. On a reviewed restart with zero unresolved registrations, only the known synthetic user/liturgy/session42 may have its date aligned; normal `update!` earns a real source revision and logs `synthetic_today_binding`. No clock or occurrence progress is fabricated, and there is no automatic midnight scheduler.

Ready origin: `http://127.0.0.1:18777`. Bare HTTPS logical fixture identity must remain distinct from this physical transport. Hard bounds:1–1800seconds, <=1000 public reads, <=100 registration mutations, <=20 distinct registration IDs including retained tombstones. Public scope is session42 state/detail/parts and its actual part IDs, plus exactly `GET /services.json?tz=America%2FLos_Angeles` for the app's real Today navigation; no login/admin/control routes. Listing permits only that one timezone query (no duplicates/extra keys) and verifies the DB still contains only session42 before passing through the unchanged Rails public listing. It shares the public-read bound. This route normally filters Session.date by the caller's local Today; a UTC-seeded date can honestly produce an empty list after UTC midnight. The real controller may enqueue its existing synthetic view-accounting job; no worker/scheduler is started. Registration PUT/DELETE/fencedPOST are the existing API, confined to session42. Request body <=4096bytes, mutation query empty, public query <=1024bytes. The PostgreSQL socket host/port are URL-encoded, including special characters in parent directory names; no caller path can add URL host/query/fragment parameters. Current HTTP Date is supplied at the transport wrapper; no-store comes from Rails. This does not manufacture provider source-validation freshness.

First successful actual registration PUT constructs one existing single-use bootstrap for that session/registration, `rounds:1`, sandbox topic `app.tarkman.progressprototype.push-type.liveactivity`, synthetic auth and existing concrete HTTP2 adapter with a synthetic subprocess. The normal factory remains FakeProvider with its original `org.tarkman.progress.experiment...` topic. No real curl/APNs request is executed. Provider status200 here is **synthetic**, never device receipt/display. Run completion counts are not acceptance receipts. No heartbeat/drain/scheduler is installed. Locks serialize this small fixture; it is not a production throughput design.

## HTTP contract probe and existing specs

Run probes on a separate dedicated DB/run from fixed-token scenarios, or use fresh synthetic tokens per follow. Backend deliberately retains token digests after revoke; new UUID/generation alone cannot reclaim an old token. Never prune tombstones to make a test pass.

```sh
python3 probe.py --enabled --origin http://127.0.0.1:18777 \
  --output "$ROOT/evidence/http-probe-new.json"
```

The bounded matrix checks coherent active/revision public reads with Date/no Age/no-store; PUT/idempotent200; wrong-capabilityDELETE403; DELETE204; PUT-after-delete409; exact matching fenced receipts for existing and never-created identities; latePUT409; idempotent recovery. A possibly committing first PUT is staged in memory before transport; failures attempt fenced cleanup. If transport/receipt cleanup fails, retain the dedicated DB and report unresolved state; this memory-only tool is not durable crash recovery. Do not reuse its evidence path. The actual client/native integration has separate lifecycle/evidence gates and must not be replaced by this probe.

Create a separate `_test` DB over the owned socket, then:

```sh
python3 runner.py create-db --enabled --root "$ROOT" --database sp277_fixture_test --pg-port 55477
python3 runner.py test --enabled --root "$ROOT" --database sp277_fixture_test --pg-port 55477
python3 runner.py test --enabled --root "$ROOT" --database sp277_fixture_test --pg-port 55477 --negative-control
```

The ordinary command executes existing service-progress and registration request specs. The negative command **must fail both** existing revocation contention examples, with `contender completed without observed registration-fence contention`, because only the test's registration advisory-lock mutation is enabled. Other PostgreSQL locks remain real. Preserve all failures/seeds, including intermittent failures; do not replace original evidence with a green rerun. No negative-control mutation is used in server runtime.

## Evidence and stop/cleanup

Record exact client/backend SHA, source/manifest digest, build mode/IDs, dedicated root/DB/socket/ports, server TTL/bounds, selected session42/revision, consent action and follow aliases. Allowlisted events record method/route class/status, counts, source/provider outcomes when observable, exact-receipt booleans and timestamps. Never save capability/token/auth/key values, request bodies, arbitrary environment/instance-variable dumps or claim unobservable app receipt/display time.

Before stopping: locally end each actual test Activity; require exact capability-owned fenced POST receipt for each possibly attempted registration before erasing its journal. Generic404/timeout/elapsed lease is not proof. Check only the dedicated DB for aggregate unrevoked/token-ciphertext/prepared counts; do not dump credential columns. Retain unresolved recovery as unresolved.

Stop/collect the **owned server job first**, then stop PostgreSQL through the verified root (`pg_ctl -D "$ROOT/pg" -m fast stop`) and collect its foreground job. Verify only the owned HTTP listener/socket are gone. A signal-forwarding wrapper and hard TTL reap the server; no automatic restart/renewal. Copy redacted evidence before any deletion. No recursive-delete command is supplied: resolve and inspect the exact manifest-owned root before manually removing it; never delete a computed/unverified path or global gems/services. Retaining the root for review is valid and must be disclosed. Reference/process cleanup is not cryptographic-memory or storage erasure.

Future trusted HTTPS requires an explicitly owned backend/reader host, DNS/routing to this dedicated namespace, CA-valid system-trusted certificate/SAN/expiry and redirect checks. Actual Team/Key IDs, profiles, entitlements, physical device authorization and APNs remain **unverified/held**, not presumed missing. This runner asks for no operator secrets and cannot authorize production activation.
