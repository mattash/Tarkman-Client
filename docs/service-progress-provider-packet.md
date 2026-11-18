# Bounded provider / HTTPS namespace preparation (#277)

Continuation from merged [PR287](<https://github.com/mattash/Tarkman-Client/pull/287>),
`3ed66950d0d325f7931a7bb4647c7cf6fc0edb4e`. The previous synthetic HTTP checkpoint
is complete; it is not a credentials blocker and does not itself activate a live
provider. This continuation prepares a separate executable experiment and matching
backend/read-only-reader namespace. #277 stays open; #283 remains queued.

## Current authorization

Source/Mac/owned disposable-fixture work and generated **test** authorization material
are permitted. Current execution must use synthetic provider collaborators; actual
APNs/private-key retrieval is not released. No public tunnel/deployment/trust-store
change, actual signing/provisioning/key creation, phone UI/screens/apps/logs/testing,
settings change or production activation is authorized. VoiceOver remains OFF;
no settings operation is performed.

Only narrowly relevant metadata inspection was additionally released. Metadata is
not proof of platform authorization, actual signing readiness, delivery or display.
Missing local metadata is not evidence that a portal resource is missing.

## Narrow read-only inventory (2026-11-14 America/Los_Angeles)

Inspection used only the two known prior isolated standalone app/extension build
artifacts, not a scan of provisioning-profile/keychain/credential directories:

| Resource | Observed fact | Limitation |
| --- | --- | --- |
| Prior isolated host | Bundle `app.tarkman.progressprototype` matches; embedded wildcard development profile covers it; Team `FHF872BAQR`; profile currently valid, expiry2027-11-14T18:37:26Z | Old local artifact, not a current portal inventory. `aps-environment` is absent in this artifact; this does not establish that an appropriate push-enabled portal profile is absent. |
| Prior isolated extension | Bundle `app.tarkman.progressprototype.LiveActivity` matches; same Team/profile expiry; development profile covers it | Old wildcard profile; not proof of the newly prepared separate explicit signing/profile configuration. |
| Two public certificates embedded in that profile | Team matches; validity2026-09-23T23:38:12Z→2027-09-23T23:38:11Z and2026-09-23T18:07:12Z→2027-09-23T18:07:11Z | Only public certificate metadata; no private key/identity query, retrieval or signing attempt. Not APNs token-key authorization. |
| Current ordinary Tarkman/current isolated push-enabled profiles | UNVERIFIED | No exact scoped current artifact selected; no unrelated profile inventory or portal operation. |
| Known paired test iPhone connection/lock/OS and profile inclusion | UNVERIFIED | A filtered metadata-only iOS/iPhone query returned three candidates. No unique authorized target was assumed and no per-device details/UI/apps/logs/settings were queried. No names, raw identifiers or UDIDs were emitted or retained in evidence. |
| Existing secure APNs authorization-loader reference | UNVERIFIED | No known configured reference was selected; no broad environment/keychain/filesystem credential search or private-key retrieval. The prepared input mechanism must be distinguished from a verified existing authorization resource. |

The first artifact check required an exact profile app-ID suffix and therefore
reported UNVERIFIED; a bounded follow-up correctly recognized the embedded wildcard
profile's coverage. It did not change or replace a profile. No raw profile, UDID,
certificate/private-key data or credential values appear in this packet.

These limits do **not** block continuing actionable source preparation and do not
request operator access, secret values or hands-on work.

## Execution / routing record

The separate [provider entrypoint](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/provider_README.md>)
requires independent provider/transport gates, explicit registration UUID allowlist
and a complete private pipe/Unix-socket FD packet. Signing material, selected token,
capability and identity stay in memory, never argv/environment/logs/evidence. This
one-shot process owns its encryption key, actual Rack registration, existing
DevelopmentBootstrap/Delivery/JWT/APNs/curl2 and exact fenced cleanup. The existing
fixture/server and ordinary factory remain fake.

**Important interface boundary:** this is executable for a trusted caller supplying
that complete selected-registration packet. It does not export an ActivityKit token
or wire the current isolated native Follow's HTTP registration into the new provider,
and cannot decrypt/rekey the default fixture's ciphertext. The caller must retain
recovery material until exact fenced receipts; unresolved aliases are failures, not
proof of erasure. It shares the existing exclusive per-database key-owner lock, so
stop the fake fixture before a provider run; no concurrent-key-owner claim is made.

Generated ephemeral TEST ES256 material exercised the actual Python→Ruby→Rails path
on a new owned database. A first fresh-schema/same-process attempt failed and was
retained (exact cause uncaptured); separate schema preparation and a pristine provider
process then passed on another genuinely fresh database. Four actual CLI cohorts:

| Synthetic scenario | Execution/cleanup | Transport evidence | CLI result |
| --- | --- | --- | --- |
| accepted | Bootstrap completed; exact fence200; zero retained ciphertext/prepared/unrevoked | One concrete curl2 response200, accepted1; label `synthetic_only` |0|
| permanent rejection | Same completed execution/fenced cleanup | Response400, accepted0; `not_observed` |nonzero|
| transport exception | Same completed execution/fenced cleanup | Exception1, accepted0; `not_observed` |nonzero|
| expired registration / no publication | Same completed execution/fenced cleanup | Requests0, accepted0; `not_observed` |nonzero|

[Redacted cohort outcomes](<service-progress-provider-evidence/provider-outcomes.json>)
preserve the failed/fresh/matrix distinction and their delegated execution provenance.
Completed execution and successful cleanup are **not provider acceptance**; even a
real provider response would not prove display. No actual APNs/network/private-key
retrieval occurred. Input/error/expiry/bounds and failed-fence cases are separately
covered with synthetic collaborators and credential-free aggregates only.

The [routing preparation](<service-progress-https-routing.md>) binds one explicit
HTTPS origin to both API/native configuration and the unchanged Expo read-only
reader export, for the same explicitly selected database/session namespace. It is
not a production reader URL for an unrelated disposable42. Named routing is optional;
the account-free Quick Tunnel plan validates its assigned random origin before
building/sealing any manifest/export/native configuration. No tunnel is started.
A changed origin invalidates the binding and requires stop/rebuild, never fallback.

The owned loopback gateway actually served the existing Expo HTML/assets and public
synthetic parts and passed genuine Rails GET/PUT/wrong-capability/bodyless DELETE/
fenced POST/late PUT namespace cases. The bounded capability header is mutation-only;
account auth/cookies/forwarding metadata do not cross the boundary. The first probe
failed before PUT on strict cookie/cache handling and remains separate evidence;
the corrected gateway strips upstream Set-Cookie, retains no-store directives and
preserves one actual upstream Date without hiding Age/encoding. Loopback tests do
not establish browser rendering, certificate/DNS/system trust or public HTTPS.

Actual current native HTTP fixture and standalone provider tests use separate,
explicit disposable test databases. A future reviewed run must choose one common
namespace/root/database/session for the provider and subsequent reader/API routing;
never carry only numeric42 between unrelated databases. The provider requires no
unresolved old registrations before taking key ownership. The trusted actual-token/
authorization producer and HTTPS/device resources remain unverified/review gates,
not inferred missing credentials or authorization to retrieve them.

## Scoped resource teardown

Final direct aggregate checks (no secret columns/identifiers emitted): provider test
DB1 row, fresh-provider DB6 rows, routing DB2 rows; each has0 unrevoked,0 ciphertext,
0 prepared publications. Those rows are retained tombstones, not deleted to make
follow/registration tests pass. Both provider child test jobs and genuine gateway
proof jobs were collected; the parent stopped only its genuine synthetic backend
and fast-stopped its owned socket-only PostgreSQL cluster (exit0). Exact18779/18780
listeners are closed and the owned PG socket is absent. All private source/build/
redacted evidence/database artifacts are retained; no secure-erasure claim.

The gateway's final adversarial lifetime tests used their own synthetic loopback
sockets, not these databases or a tunnel. All24 routing tests pass, including five
actual CLI cases for partial headers/body, drip upstream, SIGTERM during a partial
request and absolute request deadline. The parent found the original between-request
TTL/per-recv-timeout gap; the final main-thread absolute timers shut down only the
tracked accepted/upstream sockets. Every adversarial process exited0 with no stderr
and its listener closed. Initial hard-alarm/finalizer test iterations are retained;
no arbitrary asynchronous exception or unowned-port kill is used in the final path.

Three actual unchanged Expo exports each produced62 files and the same export-tree
SHA256 `2459a2f8dacad8d82b50a7bae17767f0138dfc23c2cdfa8c540e6ccabdb4d25f`.
[Initial failed gateway cohort](<service-progress-provider-evidence/gateway-initial-failure.json>)
and [corrected genuine gateway cohort](<service-progress-provider-evidence/gateway-corrected.json>)
are separately retained; the latter verifies one Date/no Age/no cookie throughout.
No existing app/native/TS/UI source was changed; static serving is not a browser
render/HTTPS claim. The six routing sources, seven provider sources and this packet
are separate source additions; ordinary factory/server/config behavior is unchanged.
