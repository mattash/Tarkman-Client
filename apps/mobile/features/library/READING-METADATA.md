# Bookmarks/resume preparation (#276)

**Incomplete and not wired into the application.** Completion depends on #274
merging first. Its occurrence-aware passage jump contract must be reused; this
preparation deliberately introduces no alternative scroll/jump implementation.

## Prepared storage boundary

`readingMetadata.ts` takes a `KeyValueAdapter`; it has no platform, network,
authentication or live-reader imports. Each versioned key is scoped by the
controller's normalized environment and liturgy ID. Records hold one resume
anchor and up to 100 explicit bookmarks. Anchors retain revision, occurrence ID,
language and original-text UTF-16 offset, never reusable part ID alone, pixel
coordinates, copied prayer text, titles or service cursors. The offset shape
remains subject to alignment with #274's final contract before integration.

Writes/removals/reads serialize across clients sharing an adapter. Invalid or
unsupported stored schemas yield an empty record; known fields are projected,
not arbitrary response objects. There is no migration from the unrelated
`tarkman.last-reading.v1` session shortcut. Storage operations return failure
rather than interrupting reading. A failed delete is not reported as success.

## Remaining integration after #274

- Bind the final passage anchor to #274's occurrence-aware navigation contract.
  Capture a meaningful visible text position, including long virtualized parts;
  never substitute only the top occurrence or a raw screen/pixel offset.
- Restore only against the opened immutable bundle. Revision mismatch, missing
  occurrence, missing language/text or invalid offset must produce an explicit
  unavailable state, not a silent jump to another passage. Reading size changes
  should retain text identity. Language changes must not reinterpret offsets.
- Add accessible save/open/remove bookmark and clear-reading-position actions
  using mobile primitives and typed translations. Keep the Today session shortcut
  unchanged and never issue a live-follow/control command.
- Bind metadata removal and invalidation to confirmed download deletion and
  authoritative revocation, including races with in-flight resume saves. A clear
  orders earlier queued writes only; the reader must stop submitting new writes
  after removal. Metadata must not fetch/recreate deleted content or bypass the
  Library's unavailable state. Reading metadata contains no cached content.
- Choose the platform adapter explicitly: native on-device persistence and web
  localStorage metadata do not imply durable web prayer downloads, service worker
  availability or offline browser cold start. No cross-device sync.
- Add deterministic navigation/offline/lifecycle interaction tests alongside the
  storage tests; run the full mobile checks, web export and shared-reader guard.
  Capture matched actual Before/After application evidence after integration,
  including large text and accessibility focus. This storage-only preparation
  changes no rendered UI and has no application captures.

No human decision or permission is currently needed. #274 is a sequencing
prerequisite, not authorization to complete or merge this draft early.
