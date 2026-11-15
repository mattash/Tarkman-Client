# Isolated device-generation / real HTTP feasibility checkpoint (#277)

Continuation from merged [PR286](<https://github.com/mattash/Tarkman-Client/pull/286>)
base `75264208c87243cded206b4c0a015155511857fe`. This prepares an executable isolated
experiment, not production activation or full #277 acceptance.

## Source boundaries

- [Device-generation guide](<service-progress-device-build.md>): explicit opt-in,
  development host entitlement, fixed isolated app/extension/topic, separate manual
  signing inputs and signed embed. Synthetic generated-project checks only; no
  actual identity/profile/certificate inspection, signing or provisioning.
- Same generated project device→unsigned/Simulator/HTTP transitions restore only
  plugin-owned settings. Original/unrelated/later external settings survive.
  Generated first-phase guards reject wrong SDK/Release even after Expo evaluation.
- The HTTP Simulator mode additionally requires product+Simulator opt-ins and exact
  bare `http://127.0.0.1:<port>`. Real URLSession public/registration drivers remain
  HTTPS-only by default and retain system TLS trust, no credentials/cookies/cache,
  all-redirect rejection and bounded streamed receipts. No TLS bypass is installed.
- The journal's optional constructor-admitted socket-test origin is exact-port-bound
  to the same real driver/configured revocation origin. Default records remain
  HTTPS-only. Admission exists only in Debug isolated Simulator or an explicit
  macOS test compile; no device/Release opt-in. Simulator storage is memory, not
  Keychain; local Activity requests nil push type and a fresh synthetic token per
  follow. Real token digest tombstones are never removed to make a test pass.
- Native help/status explicitly distinguishes in-memory replies from loopback HTTP;
  presentation, eligibility, disclosure, Start and revocation remain separate.

## Executable harnesses

[Swift/socket runner](<../apps/mobile/prototypes/service-progress-ios/Tests/run_real_http_harness.py>)
uses an owned socket fixture by default. **`--rails` is required** for actual backend
registration. [Harness source](<../apps/mobile/prototypes/service-progress-ios/Tests/RealHTTPHarness.swift>)
exercises actual URLSession sockets, not URLProtocol/mock response substitution.

[Disposable backend runner and commands](<../apps/mobile/prototypes/service-progress-ios/Tests/backend_fixture/README.md>)
pin backend `46481161509155d04e3fcf60ce7928ea19f9614b`; require explicit private owned
root, exact Ruby3.3.13, private gems, fresh socket-only PostgreSQL16 cluster/database
and explicit loopback HTTP port. Default off; download/dependency installation/init
are explicit. No `bin/setup`, inherited app secrets, global service or copied `.env`.
Strict verified database/data/socket/port/listen binding precedes writes. Synthetic
session42 only; public listing is bound to Los Angeles civil today, with real source
revision changes rather than fabricated clocks/progress. Public reads/mutations/IDs
and wall-clock lifetime are bounded; no worker, scheduler or recurring heartbeat.

The unchanged actual Rails controller/registration/fence code handles HTTP. The
existing real APNs adapter, bounded single-use DevelopmentBootstrap and concrete
HTTP/2 parser execute with an injected **synthetic subprocess**, never real APNs.
Normal provider/topic remain fake/unchanged. A synthetic200 is not delivery/display.

## Executed checks (not delivery claims)

- Generated configuration/project13 cases pass, including serialized same-project
  mode transitions, unrelated ownership preservation and actual shell guard checks.
- Swift6 strict socket/default-policy/fault tests105 pass: malformed/no-store/mismatched
  receipts, exact4096 positive vs known/chunked4097 rejection, truncated partial JSON,
  redirect/no capability replay,403/409, ambiguous PUT pin/retry/cancel, invalid fence
  exact retention/block-new-follow, valid fence erase; owned fixture listener closes.
- One actual native Foundation→Rails run120 checks passed: public42 coherent active
  snapshot/unknown initial progress, staged-before-PUT, version1/idempotence, rotation2,
  DELETE204, exact fenced POST200/erase and server latePUT409. One fresh actual alias,
  confirmed revoked/fenced; initial fixed-token reuse hazard was avoided, not hidden.
- Genuine disposable backend11 HTTP contract cases and162 existing Rails specs pass.
  Advisory-lock bypass negative control fails both expected cases. An initial50/1
  test failure remains recorded; isolated/rerun50/0 and broader162/0 are not substituted
  for its history. The first source-owned fresh-schema wrapper then failed162/59:
  schema preparation and RSpec in one Rails process crossed an autoload epoch.
  Preparation now runs in a separate verified process; both existing-schema and a
  genuinely new test database (`initialized:true`) pass162/0, same seed22189/all
  examples. The source-owned negative control fails both expected cases; no backend
  model/spec edits or example filters were used. Failure logs remain archived.
- Root review reproduced an adopted `pg`→outside-directory escape before resource
  launch. The corrected runner rejects redirected/non-owned/nonprivate clusters and
  invalid version markers before process/DB actions; Ruby repeats pre-Rails checks.
 19 offline guards pass, including20 real-entrypoint unsafe cases with all resource
  calls intercepted/not called, and legitimate prepare/adopt before initialization.
  The committed download/gem-install/init combination was not repeated as a second
  full installation; the original genuine private setup and committed runtime,
  fresh-test-database, probe and guard paths were executed.
- Typecheck/lint/UI/i18n/pure-reader guards and139 focused RN cases pass. Initial Node
  global lint issue corrected. Changed Foundation suites pass; one command omitted an
  existing reader-link dependency and was corrected, not a product failure.
- Actual unsigned integrated app+Widget build passes. Initial workspace-missing66
  after fresh Expo regeneration was resolved by normal cached CocoaPods installation.

## Actual application comparison / remaining draft gate

[Before](<service-progress-feasibility-evidence/before-memory-manager.png>): actual
installed native322, byte-identical relevant UI to merged7526, public42 manager before
verification/selection/disclosure, English/light/iPhone18Pro1206×2622, unchanged gear.
No mock baseline. [Redacted source/binary hashes and cohort correlation](<service-progress-feasibility-evidence/provenance-and-correlation.json>)
verify native inputs against the commit; complete private artifacts remain archived.

[After](<service-progress-feasibility-evidence/after-http-manager.png>): matched
actual pre-verification manager in the new unsigned HTTP build, same state/theme/
viewport and unchanged gear. Only help accurately changes to real loopback HTTP;
no verification/disclosure/Start is inferred from this matched capture.
The actual new-HTTP UI flow completed at05:26UTC on2026-11-15 (native inputs map
unchanged to `90cbda678b087229bab67a664a2c79f0eb0a0e2f`):

| UTC | Actual UI / wire evidence |
| --- | --- |
|05:26:08–09|Verify42; real fresh selection; disclosure OFF ([capture](<service-progress-feasibility-evidence/http-verified-disclosure-off.png>))|
|05:26:10–14|Real switch ON, separate Start; actual PUT200; existing one-shot bootstrap rounds1/registrations1 and synthetic HTTP2 status200/protocol2/no network ([UI status, not wire receipt](<service-progress-feasibility-evidence/http-local-started.png>))|
|05:26:16–18|Explicit revoke; **fixture DELETE500**, then actual exact fenced POST200; controller ended/cleared ([capture](<service-progress-feasibility-evidence/http-ended-cleared.png>))|
|05:26:20–25|Done returns to real synthetic public reader; no Activity/card remains ([capture](<service-progress-feasibility-evidence/http-no-card.png>))|

One registration row was created in this UI window; parent SQL verified2 total
rows (earlier Mac + UI),0 unresolved,0 ciphertext and0 prepared publications. This
is actual registration/fenced recovery correlation, not an inference from the UI's
explicitly unverified label. The UI cohort **does not prove DELETE204**: the fixture
read(4097) returned nil for bodyless iOS DELETE and raised before Rails. The wrapper
now normalizes EOF, and a separate source-owned probe at05:39:51UTC passed11 HTTP
cases including DELETE204 with explicitly no Content-Length/Transfer-Encoding,
exact fenced receipts/late409 and0 unresolved identities. Original500/fence200
cohort is retained rather than relabelled. No remote delivery/display is observed.
The fixture intentionally supplies no ActionCable/explanations route; the returned
reader honestly shows polling/unavailable explanations, not healthy real-time proof.

Other retained failures: listing initially rejected `/services.json`; a synthetic
UTC civil date excluded Los Angeles Today until explicit local-date binding with a
real revision change. First restart returned a redacted OSError; after separately
verifying free port/released runtime lock, an unchanged-guard bounded restart
returned listing/state200. Original errno was not captured, so its cause remains
unknown. An independently reported macOS TIME_WAIT reproduction establishes a
platform mechanism only. New failures include fixed stage/numeric errno without
arbitrary exception values; occupied/unowned-port rejection remains unchanged.

## Concrete next-stage resource packet (held procedure, not a request)

Bindings: isolated host `app.tarkman.progressprototype`, extension
`app.tarkman.progressprototype.LiveActivity`, update topic
`app.tarkman.progressprototype.push-type.liveactivity`, sandbox APNs. Current actual
socket origin is `http://127.0.0.1:18777`; reserved HTTPS reader origin is only a QA
identity/tap boundary. Exact client/backend/source/run hashes and redacted method/
status/correlation aliases accompany the evidence; never raw capability/token/key.

Before any released resource check, select a dedicated CA-valid HTTPS backend and
reader hostname mapped to this disposable database/session namespace. Record DNS,
certificate chain/SAN/expiry and system-trust verification without bypass. Those
origins/resources are unverified, not missing credentials. Then, only after explicit
release, verify isolated Team/app/extension/profile/device inclusion and development
push entitlement from the built product; verify provider authorization for exact
sandbox topic using secure in-memory injection, never pasted/CLI secret values.

Bound each run by one synthetic session, explicit registration IDs, short deadline,
request caps and one-shot bootstrap rounds. Stop on isolation/trust/receipt errors.
End/revoke locally; require exact fenced receipts before erasure; verify scoped DB
revoked/ciphertext-null/prepared-null state. Keep unresolved evidence, never silently
rekey/resume outstanding records. Stop only owned HTTP/PG processes; collect outputs
and verify listeners/socket gone. No secure-erasure claim or automatic deletion of
unresolved artifacts.

Actual scoped teardown completed: final native database has4 registration rows
(Mac, UI, two corrected-probe identities),0 unresolved,0 ciphertext and0 prepared
publications. The corrected HTTP runner reached its bounded deadline/exited0; the
owned PostgreSQL cluster was fast-stopped/exited0. Metro and both fixture ports
8139/8140/18777/18778 are closed; the owned PG socket is gone. No Activity remains.
Private source/build/run/database artifacts are retained, not deleted or claimed
securely erased. The [redacted corrected probe](<service-progress-feasibility-evidence/corrected-bodyless-delete-probe.json>)
is a separate cohort from the recovered UI500 failure.

Actual phone/settings, signing/provisioning, real push and production activation are
still held. Normal-app identity/Universal Links/OTA/separate production recovery
namespace, sustained provider/cadence/admission/concurrency remain explicit product
work. See [live acceptance plan](<service-progress-live-acceptance-plan.md>); #277
stays open and #283 stays queued. No operator/secret request is made here.
