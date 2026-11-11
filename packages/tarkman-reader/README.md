# Tarkman reader

Platform-free reader and display decisions shared by mobile and Apple TV. Hosts
supply their existing text adapters; the engine does not own locale dictionaries.
Prophetic interruptions use `display.prophetic`, alongside gospel and epistle.
When `options.prophetic` is missing, canonical `readings.prophetic` supplies the
display text. Explicit null or empty options remain cleared; absent readings
normalize to null, so older sessions and hand-built display models continue to
work. Notification suppression and the existing title-only fallback apply unchanged.

## Variable readings

Session parts already contain backend-expanded text. The backend session JSON
partial renders a variable Part's legacy English accessor (`en: "prophetic"`)
from the session and publishes that rendered content as `en`; unset values become
empty text. Other language fields retain their authored translations. Admin reads
may instead publish `variable` / `variable_accessor`; those are not the session
reader contract and must not replace the expanded language fields.

The reader normalizes the published multilingual fields and strips legacy HTML
for projection, exactly as for gospel/epistle. It does not evaluate accessors or
substitute `options` / `readings` into part text. Rendering variable content is
backend-owned, not app-owned. Session readings and options already participate in
the existing parts-context invalidation.

Backend reference: [session part renderer](https://github.com/mattash/Tarkman/blob/master/app/views/parts/_part.json.jbuilder)
and [unset variable rendering contract (#518)](https://github.com/mattash/Tarkman/pull/518).

## Verification

After installing mobile's dependencies, run from the repository root:

```sh
node --test packages/tarkman-reader/tests/*.test.mjs
npm run reader:check
```

The scoped Node tests use mobile's locked TypeScript to transpile the platform-free
sources into a temporary directory; no package install or runtime dependency is
added to the reader. The apps' existing reader/display suites also exercise it.
