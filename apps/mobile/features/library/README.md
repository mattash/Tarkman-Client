# Public liturgy Library (client #190 / backend #452)

Implementation scope is `apps/mobile`. Live service readers, session snapshots,
authentication and control endpoints retain their existing behavior. No deployment
or content publication is included. Production integration is **disabled**, even
if the development flag is accidentally present in a production export. An explicit
fixture-build override permits loopback only, for embedded native QA builds.

## Contract and fixture provenance

Backend-owned source: `Tarkman/spec/fixtures/public_liturgies`, read from the isolated
`/Users/mattash/clawd/worktrees/tarkman-issue-452` working tree on 2026-09-25.
Its HEAD was `cbe8999fb9a336699e2244b8b441d563c7646808` when copied; these new
fixtures were not yet committed at that HEAD. The exact copied bytes are pinned in
`tests/fixtures/public_liturgies.sha256.json`. Do not describe the old backend HEAD
as containing these fixtures. The contract test checks all hashes; run with
`LIBRARY_BACKEND_FIXTURES=/path/to/Tarkman/spec/fixtures/public_liturgies` to additionally
compare every byte to the actual backend checkout. Update both sides deliberately
when the backend contract changes. Synthetic ID 701 is never a production starter.

Anonymous GET only, `credentials: omit`, no auth headers or redirects:

- `/public/liturgies.json?limit=100&after_id=…` (omit cursor initially)
- `recommended=true` uses its own independently paginated catalog.
- `/public/liturgies/:id/download.json`; quoted opaque revision in `If-None-Match`.

`schema_version=1` is required. The validator projects allowlisted fields, checks
positive safe integer identity, ordered occurrence IDs (position then ID), all six
wire language keys, actual language availability, roles/postures, nullable pages,
published occurrence-bound explanation shape, and session-context English nulls.
Personal reading still offers en/ru/grabar/translit only; East/West Armenian are
preserved under their original wire keys without relabeling. Unknown response
metadata is discarded. Missing required fields fail closed. No arbitrary object
is persisted. Only the backend can establish public/published eligibility; client
validation does not replace backend authorization testing.

Measured compact UTF-8 fixture sizes: original bundle **1,143 bytes**, updated
bundle **1,151 bytes**. These are synthetic measurements, not representative
production-size evidence. Maximum accepted bundle: 10 MiB; aggregate native
payload budget across environments: 100 MiB. Per string: 1 Mi characters; names
and explanation titles: 4,096; revision: 256; occurrences: 20,000; explanations per
occurrence: 1,000; catalog page: 100; loaded catalog: 10,000; recommended pagination:
100 pages; transfer queue: 100 waiting plus two running; timeout: 20 seconds.
Large known downloads (at least 5 MiB each) require confirmation; network type and
unknown total size are never invented. No text truncation or automatic eviction.

Native fetch lacks a universally available response stream: declared Content-Length
is checked before reading, actual UTF-8 length after reading. A malicious server
without Content-Length can still allocate memory before the latter check; integration
must enforce the same server bound. Native transport cancellation and memory pressure
need device verification.

## Storage, intent and sync

`public-liturgy-library.db` is dedicated Expo SQLite storage, schema/user_version 2.
`library_items` keys on normalized environment URL + liturgy ID. An explicit request
records intent; a successful transaction replaces the entire validated payload,
byte count, successful saved date and verification date together. Catalog identity,
revision, languages and occurrence metadata are contained in the complete bundle.
No TTL applies. Future unsupported schemas fail closed; corrupt rows are isolated
and retained until deliberate removal. A corrupt row never deletes another download.
Saved service snapshot storage and its seven-day TTL are untouched.

Each atomic replacement also stores a local SHA-256 checksum (installed Expo
Crypto) over the exact complete projected payload, environment, ID, byte count and
saved timestamp, with a versioned domain marker. Hydration checks it before JSON
parsing/contract validation; 304 handling rehydrates and verification checks again
inside its transaction. Verification time is mutable bookkeeping, not part of the
content checksum. Checksums/content are never logged or sent over the network.
This detects local corruption, not malicious rewriting of both payload and checksum.
Hydration reads one payload at a time, bounds each to 10 MiB in SQL before returning
it to JS, and processes at most 100 MiB of payload per hydration, sequentially.

