# LAN session control, reconciled with the online session (#235)

Investigation of controlling a service over the local network (controller, projector displays and
the Apple TV on the same Wi‑Fi) while the online session stays the record. This page gives the
recommendation, the protocol sketch, the reconciliation rules, the risks and a phased plan. The
runnable spike is in [`spikes/lan-session`](../spikes/lan-session/README.md).

**Priorities (owner, 2026‑10).** First, the least latency possible for the screens in the church.
Second, a local fallback when the internet is bad. Third, and deliberately out of scope, running a
service somewhere with no internet at all: fresh clients would have no way to get the liturgy's
content, and making that work costs far more than it is worth.

**Recommendation in one paragraph.** Keep the cloud as the only source of truth and the only thing
that mints a `revision`. Let the signed‑in controller phone act as the *LAN host*: it advertises the
service on Bonjour (`_tarkman._tcp`) and publishes every command to the displays and the TV over the
LAN *the instant the operator taps*, before the cloud has answered, then confirms or corrects it when
the cloud does. That is what buys the latency: the room sees the change in tens of milliseconds
instead of waiting a cloud round trip (measured at roughly 1.3 to 1.5 seconds median on production
in `performance/mobile-session-latency.md`). When the cloud is slow or down, the same mechanism
degrades into the fallback: the host keeps its provisional commands in a log and replays them when
the cloud is back. Displays and the TV are *followers*: read‑only, exactly as today. Order LAN state
by `[cloud revision, host epoch, provisional seq]`, never by wall clocks; the cloud wins any
conflict, and the operator gets one tap to reassert the position the room was at.

## 1. Where we are today

What the LAN design must fit, with the code that defines it.

- **Revisioned state.** The cloud publishes `{ revision, content_context, cursor, status,
  status_message, posture, date }` for a session. `revision` is monotonic per session;
  `content_context` identifies the manifest (which parts exist, in what order). Clients parse this
  fail‑closed in `parsePublication` (`packages/tarkman-reader/src/contracts.ts`).
- **Publications apply only in order.** The reader engine applies a cable publication only when its
  revision is exactly `base + 1` and the content context matches; anything else marks the state stale
  and triggers an authoritative read of `GET /s/:id/state.json`
  (`applyPublication` and `recoverRevisioned` in `packages/tarkman-reader/src/controller.ts`). There is
  no event sequence number beyond `revision`.
- **Commands are compare‑and‑set.** `next`, `prev`, `set_part` and `update_status` carry
  `expected_revision` and, for moves, `expected_part_id`; the server answers 409 for a stale move.
  Each command is sent once, never queued or retried, and never while offline
  (`apps/mobile/features/services/controls.ts`, `useControls.ts`). The server records
  `transitioned_at` for timing analytics.
- **Followers are public and read‑only.** Displays and the TV read unauthenticated endpoints and the
  public `SessionChannel`; a display link token is a capability that resolves to a *configuration*
  and the operator's `user_id`, and the display follows that user's current session
  (`packages/tarkman-reader/src/display/`). The TV's saved church display stores only a church and a
  link token, never a session id (`apps/tv/docs/church-display.md`).
- **"Online" means internet.** The lifecycle both apps hand the engine treats
  `isInternetReachable === false` as offline and *stops every resource* (cable, polling, reads)
  (`createAppLifecycle` in `packages/tarkman-reader/src/adapters.ts`). On a LAN with no uplink the
  reader today does nothing, and the control screen refuses every command.
- **The phone already keeps the manifest.** The live reader saves the session's parts (and the
  current explanations) for offline reading (`apps/mobile/features/offline/`), so a host has the
  manifest to serve followers and to resolve moves without the cloud.
- **Controller presence** is a heartbeat lease on the cloud with a per‑device UUID and a monotonic
  sequence (`apps/mobile/features/services/presence/`): the same shape the LAN lease needs.
