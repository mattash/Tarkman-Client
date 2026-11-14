# Versioned native/provider contract — preparation, not delivery

Coordinated with [backend #552](https://github.com/mattash/Tarkman/issues/552).
The [Foundation type](<Shared/ServicePublicationV1.swift>) is bound to ActivityKit
by [ServicePublicationIdentity conformance](<Shared/ServicePublicationActivity.swift>),
compiled into the isolated app and extension. **Neither the current renderer nor
Activity request uses this new type yet.** The existing five-field synthetic
`ServiceAttributes.ContentState` stays separate; no token/provider is activated.

## Wire shape

`ServicePublicationIdentity` immutable attributes: `serviceID: Int` and
`generation: String` (UUID). A future renderer must compare both against the
content to isolate same-service re-follows without executing the app. The
content's `sessionID` corresponds to the attribute's `serviceID`.

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
update payloads. Active, unknown-total paused, coherently empty and deleted/end
fixtures pin the exact compiled encoding, identity, reference/Unix dates,
nil omission/null decoding, explicit zero and bounded synthetic payload size.
They are synthetic examples; no token, management secret or real service is stored.

**Codable decoding is not semantic validation or authentication.** These fixtures
and plain data types do not enforce generation, sequence/replay, status/role/size,
clock/skew, title bounds, expiry, source coherence or terminal lifecycle. Provider
and native adapter still need those checks and a renderer that safely handles
unknown/stale progress before registration can be connected. Native token
observation, registration/removal/rotation, real APNs provisioning, physical
end-to-end delivery/latency/battery and visual acceptance remain incomplete.
