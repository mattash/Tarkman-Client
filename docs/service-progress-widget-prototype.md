# Service-progress system surface: bounded design / isolated native prototype

Status: bounded design, executable data prototype and **separate local-only native
ActivityKit harness** for #277, based on SDK 58 baseline
`d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`. **Live delivery is incomplete.**
Existing mobile/web readers and their normal dependency/native build graphs are
unchanged. The standalone harness has its own app/extension identity and synthetic
public fixture; it is not a production widget, backend connection or substitute
launcher presented as delivered live progress.

## Proposed platform boundary

The owner's follow-up authorizes an explicitly opted-in **iOS Live Activity** first,
**default off**, with explicit per-service public lock-screen disclosure and a
provisional **60-second expiry**, for a bounded isolated experiment. These are
experimental assumptions, not a production freshness SLO or a decision to omit
Android from release. Keep a Home Screen widget as a separately described
last-known snapshot, not a real-time service monitor.

| Surface | Available path | Limit and implication |
| --- | --- | --- |
| iOS Home Screen | Expo SDK 58 `expo-widgets`, WidgetKit timeline | Reloads are budgeted/system scheduled. Apple describes roughly 40–70 daily reloads for frequently viewed widgets, varying with use. No per-part latency guarantee. Schedule a stale entry, but do not promise an exact redraw deadline. |
| iOS Lock Screen / Dynamic Island | Expo `createLiveActivity`, ActivityKit | App updates only while executable; APNs ActivityKit updates needed while suspended/terminated. Activity UI cannot fetch network data itself. Platform maximum active lifetime is eight hours, with possible Lock Screen retention for four more. End and stale are distinct. |
| Android Home Screen | SDK 58 widgets, opt-in `enableAndroid: true` and package name | Supported, but Expo timeline APIs and Live Activities are iOS-only. Snapshot/reload calls do not guarantee autonomous expiration after app termination. Android periodic widget refresh has a 30-minute minimum; power budgets still apply. Do not ship as “live” without a separately measured native push/expiry adapter. |
| Android promoted Live Updates | Separate future investigation | Expo custom notifications are not evidence of promoted Live Updates support. Android promotion excludes custom RemoteViews and remains user/system controlled. Not part of this prototype. |
| Web, TV, unsupported/disabled native surface | Existing public read-only reader | No changes. Preserve the existing iOS 16.4+ app behavior without requiring an Activity or widget. |

`expo-widgets` / `@expo/ui` are not installed in this repository baseline or added
by this PR. Expo Go cannot validate these native surfaces. The experiment instead
uses a standalone SwiftUI/ActivityKit app, outside Expo autolinking and EAS, so no
experimental native dependency enters the normal production build graph.