- **The web export cannot join a LAN.** `web.tarkman.app` is HTTPS; a browser cannot browse Bonjour,
  and it cannot fetch `http://` or `ws://` from a LAN host (mixed content), nor trust a self‑signed
  certificate without a prompt. Web stays cloud‑only.

Two things follow directly. First, the *follower* side needs nothing new in the data model: a LAN
publication is the same `SessionState` the engine already applies, under a richer ordering key.
Second, the *host* side needs one new concept, a provisional command log under a cloud revision, and
a LAN‑aware notion of "online" so the engine keeps running against the host when the internet is gone.

## 2. Scenarios, in priority order

| | Phone (controller) | Church Wi‑Fi | Displays and TV | What the LAN gives |
| --- | --- | --- | --- | --- |
| 1. Normal Sunday | Online | Online | On Wi‑Fi | **Latency.** Screens change on the tap, not on the cloud's reply; the cloud confirms a moment later with no visible change |
| 2. Bad internet | Cellular, fine | Up, but no or flaky internet | On Wi‑Fi, can't reach the cloud | **Fallback.** Screens keep following the phone; the cloud catches up when it can |
| 2b. Flapping | Comes and goes | Comes and goes | On Wi‑Fi | Screens never flip between live and offline while the host can be heard; replay at each reconnect |
| 3. No internet anywhere, fresh devices | None | Up, no internet | Never saw this service | **Out of scope.** A display that has not seen the service has no manifest, no display configuration and no way to resolve its link token; see section 10 |
| Remote followers | Any | Any | Someone at home on the web | Unchanged: they see the cloud, which can lag the room by one round trip, or longer during 2 |

### Latency: what the LAN changes

Today, one Next is: tap → `POST /s/:id/next.json` to Rails → commit and broadcast → each display's
cable receives the publication and applies it when its revision is in order
(`applyPublication` in the engine). The controller's own screen also waits for the reply before it
moves (`refreshAfterCommand` in `apps/mobile/features/services/ServiceControlProvider.tsx`). The
LAN hop is tens of milliseconds (spike: a `next` reached the follower in the next write); the cloud
round trip is the whole cost.

With the host publishing *LAN‑first*:

1. Tap. The host applies the command to its projection, appends it to the provisional log, and
   publishes `[base, epoch, seq+1]` to every follower and to its own screen. The room has moved.
2. The same command goes to the cloud exactly as today (compare‑and‑set, sent once).
3. Accepted: the cloud publishes `[base+1, 0, 0]` with the same state. The host settles the log and
   relays it; followers apply a higher key with identical content, so nothing visible happens.
4. Refused (409, the service moved elsewhere): the host resyncs to the cloud state and relays it;
   followers snap to it, and the operator sees *Return to Y*. With one operator in the room this is
   rare, and the snap is the honest outcome.
5. No reply (timeout, offline): the provisional state stands, the log grows, and the host is now in
   the fallback of priority 2 with no mode switch.

Relaying only after the cloud reply (what an earlier draft of this page proposed as phase 0) would
make the screens *robust* but not *faster*: they would move at the same moment the cable broadcast
would have reached them. LAN‑first is the only option that removes the round trip, so it is the
default. The remaining latency budget on a normal Sunday is the LAN hop plus the follower's own
render, which is already measured at about 25 ms from accepted data to visible text.

Two cheaper wins sit beside the LAN and should happen anyway: the controller's own screen can move
on the tap (an optimistic apply, reverted on 409, no LAN needed), and the cloud path itself can be
made faster for remote and web followers, which is backend work.

## 3. Topology

**Recommended: controller‑hosted.** The signed‑in phone on the control screen is the LAN host.

- It is the one device that holds credentials, is present whenever control happens, and already
  has the manifest and the latest state. No hardware to install or keep patched.
- Followers never gain write access or credentials: they receive the same public data they read from
  the cloud today, just from a nearer source.
- Hosting is tied to the control screen being open and in the foreground (keep‑awake is already
  used there). When the operator leaves the screen, the host stops; followers fall back to the cloud
  within the lease.

