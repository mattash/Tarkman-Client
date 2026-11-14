# Service-progress system surface: bounded design / data prototype

Status: design and executable data prototype for #277, based on SDK 58 baseline
`d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`. **Live delivery is incomplete.**
No widget, Live Activity, follow UI, native target, background task, push registration,
credential, entitlement or release is added. Existing mobile/web readers are unchanged.
This is not a launcher-only implementation substituted for the requested live widget.

## Proposed platform boundary

Recommend an explicitly opted-in **iOS Live Activity** for one bounded ongoing public
service. Keep a Home Screen widget as a separately described last-known snapshot,
not a real-time service monitor. This is a proposal for owner review, not a product
or signing decision made by this prototype.

| Surface | Available path | Limit and implication |
| --- | --- | --- |
| iOS Home Screen | Expo SDK 58 `expo-widgets`, WidgetKit timeline | Reloads are budgeted/system scheduled. Apple describes roughly 40–70 daily reloads for frequently viewed widgets, varying with use. No per-part latency guarantee. Schedule a stale entry, but do not promise an exact redraw deadline. |
| iOS Lock Screen / Dynamic Island | Expo `createLiveActivity`, ActivityKit | App updates only while executable; APNs ActivityKit updates needed while suspended/terminated. Activity UI cannot fetch network data itself. Platform maximum active lifetime is eight hours, with possible Lock Screen retention for four more. End and stale are distinct. |
| Android Home Screen | SDK 58 widgets, opt-in `enableAndroid: true` and package name | Supported, but Expo timeline APIs and Live Activities are iOS-only. Snapshot/reload calls do not guarantee autonomous expiration after app termination. Android periodic widget refresh has a 30-minute minimum; power budgets still apply. Do not ship as “live” without a separately measured native push/expiry adapter. |
| Android promoted Live Updates | Separate future investigation | Expo custom notifications are not evidence of promoted Live Updates support. Android promotion excludes custom RemoteViews and remains user/system controlled. Not part of this prototype. |
| Web, TV, unsupported/disabled native surface | Existing public read-only reader | No changes. Preserve the existing iOS 16.4+ app behavior without requiring an Activity or widget. |

`expo-widgets` / `@expo/ui` are not installed in this repository baseline. Expo Go
cannot validate these native surfaces. Adding them would require a new development
binary and native-extension build checks; this PR intentionally does neither.

