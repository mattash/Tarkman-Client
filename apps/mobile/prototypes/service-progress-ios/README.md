# Standalone iOS service-progress experiment (#277 / PR282 continuation)

Default mode is synthetic public **service 42 only**. A separately gated [selected-service development caller](<REMOTE-EXPERIMENT.md>) now wires explicit public selection and native token registration/removal, but ships off with no endpoint or APNs entitlement. This is not production integration, verified push delivery, an Android decision, or a production 60-second SLO. #277 live delivery remains incomplete until end-to-end measurements exist.

## Isolation and behavior

- Native SwiftUI app `app.tarkman.progressprototype`; embedded WidgetKit extension `app.tarkman.progressprototype.LiveActivity`. iOS deployment target 16.4.
- No production targets/schemes, Expo/EAS/update configuration, associated domains, credentials, shared keychain or App Groups are changed. Default builds have no APNs entitlement/configured endpoint and construct no remote driver/Keychain journal. In default local mode the only outgoing action is tapping the public read-only HTTPS URL `https://web.tarkman.app/sessions/42/parts`; iOS chooses its HTTPS handler. Explicit development configuration is a separate opt-in seam, not activation or live-delivery proof.
- Disclosure toggle is OFF on every launch, explicitly scoped to this synthetic service. It uses a native button-style Toggle with visible OFF/ON state and explicit Allow/Revoke public-disclosure labels (not a hidden consent or launch-argument bypass). Start is disabled until enabled. Disabling ends/removes activities. Relaunch removes prior prototype activities rather than silently restoring consent.
- Versioned v1 local publications use immutable service + fresh follow-generation attributes, separately increasing delivery sequence, coherent synthetic occurrences 11/12/13 with backend Priest/Choir/People roles, and ordinal out of 3. Advance stops at the last occurrence without inferring completion. Additional local controls exercise unknown totals, a coherent empty manifest and a cleared deleted terminal state; no real backend state is inferred.
- Foreground Start requests `ActivityContent` with `staleDate = now + 60s`, `pushType: nil`. Advance and pause/resume are foreground-only local updates with a fresh 60s staleDate. Pause is a displayed state, not a background refresh mechanism. End requests immediate dismissal.
- Lock Screen and expanded Island label ordinal/role as **Last reported part**, with last-update time, never an unqualified current/live assertion. The final simulator run retained the last-reported snapshot75s after process termination, including an immediate surface reopen. A later observation showed the genuine stale branch without app relaunch; therefore a60s automatic redraw or redraw-on-reopen is not promised. **Every** Island layout and Lock Screen branches on `context.isStale`, hiding ordinal/role when stale. The minimal Island uses a stale clock icon. No timer/background mode or push token exists in the default local fixture. iOS schedules stale rendering; staleDate does not end/remove an activity and is not a guaranteed wall-clock refresh deadline.
- English/Russian native localization is included. No system locale/settings are changed by the harness.

## Reproduce unsigned build

Use existing CocoaPods gem, **do not install anything**:

```sh
cd apps/mobile/prototypes/service-progress-ios
GEM_HOME=/opt/homebrew/Cellar/cocoapods/1.17.0/libexec \
  /opt/homebrew/opt/ruby/bin/ruby generate.rb
xcodebuild -project ServiceProgressPrototype.xcodeproj \
  -scheme ServiceProgressPrototype -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=BA0449F1-92EC-4D80-A869-4E183F56BEC4' \
  -derivedDataPath .derivedData CODE_SIGNING_ALLOWED=NO build
```

Generated project/schemes, private derived data, build log and local capture artifacts are ignored; source generates the project without xcodegen. No team or signing credentials needed. Validated tools: Xcode 27.2 / SDK 27.2, existing xcodeproj gem 1.28.1.

## Run only on an owned NEW simulator

