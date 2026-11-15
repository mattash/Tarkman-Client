# Separately gated one-shot provider experiment

This is executable source work, **not authorization for an APNs attempt**. Current verification uses generated ephemeral TEST ES256 material and a synthetic subprocess only. No credential retrieval, APNs network, signing/provisioning, device work, production resources or operator prompt is needed or authorized.

## Scope

`provider_runner.py` reuses the unchanged runner's private-root/manifest/archive/source/PG guards, clean child environment, exact Ruby version and **same per-database runtime lock**. `provider_entrypoint.rb` independently validates owned PG paths before Rails, verifies the actual database/socket/data-directory/port and disabled TCP, requires development mode and the existing synthetic session42 identity, and refuses any unrevoked prior registration. It does not rekey, resume, inspect secret columns or decrypt another process's ciphertext.

The process creates one random 32-byte encryption key **in memory**, exposes it only through process-local `ServiceProgress.encryption_key`/`enabled?` methods, and retains it for registration, source preparation, delivery and fenced cleanup. It is never placed in environment/argv/config/files. These singleton seams exist only in this separate process; immutable backend source, ordinary provider factory and existing fake HTTP fixture are unchanged.

`provider_experiment.rb` sends actual Rack HTTP PUT and fenced POST requests through the existing Rails application/controller/Registrations API, and uses the existing `DevelopmentBootstrap`, `ApnsJwtAuth`, `ApnsProvider` and concrete `ApnsCurlHttp2`. No backend adapter is reimplemented. It fixes sandbox/topic through the existing bootstrap and preserves its source validation and expiry rules. No TCP listener, scheduler, renewal or background service is started. Bootstrap completion means execution only: existing Delivery can swallow permanent/transient provider errors or skip ineligible publication. The wrapper separately records bounded credential-free transport response-code counts, exception count and exact200/empty-body accepted-response count. `execution_completed`, `acceptance_observed` and `cleanup_verified` are independent. Entrypoint acceptance is `synthetic_only`, `provider_response`, partial equivalents, or `not_observed`; the synthetic label never claims real APNs. A zero-publication run, rejection, exception or partial observed acceptance exits nonzero even if bootstrap and fenced cleanup completed. Acceptance counts describe observed responses only, not acceptance for every allowlisted ID. **Neither transport acceptance nor cleanup proves display/device receipt.**

## Explicit input and gates

Default-off invocation does not inspect resources or launch anything:

```sh
python3 provider_runner.py --root /not/inspected --database not_inspected
# {"status": "disabled"}
```

An authorized future **trusted in-memory caller** must supply all four gates/choices: `--enabled --authorize-provider --authorize-transport` and exactly one of `--synthetic-transport` or `--real-transport`. Real transport constructs the actual curl subprocess; it never falls back to synthetic transport. Do not execute `--real-transport` under the current authorization.

The caller passes a private anonymous pipe/Unix socket read descriptor using `--input-fd N` and `pass_fds`, closes the writer after one JSON packet, and independently declares each canonical UUID with `--registration-id UUID`. Values in argv are public binding metadata and descriptor numbers **only**. Neither wrapper nor child reads key paths, environment secrets, Keychain, certificates, devices, profiles or credential inventories. A regular file, TTY, TCP socket, missing EOF, invalid packet or absent token/capability fails closed.

Packet shape (schema only; never persist actual values):

- top-level exactly `signing`, `registrations`;
- `signing`: exactly `team_id`, `key_id`, `signing_key_pem` (in-memory private P-256 PEM; existing ES256 class validates it);
- each registration: exactly `id`, `secret`, `attributes`;
- attributes: exactly existing PUT keys `session_id`, `activity_id`, `generation`, `push_token`, `token_version`, `consent_version`, `lease_seconds`;
- session42, token version1, consent `public-lock-screen-v1`, lease60seconds; all registration IDs must match the independent CLI allowlist exactly. Secret/token are required and never synthesized by the real path.

**Input bridge limitation:** this is a standalone selected-registration FD experiment, not ordinary native-app Follow integration. A future trusted caller must already hold an explicitly selected Activity's real token/capability/identity plus reviewed provider authorization in memory and pass that complete packet. No app UUID/token discovery/export API was added; no automatic first-PUT authorization occurs. Do not claim ordinary app follow/live integration or reuse the existing HTTP server's key/registrations. Supplying this packet is an explicit interface, not a credential-retrieval implementation. The trusted caller must retain its own capability/identity/recovery material until exact fenced acknowledgement, including after a failed child or broken pipe. Child memory is not a durable recovery journal; failure results report only `registration_N` unresolved aliases. Do not erase the caller's recovery state on generic completion/error.