Official references (reviewed for this design):
- [Expo SDK 58 widgets, platform API restrictions, stale environment and push payloads](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)
- [WidgetKit refresh budgets and timelines](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [ActivityKit lifetime, size and network restrictions](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [Activity staleDate](https://developer.apple.com/documentation/activitykit/activitycontent/staledate)
- [ActivityKit push updates](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- [Android widget periodic updates](https://developer.android.com/develop/ui/views/appwidgets/advanced#update-periodically)
- [Android Live Update eligibility](https://developer.android.com/develop/ui/views/notifications/live-update)

## Executable prototype

[`prototype.ts`](../apps/mobile/features/serviceProgress/prototype.ts) is an isolated,
unused mobile-owned reducer/projector; nothing imports it into the application.
[`service-progress-prototype.test.ts`](../apps/mobile/tests/service-progress-prototype.test.ts)
exercises its proposed normalized contract. It is **not a wire parser** or a native
widget callback. A future transport must authenticate and validate public payloads
before calling it. Native widget functions run in an isolated synchronous environment;
feed bounded serialized props rather than importing this module into their callback.

- Explicit follow identity is `(sessionId, generation)`. Each switch/re-follow needs a
  new generation. Late callbacks for another follow or service cannot change it.
- Publications use strictly increasing `sequence`, including unchanged-state
  heartbeats. Replayed/older sequences cannot extend freshness. This sequence is
  **not** assumed to be the existing state revision: state revision need not change
  when an unchanged service is revalidated. Issued timestamps cannot move backwards.
- `issuedAt` and `expiresAt` are epoch milliseconds. A provisional **60-second maximum
  age** bounds experiments, not a promised delivery interval. Future timestamps,
  invalid windows and oversized windows are rejected. Late delivery does not reset age.
  Device/server clock skew currently fails conservative (stale/rejected); a real
  transport needs a measured clock policy, not replacement with receipt time.
- A complete ordered manifest and cursor must share `contentContext`. Occurrence
  identity is the liturgy-part occurrence, never a reusable part ID. Ordinal is array
  index + 1, not backend position divided by a guessed total. Duplicate identities,
  missing current occurrence, incomplete/empty/changed manifests suppress ordinal
  and role. One part is “1 of 1”, not “100% complete”. No ETA is computed.
- Status and freshness are independent. Active/paused can become stale; unavailable
  is not silently active; ended/deleted are terminal for this follow. Removal clears
  retained content and rejects queued publications. Native adapters must additionally
  unregister/end/delete their surface and subscription. The prototype does no I/O.
- The result says `recent`, **never `live`**. `updatedAt` is source validation time.
  There is no asserted offline detection: stale means the evidence expired, not proof
  of why delivery stopped. Future renderers must label expired progress as last-known
  or hide it, never show an unqualified active/live badge.
- The only tap destination is the existing credential-free public service reader.
  Deleted/removed snapshots expose neither a title nor a tap. No controller actions,
  API URLs, display-link/login tokens, prayer text or private reading history are
  serialized. Public titles/roles still disclose religious attendance: require
  deliberate per-service system/lock-screen disclosure consent before registration.

### Expiry without another app run

The test that projects a stored snapshot one day later proves only deterministic
expiry logic; **it does not prove any OS surface redraws when JavaScript is dead**.
For a Live Activity, pass the same expiry to `staleDate` and use the native
`environment.isStale` to hide/label progress even without the app. `staleDate` does
not end/remove an Activity. A separate end push and dismissal policy are needed.
Home widgets need precomputed stale timeline entries on iOS, subject to scheduling.
Expo Android has no equivalent timeline API here: a separately verified native
expiry mechanism is a prerequisite, or limit it to explicitly timestamped snapshots
without a live badge. Never use a JS interval, background fetch or a retained
ActionCable socket as evidence of terminated-app delivery.

## Missing backend push contract (proposal, not implemented)

Existing public reader state/cursor/content-context and deletion revisions are useful
inputs, but do not establish push registration, heartbeat delivery or expiry. Agree
these interfaces with the backend owner before wiring a native adapter:

1. Opt-in registration/removal scoped to one public session and follow generation,
   platform/environment, activity identity and asynchronously rotating ActivityKit
   token (not an ExpoPushToken). Registration must be idempotent, revocable and expire;
   token handling/logging must not expose credentials. User removal/session switch
   revokes old registration before old updates can affect a new surface.
2. Coherent public projection: session ID/title, normalized status, canonical state
   revision, separately monotonic delivery sequence, content-context/manifest revision,
   occurrence ID and role, source validation time, expires-at. Full manifest validation
   happens before producing bounded surface props; do not push the full manifest.
   Keep static attributes plus dynamic Activity content within Apple's 4 KB limit.
3. Explicit status mapping from actual backend statuses into active/paused/unavailable/
   ended/deleted. Do not infer ended from the last part, an HTTP failure, or the
   service's date. Unknown status is unavailable. Publish terminal tombstones after
   commit; expiry still protects against a lost end/delete push. Define reconnect,
   retries, deduplication, manifest changes and token invalidation/rotation.
4. ActivityKit APNs provider, separate development/production environments, topic
   `<bundleID>.push-type.liveactivity`, `apns-push-type: liveactivity`, correct priority,
   timestamps, update/end events and stale/dismissal dates. Expo's wrapper uses
   `content-state: { name: <activityName>, props: <JSON-string> }`; pin and test its
   actual encoding before backend implementation. No APNs credentials belong in app
   data or Git. App-originated start is the proposed first experiment; push-to-start
   on iOS 17.2+ requires a different token/lifecycle and is deferred.
5. Choose and measure a heartbeat/coalescing policy against the provisional TTL,
   APNs/system budgets and battery. Frequent updates require explicit configuration
   and still do not guarantee a cadence. Neither push acceptance nor socket receipt
   proves the lock-screen content was displayed on time.

## Owner decisions, signing and measurement gate

Before a native implementation, owner approval is needed for the proposed iOS-first
Live Activity surface, exact disclosure/opt-in copy and default, tolerated stale age
and service lifetime, and whether Android ships snapshot-only or waits for a live
adapter. These decisions do not block reviewing this isolated prototype.

Native validation needs an authorized Apple team, extension bundle ID and App Group,
matching app/extension entitlements and provisioning, ActivityKit/push capability,
registered physical devices and signed development builds; verify generated targets
and EAS credentials rather than assuming the SDK upgrade supplies them. No signing,
production settings/credentials or store release is authorized by this ticket.
See [Expo app extensions](https://docs.expo.dev/build-reference/app-extensions/) and
[physical iOS development builds](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/).

**Not measured here:** foreground/background/termination refresh latency, push
reliability, battery cost, physical expiration, native builds or signing. Do not mark
#277 delivered based on unit tests, app screenshots or a simulator-only demo.
The next native experiment must record device/OS/build, source revision, consent,
network/power state, server-issued/received/displayed times, p50/p95/max latency,
missed/coalesced updates and battery/energy observations for:

- foreground → locked/background → OS termination and explicit force-quit separately;
- airplane mode, reconnect, process restart, stale deadline with no app rerun;
- pause/resume, end/delete, removal, rapid switching and same-service re-follow;
- manifest replacement/repeated occurrences, absent totals and zero/one occurrence;
- denied permissions/Live Activities disabled, token rotation and provider failures;
- iOS Lock Screen and all relevant Dynamic Island sizes, Android launcher/device;
- compact/expanded, light/dark, large text, VoiceOver/TalkBack, English/Russian and
  supported service languages. Localize labels and announce ordinal/status/freshness
  without relying on color, trimming away freshness or showing bogus percentages.

A UI follow-up must include actual application **Before/After** captures at the same
viewport/theme/state, plus native device demonstrations and signed-extension evidence.
This data/design PR has no changed UI and no UI capture claim. Live delivery remains
incomplete until the backend/native contracts and physical measurements satisfy the
owner-approved freshness policy.