This run created **ServiceProgress3429**, UUID `BA0449F1-92EC-4D80-A869-4E183F56BEC4`, iPhone 18 Pro / iOS 27.0. Never substitute `booted` (another shared simulator may be booted), a shared UUID, or a physical device. On a different machine create a new named simulator and substitute its returned UUID in every command and build destination:

```sh
xcrun simctl create ServiceProgress3429 \
  com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-27-0
xcrun simctl boot BA0449F1-92EC-4D80-A869-4E183F56BEC4
xcrun simctl bootstatus BA0449F1-92EC-4D80-A869-4E183F56BEC4 -b
open -a Simulator --args -CurrentDeviceUDID BA0449F1-92EC-4D80-A869-4E183F56BEC4
xcrun simctl install BA0449F1-92EC-4D80-A869-4E183F56BEC4 \
  .derivedData/Build/Products/Debug-iphonesimulator/ServiceProgressPrototype.app
xcrun simctl launch BA0449F1-92EC-4D80-A869-4E183F56BEC4 app.tarkman.progressprototype
```

Observe OFF before opting in; enable disclosure, Start; use Simulator Home/Lock on **that window only**, capture fresh then >60s stale. Terminate using `xcrun simctl terminate <owned UUID> app.tarkman.progressprototype` after backgrounding, not another app. Capture with `xcrun simctl io <owned UUID> screenshot artifacts/<name>.png`. Relaunch removes prior activities and resets disclosure. Simulator termination is not proof of physical-device force-quit behavior. No physical phone, shared sim, production settings/data or credentials are part of this test.

## Compiled synthetic wire golden (no push activation)

`ServiceAttributes.ContentState` aliases the Foundation-only `ServiceContentState`
compiled into both app and extension. This extraction preserves the existing native
payload and rendering. Run its golden without a phone, server or APNs credentials:

```sh
mkdir -p artifacts
swiftc Shared/ServiceContentState.swift Tests/ContentStateGolden.swift \
  -o artifacts/content-state-golden
artifacts/content-state-golden Tests/Fixtures/synthetic-update.json
```

The fixture is a synthetic ActivityKit **update envelope**, not a registration
request, Expo `props` wrapper or the TypeScript publication model. APNs `timestamp`
and `stale-date` are Unix seconds; native `updatedAt` uses default Codable Date
encoding, seconds since **2001-01-01**. The test decodes with the exact native state
type, compares compiled encoding against the fixture and checks payload size.
A fake provider can consume this fixture; it does not exercise actual APNs.

