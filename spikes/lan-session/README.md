# LAN session spike (#235)

A small, dependency-free Node spike for [docs/lan-session-control.md](../../docs/lan-session-control.md):
two processes discover each other over mDNS/DNS-SD on the same network and pass cursor updates
over TCP, through the reconciliation rules the design proposes. **Nothing here ships**: it is not
bundled by either app and is not in CI.

| File | What it is |
| --- | --- |
| `protocol.mjs` | The pure rules: the `[base, epoch, seq]` ordering key, the follower reducer (host vs cloud), the host's provisional command log, the replay it produces on reconnect and how a replay settles. This is the part that would move into `packages/tarkman-reader`. |
| `dnssd.mjs` | A minimal mDNS/DNS-SD codec, advertiser and browser on `dgram` (PTR, SRV, TXT, A; compression pointers on read). Only for the spike or a dedicated LAN box: on iOS/tvOS the apps must use the system Bonjour APIs. |
| `host.mjs` | The controller's role: advertises `_tarkman._tcp`, serves the state over newline-delimited JSON, heartbeats, applies local `next`/`prev` against a stand-in manifest. |
| `follower.mjs` | A display's role: browses for the session's host, connects, applies publications through the reducer, drops the host after its lease lapses. |
| `spike.test.mjs` | Unit tests for the rules and the codec, plus an end-to-end test on this machine (skipped where multicast is unavailable). |

## Run

```sh
node --test spikes/lan-session/*.test.mjs      # or: npm run lan-spike:test

# Two terminals (or two machines on one LAN):
node spikes/lan-session/host.mjs 42            # Enter = next, p = prev, q = quit
node spikes/lan-session/follower.mjs 42
```

On a Mac, `dns-sd -B _tarkman._tcp` lists the running host, which shows the advertisement is
standard DNS-SD and would be visible to `NWBrowser` on an iPhone or Apple TV.

## What it showed

- Discovery, connection and the first state arrive in well under a second on one machine; a `next`
  reaches the follower in the next write (tens of milliseconds, no polling).
- The follower never needs a wall clock to order updates: `[base, epoch, seq]` is enough, and a
  cloud revision always outranks the provisional commands that preceded it.
- LAN-first publishing (the room moves on the tap, the cloud confirms a moment later) is just the
  ordering key at work: the cloud's acceptance arrives under a higher key with identical content and
  changes nothing visible; a 409 snaps the room to the cloud once. Tested in `spike.test.mjs`.
- The host's log compresses to the two requests today's backend already accepts (`set_part` and
  `update_status`, both with `expected_revision`), so the fallback needs no backend change.

## What it does not show

No TLS, no pairing, no manifest transfer, no persistence of the log, no iOS/tvOS permission
behaviour, and no real cloud: the cloud side is modelled by `applyCloud` and `settle` in tests.
