# Issue #181 validation

Only `apps/mobile` is changed. The starting branch was `fix/status-page-fallbacks`,
with clean HEAD `dfb974c54671755a72320d8a7f102abc6a19de9f` in the prepared isolated
worktree. `origin` matched the supplied canonical URL. No final fetch/rebase,
push, PR, merge, deployment, or production service access was performed.

The prescribed `gh issue view 181 --repo mattash/Tarkman-Client` failed twice
because the CLI could not connect to api.github.com. The GitHub connector read
the authoritative issue body successfully, including its September 24 baseline.

## Automated evidence

The targeted native tests use controlled reader state, real presentation
components, an explicitly controlled font context, dark theme, and synthetic
repeated occurrences. Dimension mocks cover 1440×900, 390×844, and 820×1180 at
fontScale 3; these assert output and layout props, not rendered geometry.

`tests/display-posture-web.test.tsx` explicitly imports `PostureIcon.web.tsx`
and mounts it with React DOM in jsdom. It verifies actual SVG paths, viewBoxes,
image roles and labels for absent/blank, standing, sitting, kneeling, and unknown
posture. This is separate from native coverage and is not a screenshot test.

The sandboxed `npm ci --prefix apps/mobile` attempt exited 1 on ENOTFOUND for the pinned expo-updates archive. The caller then ran the same pinned installation on the host; it succeeded (1049 packages). Package manifests and lockfiles were not changed. npm reported 15 moderate audit findings in existing dependencies; no dependency upgrades were authorized.

Commands below were run from `apps/mobile`:

| Command | Result |
| --- | --- |
| `npm test -- --runTestsByPath tests/display-presentation.test.ts tests/display-projection.test.tsx` | Passed: 2 suites, 62 tests |
| `npm test -- --runTestsByPath tests/display-posture-web.test.tsx` | Passed: 1 suite, 8 tests |
| `npm run lint` | Passed, exit 0 |
| `npm run typecheck` | Passed, exit 0 |
| `npm test` | Passed, exit 0: 55 suites, 708 tests; gesture-handler console warnings and Jest delayed-exit warning |
| `npm run check:ui` | Passed, exit 0 |
| `npm run check:i18n` | Passed, exit 0 |
| `CI=1 npm run export:web` | Passed, exit 0; 1927 modules, exported to ignored `dist` |

`git diff --check` and `node --check apps/mobile/qa/display/server.cjs` also
passed (run from the repository root).

Initial verification caught test tuple typing and an obsolete test query, both
fixed before the passing runs. The first targeted run also timed out in an
existing full-text test; the unchanged test passed on the next run. An accidental
root invocation of the targeted command reached the absent web Vitest runner and
exited 127; it ran no tests and changed no files.

## Rendered QA: not performed

This sandbox rejects a loopback HTTP listener with
`listen EPERM: operation not permitted 127.0.0.1:18181`. Consequently no local
Expo browser or native fixture session was exercised and no screenshots were
captured. Export success and jsdom/RNTL assertions do not establish optical
contrast, native font shaping, clipping, VoiceOver behavior, or real layout
stability. The requested initial book opacity (0.55) and size (35% of the shorter
slot dimension, bounded with the icon's two-point metrics and display scale)
remain subject to visual review.

## Reproducible synthetic visual review

From `apps/mobile`, in separate terminals on a host permitting local listeners:

```sh
DISPLAY_FIXTURE_MISSING_STATUS=1 node qa/display/server.cjs
```

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:8101 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:8101/cable \
EXPO_PUBLIC_DEFAULT_CHURCH_ID=7 \
npm run web -- --port 8082 --clear
```

The opt-in fixture leaves its initial occurrence (9902) without page or posture.
Other occurrences retain their original real values. Without the environment
flag, the existing fixture is unchanged. It binds only to loopback and never
contacts production.

Open `http://localhost:8082/sessions/9001/status/display` and
`http://localhost:8082/sessions/status/display?user_id=7`. Keep the fixture control
page at `http://127.0.0.1:8101/?app=http://localhost:8082` open alongside them.
Use **Parallel prayer** for 9902 (missing), **Long reading** for 9903 (page 108,
sitting), **Farewell** for 9904 (page 24, kneeling, repeating reusable part 902),
and **Parallel prayer** again to return to missing values. Leave the display mounted during these changes.

Capture missing and real values in each of these cases:

- 1440×900 landscape: side-by-side slots, stable 65% page / 35% posture proportions.
- 390×844 portrait: stacked slots with no clipping or horizontal overflow.
- 820×1180 and landscape tablet: same slots, centered book, stable transitions.
- Append `?status_view=pages_only` or `?status_view=posture_only` to the named
  route: only the enabled slot appears. Also try these preferences on
  `/sessions/9001/display` to exercise config-driven minimal rendering.
- Ordinary `/sessions/9001/display`: reading text, no page/posture fallback.
- English and Russian interface settings: localized image names and posture.
- Delayed/blocked bundled icon font: localized muted text, then one decorative
  book when ready; one image announcement, no keyboard stop or action semantics.

Confirm the book is visibly quieter and smaller than page 108, stays inside its
slot, and does not dim posture or actual numerals. Compare slot bounds before
and after updates. Record screenshots and browser/viewport details here after
execution; none currently exist.

For native, run an existing iOS development client against the same fixture via
Metro (the README's local development-client workflow, not Expo Go). Use an
approved local forwarding setup for a physical device: this fixture deliberately
binds to loopback. Open `/sessions/9001/status/display` with the development
client's route/deep-link tooling. Check iPhone and iPad portrait/landscape, maximum
Dynamic Type, VoiceOver image labeling, and font-not-ready behavior. Native
posture must remain the existing localized text presentation. Record device,
OS/build, text size, screenshots and observed results; no native result is claimed.

## Checkpoint

The worker sandbox could not create the shared worktree index.lock, so the caller committed the reviewed implementation from the prepared worktree. Commit e3c31cdba2a981492de26dd1f80de09b25b64bbb on fix/status-page-fallbacks contains the 11 implementation/test/fixture files. This validation note was written after that checkpoint. No push or PR was performed.

## Changed files (all relative to apps/mobile)

- `components/AppIcon.tsx`
- `features/displayLinks/presentation.ts`
- `features/displayLinks/PostureIcon.tsx`
- `features/displayLinks/PostureIcon.web.tsx`
- `features/displayLinks/DisplayProjection.tsx`
- `features/i18n/catalogs/en.ts`
- `features/i18n/catalogs/ru.ts`
- `tests/display-presentation.test.ts`
- `tests/display-projection.test.tsx`
- `tests/display-posture-web.test.tsx`
- `qa/display/server.cjs`
- `qa/status-181/VALIDATION.md`