**Later option: a dedicated box** (a Raspberry Pi or Mac mini in the AV closet, wired). Same
protocol, same host role, always on, and it could host when no controller is in the room. It costs a
stored credential on a device in a church and someone to maintain it. The spike's `dnssd.mjs` and
`host.mjs` are the shape such a box would run. Not phase 1.

**Rejected: peer‑to‑peer.** Every device gossiping state with no authority makes "which state is
the room showing" a consensus problem for a congregation display. Each follower needs one answer
from one source at a time.

**Two hosts for one session** (two signed‑in phones both on the control screen): both advertise;
followers pick the host whose TXT record carries the higher `[base, epoch]`, then the lower `hid`,
and a host that sees a peer advertising a higher key for the same session stops hosting and follows
it. Commands from the losing phone go to the cloud as today (or, in phase 3, through the winning
host).

## 4. Discovery and pairing

**Bonjour / DNS‑SD.** The host registers `_tarkman._tcp` with a TXT record:

| Key | Meaning |
| --- | --- |
| `v` | Protocol version (`1`) |
| `sid` | Session id |
| `uid` | Operator's `user_id`, so a church display (which knows only the operator's id) can find "its" host |
| `hid` | Host device id (stable per install) |
| `ep` | Host epoch (increments when the host loses its log) |
| `base`, `seq` | The host's current ordering key, for host selection before connecting |
| `fp` | Fingerprint of the host's key (see Security); phase 2 |

The spike does exactly this over raw mDNS from Node; on devices the apps use the system APIs
(`NWListener`/`NWBrowser` on iOS and tvOS, `NsdManager` on Android), which need no multicast
entitlement. Verified with the spike: a browse, a connect and the first state all complete in well
under a second on one machine, and the advertisement is standard enough for `dns-sd -B`.

**Pairing without an internet round trip.** The data is public, so what followers need is not
authorization but assurance that the host is the real operator and not someone else on the church
Wi‑Fi. Three ways, in order of preference:

1. *Trust anchor from the cloud (phase 2).* The host registers its public key with the cloud when
   it is online; the cloud publishes the fingerprint in `state.json` and in the display link
   configuration. A display that was online once since the service started trusts the host
   automatically. A TV that has been set up for its church learns the fingerprint with the link
   configuration it already polls (and adopts changes live, as it does for configuration today).
2. *A pairing code (phase 1, and the cold‑start fallback).* The control screen shows a 6‑digit code;
   the display enters it once (the TV with the Siri Remote; a projector laptop running the display
   route with its keyboard). The code is the pre‑shared key for TLS‑PSK (below), so a wrong code
   simply fails to connect. Stored per host id, so it is entered once per host, not per service.
3. *Trust on first use* for a kiosk the installer sets up: accept the first host for this `uid`,
   show the fingerprint, and never silently accept a different one.

No pairing is needed to *discover*, only to *connect*. The public read‑only links are untouched: a
LAN follower is a display link or a TV display that has found a nearer source for the same data.

## 5. Platform limits

- **iOS and tvOS local network privacy (14+).** Browsing or advertising Bonjour, or any unicast to a
  LAN address, shows the "would like to find and connect to devices on your local network" prompt the
  first time. `Info.plist` needs `NSLocalNetworkUsageDescription` and `NSBonjourServices` listing
  `_tarkman._tcp` (an unlisted type is silently not found). A refusal must be handled: the screen
  keeps following the cloud and says why the LAN is unavailable. The prompt also appears on the TV.
- **Multicast entitlement.** Sending or receiving raw mDNS from an app's own socket needs
  `com.apple.developer.networking.multicast`, granted by request. Using `NWBrowser`/`NWListener`
  (or `NetService`) does not. The apps must use the system APIs; the spike's codec is not for them.
- **Background.** iOS suspends the app soon after it leaves the foreground and closes its listener.
  Hosting therefore exists only while the control screen is open and awake, which is how the
  controller is used in practice. Followers detect this through the lease, not through an error.
