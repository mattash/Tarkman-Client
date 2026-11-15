# Service Progress isolated device build generation (not activation)

This source checkpoint prepares the first isolated feasibility build, **not full
#277 acceptance**. Read the [held acceptance plan](<service-progress-live-acceptance-plan.md>).
Signing, provisioning, device builds/installation, APNs, operator settings and real
resource inspection remain HELD. No resources were inspected or assumed absent.
Backend default factory remains fake; this configuration does not change it.

## Explicit inputs

[Expo configuration](<../apps/mobile/app.config.js>) accepts literal `0` / `1` flags:

| Input | Contract |
| --- | --- |
| `TARKMAN_SERVICE_PROGRESS_PRODUCT=1` | Existing isolated iOS graph only; default/unset `0` preserves the ordinary config object without loading the plugin. |
| `TARKMAN_SERVICE_PROGRESS_DEVICE_BUILD=1` | New, independent generation opt-in; requires product `1` and Simulator `0`. Default `0` preserves unsigned QA. |
| `SERVICE_PROGRESS_DEVELOPMENT_ORIGIN` | Explicit canonical bare HTTPS backend origin. |
| `SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN` | Explicit canonical bare HTTPS reader origin. |
| `SERVICE_PROGRESS_DEVELOPMENT_TEAM` | Explicit 10-character uppercase alphanumeric Team ID input; no discovery. |
| `SERVICE_PROGRESS_HOST_PROFILE` | Explicit host development profile UUID. |
| `SERVICE_PROGRESS_EXTENSION_PROFILE` | Explicit, different extension development profile UUID. |

Inputs may be synthetic for generation/tests. UUID shape and a team-shaped string
**do not prove authorization, profile contents, certificate availability or device
inclusion**. No identity/profile/certificate query, download or signing occurs in
configuration code. Do not supply secrets or treat this as an operator setup request.
The fixed signing class is `Apple Development`; selection of an actual identity is
not performed here.

For example, this command evaluates configuration only using deliberately synthetic
values, from `apps/mobile` (not a signing/build command):

```sh
TARKMAN_SERVICE_PROGRESS_PRODUCT=1 \
TARKMAN_SERVICE_PROGRESS_DEVICE_BUILD=1 \
SERVICE_PROGRESS_DEVELOPMENT_ORIGIN=https://backend.example.invalid \
SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN=https://reader.example.invalid \
SERVICE_PROGRESS_DEVELOPMENT_TEAM=SYNTH12345 \
SERVICE_PROGRESS_HOST_PROFILE=11111111-1111-1111-1111-111111111111 \
SERVICE_PROGRESS_EXTENSION_PROFILE=22222222-2222-2222-2222-222222222222 \
npx expo config --type prebuild
```

No EAS configuration, provisioning updates, archive, codesign or phone command is
part of this checkpoint. Reapplying the plugin to the same generated project is
supported for device → unsigned and device → Simulator transitions, including after
serialization/parsing. A versioned ownership record in generated PBXProject
attributes retains original values only for the signing keys, host Push capability
and embed attributes overridden by device mode. Cleanup restores those values (or
removes originally absent keys) only while they still match the plugin-applied
value; later edits from other owners and unrelated capabilities/settings/profiles
are preserved. Embed `CodeSignOnCopy` membership added by the plugin is removed
independently so a later unrelated embed attribute does not retain device signing. Empty capability containers created by the plugin are pruned, and
the ownership record is removed. Widget unsigned signing `NO` and the selected
mode's generated guard are then reapplied. Generated entitlement files from a
previous device pass are neutralized to empty plists; unrelated host entitlement
files are never rewritten. A legacy device graph lacking ownership metadata fails
closed and requires clean regeneration rather than guessing original settings.

## Generated contract

The [plugin](<../apps/mobile/plugins/with-service-progress.js>) keeps fixed host
`app.tarkman.progressprototype`, extension
`app.tarkman.progressprototype.LiveActivity`, scheme `tarkman-progress-dev`, iOS 16.4.
The APNs topic is **`app.tarkman.progressprototype.push-type.liveactivity`**, derived
from the host, never the extension. Production associations, EAS project metadata
and OTA updates remain excluded. Host `NSSupportsLiveActivities` remains true.

