# Native evidence — service-progress experiment

## Environment and isolation

2026-11-14; Xcode27.2 / SDK27.2; NEW **ServiceProgress3429**, UUID `BA0449F1-92EC-4D80-A869-4E183F56BEC4`, iPhone18Pro / iOS27.0, 1206×2622 portrait, default light appearance/wallpaper. Only this prototype directory and owned simulator were modified by this implementation agent. No shared simulator, physical device, production data/settings, credentials, GitHub action or commit.

Source generates only isolated `app.tarkman.progressprototype` and `app.tarkman.progressprototype.LiveActivity` native targets (plus optional isolated UI-test runner). Main app and widget minimum OS16.4. Actual16.4 runtime was unavailable; runtime evidence is27.0. Xcode27's XCTest libraries emit minimum17 linker warnings for the optional test runner; app/widget build succeeds at16.4.

## Build and metadata results

- Existing CocoaPods xcodeproj gem used without install; generator and `ruby -c` succeed.
- Exact unsigned build/test reproduction commands: [README](README.md).
- `xcodebuild … -sdk iphonesimulator -destination 'platform=iOS Simulator,id=BA0449F1-92EC-4D80-A869-4E183F56BEC4' -derivedDataPath .derivedData CODE_SIGNING_ALLOWED=NO build`: **exit0**, app + embedded ActivityKit extension built and validated. No team/credentials required.
- Built plists inspected: actual Boolean `NSSupportsLiveActivities = true`, correct isolated identifiers, WidgetKit extension point, minimum16.4. `plutil -lint` widget plist and both native locale strings: OK.
- Build project, both private derived-data directories, logs and local artifacts are ignored. `git check-ignore` confirms this. No production native targets/configuration or entitlements were introduced.

## Genuine native capture status

The final visible consent flow is a native button-style Toggle with explicit per-service public Lock Screen **OFF/ON** state and **Allow/Revoke** labels. Start remains separate and gated. XCTest locates the unique consent accessibility identifier independent of its native AX role (Switch even with button styling), taps it and verifies visible ON state before Start.

`artifacts/NativeFinalUITests.xcresult` / `artifacts/ui-final-test.log`: **exit0**. Genuine consent + ActivityKit request succeeded; requested-state status confirmed. `artifacts/11-system-after-termination.png` was visually inspected and shows a native card with SYNTHETIC PUBLIC SERVICE42, Part1/3 Reader, lastupdated11:11AM and public read-only link **after deliberate app termination**, but also the first-use iOS **Allow Live Activities** prompt. This is preliminary active evidence, not clean expiry evidence.

The authorized capture run handles the system **Allow** button only on the owned simulator and only after explicit in-app per-service disclosure consent. It does not silently change production settings or bypass consent. `artifacts/NativeAuthorizedUITests.xcresult` completed **exit0**: clean fresh card and post-termination card were visually confirmed, but the continuously displayed capture75s after termination **still showed ordinal/role**. Thus an exact60s automatic redraw is **not validated**.

A genuine system-surface close/reopen **without app relaunch** subsequently rendered the native stale branch: `artifacts/attachments-background/6DD56825-A93C-4250-A333-D4E511E7636C.png` (11:19, lastupdated11:15) visibly says **Stale — open public parts**, with ordinal/role hidden. This is real stale-on-redraw evidence, not a forced stale flag. It does not establish when the stale flag first became available or a60s rendering deadline. The independent background-only run also completed exit0, but encountered a second iOS **Always Allow** prompt; its75s images are not clean background-expiry evidence.

These measured images use the pre-diagnostic source hashes in ignored `artifacts/pre-diagnostic-source-sha256.txt`. Final source now labels fresh content **Last reported part** rather than an unqualified current-part claim, exposes the actual returned `activity.content.staleDate` / `activityState` through local accessibility diagnostics, and handles **Allow / Always Allow** in the owned-simulator test. A final capture of that safer revision is pending; it must be inspected before claiming its visual acceptance.

Current source SHA256 inventory: ignored `artifacts/source-sha256.txt`. Parent may preserve these hashes with chosen evidence; no commit hash is invented for uncommitted source.

## Evidence boundaries

- Pre-opt-in captures are **same-revision before/after**, not a previous-source baseline. The shared installed `app.tarkman0.2.7` has unknown exact revision and was not used or altered. Parent separately owns original-source baseline captures.
- The system presentation reached by a top-edge gesture is **Notification Center / Lock Screen-style Activity surface**, not proof of locking a physical phone.
- XCTest `app.terminate()` is deliberate simulator process termination, **not OS eviction or physical-device force-quit**. StaleDate does not remove an Activity; iOS controls rendering time, not a guaranteed60s refresh SLA.
- Compilation and request success do not prove stale rendering. Chosen fresh/stale images must be visually inspected. Every Island layout compiles, but expanded/minimal Island presentations and Russian rendering have not been visually validated.
- No APNs token/network delivery exists. No backend/end-to-end latency, physical-device power behavior, Android feasibility or production readiness is established; #277 live delivery remains incomplete.
- DeviceHub accessibility inventory repeatedly returned TIMEOUT / global_window_inventory_unstable despite granted permissions. No desktop input actions were delivered. Native tests and explicit-UUID simctl screenshots avoid shared-simulator GUI selection.
- Earlier exploratory failed automation and auxiliary captures remain ignored artifacts only. They are not accepted active/stale evidence; filenames alone are not semantic proof of a captured state.
