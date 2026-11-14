# Isolated opening-only Siri prototype

**Timeboxed disposition: [finished NO-GO report](<NO-GO.md>).** The reproduction
sources below are research artifacts, not production integration or a verified
Shortcut/Siri feature. Positive entry/cold-warm/safety acceptance remains
unfulfilled. All phone work is held; these commands are not authorization to
resume it or extend the spike indefinitely.

This directory is an inert overlay, **not** part of the normal mobile app or its
native dependency graph. Expo autolinks installed native dependencies even when
a config plugin/JS handler is disabled; an environment flag alone is not isolation.
Do not install `expo-app-intents` in the normal mobile manifest.

## Prepare external copies

From the repository root, choose two **new absolute directories outside the
repository**, with existing, real (non-symlink) parent directories. On macOS use
`/private/tmp`, not the `/tmp` symlink. Example:

```sh
node spikes/siri-shortcuts/prepare.mjs --baseline /private/tmp/tarkman-siri-before-275
node spikes/siri-shortcuts/prepare.mjs /private/tmp/tarkman-siri-after-275
```

The script exports only `apps/mobile`, `packages`, `tools/metro` (the real shared
Jest/Metro resolvers), and root `vercel.json` (universal-links test fixture) from
immutable base commit
`d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`, then runs `npm ci` in the copied
mobile app. The prototype additionally overlays Swift, its JS opening handler,
and tests, patches the root layout exactly once, and runs
`npm install --save-exact expo-app-intents@0.5.17` **only in that copy**.
No existing destination is reused/overwritten/deleted; failed partial outputs are
left for inspection. No signing, build, prebuild, device, EAS or GitHub commands
are run by preparation. No credentials or local native output are copied.

Both copies **unconditionally** use name `Tarkman Siri Spike`, bundle ID
`app.tarkman.sirispike`, slug/scheme `tarkman-siri-spike`, no universal-link
association, no production EAS project, and disabled updates without the production
update URL. Missing environment variables cannot select the production identity.
Do not provision a production EAS project for either copy.

`--baseline` is the genuine Before app: no intent dependency/plugin/watched Swift
directory, no handler import/mount, and no prototype tests or native declarations.
The two copies intentionally use the same isolated identity for controlled
before/after captures; they cannot coexist as separate installed apps. Existing
spike app data can survive replacement: record install/reset state.
Neither copy uses production app storage because its bundle ID differs.

## Native verification (manual, after preparation)

Run mobile commands only from the selected copy's `apps/mobile` directory. No
`TARKMAN_SIRI_SPIKE` flag is needed; both configs are always isolated.

```sh
export SENTRY_DISABLE_AUTO_UPLOAD=true
export EXPO_PUBLIC_LIBRARY_ENABLED=1 EXPO_PUBLIC_API_URL=https://www.tarkman.app
npx expo config --type public
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -list -workspace ios/TarkmanSiriSpike.xcworkspace
# Use a team authorized for the generated app.tarkman.sirispike bundle ID:
xcodebuild -workspace ios/TarkmanSiriSpike.xcworkspace -scheme TarkmanSiriSpike \
  -configuration Release -destination 'generic/platform=iOS' -jobs 2 \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=FHF872BAQR build
```

Signing and physical cold/warm/error verification require an authorized developer
account and device. Inspect the resolved isolated identity before building; never
reuse a provisioning profile restricted to production `app.tarkman`. Preparation
does not perform these operations or install/reset either app.
The prototype is opening-only: no entities, indexing, donations, playback, or
service control. Native dispatch queues a request, not a claim that content loaded.

## Checks (no dependency installation)

```sh
node --test spikes/siri-shortcuts/prepare.test.mjs spikes/siri-shortcuts/native-validation.test.mjs
```

These tests export disposable pinned copies without npm/network work and verify
unconditional isolated configuration, baseline absence of native/JS integration,
path rejection and unchanged production source bytes. Test copies remain in the
OS temporary directory for inspection. After preparation, the prototype copy can
run its existing tests using `npx jest tests/siri-opening.test.ts tests/siri-handler.test.tsx tests/siri-diagnostics.test.ts --runInBand`.
For the full suite, unset build-only `EXPO_PUBLIC_LIBRARY_ENABLED`,
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_LIBRARY_API_URL`,
`EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY`, and `EXPO_PUBLIC_LIBRARY_FIXTURE_BUILD`
in the test shell: configuration-contract tests intentionally exercise absent
flags. Set the public Library flags again only for native bundling/device use.
The native classifier test compiles actual Swift helper/validator source and
never calls persistence functions or changes host UserDefaults; it requires
macOS/Xcode and is explicitly skipped elsewhere.

## Failed voice result and prepared diagnostic comparison

The first reported owner voice attempt **failed after Siri prompted for
Liturgy ID and the owner answered “1.”** An ordinary URL opening the reader is
not evidence that this voice action succeeded. Preserve that failure and its
[provenance](<evidence/voice-attempt-1.json>) even if a later typed/Shortcut path works.

Subsequent **cold native String1 execution and reader display were observed**:
exact-one input/dispatch and JS receipt/route/ack share one UUID, persisted
pending queue is empty afterward, and the reader is visible. The requested
scenario was typed Shortcuts, but the later Executor user-role completion
message has no retained sender/channel/exact time and does not identify the
entry. Earlier owner-operated/typed-entry claims were contextual inferences,
now withdrawn; the automated orchestration acknowledgment is not testimony.
See [qualified provenance](<evidence/typed-1-comparison.json>),
[unchanged phase events](<evidence/typed-1-phase-events.json>) and the
[bounded remaining matrix/go-no-go](<verification-matrix.md>). No end-to-end
Shortcuts/Siri, warm/repeat/error, actual offline or revocation pass is claimed;
no rerun or owner prompt is requested to repair provenance.

The diagnostic overlay preserves the existing String input and canonical-ID
validation. It keeps at most 32 local phase events in the isolated app's standard
UserDefaults key `app.tarkman.sirispike.diagnostics.events`: fixed stage,
timestamp, own bundle/process context, optional invocation UUID, and only input
classification/UTF8 byte count—not raw speech, reading content or URLs. Native
and JS writes serialize on the main actor within the process. Diagnostics are
best-effort, never awaited by the navigation/acknowledgment consumer, and cannot
fail the action. No synchronization, cross-process durability guarantee,
indexing or external logging is added.

After an independently verified signed diagnostic build is installed in a
coordinated phone slot, compare a Shortcuts **Open Liturgy** action from
**Tarkman Siri Spike** with a typed literal Liturgy ID `1` against the failed
spoken-parameter path. Do not repeat the same voice step without a concrete
correction or this prepared phase comparison. Inspect native perform/validation,
dispatch-returned UUID, module/readiness, queue receipt, route acceptance and ack
markers. Accepted route/ack is not proof that reader content loaded; inspect the
actual reader too. Native dispatch-returned can appear after JS receipt because
of actor scheduling. Absent markers alone do not prove a speech conversion bug.

Copy only the isolated app's preferences for diagnosis, and never publish the
whole plist or unrelated phone screens:

```sh
xcrun devicectl device copy from --device DEVICE_UDID \
  --domain-type appDataContainer --domain-identifier app.tarkman.sirispike \
  --source Library/Preferences/app.tarkman.sirispike.plist \
  --destination /private/tmp/siri-spike-preferences.plist
```

The optional live-service tab may show an ActionCable configuration notice in
this Library-only build. Do not change production settings or treat that notice
as the outcome of an intent; the public Library reader is separately configured.