- **Expo managed workflow.** Neither app has a module for Bonjour or for a TCP/TLS server. Options:
  `react-native-zeroconf` (browse and register) plus `react-native-tcp-socket` (server, client, TLS),
  or one small local Expo Module on `Network.framework` (Swift) and `NsdManager` plus `ServerSocket`
  (Kotlin) exposing `advertise`, `browse`, `listen` and `connect` with TLS‑PSK. The latter is
  recommended: one module, both roles, system Bonjour, TLS‑PSK built in, no third‑party
  maintenance risk. Either way it is a new native module: a fresh dev client for mobile and a fresh
  prebuild for TV (`apps/tv/README.md`), and for TV it must build against `react-native-tvos`.
  Expo's tvOS support list is about Expo SDK packages; a local module is ours to verify.
- **tvOS.** The Apple TV can browse and connect (follower) with the same module; it never hosts.
  There is no camera, so pairing is a typed code or the cloud trust anchor, never a QR scan.
- **Android.** `NsdManager` for discovery and registration (no permission beyond `INTERNET`;
  `CHANGE_WIFI_MULTICAST_STATE` only for raw mDNS, which we do not use), plain sockets for
  transport. Android is not yet a release platform, so it follows mobile's module without extra work.
- **Web.** No LAN path (section 1). The display route on the web export stays cloud‑only; a
  projector that must work on LAN should run the native display (an iPad on the display route, or
  the Apple TV).
- **Mixed radios.** A phone on cellular and the screens on Wi‑Fi are on different networks unless
  the phone also joins the Wi‑Fi. Scenario A requires the phone to be *on the church Wi‑Fi* with
  cellular providing its uplink. iOS keeps the Wi‑Fi association and routes internet traffic over
  cellular when the Wi‑Fi reports no internet, so this usually needs no user action, but the UI
  should say "join the church Wi‑Fi to feed the screens" when no followers are heard.

## 6. Source of truth and reconciliation

### The ordering key

A LAN publication carries `[base, epoch, seq]`:

- `base`: the last cloud `revision` the host accepted;
- `epoch`: the host's epoch, incremented only when the host lost its provisional log (a reinstall, or
  a crash before the log was persisted; the log is persisted in SQLite, so an ordinary restart keeps
  the epoch);
- `seq`: the number of provisional commands applied locally since `base` (0 while relaying).

Cloud publications are `[revision, 0, 0]`. Comparison is lexicographic, so a cloud revision always
outranks the provisional commands that preceded it, a host that lost its log honestly announces that
it is back at `base` (and the followers go back with it, instead of showing a position the host no
longer knows), and no wall clock is involved. `content_context` travels with every publication, as
today: a follower that sees a new context fetches the manifest (from the host, which serves the parts
it saved; or from the cloud) before it shows the cursor.

### Follower rules

Implemented and tested in `spikes/lan-session/protocol.mjs` (`applyHost`, `applyCloud`, `choose`).

1. A follower keeps one view per source (host, cloud) and projects one of them.
2. Within a source, only a strictly newer key is applied; a repeated key from the same host is the
   heartbeat and only refreshes the lease. Older or duplicate frames are dropped.
