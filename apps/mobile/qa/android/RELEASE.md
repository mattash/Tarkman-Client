# Android beta and release evidence / #193

Status: preparation only. No tester rollout or public release authorized by this packet.
Evidence refreshed September 28, 2026. Source baseline: main
`09c835658bda0f4be0d25f371a39b8a915e43786` (includes #197, #202/#203 and #207).

## Artifact decision

The accepted internal draft is build `38b63fc4-3947-47ba-a8be-4fd1e35d97da`,
source `6efb5c4e5b0f56e00134e3134e30f0e78c65670b`, version 0.1.1 / code 2.
See [stage 2 evidence](../../docs/android-release.md) for its hash and validation.
It is an upload proof, not evidence for later main changes or Android App Links.

Proposed beta: finish the App Links implementation and focused fixes on current
main, review/merge them, then record the resulting exact commit before building.
A native intent-filter change requires a new binary and an app-version increment
under the appVersion runtime policy; do not deliver it as an OTA update to 0.1.1.
Keep remote versionCode auto-increment, production endpoints/channel, and select
an exact build ID for any subsequently approved upload. Do not use --latest.
No new build/versionCode has been allocated by this preparation.

The owner must select a named internal audience before rollout. Test first install
and an update to a subsequent higher versionCode with preferences/saved content
retained. Never silently uninstall a sideloaded app to resolve a signer mismatch.

## Current Console handoff

Fresh read-only inspection September 28: internal release 0.1.1 remains Draft,
track Inactive; tester selection and preview/confirmation remain incomplete.
Production is Inactive. Its page offers Create new release, while the dashboard
explicitly gates closed/open testing and production on initial app setup. A
visible creation button is not approval or proof of production eligibility.
The dashboard permits internal testing before those broader setup tasks finish.

The recorded publisher is an organization. The new-personal-account 12-tester /
14-day rule is not a universal requirement; see [Google's account-specific rule](https://support.google.com/googleplay/android-developer/answer/14151465).
Before release, recheck account-level verification and all track-specific gates;
no full account-verification attestation has been obtained. Complete the 11
listing/compliance tasks in the stage 2 runbook with owner-approved answers.

## App Links implementation contract

Only HTTPS web.tarkman.app reader paths should open the Android app. Keep the
existing tarkman scheme and scanner parser semantics. Do not deploy the candidate
association file in this directory: domain deployment needs separate approval.

| URL path / input | Intended behavior |
| --- | --- |
| /sessions/4006/parts | Reader list, cold and warm |
| /sessions/4006/part/2066 | Reader detail, cold and warm |
| /sessions/4006/explanations | Existing web redirect to reader; test redirect behavior separately |
| /s/4006/explain | Existing scanner input, not a new host-wide Android claim |
| /sessions/display | Browser |
| /sessions/status/display | Browser |
| /sessions/4006/display | Browser |
| /sessions/4006/status/display | Browser |
| /display-links/example | Browser |
| Invalid, zero, negative or unsafe integer IDs | Safe invalid-route behavior, no control privilege |
| Different host or HTTP | Not claimed by the HTTPS host filter; explicit app delivery rejected |
| Encoded separators, malformed IDs or extra part-path segments | Legacy OS glob may dispatch to the app; native reader validation rejects navigation |

Inspect the generated Android manifest, not only app.json. A broad /sessions
prefix or catch-all host is unacceptable. Android pathPattern uses simple glob
semantics, not JavaScript regular expressions; pathAdvancedPattern requires API
31 while the accepted artifact supports API 24. Before enabling filters, prove
positive matching and browser exclusions across the supported API range. Do not
assume [advanced patterns](https://developer.android.com/guide/topics/manifest/data-element)
work on older devices or rely on new server-side dynamic rules for old Android.

The candidate JSON uses the Console-provided Play signing SHA-256 recorded in
stage 2. Before deploying, inspect App integrity signing-key history and extract
the signer of a Play-delivered APK on each applicable API tier. Add any applicable
legacy Play signing certificate only after verifying it. The EAS upload certificate
is not a substitute. The JSON does not itself restrict paths; native filters must.

After authorized domain deployment and installation from Play, record:
HTTP 200 / application/json without redirects at /.well-known/assetlinks.json;
OS association state; actual cold/warm navigation; signed-out reader behavior;
invalid links; app-absent browser fallback; every browser-only route above.
For Android 12+ diagnostic commands on the selected QA device:

```sh
adb -s DEVICE shell pm verify-app-links --re-verify app.tarkman
adb -s DEVICE shell pm get-app-links app.tarkman
```

Record OS verification output and visible navigation separately. Neither a JSON
file nor an intent resolver result proves that the right screen opened.

## QA evidence matrix

Device inventory on September 28: adb devices -l returned no attached devices.
No device test was run. Supply a dedicated physical phone and tablet or record
unavailable coverage; preserve personal devices and data. Use a synthetic service
and minimum-privilege reviewer account, never a public worship session.

Every row needs exact build, device/model/API, date, result and evidence/defect link.
All rows below are NOT RUN, including physical 16 KB-page-size behavior.

| Area | Required coverage | Result |
| --- | --- | --- |
| Install/update | Play first install, cold launch, higher-code update, saved preferences/content | NOT RUN |
| Reading/layout | Today/services, QR/manual join, live/manual progression, repeated parts, detail/explanations, Armenian/fonts/languages, text/theme, phone/tablet portrait/landscape | NOT RUN |
| Lifecycle | Background/foreground, process death, network loss/recovery, expired auth, ending/rollover, stale data, single subscription/no command replay | NOT RUN |
| Persistence | SecureStore restoration/sign-out, airplane-mode saved-service cold start explicitly non-live, selected-release library behavior | NOT RUN |
| Management | Owner-only/denied/stale/conflicting controls, presence, display-link CRUD/share, cancellation, native display surfaces | NOT RUN |
| Native | Scanner cleanup, denied/revoked permissions, approximate foreground location, Back/modal/keyboard order, safe area/edge-to-edge | NOT RUN |
| Accessibility | TalkBack focus/names, large text, targets/contrast, reduced motion, unclipped Armenian | NOT RUN |
| Compatibility | Small/large phone/tablet, minimum/current API, physical device and 16 KB page-size coverage | NOT RUN |
| Release operations | Pre-launch report, crashes/ANRs, production endpoints, actual permissions, Sentry tags/maps/symbols, runtime/channel safety | NOT RUN |

## Listing and disclosure preparation

Draft short description for owner review: Follow Armenian church services with live readings and explanations.
Draft long-description outline: discover/join a service; read supported languages;
follow live progression or browse; retain saved reading content for offline use.
Validate every claim against the selected binary before supplying final copy.
Capture Android phone/tablet screenshots from the approved synthetic service;
no screenshots or final artwork have been produced for this release.

Owner decisions pending: approved copy, support/privacy URLs, category, audience,
content rating, ads, government/financial/health declarations and reviewer access.
Data safety requires a source/runtime inventory of authentication, API payloads,
Sentry and SDK behavior, camera and location; do not infer answers from iOS or
claim no collection without evidence. Verify any applicable account-deletion
behavior and public support route. Keep credentials out of this packet.

## Go/no-go record (incomplete)

- Exact release SHA/build/versionCode and artifact hash: pending.
- Device, Play update and App Links evidence: pending.
- Account eligibility, approved listing/disclosures and pre-launch triage: pending.
- Open defects and owner-accepted nonblockers: pending QA.
- Support/monitoring owner and forward-fix procedure: owner confirmation pending.
- Exact countries/audience/timing and explicit production approval: not granted.
- Review outcome, public listing/install/launch and public version: not performed.

A lower-versionCode binary is not an ordinary Play rollback. Prepare a tested
higher-versionCode hotfix and use only release controls the Console actually offers.
Keep #193 open through verified public availability unless the owner changes scope.

## Reader App Links implementation (review pending)

Android config now requests verification only for HTTPS web.tarkman.app reader
list/detail paths. API-24-compatible simple globs exclude the known display/status
routes in the matrix above. These globs cannot validate numeric IDs and the detail
glob can dispatch a malformed suffix; +native-intent rejects these URLs before
navigation. It preserves existing custom schemes, occurrence/context parameters
and iOS handling. Invalid Android web intents return to Today; they do not acquire
reader or management access. Scanner parsing and web redirects are unchanged.

Local validation: generated prebuild manifest contains only the three expected
reader patterns and retains tarkman. The installed Android API 35 framework's
simple-glob method passed a 12-case reader/display matrix on the host JVM. This is
algorithm validation, not minimum-API/device association evidence. Jest covers
valid/invalid URL routing, unsafe IDs, query overrides and preserved contexts.

No assetlinks file has been deployed and no Play-installed association verified.
Before building this native change, select a new app version/runtime and exact
source SHA; the current 0.1.1 accepted artifact does not contain these filters.

## Domain association proposal (September 29)

Play Console's App signing page now shows two classical SHA-256 fingerprints:
the current key `1F:64:9E:59:72:81:85:07:1A:7D:E1:33:DD:A9:AD:D5:19:52:07:4E:97:7D:A6:D1:83:36:45:68:BF:A3:FC:30`
and the previous key `1D:24:05:04:F7:93:87:6D:5D:53:8A:7A:C0:EF:38:13:7B:F6:55:7A:8B:27:BD:9F:E4:1D:0A:0E:B6:38:2C:23`.
The latter is the key in Play Console's generated Digital Asset Links snippet;
neither is the EAS upload-key fingerprint. The proposed
`public/.well-known/assetlinks.json` includes both because Play retains both
signing keys. The current production URL returns `200 text/html` from the SPA
fallback, which does not establish Android App Links.

After deployment, verify the URL returns `200 application/json` without a
redirect and that its JSON matches both Console fingerprints. Only a
Play-installed app on a device can confirm OS verification and reader routing;
the static-file and export checks alone cannot establish that behavior.
