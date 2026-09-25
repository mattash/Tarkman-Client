# Issue 180: mobile explanation cue review

Scope: `apps/mobile` only. No network subscription, endpoint, dependency, persisted receipt, onboarding rule, legacy web, or shared-display UI was added. The fixture's new mutation endpoints are loopback-only synthetic QA controls.

## Reproduce rendered QA

From this isolated checkout, use separate terminals:

```sh
node apps/mobile/qa/design-system/mock-reader-server.cjs
```

```sh
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:8100 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8100/cable \
npm run web -- --port 8082
```

Open `http://localhost:8082/sessions/9001/parts`. Keep the fixture running; confirm its startup reports ActionCable enabled. Restart it for a fresh scenario. Use only service 9001, never public worship content.

1. At 390×844, wait for the live state and badge `1`. Capture the initial header. The button's accessible name must include the full new count and must not be selected.
2. Open explanations, wait for “Sample explanation · Lord’s Prayer” and its body to render, dismiss. Badge must be absent; the quiet availability treatment remains. Reopen and verify access/content.
3. With the sheet closed, run the edit command below. Capture badge `1`, open and verify the edited body, dismiss and capture clearing. Repeating an equal edit must not re-badge acknowledged content.
4. Run `add`, then `many`. Verify unique counts and `9+`; the accessible button must announce 12, not “9+”. Compare header/icon bounds before/after; no neighbor overlap, clipping, wrapping or target size change.
5. Run occurrence index `1`: this occurrence must independently show `1`. Present/dismiss; return to index `0`: unchanged previously presented versions must stay acknowledged. Changing the reading language, appearance, reading size, manual browsing or replaying the tour must not reset that history.
6. Leave the sheet open and run `edit`/`add`: newly committed content should clear its own badge without reopening. Background/foreground and navigate away/back; fresh verification should acknowledge visible content without a second modal show event. Disconnect while loading and dismiss; late results must not acknowledge unseen content.
7. Run `empty`: no badge, ordinary empty explanation state. Restart the fixture to reset its authored data. Reload the reader to reset in-memory presentation history.

```sh
curl -X POST http://127.0.0.1:8100/fixture/explanations \
  -H 'Content-Type: application/json' -d '{"scenario":"edit"}'
# Other deterministic scenarios: reset, add, many, empty.
curl -X POST http://127.0.0.1:8100/fixture/occurrence \
  -H 'Content-Type: application/json' -d '{"index":1}'
# Indices: 0, 1, 2. Edits are retained separately for each occurrence.
```

These commands publish legacy ActionCable invalidations. The fixture now returns occurrence-owned explanations for progression, including the same explanation ID on distinct occurrences. Revisioned fast-path/no-flicker and delayed-response races are exercised by controller tests, not by this legacy fixture.

Native: build/run the local iOS development client with the same fixture endpoints and open session 9001. Run `maestro test maestro/fixture-explanations.yaml` from `apps/mobile` after the fixture-open-service prerequisites in the mobile README. The flow asserts badge before opening, content visibility, badge absence after dismissal, and reopening. Loopback works on the host simulator; physical-device network setup must make the fixture reachable without exposing production content.

Repeat on iPhone and iPad, portrait/landscape, light/dark, largest accessibility text, VoiceOver, keyboard navigation on Expo web, Reduce Motion, and unavailable icon-font fallback. Check that the decorative badge is neither a focus stop nor a separate tap target. Capture initial, edited/new, cleared, and next-occurrence screenshots. These are pending rendered acceptance checks, not inferred from Jest.

## Executed evidence and blockers

- Starting worktree path and clean HEAD verified against `dfb974c54671755a72320d8a7f102abc6a19de9f`.
- `gh issue view 180 --repo mattash/Tarkman-Client --comments` could not reach GitHub. Full issue retrieved using the connected GitHub read tool; issue had zero comments.
- Dependencies installed with `npm ci --offline --no-audit --no-fund` using a writable copy of the existing npm cache after network installation failed DNS resolution. Lockfile unchanged.
- Fixture Node syntax and `git diff --check` passed.
- No browser screenshots or native/device QA performed: fixture startup failed `listen EPERM 127.0.0.1:8100`; agent-browser was absent and unavailable in the offline cache. Existing screenshots elsewhere in this repo predate this change and are not evidence for it.
- Commit blocked: Git cannot create the isolated worktree's `index.lock` under the primary repository's `.git/worktrees/...` (Operation not permitted). No workaround writes to primary checkout were attempted.
- Required final `git fetch --prune origin` blocked on `FETCH_HEAD` by the same metadata permissions. `git merge-base --is-ancestor origin/main HEAD` succeeds only against the existing local ref, both still at the prepared base SHA. This is not proof of current remote ancestry. No push, PR, merge or deployment performed.

## Final local check results

All commands executed for `apps/mobile` on 2026-09-24 (local time):

| Command | Result |
| --- | --- |
| `npm run lint` | Exit 0, no lint warnings/errors |
| `npm run typecheck` | Exit 0 |
| `npm test` | 57 suites passed; 690 tests passed; 0 snapshots; 50.088 seconds |
| `npm run check:ui` | Mobile UI guard passed |
| `npm run check:i18n` | No inline interface copy outside catalogs |
| `CI=1 npm run export:web` | Exit 0; exported `dist` |
| `node --check qa/design-system/mock-reader-server.cjs` | Exit 0 |
| `git diff --check` | Exit 0 |

Jest emits existing native gesture-handler/act warnings; these are not rendered device evidence. The saved-service tests explicitly verify that live fingerprints are not persisted. No dependency/lockfile changes were made.

Current HEAD (unchanged prepared base): `dfb974c54671755a72320d8a7f102abc6a19de9f`. There is no implementation commit SHA or PR URL because Git metadata writes/fetch are blocked. Prepared PR text is in [PR.md](PR.md).

## Review risks

Modal onShow/layout and native focus restoration need actual iOS/iPadOS review. The numeric adornment uses bounded scaling; large-text, icon-font fallback and physical VoiceOver remain unverified. Russian plural forms have automated coverage but the added wording needs fluent-reader review. Acknowledgment means an eligible collection was presented, not that every item was read or scrolled into view. Unknown content context intentionally suppresses retained cues during recovery.
