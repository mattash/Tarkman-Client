# Native evidence — isolated service-progress experiment

## Scope and source

Synthetic public service **42**, ordinal **1 of 3**, Reader. Source revision
`15e4e8e2a842e9ed2c370b0251b5d9b5c112c159`; the eight captured app/widget/shared/
localization/generator/test source SHA256 values were independently checked against
that committed tree. [Capture provenance and hashes](<../../../../docs/service-progress-evidence/native-captures.json>)
preserve the original screenshot bytes and attachment times.

Runtime: a new **ServiceProgress3429** iPhone 18 Pro / iOS 27.0 simulator,
1206×2622 portrait (402×874 points), light appearance/default wallpaper.
No physical phone or shared simulator was used. Production app/data/settings were
not changed. Main app/extension minimum target is 16.4; no 16.4 runtime was tested.

## Build and isolation checks

- [Generator/build/test reproduction](<README.md>) uses the already installed
  xcodeproj 1.28.1 gem; Xcode 27.2 / SDK 27.2. No Expo/native dependency was added.
- Unsigned app plus embedded ActivityKit extension build: **passed**. Actual built
  plist has Boolean `NSSupportsLiveActivities = true`, the separate app/extension
  identifiers, correct WidgetKit extension point and minimum 16.4.
- Generic iOS development-signed build of this source: **passed**, followed by
  `codesign --verify --deep --strict`. Existing development signing created profiles
  only for the two isolated identifiers; no production profile/capability changed.
  Inspected entitlements contain only the isolated application identifier, team and
  development debugging permission, with no App Group/APNs/shared keychain group.
- Locale/plist lint passed. Xcode 27's optional XCTest runner emits minimum-17
  library warnings; runtime tests below use 27.0, not a claim of 16.4 runtime coverage.
- [Ordinary app graph comparison](<../../../../docs/service-progress-isolation.json>)
  verifies matching native modules/entitlement mods versus the original baseline,
  not merely app-config equality. Experimental code is a separate Xcode project,
  outside production Expo autolinking/EAS. Build products and raw test artifacts are
  ignored, not committed.

## Actual foreground → background → terminated observation

The two final native UI tests **passed**, 278.907 seconds total. They interact with
the real visible disclosure control, assert OFF then ON, tap Start, handle the
isolated simulator's **Allow / Always Allow** system permission after in-app consent,
and capture the real system surface. They do not force a stale flag or use a
launch-argument consent bypass. A passing interaction test is **not** considered
proof that stale rendering occurred; the selected images were separately inspected.

| Step | Actual result | Evidence |
| --- | --- | --- |
| Launch before disclosure | OFF; Start disabled | [Default-off app](<../../../../docs/service-progress-evidence/after-disclosure-off.png>) |
| Explicit disclosure then Start | ON; local Activity request acknowledged, no network/push | [Foreground](<../../../../docs/service-progress-evidence/after-foreground-requested.png>) |
| Background | Real native card: Last reported part 1/3 Reader and last-update time | [System surface](<../../../../docs/service-progress-evidence/after-background-reported.png>) |
| Explicit process termination, then 75-second wait | Card still retained its last-reported ordinal/role; **no exact expiry redraw** | [75-second observation](<../../../../docs/service-progress-evidence/after-terminated-75s.png>) |
| Later system rendering, with no app relaunch | Genuine **Stale — open public parts** branch; ordinal/role hidden | [Observed stale](<../../../../docs/service-progress-evidence/after-stale-observed.png>) |

The first returned ActivityKit content was read back through native accessibility
diagnostics: requested/updated at **2026-11-14T19:31:57Z**, staleDate
**19:32:57Z**, activityState **active**, pushType **nil**. The later background-only
cycle read back requested/updated **19:34:10Z**, staleDate **19:35:10Z**. Its
75-second sample and immediate surface reopen also retained the last-reported
snapshot. A final simctl still around **19:37:10Z** showed the genuine stale branch:
roughly 180 seconds after the second request / 120 seconds after its staleDate.
**That is an observation time, not the exact transition time or a maximum latency.**
No app relaunch, forced `isStale`, JS timer or server update produced that state.

Conclusion: the requested native 60-second staleDate is accepted, and eventual
native stale rendering works after background/termination, but **a 60-second
onscreen deadline is not established**. The copy always says **Last reported part**
so a cached snapshot does not claim unqualified current/live state. Reopening a
surface is not itself a guaranteed redraw deadline. staleDate does not end/remove
an Activity; End requests immediate dismissal separately.

## Evidence boundaries

- The surface reached by a top-edge gesture is **Notification Center / Lock
  Screen-style Activity presentation**, not proof of physically locking an iPhone.
- XCTest `app.terminate()` is deliberate simulator process termination, **not OS
  eviction or physical-device force-quit**.
- These captures use real system/app rendering and public synthetic fixture data.
  Same-revision pre-opt-in is not a previous-source baseline. The matched original
  application baseline is separately identified in the PR's Before/After comparison.
- Every Dynamic Island layout compiles; expanded/minimal presentations, Russian
  rendering, other text scales/themes and physical device behavior remain unmeasured.
- No APNs registration/provider or network delivery exists. No end-to-end latency,
  battery cost, Android live feasibility or production readiness is established.
  **#277 live delivery remains incomplete.**
- DeviceHub accessibility inventory was unavailable despite granted permissions;
  explicit-UUID simctl and XCTest avoided changing shared GUI simulator selection.