The transactional v1→v2 migration adds a nullable checksum without backfilling:
legacy payloads cannot be established as intact and are quarantined like corrupted
rows. Intent-only rows and prompt dismissal survive. Quarantined copies cannot be
read offline or satisfy 304. Recovery is an explicit Download from the catalog
(which atomically replaces that row), or Remove all library downloads; unrelated
valid downloads/environments remain intact. No automatic network migration occurs.

All operations share a queue, and each replacement uses
`withExclusiveTransactionAsync` with the transaction object's methods. See the
installed `expo-sqlite ~57.0.3` declarations and
[Expo transaction documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/).
The old snapshot survives validation/HTTP/write/transaction errors, including disk
full. The payload cap does not reserve filesystem space for SQLite/WAL replacement;
actual low-disk writes can fail and are reported without claiming download success.

Only Download / Download selected / Update / Sync downloads transfer and save text.
Read online is an in-memory request. Entering Library, opening the starter sheet,
changing selection, catalog refresh, sign-in/out and resetting reading preferences
never download text. Skip persists separately in `library_preferences`; a quiet
Choose downloads button remains. No configured recommendations means no invitation.
There is no production starter mapping: editorial verification remains outstanding.

Metadata refresh coalesces work, observes explicit continuation, and uses a five-minute
successful-check cooldown except explicit Refresh/Load more. Offline/partial checks
never assert freshness. Saved IDs absent from metadata still sync directly by ID.
At most two bundle requests run; duplicate requests share their completion. A Download arriving during Read online
waits for that online job, then queues a normal durable request; duplicate durable
waiters coalesce. This may require a second transfer, but Download cannot finish
successfully before persistence. Cancellation, removal, disposal and authoritative
unavailability discard the waiting durable request; retry remains explicit. 304
requires an intact corresponding local revision, otherwise one unconditional retry.
A changed catalog/download pair gets one unconditional per-item revalidation; a
second changing revision fails. Equal revisions preserve the download timestamp.
Updates never mutate an already-open reader snapshot. The reader offers a reopen
notice, not a live jump. No bookmarks or account sync are introduced.

Remove/Clear invalidate pending generations and serialize deletion after earlier
writes. Failed deletion is reported. Backgrounding cancels work, with explicit
retry required; disposal/environment replacement invalidates all late work. Stored
copies in other environments are retained but not surfaced across environments.

Only a per-item HTTP 404 with the exact validated v1
`public_liturgy_unavailable` envelope is authoritative. That item's generations are
invalidated, open reading is cleared, and its persisted copy is removed. Generic
404s, HTML, 5xx, invalid/oversize content, timeout and catalog omissions preserve old
copies. Permanently offline copies cannot be remotely revoked. Failed filesystem
removal cannot guarantee deletion; the current reader remains blocked and a storage
error is shown.

## Platform and release status

Native iOS/Android use SQLite. Expo web intentionally uses no library SQLite import,
provides online reading only, and cannot report a durable download. Web localStorage
is used only for optional prompt dismissal. No service worker/PWA work is included.

`EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1` plus `EXPO_PUBLIC_LIBRARY_API_URL` enables
**development-only** test integration. URL normalization rejects credentials, query,
fragment and unsafe protocols; HTTP is limited to loopback in development. A release
build always gets a null remote network capability. The additional explicit
`EXPO_PUBLIC_LIBRARY_FIXTURE_BUILD=1` permits loopback-only fixture access in an
embedded QA build, so offline cold start does not depend on Metro. Neither flag
is set in repository build configuration. No `.env` file is required or added.
Production enablement, real backend checks, real starter IDs, representative real
sizes/latency, native bridge/cold-start/accessibility QA, and human review of the new
English/Russian copy remain release gates. Existing reviewed locale choices are not
expanded. See `qa/library-190.md` for the independent UI Operator handoff.
