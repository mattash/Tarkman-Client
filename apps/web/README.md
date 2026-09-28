# apps/web (deprecated)

This is the original React + Vite client. It was replaced in production by the
Expo web export of [`apps/mobile`](../mobile/README.md) on September 25, 2026
(cutover #177, PR #194), and nothing deploys from this directory any more.

It is kept only until the post-cutover rollback window closes, then removed.
Do not add features here; fix bugs in `apps/mobile`. The root scripts for this
app are `npm run legacy-web:*`, and the repository [README](../../README.md) and
`CLAUDE.md` still document it under their legacy sections.

[Legacy web CI](../../.github/workflows/legacy-web.yml) typechecks, builds and
tests this app on Node 24, and runs the core consumer compile probes, only when
`apps/web/**`, `packages/tarkman-core/**` or that workflow changes (or when run
manually). It is intentionally not a required check (#205). When removing this
app, delete that workflow and the `web` entries in
`packages/tarkman-core/scripts/check-consumers.mjs` and `check-package.mjs`.
