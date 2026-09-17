# Web session display: latency and recovery review

Source review on 2026-09-17. No web benchmark or web application changes were made. These are code-supported opportunities, not measured web latency reductions.

Reviewed `apps/web` in `codex/session-latency-benchmark` at base `354574d`. The display route, reader hook, both display layouts, and scroll implementation are identical in the user's primary checkout (`b424738`). Control-screen differences between those checkouts concern boundary handling, not the invalidation behavior described below.

## Existing fast path

`useSessionParts.ts:108–125` applies a cable event's `part` to local state and scrolls to an existing DOM reference. It does not fetch the entire parts list before showing each move. `smoothScrollToPart.ts:35–42` snaps immediately, then separately scrolls through a long reading using its configured duration. That later continuous scrolling is intentional reading behavior; it is different from the mobile transition animation removed in this change.

ActionCable consumers and subscriptions are already shared by URL/channel (`useActionCable.ts:93–139`). Multiple hook consumers should not be described as separate socket connections.

## Recommended changes

### 1. Narrow query invalidations; keep text separate from live session state

- `queries/sessions.ts:11–12` defines session state as `['sessions', 'session', id]` and parts as that same prefix plus `'parts'`.
- `useSessionParts.ts:126–129` invalidates the session prefix on a status event, which also matches the parts query.
- `SessionControls.ts:55–58` invalidates both that prefix and the parts key after a command. These overlap and can refetch or restart the same parts request.

Use exact session-state invalidation when only the position/status changed. Refresh the parts manifest for content/liturgy changes and explicit recovery. Separate the cached manifest from the canonical current session so that a parts refresh cannot republish an older cursor embedded in `PartsResponse.sessionData`.

Expected benefit: fewer full parts downloads and less serialization work for status/control updates. This is the lowest-risk network optimization once the corresponding query tests confirm the intended invalidation scopes.

Acceptance: one session-state refresh per accepted command, no parts download for a pure status change, one deliberate parts refresh when content changes, and a stale/refused command still reconciles correctly.

### 2. Memoize reading rows and precompute Markdown input

`SessionPartsSingle.tsx:34–61` and `SessionPartsParallel.tsx:31–73` map the entire manifest into Markdown components. A current-part state update rerenders the layout; every visible-language cell reconstructs its normalized Markdown string. The parallel layout can create two Markdown trees per occurrence.

Extract a memoized reading row with stable part/text props. Compute newline normalization when content or language changes. A move should normally update the previous/current row styling and the scroll target, rather than re-rendering every unchanged Markdown cell.

Expected benefit: less main-thread work as manifests and language columns grow. No timing estimate is claimed from this source review. Preserve row dimensions and duration attributes, because continuous reading scroll depends on measured height. Do not introduce virtualization before validating jump/height behavior on the projector display.

Acceptance: unchanged rows do not rerender for a pure cursor move; changing language/text updates the appropriate cells; long-reading duration scrolling still works.

### 3. Make recovery authoritative, then reduce one-second polling

- `routes/sessions.$id.display.tsx:83–94` polls the full session every second.
- `useSessionPolling.ts:44–50` and `useUserSessionPolling.ts:40–44` also use a one-second cadence for an active session in the discovery-based display.
- This is approximately 60 session reads per minute per active display, even when no one advances it. The comment about jitter in `useSessionPolling.ts` does not implement jitter.
- `useActionCable.ts:114–120` forwards received events but does not expose connected/disconnected/reconnected state to the display reader.
- The `useSessionParts` position effect reads the session embedded in the parts-query result (`:81–106`), not every new `options.sessionData` from the parent's poll. Its stale-data protection only covers a live event that arrives before the initial parts result. Later stale parts results can republish an older cursor. Repeated events can also restart scrolling even when their `part` is unchanged.

First reconcile canonical polled state independently of cached text, suppress duplicate scroll transitions, and expose connection health. Then use a slower reconciliation poll while connected, immediate verification on reconnect/focus, and an appropriate fallback cadence while disconnected. Give startup/reconnect polling jitter where many displays can reconnect together.

Expected benefit: substantially less steady backend traffic. Reducing polling alone would weaken recovery from missed events; it is dependent on the state/reconnect work above.

Acceptance: a deliberately missed cable event is corrected by a canonical read; reconnect recovers without waiting for another operator action; a stale response cannot rewind a newer accepted position; duplicate notifications do not restart a long reading's timer.

### 4. Resolve occurrences consistently before relying more heavily on cable state

`SessionPartsSingle.tsx:35–48` uses reusable `part.id` for highlighting, React keys and DOM references. `SessionPartsParallel.tsx:41` improves the React key with `liturgy_part_id`, but highlighting (`:32`) and DOM references (`:45`) still use `part.id`. Repeated parts can overwrite each other's references or highlight more than one row. The event contains `part` and liturgy metadata, but no occurrence ID or monotonic revision.

The current backend also deduplicates reusable parts in `Session#all_parts_ordered`, derives `current_liturgy` by the first matching liturgy, and derives the current position from the reusable part. Consequently, changing frontend keys alone cannot establish independent repeated-occurrence navigation. A reliable protocol should publish an occurrence ID and ordered state revision in the response, event and canonical session endpoint. Apply one shared resolver to keys, highlighting, scrolling and controller boundaries.

This is a correctness prerequisite for a more aggressive event-only path. It is not a measured performance win and requires backend work outside this mobile-only change.

## Suggested order

Narrow invalidations and isolate memoized rows first. Next, unify canonical state and reconnect recovery; only then lengthen polling. Design the occurrence/revision contract before removing consistency checks or patching ambiguous events directly into state.

The mobile implementation keeps canonical before/after reads and bounded full refreshes for these reasons. Copying the web event-only path into mobile would remove important safeguards.

## Verification scope

The source paths and both checkouts were compared directly. During PR preparation, the locked web dependencies were installed and the full web suite passed 356 tests across 40 files; the production build, including TypeScript, also passed. These checks establish regression coverage, not runtime profiling. The mobile production benchmark must not be used to infer a web display timing distribution.
