# Affected-job CI rollout (#293)

The first phase records proposals only, on ordinary PR workflow events. Current
validation (including main pushes, native bundles and compile reuse) does not
consume the planner. The planner fails visibly if it cannot verify the merge
revision or compute the complete Git diff; no existing jobs depend on it. A
missing live title widens the proposal, as do `[full-ci]` and `[native-build]`.
The latter still follows the existing compile and reuse rules.

## Audited boundaries

| Input | Proposed consumers |
| --- | --- |
| Mobile routes, components, features, design bindings, tests, public files and non-font assets | Mobile |
| TV source, assets, tests and app documentation | TV |
| Mobile fonts, Expo identity and EAS profiles | Mobile + TV (`check:fonts`, `check:identity`) |
| Mobile manifest, lockfile and TypeScript config | All groups; TV's runtime check reads mobile's manifest, and Legacy web CI's core consumer probes install mobile and read its TypeScript config |
| `tarkman-core` | Mobile + TV + legacy web |
| `tarkman-reader` and `tarkman-design` | Mobile + TV; TV also runs the reader boundary checks |
| `tarkman-lectionary` | Mobile, including package contracts and Python parity |
| Deprecated web app | Legacy web |
| Shared tooling (including Metro), CI, unaudited config or unknown paths | All groups |

Keep the required `design` check for generated CSS and contrast in every plan.
The `mobile` proposal covers `mobile-checks`, `mobile-test` and `mobile-export`;
the `tv` proposal covers TV validation. No estimate should count stable gates
or existing conditional native jobs as jobs saved. The Git diff includes both
the PR's merge-base-to-head changes and the tested base-to-merge changes. Moves
are represented by both paths, and deletions retain the old path.

## Before enabling any omissions

- Compare the proposals with ordinary successful mobile-only and TV-only PRs.
  Record each head and tested merge, workload, cache restores or misses, and job
  timing. Use both planner job duration and time added to the dependency path;
  during observation the planner runs in parallel. Subtract planner overhead
  from the sum of validation jobs that actually ran and would be omitted. This
  estimates runner time, not elapsed feedback time or realized savings.
- Confirm that the plan agrees with actual consumers. If an app introduces a
  cross-app input, update the boundary and tests with that change. Use the
  planner tests for mixed, rename, deletion, unknown and unavailable-diff cases.
- Keep `design`, `mobile`, `ios-build` and Vercel stable (these were the required
  contexts on `main` when audited), along with the existing Android and TV gates.
  When wiring gates, validate a complete, revision-bound plan. Require explicit
  approval for each skipped child, and require `success` for every selected
  child; fail or run the baseline if the plan is unavailable. Exercise failure,
  cancellation, missing results and the full-validation override before rollout.
- Route PR legacy-web coverage from the complete plan before relying on its
  decisions. The current separate workflow has GitHub's path-filter limit and
  does not select every widened case. Retain its main-push and manual policy.
- Verify real PR native bundle and gate behavior separately from main cache
  seeding. Preserve #294's Metro caching, and keep `[native-build]` compile
  opt-in, native fingerprints and verified reuse unchanged.