Device generation copies the existing standalone
[development entitlement template](<../apps/mobile/prototypes/service-progress-ios/App/RemoteExperiment.entitlements>)
into `ServiceProgressGenerated/App/RemoteExperiment.entitlements`, validates it is
exactly `aps-environment=development`, and assigns that file to host signing.
The host gets the Xcode Push Notifications capability. Extension signing uses its
own generated empty entitlement plist (no push entitlement or speculative App Group)
and distinct profile. Both targets use the explicit team, Manual signing,
`Apple Development`, signing allowed/required and `iphoneos` supported platform.
The widget is embedded in destination 13 with `CodeSignOnCopy` and
`RemoveHeadersOnCopy`, preserving the host dependency. Widget Info.plist is still
parsed from the existing source, with matching host version/build and no Simulator
handoff/HTTP flags. App-only HTTP/Keychain sources never enter the widget target.

## Actual configuration/SDK boundary

Expo configuration evaluation cannot know which configuration/SDK a later Xcode
invocation selects. Therefore **both generated targets have a first, always-run
shell build phase** with the selected mode sealed into its source:

- Device generation allows **Debug + iphoneos only**; Release, custom configurations
  and Simulator fail before source compilation. This is not a Release recipe.
- Simulator fixture/HTTP generation allows **Debug + iphonesimulator only**; device
  and Release fail. Changing an environment/build-setting mode does not bypass it.
- Existing unsigned non-fixture QA has no new SDK/configuration restriction and the
  extension remains `CODE_SIGNING_ALLOWED=NO`.

Device generation also rejects mixed Simulator fixture/API/HTTP inputs at config
and plugin evaluation. These are generated-project invariants, not a guarantee
against manually editing the generated project or overriding other Xcode settings.
They do not verify an actually signed artifact; that remains a later held gate.

## Separate Simulator HTTP opt-in

`TARKMAN_SERVICE_PROGRESS_SIMULATOR_HTTP=1` additionally requires both
`TARKMAN_SERVICE_PROGRESS_PRODUCT=1` and
`TARKMAN_SERVICE_PROGRESS_SIMULATOR=1`, plus existing strict
`SERVICE_PROGRESS_SIMULATOR_API_ORIGIN=http://127.0.0.1:<port>` (1–65535; no path,
credentials, alternate loopback form or leading-zero port). It emits exactly host
Info.plist `ServiceProgressSimulatorHTTP=true` and
`extra.serviceProgressSimulatorHTTP=true`; no widget HTTP key is generated.
Without HTTP opt-in, the existing in-memory fixture stays unchanged.

For source generation, set those three flags and the explicit loopback variable;
leave device mode `0`. Generated backend/reader configuration origins remain sealed
to `https://backend.service-progress.invalid` and
`https://reader.service-progress.invalid`; nonmatching origin inputs fail. In the
explicit native HTTP fixture, the actual operation origin, journal record origin,
configured revocation origin and HTTP drivers all bind to the **same exact selected
`http://127.0.0.1:<port>` endpoint**. The reserved backend configuration value does
not become a different journal origin. The reader origin remains reserved HTTPS.
Journal loopback admission is constructor-explicit and gated to Debug Simulator QA
(or the narrowly scoped macOS test compilation); ordinary journal behavior remains
HTTPS-only. The harness uses in-memory recovery and synthetic tokens/no APNs. This
is not HTTPS, durable Keychain, ActivityKit token issuance or signed-device evidence.

## Unsigned checks and remaining scope

From `apps/mobile`:

```sh
node --test tests/service-progress-config.test.mjs
```

The [tests](<../apps/mobile/tests/service-progress-config.test.mjs>) check the actual
node-xcode generated targets, all configuration signing settings, independent
profiles/entitlements, embed/dependency and source boundaries, generated widget
plist and development entitlement template, serialization/parse idempotence,
same-project device → unsigned/Simulator/HTTP cleanup with both absent and
pre-existing settings/capabilities, preservation of later external edits,
fail-closed mixed inputs, and execute only generated boundary scripts under
synthetic configuration/SDK variables. They never invoke xcodebuild or codesign.

Production identity, Universal Links, OTA/native runtime compatibility, separate
production Keychain namespace, sustained provider policy, resource authorization,
physical lifecycle, freshness/redraw and product acceptance remain future work.
