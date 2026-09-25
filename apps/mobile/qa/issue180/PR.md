Mobile reader: show new explanation counts after verified live updates

Fixes #180.

The current live occurrence's explanation button shows an in-memory count of authored items not yet presented. Equal refreshes and preference changes preserve identity; distinct occurrences can signal the same explanation independently. Presentation clears the count while keeping the availability highlight and access to the sheet.

Normalization records authored fingerprints before localized fallbacks and rejects conflicting duplicate IDs. Controller provenance/request tickets distinguish healthy revalidation from invalidation, with the same acceptance path for legacy and revisioned recovery. Reader-local batch and opening tokens guard modal show/layout/commit acknowledgment across occurrence changes, scope switches, dismissal, focus, background and reconnection. There is no new subscription, production endpoint, dependency or persistent receipt. Changes are scoped to apps/mobile.

Validation from apps/mobile:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 57 suites / 690 tests / 0 snapshots (50.088 seconds).
- `npm run check:ui`: passed.
- `npm run check:i18n`: passed.
- `CI=1 npm run export:web`: passed; exported dist.
- Fixture syntax and whitespace checks: passed.

The fixture is occurrence-aware and offers synthetic edit/add/many/empty scenarios. The Maestro flow asserts the badge before opening and its absence after presentation/dismissal. Reproducible rendered scenarios and actual execution limits are in `apps/mobile/qa/issue180/REVIEW.md`.

Explicit skips/blockers: no screenshots, browser rendered run, Maestro execution or iPhone/iPad/VoiceOver/Reduce Motion validation were completed. This environment denies the fixture's loopback listen; agent-browser is unavailable. Native modal/focus behavior, header geometry with large text/icon fallback, and the new Russian copy need rendered/fluent-reader review. Existing screenshots are not evidence for this feature.

Handoff status: this is prepared PR text, not a created PR. Commit and final fetch were blocked by read-only worktree Git metadata (`index.lock` / `FETCH_HEAD`). No branch push, PR creation, merge or deployment occurred. Current HEAD remains the prepared base. Re-fetch and verify `origin/main` ancestry after committing in an environment allowed to write the worktree metadata; update onto latest main and rerun affected checks if needed, then push without force and create the PR to main using this body after updating these handoff notes.
