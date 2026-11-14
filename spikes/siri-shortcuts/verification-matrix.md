# Bounded opening-only verification matrix

## Evidence boundary

- **PASS, one physical cold typed run:** owner-created native Shortcuts action,
  literal String `1`, new process, accepted native validation, one UUID correlated
  through dispatch/JS receipt/route/ack, and the actual Divine Liturgy reader.
  [Provenance](<evidence/typed-1-comparison.json>),
  [allowlisted events](<evidence/typed-1-phase-events.json>).
- **FAIL, actual spoken-ID attempt:** Siri reached the Liturgy ID prompt; the owner
  answered “1” and reported a generic failure. Resolved String and original
  native/JS stages remain unknown. Typed success does not explain or reverse it.
  [Original failure](<evidence/voice-attempt-1.json>).
- Unit tests, native metadata/builds, URL preflight and the successful single
  typed run do **not** establish the remaining physical outcomes below.

## One remaining matrix

| Case | Current physical result | Bounded next check / required evidence |
| --- | --- | --- |
| Cold typed `1` | **PASS once** | Already preserved; do not repeat merely to obtain another screenshot. |
| Warm/repeated typed `1` | **NOT RUN** | Same existing isolated action; confirm same process, new invocation UUID, route/ack, actual reader and no accumulating reader stack. |
| Invalid typed `0` | **NOT RUN** | Only the test shortcut: temporarily use `0`, expect native validation rejection with no dispatch/JS route; capture actual error, then restore `1`. Other malformed/safe-boundary vectors are unit coverage, not physical passes. |
| Canonical but authoritatively unavailable ID | **NOT RUN** | Controlled fixture ID701/702 with exact v1 `public_liturgy_unavailable` response; actual reader refusal. Do not guess a production missing ID: generic404 maps to transport failure, not authoritative revocation. |
| Saved reader with fixture transport failure | **NOT RUN** | Explicitly download fixture701, keep identical normalized environment, then503/timeout/server-stop; verify cold/warm saved read on device. This is app transport failure, **not proof of device offline**. |
| Actual device offline: saved and unsaved target | **NOT RUN** | Requires a verified naturally offline condition or separately authorized real disconnection. No device/network settings change is authorized here; do not substitute503 for offline. |
| User-deleted download | **NOT RUN** | Delete only the isolated fixture copy, close/restart the reader, open through the action; no saved copy/download intent silently restored. Distinguish permitted transient online reading from re-downloading. |
| Known unavailable/revoked saved item | **NOT RUN** | Download controlled fixture701, change the **same** fixture origin to authoritative unavailable, explicitly Sync/Update, then inspect removal and reopen/cold state. A saved open alone does not revalidate; catalog omission is not revocation. No production content mutation. |
| Additional Siri execution comparison | **NOT RUN** | Only a justified changed entry/diagnostic comparison, e.g. a named fixed-ID shortcut. Verify current state/lease and provenance first; no unchanged spoken-ID retry. Recognized-text injection, if used, is not an actual voice pass. |

## Gates and non-goals

The next live-origin lease should be limited to the warm/repeat and invalid-ID
rows, then explicitly released. Prefer an actually working authorized targeted
UI runner over another operator request. Mirroring inventory failures are not
proof that all native automation is impossible; no checked-in Shortcuts XCTest
runner was found in this repository.

The fixture rows are **deferred**, not failures or passes. Existing
[fixture server](<../../apps/mobile/scripts/library-fixture-server.mjs>) modes
include `normal`, `error`, `slow`, `unavailable`, `invalid`, `empty`, and `updated`.
They are process-start scenarios, not an installed runtime switch. Configuration
is build-time gated; the server binds Mac loopback, which is not the phone's
loopback. A separately prepared isolated fixture-capable app and verified device
reachability (or controlled injected test transport) must exist first. Keep
fixture environment identity fixed between seed/failure/revocation; never use
production revocation or change production credentials/settings/data. Synthetic
transport/content tests must be labelled as such.

The unavailable envelope intentionally does not identify whether the server
reason was deletion, revocation or another unavailability. Malformed-content
schema and catalog-empty scenarios are separate from malformed IDs and do not
prove revocation. Library unit tests cover those contracts but are not device
execution evidence.

The signed binary retains minimum iOS16.4; current physical evidence is iOS27.2,
not a runtime test on16.4. Queue navigation remains at-least-once, not an
exactly-once content-success guarantee.

## Current go/no-go

**GO only for further bounded opening-only investigation:** one cold native
Shortcuts→native→JS→existing-reader path works with a typed fixed ID.

**NO-GO for production Siri readiness or full acceptance:** the actual spoken-ID
failure is unresolved and the warm/error/offline/deletion/revocation physical
rows are unrun. No store submission, default production integration, release or
claim of a shipped Siri feature follows from this spike.