Official references (reviewed for this design):
- [Expo SDK 58 widgets, platform API restrictions, stale environment and push payloads](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)
- [WidgetKit refresh budgets and timelines](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [ActivityKit lifetime, size and network restrictions](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [Activity staleDate](https://developer.apple.com/documentation/activitykit/activitycontent/staledate)
- [ActivityKit push updates](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- [Android widget periodic updates](https://developer.android.com/develop/ui/views/appwidgets/advanced#update-periodically)
- [Android Live Update eligibility](https://developer.android.com/develop/ui/views/notifications/live-update)

## Verified normal-build isolation

The native experiment is a **separate Xcode app/extension project**, not an Expo
module, config plugin or flag-gated production dependency. No change to the ordinary
app's manifest, lockfile or config is needed. Its separate identifiers, no production
URL scheme/associated-domain/keychain group, and no EAS update configuration prevent
replacing or sharing data with the installed production app.

[Recorded graph comparison](<service-progress-isolation.json>) compares actual
`expo-modules-autolinking resolve --platform apple --json` output for the normal app
against the original baseline with both experiment flags unset: all **33 modules**,
versions, pods, module classes and delegate/subscriber metadata match after only
normalizing the two absolute checkout roots. The refreshed baseline uses its own
private dependency tree, not the candidate's module-resolution path.
`expo config --type introspect --json` (`EXPO_NO_DOTENV=1`) also confirms the normal
entitlement mods match: only the existing associated domain, no App Group/APNs,
no `NSSupportsLiveActivities` and no inline extension targets. This verifies more than
app-config equality. The full generated Info.plist template is not asserted equal
because the capture baseline has an existing generated iOS directory and an
identity-only isolation override. Ordinary app manifest/lockfile/config bytes still
match the exact baseline commit. No shared config/package edits with #275 are needed.

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
  is not silently active; ended/deleted cannot revive this follow. A newer deletion
  may refine an ended snapshot to clear its retained title/link. Removal clears
  retained content and rejects queued publications. Native adapters must additionally
  unregister/end/delete their surface and subscription. The TypeScript prototype does
  no I/O; the separate native harness only starts/updates/ends a local fixture Activity.
- The result says `recent`, **never `live`**. `updatedAt` is source validation time.
  There is no asserted offline detection: stale means the evidence expired, not proof
  of why delivery stopped. Future renderers must label expired progress as last-known
  or hide it, never show an unqualified active/live badge.
- The only tap destination is the existing credential-free public service reader.
  Deleted/removed snapshots expose neither a title nor a tap. No controller actions,
  API URLs, display-link/login tokens, prayer text or private reading history are
  serialized. Public titles/roles still disclose religious attendance: require
  deliberate per-service system/lock-screen disclosure consent before registration.

### Separate native experiment and current observed limit

[Native harness](<../apps/mobile/prototypes/service-progress-ios/README.md>) generates
an isolated SwiftUI app and embedded WidgetKit extension, with synthetic service 42,
three distinct occurrences, localized disclosure OFF/ON + Allow/Revoke, a separate
Start action and foreground-only fixture updates/removal. No Expo package or plugin
is installed. The native payload is a small Codable fixture, not a connected
implementation of the TypeScript publication contract or backend transport.

Real simulator consent plus the system permission produced an Activity visible
after explicit process termination. The final run confirmed ActivityKit returned a
staleDate exactly 60 seconds after its source update. Nevertheless the continuously
visible card retained ordinal/role at 75 seconds, including an immediate surface
reopen. A later still around 180 seconds after the second request displayed the
genuine stale branch with ordinal/role hidden, without app relaunch or forced flags.
Thus **eventual native stale rendering is observed; an exact 60-second onscreen
transition or redraw-on-reopen guarantee is not**. The renderer always qualifies
retained content as **Last reported part**. [Inspected capture evidence](<../apps/mobile/prototypes/service-progress-ios/EVIDENCE.md>)
records the actual times and source hashes. The [matched original-source comparison](<service-progress-evidence/README.md>)
is captured and inspected. This is measured OS behavior to review, not an assertion
of real-time delivery or a reason to silently relax #277's criteria.

### Expiry without another app run

The test that projects a stored snapshot one day later proves only deterministic
expiry logic; **it does not prove any OS surface redraws when JavaScript is dead**.
For a Live Activity, pass the same expiry to `staleDate` and use native
`ActivityViewContext.isStale` (or Expo's `environment.isStale`) to hide/label progress
even without the app. `staleDate` does not end/remove an Activity. A separate end push and dismissal policy are needed.
Home widgets need precomputed stale timeline entries on iOS, subject to scheduling.
Expo Android has no equivalent timeline API here: a separately verified native
expiry mechanism is a prerequisite, or limit it to explicitly timestamped snapshots
without a live badge. Never use a JS interval, background fetch or a retained
ActionCable socket as evidence of terminated-app delivery.

## Missing backend push contract (proposal, not implemented)

The existing public client reads `/s/:id/state.json`, `/s/:id.json` and
`/s/:id/parts.json` and receives ActionCable publications. Backend route/publication
inspection confirms no ActivityKit registration/provider path in that inspected
boundary; an app WebSocket is not an APNs provider. The actual missing work is a
revocable activity registration API, durable public-state projection/heartbeat jobs
and an ActivityKit APNs provider with per-environment token management. This local
prototype bypasses all three and cannot measure their delivery. Agree these
interfaces with the backend owner before wiring a native adapter:

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

### Concrete backend implementation and tests to commission

Proposed additive endpoints (not present or called by this prototype):
`PUT /public/service_activity_registrations/:registration_id` and
`DELETE /public/service_activity_registrations/:registration_id`. The PUT supplies
an installation-generated opaque registration ID, per-registration revocation
secret, public session ID, fresh follow generation, activity ID, ActivityKit token,
APNs environment and expiry/consent version. It returns a bounded lease and the
canonical sequence/expiry. Do not reuse login/controller/display-link tokens or
allow a caller to select arbitrary APNs topics. Store tokens/secrets protected,
redact them in logs, rate-limit creation and reject sessions not publicly readable.
Removal authenticates only this registration and is idempotent. Token rotation
replaces the old token atomically; old generations cannot renew a new registration.
Exact endpoint authorization/schema remain a backend security-design deliverable,
not an API this client can assume exists.

A durable after-commit/outbox projection job must compute one coherent public
occurrence against its content-context and enqueue coalesced updates. A separate
bounded heartbeat job may revalidate unchanged active/paused state with a new
publication sequence, never fabricate a new source validation time for a failed
read. Terminal/delete jobs send an end event and stop heartbeats. The provider
must set ActivityKit headers and native Codable content-state (or the Expo wrapper
if that adapter is chosen), propagate expiry/stale dates, retry transient failures
within the lease, invalidate permanent APNs token failures, and never renew expired
or removed registrations. The local Swift harness uses direct Codable content-state,
not Expo's JSON-string wrapper: these are alternative adapters, not interchangeable
payloads. APNs envelope `timestamp`, `stale-date` and `dismissal-date` use Unix
seconds, distinct from the TypeScript experiment's epoch-millisecond clock. Pin the
native content-state's Date encoding with a golden contract fixture.

Required backend tests before an end-to-end experiment:
- request auth/abuse tests: registration isolation, public-read scope, denied private
  service, idempotent removal, redacted tokens, bounded leases and environment/topic;
- job tests: transactional rollback publishes nothing, dedup/coalescing and retries
  preserve state revision/content-context, heartbeat sequence increases without a
  state revision change, late/reordered work cannot revive removed/terminal follows;
- provider contract tests with fake APNs: update/end headers and content-state shape,
  a golden payload encoded by the compiled Swift `ContentState` (including its Date
  encoding, not blindly copying TypeScript epoch-millisecond fields), payload <=4 KB,
  stale/dismissal dates, expired lease suppresses delivery, rotating/invalid token
  removal, transient backoff and no cross-environment token reuse;
- device integration: correlate server publication/receipt/display timestamps with
  real foreground, suspension, OS termination and force-quit results, dropped
  heartbeats, lost end push, offline expiry and reconnect. Provider acceptance alone
  is not proof of displayed freshness.

## Owner decisions, signing and measurement gate

The iOS-first, default-off, explicit per-service disclosure and provisional 60-second
expiry assumptions are authorized for this experiment. They are not approval blockers.
Production freshness/lifetime, final copy and Android release policy remain future
product decisions, not reasons to stop independent native prototyping.

An isolated local-only ActivityKit experiment needs a separate app and embedded
extension with `NSSupportsLiveActivities`, shared ActivityAttributes and
`pushType: nil`. It needs **no App Group or push entitlement** when it shares only
ActivityKit attributes. Unsigned simulator builds need no Apple team. Physical
installation needs actual development signing and matching profiles for the two
isolated bundle IDs, device inclusion and Developer Mode. App Groups are needed
only if later sharing files/defaults; APNs capability/provider is needed only for
remote updates. Do not assume the SDK upgrade or the production EAS profile supplies
these. No production settings/credential changes or store release is authorized.
See [Expo app extensions](https://docs.expo.dev/build-reference/app-extensions/) and
[physical iOS development builds](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/).

Unsigned simulator app/extension compilation and a signed generic iOS development
build succeeded for the isolated harness; deep signature verification and entitlement
inspection also passed. Development signing uses the existing authorized team and
new isolated identifiers, not the production app's profiles. No App Group/push
capability was added. Signing is not currently an owner-action blocker.

**Not measured here:** real-service foreground/background/termination refresh
latency, push reliability, battery cost or physical-device expiration. Do not mark
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

Actual application **Before/After** captures now compare the original-source reader
and the isolated native prototype on the same system surface, service/occurrence/role,
viewport and theme; see the [comparison and provenance](<service-progress-evidence/README.md>).
A new-harness pre-opt-in capture is supplementary, not the prior-source baseline.
Live delivery remains incomplete until backend/native contracts and physical
end-to-end measurements satisfy the original criteria.
