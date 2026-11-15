# Selected-service app/native integration (#277)

Continuation from merged #282 on main `1636114333e453d3549d5c67bea982a9ce022e03`.
The public reader opens a native manager for its **route-selected service**, not a
service ID/credential taken from a backend response. Presentation is not consent,
registration or delivery. Native re-verifies the public service, requires fresh
per-follow disclosure and an explicit Start, and reuses the reviewed fenced
revocation/retry/journal contracts. End/revoke is required before switching an
active or unresolved follow. Shared reader packages remain platform-free.

## Configuration

Default/unset `TARKMAN_SERVICE_PROGRESS_PRODUCT` preserves the ordinary graph and
hides the action. Web/Android, absent native module and unsupported presentations
leave normal reading available. Native checks foreground scene, identity and the
configured origin again. Reader APIs with a non-root path cannot silently be
retargeted to a different namespace: reading still works, progress presentation
fails closed.

Explicit `TARKMAN_SERVICE_PROGRESS_PRODUCT=1` generates the isolated
`app.tarkman.progressprototype` / `tarkman-progress-dev` app and embedded extension.
It requires explicit bare HTTPS `SERVICE_PROGRESS_DEVELOPMENT_ORIGIN` and
`SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN`. The plugin adds no team, profile,
APNs entitlement, App Group or provider. OTA updates/production associations are
removed for this development variant. It is not production activation.

## Safe enabled Simulator seam

Also set `TARKMAN_SERVICE_PROGRESS_SIMULATOR=1` and
`SERVICE_PROGRESS_SIMULATOR_API_ORIGIN=http://127.0.0.1:8140` (an explicit valid
loopback port). This seals the backend/reader namespace to reserved `.invalid`
origins, creates no native network/Keychain driver and requests a **local Activity
with pushType:nil**. Synthetic token/reply data stays in memory. It does not
simulate durable relaunch recovery or prove server/APNs delivery. Only documented
public QA service IDs 42, 43 and 9001 are admitted by that fake verifier.

Native admission additionally requires a **Debug Simulator** and the isolated
bundle ID. Devices/release builds fail closed rather than falling back to real
HTTP/token observation. Selection/registration replies in this seam are explicitly
fake; their initial progress/role/total stays unknown, not guessed from reader text.

The explicit widget test flag substitutes only the reserved reader URL's validated
`/sessions/:id/parts` path into this QA app's fixed scheme. This lets an owned
Simulator exercise the read-only tap without contacting a real web service. Every
device/default build retains the validated HTTPS reader destination. It is not
universal-link or physical delivery acceptance.

```sh
# From apps/mobile, with a separate public loopback QA fixture on port 8140:
EXPO_NO_DOTENV=1 TARKMAN_SERVICE_PROGRESS_PRODUCT=1 \
TARKMAN_SERVICE_PROGRESS_SIMULATOR=1 \
SERVICE_PROGRESS_SIMULATOR_API_ORIGIN=http://127.0.0.1:8140 \
npx expo prebuild --platform ios --no-install
# Build only for an explicitly owned Simulator, CODE_SIGNING_ALLOWED=NO.
# Use the same flags and EXPO_PUBLIC_API_URL for that app's Metro process.
```

## Evidence and remaining gates

Source checks and the host Swift Simulator policy test exercise routing admission,
coherent public verification, unknown progress, synthetic registration/revocation
receipts and the default-disabled boundary. An unsigned integrated Simulator app
plus extension build passes separately from ordinary-app CI. UI/Simulator captures
and the final PR review record are added as validation finishes; no mock baseline
or old standalone screenshot is substituted for the actual application.

#277 remains open. Current scope does **not** authorize real APNs, signing/profile
changes, production activation, store release, phone queries/tests/settings or an
operator prompt. Real server/device/publication-to-display, oldest-OS runtime,
background/termination latency and battery acceptance remain unrun. A 60-second
staleDate is not a guaranteed visual redraw deadline. No retained-memory secure
erasure claim follows from null projected display fields.
