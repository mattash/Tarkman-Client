# Standalone iOS service-progress experiment (#277 / PR281)

Synthetic public **service 42 only**. This is not production integration, push delivery, an Android decision, or a production 60-second SLO. #277 live delivery remains incomplete until end-to-end measurements exist.

## Isolation and behavior

- Native SwiftUI app `app.tarkman.progressprototype`; embedded WidgetKit extension `app.tarkman.progressprototype.LiveActivity`. iOS deployment target 16.4.
- No production targets/schemes, Expo/EAS/update configuration, associated domains, credentials, APNs entitlement, shared keychain, App Groups, or networking client. The only outgoing action is the user tapping the public read-only HTTPS URL `https://web.tarkman.app/sessions/42/parts`; this prototype has no universal-link entitlement, and iOS chooses the HTTPS handler (normally the browser on the clean owned simulator).
- Disclosure toggle is OFF on every launch, explicitly scoped to this synthetic service. It uses a native button-style Toggle with visible OFF/ON state and explicit Allow/Revoke public-disclosure labels (not a hidden consent or launch-argument bypass). Start is disabled until enabled. Disabling ends/removes activities. Relaunch removes prior prototype activities rather than silently restoring consent.
- Fixed immutable synthetic occurrences 11/12/13 carry Reader/Choir/Reader roles, with ordinal out of 3. Advance stops at the last occurrence without inferring completion.
- Foreground Start requests `ActivityContent` with `staleDate = now + 60s`, `pushType: nil`. Advance and pause/resume are foreground-only local updates with a fresh 60s staleDate. Pause is a displayed state, not a background refresh mechanism. End requests immediate dismissal.
- Lock Screen and expanded Island label ordinal/role as **Last reported part**, with last-update time, never an unqualified current/live assertion. The final simulator run retained the last-reported snapshot75s after process termination, including an immediate surface reopen. A later observation showed the genuine stale branch without app relaunch; therefore a60s automatic redraw or redraw-on-reopen is not promised. **Every** Island layout and Lock Screen branches on `context.isStale`, hiding ordinal/role when stale. The minimal Island uses a stale clock icon. No timer, background mode or push token exists. iOS schedules stale rendering; staleDate does not end/remove an activity and is not a guaranteed wall-clock refresh deadline.
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

## Evidence limits

A pre-opt-in screenshot of this revision is a **same-revision before/after**, not an actual previous-source baseline. The existing shared simulator installation `app.tarkman0.2.7` reportedly lacks Activities/extension, but its exact installed revision is unknown; it was not altered or used as a source baseline. Simulator evidence cannot establish APNs delivery, server latency, production background correctness, device power behavior, Android feasibility or production readiness. Dynamic Island expanded/minimal code compilation is not by itself visual evidence of every system presentation.

Actual run observations and capture inventory are recorded in [EVIDENCE](<EVIDENCE.md>).

## Native UI-test capture without a Simulator GUI

The optional XCTest UI target taps the real disclosure toggle and Start button (no launch-argument consent bypass), backgrounds using Home, opens the system Notification Center/Lock Screen surface, deliberately terminates the app using XCTest, and captures again after 75 seconds without relaunch. Its image attachments require visual inspection: a passing interaction test alone does not establish that every system surface rendered correctly.

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
