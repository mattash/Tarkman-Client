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

The steps describe the **coherent XCTest flow at19:23**, whose result exited0.
Linked photos are a **state mosaic across repeated runs**, not a continuous photo
sequence or evidence of one follow/generation. Their original bytes are retained:

| State image | Visible local clock | Capture run / stage |
| --- | --- | --- |
| [Reader](<after-322-reader.png>) |19:21| `done314`, after earlier cleanup |
| [Verified OFF](<after-322-verified-off.png>) |19:12| `corrected-verify`, first corrected verification |
| [Disclosure ON](<after-322-disclosure-on.png>) |19:23| `coherent-flow`, before separate Start |
| [Started](<after-322-started.png>) |19:13| `consent-card`, earlier local follow |
| [System Activity](<after-322-system-activity.png>) |19:23| `coherent-flow`, that run's actual card |
| [Read-only tap](<after-322-read-only-tap.png>) |19:23| `coherent-flow`, that card's return to reader |
| [Revoked](<after-322-revoked.png>) / [absent](<after-322-system-removed.png>) |19:19| `revoke`, earlier follow cleanup |
| [Switch fenced](<after-322-switch-fenced.png>) / [aligned](<after-322-switch-revoked.png>) |19:30–31| `guard-lifecycle`, active42 then explicit revoke before43 |
| [Foreground return](<after-322-foreground-return.png>) |19:33| focused `hosted-lifecycle`, no active follow |

Do not infer chronology or shared follow identity from file/list order. The
coherent-flow result separately verifies the actual ordered interaction; the
combined guard/lifecycle result's immediate activation assertion failed, and the
focused bounded lifecycle result separately passed. Public provenance uses
repository-relative source paths; the private original archives remain unchanged.

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

## Deleted-reader cleanup correction — separate Before / After

| Before — JS `b160d869`, existing native follow42 | After — JS `32cd1f81`, same installed native `32294c9` |
| --- | --- |
| ![Before deleted reader hides management](<before-b160-deleted-reader.png>) | ![After deleted reader retains explicit management](<after-32cd-deleted-reader.png>) |

This separate terminal scenario ran at19:56–20:05, not in the19:23 coherent run.
A normally consented local follow42 already existed. The private public-read fixture
then returned authoritative typed404 `code=session_not_found`; generic410 is not
this reader's deletion contract. Before exited0 at19:58 with gone alert/Back but no
management or Retry. After loaded released JS with normal devclient Reload (no
native process termination, reinstall or preference change), then exited0 at20:05:
management opened the [retained active42 caller](<after-32cd-deleted-manager.png>),
[explicit revoke completed](<after-32cd-deleted-revoked.png>), Done returned to the
still-deleted page and [the system card was absent](<after-32cd-deleted-no-activity.png>).
[Exact source/provenance and limits](<terminal-metadata.json>) distinguish this JS
fix from the unchanged accepted native captures above. No fresh Verify or Start was
attempted for deleted42; independent in-memory QA eligibility is not evidence of
real deleted-service eligibility. Normal native eligibility/disclosure guards are
unchanged. Original bytes, initial retained-old-JS attempt and private archives remain.

## Limits and next stage

No exact 60-second redraw promise: staleDate is source-expiry metadata and iOS
controls rendering. No physical/APNs, termination delivery, oldest-OS runtime,
latency or battery acceptance is inferred from these captures. Minimum deployment
is iOS16.4; the executed runtime here is iOS27.0. No secure-memory-erasure claim is
made from null projections/reference cleanup.

See the [concrete held live/device plan](<../service-progress-live-acceptance-plan.md>).
#277 remains open; no operator/secret request is made by this checkpoint.