Bounds: packet<=32768bytes, read/EOF<=2seconds, body/response<=4096bytes, <=20 allowlisted IDs, rounds1–4, requests1–20, IDs×rounds<=request maximum, publication deadline1–30seconds, actual existing auth/request deadlines, independent **total** cleanup budget5seconds. The launcher waits deadline+30seconds (Rails boot allowance), then terminates/reaps with at most5seconds grace. An explicitly requested separate schema setup has its own existing runner bound; there is no unbounded service lifetime.

Every possibly committing PUT is staged before dispatch. Cleanup verifies the namespace/key again and requires each actual fenced POST200 receipt to equal all four identity fields plus `revoked:true`. Generic404, DELETE204, lease expiry, timeout and completion counts are never accepted as fencing. Failure remains unresolved; keep the DB for review. Shutdown signals during the experiment enter the same ensure path; SIGKILL/process loss cannot guarantee cleanup and must not be called recovery.

Rails logging is disabled before initialization; runner/entrypoint errors are fixed stage strings, and results contain only statuses/counts/booleans. Input, key/token/capability values, request bodies, JWTs and arbitrary exception messages are never output. Clearing references/strings is not cryptographic erasure.

## Synthetic verification only

The parent must own the verified socket-only PG foreground job and explicitly create a **new** dedicated database. No test starts PostgreSQL or reuses a production DB. `--initialize-synthetic-fixture` is explicit: existing unchanged schema runner executes in a separate process, then a pristine process seeds only a zero-user/zero-session/zero-liturgy schema with the known synthetic identity. It fails on a nonempty seed instead of changing existing data.

`provider_cli_test.rb ROOT [--initialize-synthetic-fixture] [--database NAME] [--scenario accepted|rejected|transport-error|expired-registration]` generates ephemeral ES256/test token/capability entirely in memory, sends them via an anonymous pipe to the **full Python→Ruby→actual Rails entrypoint**, selects only synthetic transport, checks argv and captured stdout/stderr against all generated secrets, and requires PUT200, exactly one synthetic concrete-curl request, exact fence200 and zero unresolved/ciphertext/prepared aggregates. It never prints the packet. Negative scenarios require child exit1 despite `execution_completed:true`, no acceptance, exact fence and zero retained aggregates: rejection uses actual HTTP2 adapter status400/BadDeviceToken; transport-error raises inside its synthetic runner; expired-registration injects a synthetic clock+61seconds so actual Delivery skips the lease-expired registration without transport. This clock is test-only, not fabricated live source evidence. Wrapper `--synthetic-scenario` is forbidden with real transport except its neutral `accepted` default. Requires the pinned Ruby executable; child gem environment is the existing runner's allowlist.

`provider_test.rb ROOT` runs offline contracts under the scoped bundle environment, loading actual immutable Bootstrap/JWT/provider/curl/payload classes with explicitly synthetic Delivery/Rack collaborators. It verifies generated ES256 JWT signature/issuer/key ID, binding/session/topic/sandbox/expiry, default-off gates, input timeout/size/file/badJSON rejection, allowlist/missing-token rejection, exact-fence failure and no-network/argv redaction. This is not full real-DB Delivery evidence; the CLI test supplies that separate coverage.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 provider_test_guards.py -v
/opt/homebrew/opt/ruby@3.3/bin/ruby provider_cli_test.rb /tmp/sp277-3429.jsyOZl
```

For offline Ruby contracts, use `runner.clean_environment(root, database, pg_port)` and execute the pinned Ruby with the scoped bundle, exactly as the existing runner does. No global gem install/configuration is required.

## Retained outcomes

The first same-process fresh schema/provider attempt failed: attempted1, requests0, fenced receipts0; aggregate unresolved/ciphertexts/prepared were all0. No success was inferred from those zero aggregates. Keep it as failed evidence; its exact HTTP failure cause was not captured. A subsequent initialized-schema full CLI run passed PUT200, requests1, fencedPOST200, exact receipt, all three aggregates0. Fresh initialization was then changed to the existing split-process schema boundary. A distinct newly created `sp277_3429_provider_fresh_test` database passed the full fresh initialization CLI proof: PUT200, requests1, exact fencedPOST200, unresolved/ciphertexts/prepared all0, no-network and generated-secret-output checks true. It is separate evidence, not a replacement for the first failed cohort. Offline contracts and three Python guard tests also passed. A later four-scenario actual-Rails CLI matrix passed: synthetic200 exited0; actual Delivery swallowed synthetic400/permanent-token error and synthetic transport exception but the wrapper correctly exited1 with no acceptance; lease-expired actual Delivery skipped publication and the wrapper correctly exited1 with requests0/no acceptance. All four still had exact fence200 and zero retained aggregates, explicitly demonstrating why cleanup/execution completion cannot prove acceptance. Actual APNs, credentials and device receipt/display remain held/unverified.
