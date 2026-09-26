# apps/web (deprecated)

This is the original React + Vite client. It was replaced in production by the
Expo web export of [`apps/mobile`](../mobile/README.md) on September 25, 2026
(cutover #177, PR #194), and nothing deploys from this directory any more.

It is kept only until the post-cutover rollback window closes, then removed.
Do not add features here; fix bugs in `apps/mobile`. The root scripts for this
app are `npm run legacy-web:*`, and the repository [README](../../README.md) and
`CLAUDE.md` still document it under their legacy sections.
