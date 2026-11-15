# Actual app integration comparison (#277 / #286)

These are application/system captures, not mockups or reused standalone screenshots.

## Matched Before / After

| Before — main JS `1636114333e453d3549d5c67bea982a9ce022e03` | After — app/native UI `32294c9ab80421c5dae7e74fc7842e46693dc181` |
| --- | --- |
| ![Before: public reader42 without progress action](<before-main1636-reader.png>) | ![After: same reader42 with explicit progress-options action](<after-322-reader.png>) |
| ![Before: no Activity in Notification Center](<before-main1636-system.png>) | ![After: actual local Activity in Notification Center](<after-322-system-activity.png>) |

Both: iPhone18Pro / iOS27.0 owned Simulators, 402×874 points / 1206×2622 pixels,
English, light theme, default wallpaper, actual Nov14 clock; selected synthetic
public service42, active first part of three, Reader / Our Father. Baseline uses
isolated `app.tarkman.progressbaseline`; After uses `app.tarkman.progressprototype`.
No production/phone/account data, clock override or settings change is involved.
Notification Center is **not** a physical-device locked-screen acceptance result.

The baseline native executable is `d459fa5e`, SHA256
`97d59158d1709a40a36041227ea3ca1660cb810eb1f2403f5cbb29f13d476bd9`;
its reuse is supported by [37 byte-identical native inputs](<before-native-inputs.json>)
and [identical autolink/introspection/entitlement graphs](<before-native-graph.json>).
Actual **current-main JS** was loaded, not the old JS bundle: [source-map/git-blob
provenance](<before-js-provenance.json>), [baseline capture metadata](<before-metadata.json>).
Only the baseline bundle-ID isolation override differs from normal source.

## Actual selected-service flow

1. Reader42's explicit action opens the native manager with locked ID42.
2. [Fresh verification, disclosure OFF](<after-322-verified-off.png>): Start remains
   disabled. No follow is started by presentation or verification.
3. The actual disclosure switch is tapped ([disclosure ON, separate Start enabled](<after-322-disclosure-on.png>)), then Start is tapped separately.
   [Started native manager](<after-322-started.png>) explicitly says local Simulator,
   no APNs/network registration. Initial progress stays unknown, never guessed.
4. Done dismisses to reading. Home/Notification Center shows the actual local
   Activity in the comparison above.
5. [Tapping that card returns to public reader42](<after-322-read-only-tap.png>), not
   controller UI. The fixed Debug-Simulator QA scheme is not Universal Link proof.
6. [Explicit end/revoke](<after-322-revoked.png>) clears the fake follow and
   [the actual system card is absent](<after-322-system-removed.png>).

The actual public All services UI then selected43 while42 was active:
[the manager retained42 and blocked a silent switch](<after-322-switch-fenced.png>).
Only [explicit revoke allowed alignment to43](<after-322-switch-revoked.png>).
A fresh verification43 required disclosure OFF again. Finally the nonactive
manager stayed open through Home/background and activation, then
[returned with Verify enabled and consent OFF](<after-322-foreground-return.png>)
under a bounded three-second expectation; actual Verify and Done worked.
An earlier immediate post-activate assertion failed before normal asynchronous
scene propagation; it is not hidden or counted as a passing lifecycle test.

[After metadata and installed executable/plist hashes](<after-metadata.json>)
identify the tested artifact, not a later uninstalled build product.

The synthetic native public/registration replies and journal are in memory;
`Activity.request` uses `pushType:nil`. This proves integrated app/bridge/extension
interaction, not native network registration, durable relaunch recovery or remote
push delivery. Reopening a nonactive manager requires fresh disclosure.

## Observed failure and corrected build

The original integrated app reached the manager while XCTest reported the app
runningForeground, but Verify was disabled. UIKit-hosted SwiftUI did not receive
the standalone App/Scene environment used by the shared view. The corrected build
supplies its presenting UIWindowScene lifecycle explicitly; standalone callers keep
the original scenePhase fallback. Native Start still independently checks actual
application foreground. Done explicitly dismisses the UIKit host.

Original failed captures/results remain in the local validation archive; they are
not labelled as verified/off/reader success. The images above were visually read
and the corresponding actual flow was exercised on the corrected installed build.
The development-client Tools gear is intentionally unchanged in both captures.
It overlaps most of Done's trailing hit region; the exposed left edge was used and
dismissal was verified with a bounded nonexistence expectation. No preference was
changed and no alternative toolbar layout is part of this patch.

## Limits and next stage

No exact 60-second redraw promise: staleDate is source-expiry metadata and iOS
controls rendering. No physical/APNs, termination delivery, oldest-OS runtime,
latency or battery acceptance is inferred from these captures. Minimum deployment
is iOS16.4; the executed runtime here is iOS27.0. No secure-memory-erasure claim is
made from null projections/reference cleanup.

See the [concrete held live/device plan](<../service-progress-live-acceptance-plan.md>).
#277 remains open; no operator/secret request is made by this checkpoint.
