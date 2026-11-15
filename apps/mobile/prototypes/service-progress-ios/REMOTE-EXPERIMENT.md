# Explicit selected-service development caller

This is a runnable **isolated experiment**, not production Expo integration or
completed #277 acceptance. [Controller](<App/ServiceRemoteExperimentController.swift>)
and [UI](<App/ServiceRemoteExperimentView.swift>) now construct the actual native
`.token` request and corrected bridge **only** after explicit development
configuration, a verified public selection and fresh per-service disclosure.
The ordinary local fixture remains `pushType: nil`.

## Defaults and configuration seam

Normal generation ships a typed `ServiceProgressRemoteEnabled = false`, no
backend/reader origin and no APNs entitlement. The disabled caller constructs no
HTTP driver and does not load Keychain. It cannot verify/start a remote follow.
No ordinary mobile manifest, lockfile, native dependency graph or production
setting is changed.

The opt-in inputs to [the generator](<generate.rb>) are:

| Input | Meaning |
| --- | --- |
| `SERVICE_PROGRESS_REMOTE_EXPERIMENT` | Exactly `0` (default) or `1` |
| `SERVICE_PROGRESS_DEVELOPMENT_ORIGIN` | Explicit trusted bare HTTPS development backend origin |
| `SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN` | Explicit trusted bare HTTPS reader origin for that backend's service IDs |

Both origins are required for `1`. Credentials, path, query, fragment and trailing
slash are rejected. There is no bundled live endpoint or URL/deep-link override.
The ignored generated plist contains a real Boolean, not the string `NO`.
`1` also selects [development-only app entitlements](<App/RemoteExperiment.entitlements>).
No entitlement is added to the widget or ordinary production app.

For review/reproduction, the configuration shape is:

```sh
# Example syntax only: reserved .invalid hosts, NOT a live-delivery command.
# Do not run an enabled build on the owner's phone while physical work is held.
SERVICE_PROGRESS_REMOTE_EXPERIMENT=1 \
SERVICE_PROGRESS_DEVELOPMENT_ORIGIN=https://api.example.invalid \
SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN=https://reader.example.invalid \
GEM_HOME=<existing-cocoapods-gem-home> <ruby> generate.rb
```

An enabled build is not permission to change server defaults, provision keys or
send a push. Native development signing/capability, secure backend provider
configuration and an expressly authorized test/device window have **not** been
validated by these synthetic checks. No secure-access failure is asserted and no
credential or phone prompt is requested. Physical work remains stopped under the
owner's explicit hold; restoration of accessibility settings did not lift it.

## Exact identifier / topic / environment binding

| Component | Required isolated binding |
| --- | --- |
| Native app identifier (fixed by generator) | `app.tarkman.progressprototype` |
| Update APNs topic for that app | `app.tarkman.progressprototype.push-type.liveactivity` |
| Opt-in app entitlement | `aps-environment = development` |
| Matching provider environment/host | Sandbox, `api.sandbox.push.apple.com` |
| Widget identifier (not the APNs topic base) | `app.tarkman.progressprototype.LiveActivity` |

