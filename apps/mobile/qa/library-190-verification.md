# Issue #190 implementation verification

Date: 2026-09-25. Branch: `issue-190-public-liturgy-library`.
Initial Git HEAD: `3ac346e459b7a2e482f2118e79564f09bc0fb181`.
The parent fetched `origin/main` immediately before committing and proved the base SHA was still its ancestor.

Exact changed code/test/fixture bytes are recorded in
[`library-190-code-sha256.json`](library-190-code-sha256.json), whose SHA-256 is
`6163df30dcaa0d8bb8db1aba3b67879f227207088ccaebe12b19b6f069f34a88`.
The manifest excludes prose/QA reports and covers all 39 changed code/test/fixture
files. All changes, including the reports, are under `apps/mobile`.

## Preparation and dependency environment

Verified the isolated cwd, clean initial tree, branch, canonical `origin`, and exact
requested starting SHA before editing. Read repository AGENTS.md and CLAUDE.md,
the complete local issue body and Atlas plan. `.clawpatch/config.json` was absent
from the isolated checkout; the primary checkout's copy was located and read later,
after initial implementation edits. No primary-checkout file was modified.

`npm ci --prefix apps/mobile` failed with `ENOTFOUND registry.npmjs.org`
(expo-clipboard tarball). To execute checks, copied the existing primary mobile
`node_modules` into this worktree; all directly installed package versions were
checked against this worktree's lockfile and matched. No dependency or lockfile
changes were made. Runtime: Node v26.8.2. Native storage tests use real Node SQLite
behind the Expo async interface, not an actual device bridge.

Two accidentally root-invoked `npm run typecheck` attempts dispatched the repository's
web wrapper and failed `tsc: command not found`. They changed no web files and are
not counted as mobile checks. All checks below ran from `apps/mobile`.

## Commands and exact final outcomes

| Command (from `apps/mobile`) | Outcome |
| --- | --- |
| `npm run lint` | Exit 0; no lint errors or warnings |
| `npm run typecheck` | Exit 0 |
| `npm run check:ui` | Exit 0; NativeWind 4 / Tailwind 3 guard passed |
| `npm run check:i18n` | Exit 0; no inline interface-copy findings |
| `npm run check:fonts` | Exit 0; release hashes and Armenian/punctuation coverage passed |
| `CI=1 npm run export:web` | Exit 0; 2,010 modules, three web bundles, exported to `dist` |
| `git diff --check` | Exit 0 |

The full Jest command, preserving all suites, was:

```sh
LIBRARY_BACKEND_FIXTURES=/Users/mattash/clawd/worktrees/tarkman-issue-452/spec/fixtures/public_liturgies npm test -- --json --outputFile=/private/tmp/issue-190-tests.json
```

Result: **827 passed, 1 failed, 0 skipped; 64 suites passed and 1 failed. Exit 1.**
All **51 Library assertions passed** (contracts 25, store 5, sync 13, UI 8).
Machine-readable summary: [`library-190-results.json`](library-190-results.json).

Only failing assertion: existing `tests/display-qr-fixture.test.ts`, “two connected
readers adopt QR and active status_change without a state GET or part navigation”.
Its child server exits because the sandbox rejects binding `127.0.0.1` with
`listen EPERM`. A direct invocation of `node qa/display/server.cjs` reproduced
that exact error. The new `node scripts/library-fixture-server.mjs` is blocked by
the same restriction on port 4190. These are runtime limitations, not claimed passes.
No tests were skipped or changed to hide this failure.

An earlier isolated run of all four Library suites with `--detectOpenHandles`
passed 49/49 tests, with no open-handle findings. Two additional typed HTTP error
cases were added afterward and are included in the final full-suite count. Jest
logs include gesture-handler mock warnings and Node's localStorage warning; an
intermediate full run also reported a delayed process exit. Native rendering and
browser screenshots are not established by these tests.

The exported web JS was inspected for the Library native database marker
`public-liturgy-library.db`: absent. The code hash manifest was rechecked: zero
mismatches. Test fixture parity ran against the supplied backend directory, not
just locally copied hashes. Full logs in this runtime:
`/private/tmp/issue-190-tests-final.log`, `/private/tmp/issue-190-tests.json`,
`/private/tmp/issue-190-export-final.log`, `/private/tmp/issue-190-focused.log`.

Skipped external checks: real-backend HTTP integration, independent rendered QA,
native/device offline cold start, native disk-full fault injection, VoiceOver and
TalkBack, and independent Lens review. The feature must stay gated pending them.

## Parent delivery verification

The parent reran the complete mobile gate from `apps/mobile`: lint and typecheck passed; all **65 test suites / 828 tests passed**; UI, i18n and font guards passed; and `CI=1 npm run export:web` exported successfully. A fresh `git fetch --prune origin` completed immediately before delivery, and `origin/main` remained `3ac346e459b7a2e482f2118e79564f09bc0fb181`, an ancestor of the implementation commit. No force push, merge, release, deploy, repository setting or `.env` change was made.

## Files and scope

- `app/(tabs)/live.tsx`, `app/_layout.tsx`, `app/library.tsx`,
  `app/liturgies/[id]/index.tsx`: Services switch, provider and separate Library routes.
- `features/library/`: strict contracts, anonymous API/config, dedicated native/web
  repository, bounded coordinator, consent/browse/manage screens, pinned manual
  reader and implementation notes.
- `features/home/ServicesList.tsx`, `features/home/Settings.tsx`: small integration
  points preserving the existing Live list and separate saved-service/preferences actions.
- `features/i18n/catalogs/en.ts`, `ru.ts`: new interface copy, no new locale.
- `tests/library-{contracts,store,sync,ui}.test.*`, `library-test-helpers.ts`,
  `tests/fixtures/public_liturgies*`: contract parity and regression evidence.
- `scripts/library-fixture-server.mjs`, `qa/library-190*`: independent QA and delivery handoff.

## Unproven gates and risks

Real-backend integration, real starter IDs/editorial publication, representative
production payload/latency, iOS/Android native durability and background behavior,
physical disk-full recovery, rendered screenshots, VoiceOver/TalkBack and fluent
review of new copy remain incomplete. Android evidence needs #191's runnable build.
No screenshot or real-device pass is claimed. Independent Lens review has not been
performed in this session. Production capability remains disabled.

Native fetch may allocate an unannounced response before the post-read byte check;
server bounds remain required. The SQLite payload cap does not reserve replacement
WAL/free-disk space; real writes can fail and must remain truthful. Offline copies
cannot be remotely revoked. Details and reproducible scenarios are in
[`library-190.md`](library-190.md) and [Library notes](../features/library/README.md).
