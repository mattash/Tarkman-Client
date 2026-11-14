# Exact-passage bookmarks and resume (#276)

**Draft / not ready for merge.** Provisionally stacked on #280 at
`7aa34e13fb04cfdf6c110255d8591f4467a81e69`, including its corrected repeated-native-jump
geometry cache. Reconcile to its accepted final main commit before readiness.
#276 native evidence and audible/focus accessibility validation remain unverified.
The owner requested restoration of changed phone accessibility settings. Physical
phone work is paused by orchestration coordination until a specific slot is
released; no new VoiceOver enablement or owner prompt is authorized. Separately
authorized owned-simulator validation must not be presented as physical-phone or
VoiceOver proof. Do not substitute mobile-sized web images for native evidence.

## Address and restoration

`PassageAnchor` is the exact `TextJumpTarget` from #280: liturgy ID, immutable
revision, active language, occurrence (`liturgyPartId`), reusable part ID,
occurrence index, and nonempty original-source UTF-16 `[start,end)`. The metadata
key separately scopes it to the controller's normalized environment. Every open
uses `resolveTextJump`; no fallback by reusable part, ordinal, new revision or
pixel offset is permitted. Unsupported personal-reader languages are unavailable
rather than silently relabelled. Opening a valid saved passage explicitly selects
its saved reading language and uses the existing `PassageJump` rendering request.

The optional `PartList.passageVisible` callback reports the first meaningful
visible active-language line, even inside long occurrences and compact stanzas.
Native uses actual `onTextLayout` geometry with the Markdown source map; web uses
DOM glyph ranges because RN web has no `onTextLayout`. Only mounted rows are
measured, on a 120ms throttle, with recycled-row/async generation guards. No new
required props or behavior are added to live-follow callers.

Saved passages are available in the service header and reading preferences.
Bookmarks can be opened/removed; reading position can be cleared separately.
Initial layout does not overwrite a previous continuation. Resume persistence
starts after manual browsing or an explicit saved jump, debounces for 500ms and
flushes on unmount. Clearing the position disables that flush until new browsing.
A failed metadata hydration does not enable passive autosave. Revision/missing
occurrence/missing text produce an explicit unavailable state. When content cannot
be loaded, the stored entries remain removable, but cannot open or fetch content.

## Local persistence and removal

`readingMetadata.ts` projects only typed anchors; no prayer text, titles, live
session IDs or service cursors are stored. A bounded versioned environment record
holds per-liturgy resume plus at most 100 bookmarks per liturgy (at most 1000
liturgies / 2,097,152 serialized UTF-16 units per environment). Clear-all includes
online-only reading records, not just downloads in the current controller.
Corrupt/unknown/provisional occurrenceId-offset schemas fail closed. The live
`tarkman.last-reading.v1` shortcut is neither migrated nor changed.

All metadata reads/writes/removals share an adapter queue. The controller issues a
content-generation lease per reader opening. Remove/revoke/clear-all invalidates
leases synchronously, clears open snapshots, cancels old content transfers, and
queues metadata deletion after preceding saves. Guarded queued operations recheck
the lease after storage awaits; a late old reader cannot recreate cleared records.
An explicit later reader can acquire a new lease only through normal content
availability. Storage deletion failures remain reported, never claimed successful.
No metadata operation downloads content or invokes live controls.

Native metadata uses the existing on-device SQLite key-value adapter. Web uses a
strict localStorage adapter that reports blocked reads/deletes as failures.
Browser clearing/private-session restrictions can remove this metadata; it is not
account sync, encrypted private storage or a durable browser prayer download.
Available native downloaded bundles remain readable offline. Web prayer content
still requires the existing online application/API path; metadata persistence
**does not establish offline browser cold start**.

## Verification and remaining gates

Focused storage, lifecycle, reader interactions and precise passage-visibility
coverage includes repeated parts, revision replacement, missing content, multiple
liturgies/environments, storage failure/retry, language/size changes, deletion,
revocation, clear-all, pending writes/transfers and stale callbacks. Run the full
mobile suite, typecheck/lint, copy/UI gates, web export and `npm run reader:check`.
Matched actual web evidence is in `docs/evidence/issue-276`; native Before/After,
physical accessibility/focus and offline cold-start checks remain explicit gates.
No phone access or production-app changes are part of this preparatory work.
