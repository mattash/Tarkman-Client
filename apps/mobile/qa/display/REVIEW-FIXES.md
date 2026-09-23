# Issue #173 independent-review fixes — 2026-09-23

Verified the existing worktree and clean starting HEAD
`1ca2de67b7ee92affdcd0bd160f5a0bae851d011` on
`feat/173-display-links-manager`. `origin/main` matches the preparation receipt:
`c93e3d31df0cf47e37473932771e6b1dcdf58045`. No history rewrite or push.

Changes are confined to mobile. No additional shared-core changes were needed;
no apps/web source or dependency manifests were changed.

- Authenticated DELETE has destructive confirmation, English/Russian copy,
  duplicate prevention, request timeout, navigation fencing, and terminal
  401/403/404 handling. Unknown outcomes require collection reconciliation and
  explicit review before another write; they never automatically retry DELETE.
- Error decoding preserves HTTP status with empty/malformed error bodies.
- Public GET accepts incomplete additive presentation data through legacy
  normalization, while rejecting invalid identity, version, and expiration.
  Cable snapshots and invalidations retain strict, monotonic validation.
- Redaction covers plain and repeatedly stringified token identifiers.
- Editing clears stale errors; expiration text/validity stays separate from
  typed configuration and survives validation/review as an explicit draft.
- New catalogs use the surrounding catalog style. Test type errors and dynamic
  imports exposed by running the previously uninstalled dependencies were fixed.

## Verification

Environment: Node v26.8.2. Both apps initially lacked node_modules. Web installed
from the local npm cache. The mobile cache lacks expo-clipboard 57.0.2;
`npm ci --offline` fails ENOTCACHED. An online install fails
`getaddrinfo ENOTFOUND registry.npmjs.org` for that tarball.

To run available checks, all other mobile dependencies were installed offline
with clipboard temporarily omitted from the manifests. Both manifest files were
restored byte-for-byte immediately afterward. No clipboard implementation or type
stub was installed, and the dependency/lock metadata remains unchanged.

| Check | Result |
| --- | --- |
| `npm run typecheck` (web) | Pass |
| `npm test -- --run` (web) | 40 suites, 359 tests pass |
| `npm run build` (web) | Pass |
| `npm run core:test` | 13 tests and boundary guard pass |
| `npm run core:check-consumers` | Web and mobile compile probes pass |
| Mobile `lint`, `check:i18n`, `check:ui` | Pass |
| Mobile management/API, reader GET and config controller tests | Pass without any clipboard mapping |
| Full mobile Jest suite with existing clipboard mocks made resolvable | 53 suites, 641 tests pass |
| Mobile `typecheck` | Only remaining error: TS2307, missing expo-clipboard in features/displayLinks/share.ts:1 |
| `CI=1 EXPO_OFFLINE=1 npm run export:web --prefix apps/mobile` | Metro fails resolving expo-clipboard |
| `npm run test:integration` (web) | 8 failed, 4 passed, 3 skipped; live explanation requests fail ENOTFOUND example.test; auth-dependent suites skip |
| `git diff --check` | Pass |

The unmodified full mobile test command cannot resolve clipboard in three suites.
For the supplementary full run, Jest alone maps `^expo-clipboard$` to a temporary
file outside the repository; each affected suite already defines its own
`jest.mock` factory. The temporary file throws if loaded without that mock. This
allows behavioral tests to run without claiming clipboard runtime verification.
The full command used `--forceExit` because the standard run reported outstanding
async handles after finishing. Existing gesture/act warnings remain.

Installed expo-router 57.0.22 declarations re-export usePreventRemove through
react-navigation/native → core; its NavigationAction type and the editor import
resolve in the actual TypeScript check. Installed Expo's bundledNativeModules.json
specifies expo-clipboard `~57.0.2`, matching package.json and the lock's 57.0.2
entry. The tarball and its missing lock integrity metadata could not be verified
or regenerated authoritatively because the registry is unavailable. Full mobile
build/typecheck and native clipboard acceptance remain blocked until npm ci can
fetch it. No native/device or browser screenshot acceptance is claimed.

Reviewed the complete diff for secrets; added-line private-key/access-token
patterns found zero matches. Test URLs and capabilities are synthetic fixtures.

## Commit blocker

`git add ... && git commit -m 'Fix display link manager review findings'` failed
at staging: Git could not create
`/Users/mattash/Projects/Tarkman-Client/.git/worktrees/Tarkman-Client-173-display-links/index.lock`
(`Operation not permitted`). The worktree's Git metadata is outside the sandbox's
writable roots; this session cannot request elevated permissions. HEAD remains
1ca2de6, and all fixes remain uncommitted in this worktree. Nothing was pushed.

The requested Telegram completion/failure command was invoked once. OpenClaw
exited before delivery because it could not create its fallback temporary
directory `/Users/mattash/Library/Caches/openclaw-501`. No notification delivery
was confirmed.