3. The host is an authority only while it is heard from (lease: 15 s, heartbeat every 5 s).
4. Choose the host when it is fresh and either at or beyond the cloud revision the follower knows
   (relay, or ahead with provisional commands), or behind the cloud *with* provisional commands (it
   is partitioned and the operator in the room is running the service on it). Choose the cloud when
   the host is fresh but behind with no provisional commands (it is merely stale), or when the host
   is gone. With neither, keep the last state and mark it not live (the TV's freshness badge).

Rule 4 is the one judgement call: *the room follows its operator while the host is partitioned*, even
if the cloud moved. The alternative (snap the congregation display to whatever the cloud says while
the operator in front of it is pressing Next) is worse for the people in the room, and it is
temporary: the host reconciles the moment it sees the cloud.

### Host rules

1. Every command is applied to the local projection first, appended to the log with
   `commandId = hid:epoch:base:seq` and `transitioned_at`, persisted, and published to followers
   with `seq + 1`. Moves are resolved against the saved manifest; a move past either end is refused
   locally with the same message the control screen uses for the server's refusal.
2. The same command goes to the cloud as today (compare‑and‑set, sent once). An accepted reply
   settles the log: the host takes the cloud's revision and relays it with `seq = 0`.
3. When the cloud does not answer, the log stays and grows; the host keeps commanding on the LAN.
   At the next successful contact the host replays the log, then reads `state.json` and resumes.

### Replay and conflicts

*Phase 1, today's endpoints.* The log is compressed to what the backend can express: one
`set_part` for the final cursor (with the last move's `transitioned_at`) and one `update_status` if
the status changed, both with `expected_revision = base` (`replay()` in the spike). Outcomes:

- **Accepted.** The cloud assigns new revisions; the host takes them (`settle`), the log is settled,
  and followers see the same state under a higher key with no visible change.
- **409, the cloud moved while the host was away.** The cloud wins: the host resyncs to the cloud
  state and relays it, followers move with it, and the control screen shows "While you were offline
  this service moved to *X*. The room was at *Y*." with one tap, *Return to Y*, which is an ordinary
  `set_part`. Nothing is retried on its own, so a replay can never double‑move the service.
- **Failed (network).** The log is kept and replay is attempted at the next reconnect.

Idempotency with today's backend comes from compare‑and‑set: a second attempt after a crash
mid‑replay carries the same `expected_revision` and is refused as stale rather than applied twice.
The cost of compression: intermediate transitions and their timestamps do not reach the server's
timing analytics while the host was offline. That is a backend gap to close in phase 2, not a reason
to replay every move (replaying `next` five times against a service that moved is exactly the
duplicate‑command failure the beta criteria forbid).

*Phase 2, with backend support.* `POST /s/:id/transitions` accepts the full ordered log with
`commandId` as an idempotency key and the original `transitioned_at`s, in one transaction, and a
*LAN lease*: the host records `{ hid, epoch, key fingerprint }` on the session while online, and a
replay from the lease holder within the lease window is accepted even past a 409 caused by a
non‑lease command (the room wins over a remote edit made during the partition). Both change who
wins in the rare true conflict; neither changes the client's ordering model.

### Clocks

Nothing orders by wall clock. `transitioned_at` is still the host's clock, as it is for every
command today, and only feeds analytics. Leases are measured on each device's own monotonic clock.
Hosts and followers do not need agreeing clocks.

## 7. Protocol sketch

Transport: one TCP connection per follower, TLS‑PSK (the pairing code or a cloud‑delivered key),
newline‑delimited JSON. Messages, all with `v: 1`:

| Message | Direction | Fields | Notes |
| --- | --- | --- | --- |
| `hello` | both | `role`, `hid`, `sid`, `uid`, `caps` | First frame each way; a follower disconnects on a `sid` it did not ask for |
| `state` | host → follower | `sid`, `hid`, `epoch`, `base`, `seq`, `contentContext`, `state` (`SessionState`) | On connect, on every change, and as the heartbeat (unchanged key) |
| `manifest` | follower → host, host → follower | request: `sid`, `contentContext`; reply: `parts` (the saved‑service shape) | Only when the follower's context differs; the parts the host already saves |
| `explanations` | same | `sid`, `contentContext`, `liturgyPartId`; reply `items` | Optional; only for displays configured to show the cue |
| `bye` | host → follower | `reason` | Clean stop; followers fall to the cloud immediately instead of waiting for the lease |
| `command` | follower → host | `commandId`, `kind`, `cursor` or `status`, `transitionedAt`, `capability` | Phase 3 only; see Security |

Example `state` (what the spike sends):

```json
{"v":1,"kind":"state","sessionId":42,"hostId":"5b9b486f","epoch":1,"base":10,"seq":2,"contentContext":"ctx-1",
 "state":{"cursor":{"partId":103,"liturgyPartId":203,"liturgyId":7,"position":3},"status":"active","message":null,"posture":null,"date":"2026-10-04"}}
```

Where this lives: the ordering key, the follower reducer and the host log are platform‑free and
belong in `packages/tarkman-reader` (`src/lan/`), bound by `features/live/*` on mobile and
`src/reader.ts` on TV like everything else in the engine. The engine's `Lifecycle` gains a third
input, "LAN host reachable", so `online` means *a source is reachable*, not *the internet is*. The
native module is the only platform code.

## 8. Security

- **No new data exposure.** A follower receives what the public endpoints and `SessionChannel` already
  give anyone with a link. Explanations and parts are the public manifest. The host never sends
  credentials, the operator's token, or anything from the signed‑in API.
- **Host authenticity.** TLS‑PSK (the pairing code, or in phase 2 a key whose fingerprint the cloud
  published) prevents a stranger on the church Wi‑Fi from showing text on the congregation display.
  The Bonjour record itself is unauthenticated and only used to find candidates; a follower trusts
  nothing until the TLS handshake with the expected key succeeds.
- **Replay and reordering** are handled by the ordering key: a follower never applies a key it has
  already passed. TLS gives per‑connection integrity, so a recorded frame cannot be replayed into a
  new connection.
- **Display links are not weakened.** A token still resolves only through the cloud; the LAN never
  mints, validates or revokes one. A revoked link stops at the next configuration poll exactly as it
  does today, LAN or not.
- **Commands from other LAN devices (phase 3)** must carry a *capability* the cloud issued to that
  device while it was online (a short‑lived signed token naming `sid`, device id and expiry) that the
  host verifies offline with the cloud's public key. Without it the host accepts no command. Until
  phase 3, the host accepts no `command` frame at all.
- **Local network prompt copy** must be honest and specific: "to feed the screens in this church
  from this phone".

## 9. Failure modes

| Situation | Behaviour |
| --- | --- |
| Host leaves (screen closed, phone locked, walks out of range) | Followers lose the heartbeat; after the lease they fall to the cloud if they can reach it, otherwise show the last state as not live. A clean `bye` skips the wait. |
| Host partitioned from the cloud, followers can reach the cloud | Followers show the host (rule 4), which may lag or lead the cloud until the host reconnects and replays. |
| Host can reach the cloud, followers cannot | Scenario A: followers get the cloud state through the host, with `seq = 0`. |
| Nobody can reach the cloud | Scenario B: the host commands locally, followers follow, replay at reconnect. |
| Host lost its log (new epoch) | It announces `base` again; followers go back to `base`. The operator sees the display's position and uses `set_part` to continue. |
| Cloud moved during the partition | Replay is refused (409): the cloud wins, the operator is offered *Return to Y*. |
| Two hosts | Higher `[base, epoch]`, then lower `hid`, hosts; the other stops hosting. |
| Manifest changed (edited service) | New `content_context`; followers fetch the manifest from the host or the cloud before showing the cursor; the host's log is replayed only if its `base` still matches, else dropped with the same *Return to Y* offer. |
| Local network permission refused | No LAN; everything behaves as today, with one line saying why. |
| Rogue advertiser | Discovered, never trusted: the TLS‑PSK handshake fails. |
| Session deleted while partitioned | The host learns it on reconnect (`session_not_found`), sends `bye`, and the control screen ends as it does today; the log is discarded. |

## 10. Scope and phased plan

Read‑only followers only; the host is the one commander. Ordered by the owner's priorities.

**Phase 1, latency (client only).** The native Bonjour/TCP module; the host publishes LAN‑first on
every tap and settles against the cloud's reply; the controller's own screen moves on the tap;
mobile display route and TV follow a host when present, falling to the cloud when none is heard.
Pairing by code. The log need not be persisted yet: in this phase a lost log only costs a
*Return to Y* after a restart. Gate on physical devices: a projector and a TV change within 100 ms
of the tap over the church Wi‑Fi, a 409 snaps them to the cloud state once, and nothing is ever
sent twice.

**Phase 2, fallback (client only).** Persist the log in SQLite, make `online` LAN‑aware so the
engine keeps running against the host when the internet is gone, replay with today's endpoints,
the *Return to Y* conflict screen, and the "join the church Wi‑Fi to feed the screens" hint. Gate:
pull the building's uplink mid‑service with the phone on cellular, then put the phone in airplane
mode for three commands; the screens never stop following, the replay is accepted, and a
conflicting online edit produces one 409 and no double move.

**Phase 3, backend (mattash/Tarkman).** Transitions batch endpoint with idempotency keys and
original timestamps; LAN lease and host key fingerprint on the session and in the display link
configuration; `state.json` and `display_links/:token` publish them. Removes the pairing code for
displays that were online once, and restores timing analytics for moves made during a fallback.

**Out of scope: a service with no internet and fresh devices.** The host *could* serve its saved
manifest (the `manifest` message exists for the case where the context changed), but a device that
has never seen the service also needs the display link configuration, the church's display
settings, the fonts' companion data and, for the TV, a link token it can only resolve through the
cloud. Each of those would need a LAN copy and a way to trust it, for a situation that is rare and
usually solved by a phone hotspot. If it ever matters, it is the dedicated LAN box of section 3
with a cached copy of the church's services, not a change to this protocol.

**Later, if wanted: LAN controllers.** A second signed‑in phone sends commands to the host with a
cloud‑issued capability; the host relays them to the cloud when online or logs them when not.

Backend changes to track in mattash/Tarkman: the transitions batch endpoint (idempotent, ordered,
timestamps preserved), the LAN lease and fingerprint fields on session state and display link
configuration, the device capability token for phase 3, and `session_not_found` on the batch
endpoint for a deleted session.

## 11. Risks and open questions

- **The native module is the real cost.** It needs Swift and Kotlin, a fresh dev client and a
  TV prebuild, and device testing of the local network prompt on iOS and tvOS. Estimate before
  committing; `react-native-zeroconf` plus `react-native-tcp-socket` is the fallback if a custom
  module proves too much.
- **LAN‑first means a visible snap on a 409.** With one operator in the room that is rare; with two
  controllers acting on different paths it is the honest outcome, but it is a product decision to
  prefer the tap's speed over the cloud's confirmation. The alternative, relaying only after the
  reply, is one flag on the host and costs the entire latency gain.
- **Rule 4 needs a real‑world check.** Showing the room's operator over the cloud during a partition
  is a product decision; the alternative is one line in `choose()`.
- **Cellular uplink with a Wi‑Fi LAN** on the phone is what makes scenario A work without any user
  action. Verify on iOS with the church's actual network (including a captive portal) before
  promising it.
- **Projector laptops on the web export** cannot join the LAN. If a church projects from a browser,
  the LAN path does not help them; the native display or the TV does.
- **Lease and heartbeat values** (15 s / 5 s) are guesses tuned for a reading that changes every few
  minutes; a display "not live" badge appearing during a 10‑second Wi‑Fi hiccup would be worse than
  a late update. Tune on devices.
- **Log persistence across an app update** (a new runtime version) should keep the epoch; verify
  SQLite survives OTA updates on iOS, which it does for the saved service today.

## 12. The spike

`spikes/lan-session` (Node 22, no dependencies; `npm run lan-spike:test`). It implements the
ordering key, the follower reducer, the host log, replay and settlement as pure functions with
tests for every rule above, including the LAN‑first sequence (provisional frame, then the cloud's
acceptance with no visible change, then a 409 that snaps to the cloud), a minimal mDNS/DNS‑SD
advertiser and browser, and a host and follower that run as two processes. The end‑to‑end test
discovers the host over real multicast, connects, receives the initial state, and receives one
cursor update after `next`; the two‑process run does the same across terminals. What it deliberately leaves out is listed in its README: TLS, pairing,
manifest transfer, persistence and the real cloud.