The earlier backend foundation `c6489b9b` fixes the normal `ServiceProgress.topic` to
`org.tarkman.progress.experiment.push-type.liveactivity`, which **does not match**
this app ([cross-repository configuration review](<https://github.com/mattash/Tarkman-Client/pull/282#issuecomment-6886063233>)).
This caller does not rename either app, send a user-selected topic or override
production defaults to hide that mismatch. Backend #554 supplied concrete
collaborators but no runtime provider/key-loader/scheduler activation path; #557
adds separate isolated construction without changing those normal defaults.
Deployment alone cannot deliver to this app's token.

The bounded backend source/test dependency is now merged as
[backend #557](<https://github.com/mattash/Tarkman/pull/557>),
`46481161509155d04e3fcf60ce7928ea19f9614b`. It prepares separately invoked isolated
sandbox/topic construction, trusted auth/HTTP injection and bounded fixture/outbox
drain; normal factory/topic/config remain unchanged. Backend verification and
fence-bypass race controls are recorded there, separately from this native suite.
This is not activation, an app provisioning result or actual APNs delivery.

The remaining integration work must connect the real selected-service product
flow to this caller without adding experimental modules/entitlements to ordinary
builds. The enabled-native test path must bind the exact identifiers above and
use an expressly authorized isolated configuration. Actual secure auth injection,
provisioning, pushes and physical observations remain subsequent explicit gates,
not actions performed by this handoff. No credential-access failure or owner key
request is inferred from source preparation alone.

## Actual caller flow

1. Enter an explicit positive public **session/service ID**, not a user ID.
   Anonymous `GET /s/:id/state.json` and `GET /s/:id.json` must both succeed with
   coherent matching ID/status/revision. Only active/paused selections proceed.
   There are no account, controller or display-link credentials.
2. Use the actual public `liturgy` name as title. These endpoints provide no
   reliable part-transition instant or coherent occurrence manifest; initial
   ordinal/total/role/context are unknown, never guessed. Source freshness is the
   oldest explicit fresh server HTTP Date, not the civil `session.date` and not
   receipt-time renewal of a previous push. Cache Age, non-200/error, mismatched or
   stale/future/backwards reads fail closed. The original 60-second budget cannot
   be extended by reusing the selection.
3. Fresh disclosure describes public Lock Screen exposure for the selected
   service. Input changes/reverification/end/relaunch reset it. Starting requires
   foreground native authorization and unexpired verified selection. Local
   fixture controls are blocked while this selected follow is active.
4. Create a new canonical generation, cryptographic 32-byte capability and
   registration UUID. Actually request `Activity<ServicePublicationIdentity>`
   with `.token`. A synchronous pre-observation hook persists deletion-only
   recovery **before** the token task or any registration PUT can start.
5. The bridge converts actual `pushTokenUpdates`, calls the concrete HTTPS
   transport and retains ambiguous candidates for explicit exact-token/version
   reconciliation. UI retry does not depend on another token event; rotation is
   bounded and comes after candidate acknowledgement. Retry completion/observation
   is **not** a claim that APNs delivered or iOS displayed an update.
6. Explicit removal cancels observation/reconciliation, ends locally and revokes
   at the same configured origin. A genuine never-attempted removal can clear a
   same-process staged journal without HTTP. A possibly attempted registration
   requires acknowledged remote revocation. The backend556 fenced POST below is
   reachable even if legacy bridge DELETE fails with404 or an in-flight/ambiguous
   error. No legacy failure, local timer or version0 is fabricated into a receipt.

All credential-bearing requests stay on the explicit HTTPS backend origin, with
no redirects/shared cookies/cache/credential storage. Public reads have a 64 KiB
stream bound; registration responses have a 4 KiB bound. Capability/token/header
values and raw server errors are not logged or displayed.

## Correct public tap destination

Development IDs do not necessarily name the same production service. The caller
therefore supplies an optional immutable `readerOrigin` attribute from its
separately trusted reader configuration. The widget validates this bare HTTPS
origin and opens exactly `/sessions/<selectedID>/parts`, without control tokens or
queries. Invalid supplied origins fail closed, never falling back to production.
Nil preserves the historical synthetic fixture's known URL; its two-field
attributes golden remains byte-equivalent because nil is omitted. Dynamic v1
content and the seven-field registration body are unchanged. No server change is
needed to interpret this app-originated immutable attribute on update pushes.

## Background / termination recovery and limits

No background timer, foreground polling loop or automatic consent restoration is
added. Background/terminated updates rely on the backend and OS, not a running
Swift store. The isolated app ends its old Activities at launch as before.
The new caller loads only a deletion-only recovery record when explicitly
configured; it does **not** reconstruct/register an old follow or expose its title.
New remote follows cannot overwrite pending recovery.

The minimal capability/registration/identity/origin/activity record is in this
app's device-only Keychain, not defaults, a file or a shared access group. A
restored record can never be abandoned using a new transport's version0 or a
fabricated never-attempted outcome. A 404 after a possibly attempted or restored
registration remains unresolved: it is not evidence permitting deletion of the
capability. The matching native [backend556 contract](<https://github.com/mattash/Tarkman/issues/556#issuecomment-6886397865>)
is now prepared: `POST /public/service_activity_registrations/:uuid/revoke`, same
capability header, JSON exactly `{session_id, activity_id, generation}`. Only HTTP200,
`Cache-Control: no-store` and an exact receipt
`{id, session_id, activity_id, generation, revoked: true}` matching every durable
subject field permits exact-byte Keychain erasure. Missing/extra/wrong/null fields,
non-Boolean acknowledgement, wrong origin/identity, non200 or storage error retain
recovery. The concrete driver bounds and validates this POST separately from legacy
PUT/DELETE. The receipt must mean durable server fencing against a late PUT; a
mere absent-row observation is not enough. Backend #557 independently validates
its transaction fence (including controls that fail when bypassed); these fake-only
native tests do not establish deployment or enabled cross-system execution. Until
the configured endpoint returns a valid authoritative receipt, a new remote follow
remains blocked. No automatic expiry-based erasure or fallback acceptance is added.

Real initial token issuance, registration, APNs receipt/display, rotation,
foreground/background/terminated/force-quit freshness, latency/battery and final
product integration remain unmeasured acceptance gates. Backend #553/#554 defaults
remain off/fake; deployment does not establish live delivery. Same-second source
ordering is an independent backend/provider gate, not solved by a dynamic sequence
field in a stateless widget. iOS controls stale rendering time; no 60-second
on-screen guarantee is made.

## Deterministic checks

Run from this directory; all fixtures are synthetic. No commands below access
Keychain, request an APNs token or contact an endpoint:

```sh
swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServiceRemoteExperimentConfiguration.swift Tests/RemoteExperimentPolicyTests.swift \
  -o artifacts/remote-policy-tests
artifacts/remote-policy-tests

swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServicePublicationValidation.swift \
  Shared/ServiceRegistrationTransport.swift Shared/ServiceRegistrationURLSessionHTTP.swift \
  Shared/ServiceRemoteExperimentConfiguration.swift Shared/ServicePublicSelection.swift \
  Tests/PublicSelectionTests.swift -o artifacts/public-selection-tests
artifacts/public-selection-tests

swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServiceRemoteExperimentConfiguration.swift \
  Shared/ServiceRegistrationTransport.swift Shared/ServiceExperimentJournal.swift Tests/ExperimentJournalTests.swift \
  -o artifacts/experiment-journal-tests
artifacts/experiment-journal-tests

swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServiceRemoteExperimentConfiguration.swift \
  Shared/ServicePublicSelection.swift Shared/ServiceRegistrationTransport.swift \
  Shared/ServiceRegistrationCoordinator.swift Shared/ServiceRegistrationURLSessionHTTP.swift \
  Shared/ServiceExperimentJournal.swift Tests/RemoteExperimentFlowTests.swift \
  -o artifacts/remote-experiment-flow-tests
artifacts/remote-experiment-flow-tests

swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServiceRemoteExperimentConfiguration.swift \
  Shared/ServiceRegistrationTransport.swift Shared/ServiceExperimentJournal.swift Tests/FencedRevocationTests.swift \
  -o artifacts/fenced-revocation-tests
artifacts/fenced-revocation-tests
```

The integrated flow uses selected ID77, two reserved synthetic origins, fake
public reads/token events/HTTP and in-memory secure storage. It exercises actual
selection/projection/journal/transport/coordinator methods, including ambiguous
retry/rotation/removal and no-PUT/restart behavior. A fake Activity ID is not an
ActivityKit or provider delivery test. Those original captures exercise the default-off
UI and normal local fixture, not token-backed remote delivery. The later separate
[HTTP feasibility checkpoint](<../../../../docs/service-progress-feasibility-checkpoint.md>)
adds actual integrated Debug Simulator URLSession→disposable Rails verification,
registration and fenced recovery with memory storage/nil push type. See its matched
Before/After, real receipts and retained failures; no APNs/Keychain/physical proof.