This existing five-field state is **synthetic-only**: fixed three-part totals and
localization-key roles cannot represent arbitrary manifests, unknown totals or all
terminal states. Backend [#552](https://github.com/mattash/Tarkman/issues/552)
and client #277 must agree a versioned real-service contract before connecting a
native adapter. No token observation, registration endpoint, provider credentials,
push entitlement or `pushType: .token` is enabled by this golden. The harness still
requests `pushType: nil`; no remote delivery is claimed.

The separately compiled [versioned v1 contract and goldens](<PUBLICATION-V1.md>)
pin the real-service wire fields and immutable follow generation. This harness
now requests/renders that type using validated local fixtures and `pushType: nil`.
The document records semantic/foreground ordering tests and default-disabled
registration/token bridge preparation; real HTTP/APNs activation remains off.

## Evidence limits

A pre-opt-in screenshot of this revision is a **same-revision before/after**, not an actual previous-source baseline. The existing shared simulator installation `app.tarkman0.2.7` reportedly lacks Activities/extension, but its exact installed revision is unknown; it was not altered or used as a source baseline. Simulator evidence cannot establish APNs delivery, server latency, production background correctness, device power behavior, Android feasibility or production readiness. Dynamic Island expanded/minimal code compilation is not by itself visual evidence of every system presentation.

Original checkpoint observations are recorded in [EVIDENCE](<EVIDENCE.md>).
The continuation's [matched actual v1 Before/After and terminated stale evidence](<../../../../docs/service-progress-v1-evidence/README.md>)
identifies both native source revisions, scenario and measured redraw limitation.

## Private physical metadata observer (not visual acceptance)

Use a coordinated physical-device slot, never run the simulator capture suite on
the shared phone. `PhysicalObservationTests` operates only the isolated synthetic
app's visible consent/Start controls, then Home/Notification Center. It never taps
system permission buttons, dumps a UI tree or explicitly attaches screenshots.
It records only synthetic request metadata and fixed label-presence booleans at
background/termination/75s/180s; inaccessible labels or missing permission are
inconclusive, not proof of displayed freshness. Cleanup relaunches only this
prototype to remove its Activities. XCTest termination is not user force-quit/OS
eviction; Notification Center is not a physical lock demonstration.

Prepare a separate manifest **after** signed `build-for-testing`. The script
preserves `__TESTROOT__` resolution by requiring the output beside the input and
refuses overwrite/other app targets. Use a new manifest/result name per run:

```sh
python3 -m unittest discover -s Tests -p 'test_private_observer.py'
python3 prepare-private-observer.py \
  .deviceDerivedData/Build/Products/ServiceProgressPrototype_iphoneos27.2-arm64.xctestrun \
  .deviceDerivedData/Build/Products/PrivateObserver-01.xctestrun
umask 077
mkdir -p artifacts/private-observation
chmod 700 artifacts/private-observation
xcodebuild test-without-building \
  -xctestrun .deviceDerivedData/Build/Products/PrivateObserver-01.xctestrun \
  -destination 'platform=iOS,id=<coordinated-physical-UDID>' \
  -only-testing:ServiceProgressUITests/PhysicalObservationTests/testSyntheticTerminatedObservation \
  -parallel-testing-enabled NO -collect-test-diagnostics never \
  -resultBundlePath artifacts/private-observation/Observation-01.xcresult \
  > artifacts/private-observation/Observation-01.log 2>&1
```

The original generated manifest defaults to **screen recording** and
`deleteOnSuccess`. The private copy instead sets `PreferredScreenCaptureFormat`
to `screenshots`, both attachment lifetimes to `keepNever`, and selects only the
metadata observer. These are **retention controls**, not a promise that XCTest
never transiently acquires system pixels or logs accessibility details. Disable
verbose diagnostics as shown, and keep **all raw results/logs/build artifacts
private and local**; never upload them to GitHub or feed them into code-review
context. Export only independently inspected, allowlisted synthetic facts. No
physical observation has been completed merely by preparing this runner.

## Native UI-test capture without a Simulator GUI

The optional XCTest UI target is guarded to skip on physical devices: its full-screen Notification Center captures and broad system permission queries are appropriate only on an owned synthetic simulator, not the shared owner's phone. A signed physical build-for-testing alone does not make this capture suite safe for physical acceptance.

On the owned simulator it taps the real disclosure toggle and Start button (no launch-argument consent bypass), backgrounds using Home, opens the system Notification Center/Lock Screen surface, deliberately terminates the app using XCTest, and captures again after 75 seconds without relaunch. Its image attachments require visual inspection: a passing interaction test alone does not establish that every system surface rendered correctly.

```sh
xcodebuild -project ServiceProgressPrototype.xcodeproj \
  -scheme ServiceProgressPrototype -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=BA0449F1-92EC-4D80-A869-4E183F56BEC4' \
  -derivedDataPath .derivedData -resultBundlePath artifacts/NativeUITests.xcresult \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
xcrun xcresulttool export attachments --path artifacts/NativeUITests.xcresult \
  --output-path artifacts/attachments
```

The result path must be new for each run. This machine's Xcode installation does not expose a discoverable Simulator.app at the traditional path; `open -a Simulator` failed. `simctl` and XCTest avoid altering the shared desktop Simulator selection. If no GUI is installed, skip the optional `open` command above; this is not a blocker to `simctl install/launch/screenshot`.
