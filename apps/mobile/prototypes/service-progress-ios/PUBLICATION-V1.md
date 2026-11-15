# Versioned native/provider contract — preparation, not delivery

Coordinated with [backend #552](https://github.com/mattash/Tarkman/issues/552).
The [Foundation type](<Shared/ServicePublicationV1.swift>) is bound to ActivityKit
by [ServicePublicationIdentity conformance](<Shared/ServicePublicationActivity.swift>),
compiled into the isolated app and extension. The local harness now requests and
renders this v1 type with synthetic public fixtures and `pushType: nil` by default.
The separately gated [development caller](<REMOTE-EXPERIMENT.md>) wires verified
public selection to an actual `.token` request/registration/removal path, off by
default and not yet measured against APNs. The old
five-field `ServiceAttributes.ContentState` is retained only for baseline golden
verification and cleanup of earlier experiment Activities; no provider is activated.

## Wire shape

`ServicePublicationIdentity` immutable attributes: `serviceID: Int` and
`generation: String` (UUID). The renderer compares both against the content to
isolate same-service re-follows without executing the app. The content's
`sessionID` corresponds to the attribute's `serviceID`. An optional app-originated
`readerOrigin: String?` binds development IDs to their explicitly trusted reader;
malformed supplied origins fail closed. Nil is omitted, preserving the historical
two-field attributes golden byte-for-byte. It is not a dynamic content or
registration field, and update pushes need no new server field.

`ServicePublicationV1` required content fields:
- `schemaVersion: Int` (1), `sessionID: Int`, `generation: String`, `sequence: Int`;
- `status: String`, `updatedAt: Date`, `expiresAt: Date`.

Optional fields: `stateRevision: Int`, `contentContext: String`,
`serviceTitle: String`, `occurrenceID: Int`, `ordinal: Int`, `total: Int`,
`role: String`. Synthesized Codable omits nil keys; absent or JSON null decode as
unknown. `total: 0` is distinct from unknown. Occurrence identity is a LiturgyPart
occurrence, not reusable Part identity. Ordinal/role require a coherent authoritative
reading order; no completion percentage or estimated end is implied.

Status values agreed for the experiment are active, paused, unavailable, deleted;
ended is reserved but cannot be inferred because the backend has no domain ended
state. Transport failure does not manufacture authoritative unavailable/end or
renew freshness. Deleted/unavailable terminal projection clears title/current
progress; an explicitly coherent empty manifest may retain total0. Deletion has
no surviving authoritative state revision/context. Role values are backend roles:
priest, deacon, choir, people, instruction, title, leader, all, clergy; unknown is
omitted, not a synthetic localization key. Service title is bounded to 120 characters.

Both content Dates use default synthesized Codable **seconds since 2001-01-01**.
APNs `timestamp`, `stale-date`, `dismissal-date` remain **Unix seconds**. These are
not the TypeScript prototype's epoch milliseconds or Expo's JSON-string props.
The experiment proposes a 60-second source expiry, not an OS redraw guarantee.

## Compiled golden verification

```sh
swiftc Shared/ServicePublicationV1.swift Tests/PublicationV1Golden.swift \
  -o artifacts/publication-v1-golden
artifacts/publication-v1-golden Tests/Fixtures
```

`publication-v1-attributes.json` pins immutable attributes separately from APNs
update payloads. The deleted/end envelope uses `dismissal-date = timestamp - 1`
(an explicitly past time for immediate dismissal), matching the backend provider.
Active, unknown-total paused, coherently empty and deleted/end fixtures pin the exact compiled encoding, identity, reference/Unix dates,
nil omission/null decoding, explicit zero and bounded synthetic payload size.
They are synthetic examples; no token, management secret or real service is stored.

## Native semantics and inactive registration boundary

[Validator and foreground store](<Shared/ServicePublicationValidation.swift>) now
check schema, immutable service/generation identity, canonical lowercase UUID,
positive sequence, supported status, bounded title and finite source/expiry/clock.
They fail conservative on future-issued source or a window beyond 60 seconds.
Presentation suppresses incoherent/unknown occurrence progress and unknown roles;
known zero remains distinct from unknown. Expiry or native `isStale` hides ordinal
and role without another publication. Terminal states clear title/progress/tap;
removal clears the foreground snapshot and rejects late callbacks. The local
foreground store rejects non-increasing sequence/backwards source time and latches
terminal state. The [shared renderer](<Shared/ServicePublicationView.swift>) uses
this projection on Lock Screen/Island and the local fixture preview. Retained
progress always says **Last reported part**, never live/current/percent/ETA.

**The stateless Widget renderer cannot compare a prior sequence.** Backend source
validation uses integer seconds; a higher custom sequence may share the same APNs
`timestamp`. OS acceptance/display ordering, same-second coalescing and retry/end
emission policy require separate provider proof in backend #552. A local store's
sequence checks are not terminated-app replay protection or an OS-redraw deadline.

[Registration transport](<Shared/ServiceRegistrationTransport.swift>) matches the
capability-authenticated seven-field PUT, bodyless DELETE and bounded receipt from
backend #553 at `2053e7547ffbfacee8d8fe5c4bc205abfa91837c`. It is **disabled by
default**, has no default HTTP driver/base URL, and is tested only with synthetic
injected asynchronous HTTP. MainActor serialization and a sending gate protect
mutation across suspension; actual I/O does not block the UI actor. It validates lease/receipt/identity, pins ambiguous rotation retries,
invalidates locally before removal and prevents stale follow callbacks/switches.
A provably never-attempted follow removes locally without DELETE; used IDs and
generations remain invalidated. An explicit monotonic PUT-attempted fact is set
before HTTP suspension and survives pending clearing, so ambiguous/in-flight or
previously attempted registrations still require remote acknowledgement. Removal
returns `.neverAttempted` or `.acknowledged` for caller recovery, not an inference
from token/version0 after an error.
Request/response/debug/error representations redact sensitive values; actual
request headers/body remain sensitive and must never be logged or persisted.

[Native token bridge](<Shared/ServiceActivityRegistrationBridge.swift>) is likewise
default-disabled and is **not constructed in default local mode**. The explicitly
configured development caller supplies verified selection/fresh disclosure and
persists recovery through a pre-observation hook before any token task/PUT. It prepares
serialized ActivityKit `pushTokenUpdates` observation, hex token rotation and local
end plus revocation retry. Its [testable coordinator](<Shared/ServiceRegistrationCoordinator.swift>)
retains a failed/ambiguous candidate, reconciles that exact token/version before
one latest queued rotation and bounds each drain to two PUTs. The bridge exposes
`retryRegistration()` even if no new token event arrives, plus
`needsRegistrationRetry`; a false return indicates bounded work remains. Removal
cancels/clears queued reconciliation before ending/revoking, and rejects registration
retry afterward. No foreground retry entry point implies background execution. No `.token` Activity request, real HTTP driver, endpoint
activation, capability/provider key, APNs entitlement or background timer is added.
The concrete [asynchronous HTTPS driver](<Shared/ServiceRegistrationURLSessionHTTP.swift>)
is also default-disabled and requires an explicit bare HTTPS origin. It is only
constructed through the separately configured opt-in caller, never default mode. It denies redirects/authentication credential reuse,
uses ephemeral no-cache/no-cookie/no-credential-storage configuration, bounds
streamed response bytes and sanitizes transport errors. Policy tests do not issue
outbound requests. No real endpoint/provider activation or remote receipt is claimed
by those policy tests. The separate [isolated HTTP checkpoint](<../../../../docs/service-progress-feasibility-checkpoint.md>)
adds an explicit compile-gated Debug Simulator/macOS socket-test constructor;
default HTTPS/system-trust policy is unchanged. Its actual loopback Rails receipts
and synthetic provider collaborator are not APNs delivery.

```sh
swiftc Shared/ServicePublicationV1.swift Shared/ServicePublicationValidation.swift \
  Tests/PublicationValidationTests.swift -o artifacts/publication-validation-tests
artifacts/publication-validation-tests
swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServiceRemoteExperimentConfiguration.swift \
  Shared/ServiceRegistrationTransport.swift Shared/ServiceRegistrationURLSessionHTTP.swift Tests/RegistrationTransportTests.swift \
  -o artifacts/registration-transport-tests
artifacts/registration-transport-tests
swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServiceRemoteExperimentConfiguration.swift \
  Shared/ServiceRegistrationTransport.swift Shared/ServiceRegistrationURLSessionHTTP.swift Tests/RegistrationHTTPTests.swift \
  -o artifacts/registration-http-tests
artifacts/registration-http-tests
swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
  Shared/ServicePublicationV1.swift Shared/ServiceRegistrationTransport.swift \
  Shared/ServiceRegistrationCoordinator.swift Tests/RegistrationCoordinatorTests.swift \
  -o artifacts/registration-coordinator-tests
artifacts/registration-coordinator-tests
```

**Codable decoding is not authentication.** The native surface checks cannot
establish backend public-read authority or APNs emission order. Actual HTTP/provider
activation, authenticated remote update/end delivery, real physical lifecycle,
latency/battery, Android and full visual/accessibility acceptance remain incomplete.
