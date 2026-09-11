# Tarkman core

Framework-neutral contracts for Expo 04 / issue #72. Both apps depend on
`@tarkman/core` via `file:../../packages/tarkman-core` with independent installs
and lockfiles. There are no root dependencies or npm workspaces.

The public entry point is `src/index.ts`. The top-level `types` entry supports
web's existing Node resolution; `exports` supports modern consumers.
Vite and Expo consume plain TypeScript;
no prepare hook or prebuilt dist is required for app installs. The local build
emits JS and declarations to ignored `dist/` for verification and core tests.

Run repository verification from the repository root, in this order:

```sh
npm ci --prefix apps/web
npm ls --all --prefix apps/web
npm ci --prefix apps/mobile
npm ls --all --prefix apps/mobile
npm run core:test
npm run core:check-consumers
```

`core:build` and `core:check` can also run separately after web's install.
Core tests build only core with its own strict, platform-free tsconfig and use
Node's test runner. The compiler and AST guard explicitly use web's locked
app-local TypeScript; there is no global compiler lookup or tooling download.
Consumer compile probes require both installs and use each app's own compiler.
Core is independently checked, but is not a standalone installable verification
toolchain: a fresh checkout must install web before building/testing core.
Do not run a root or core install.

Domain types originate from `apps/web/app/types`; language labels and helpers
follow `constants/languages.ts` and `LanguageContext`. CSS status colors stay
in web. Display languages remain distinct from content-selection languages.
Query keys mirror the existing query modules and current-session hooks. Policy
constants document existing polling values and explanation lookahead; importing
them starts no work. Existing web call sites and mobile UI are unchanged.

Inbound DTO vocabularies are open: `SessionStatus` is `string`, including observed
`live` and future values. `StatusChangeEvent`, `StatusUpdateResponse` and
`SessionData` use this inbound vocabulary. `Part.duration_type` (also exposed
through `PartResponse`) accepts any string, including observed `fixed`.
`KnownSessionStatus` is the closed set supported by existing UI labels and
`StatusUpdateRequest.status` commands. Receiving a value does not establish that
it is a supported command. No new command or UI label is inferred from wire data.

Public compile tests exercise these DTOs directly, including arbitrary strings,
and reject `live`/future command values. The consumer check repeats those probes
using each app's own TypeScript compiler and verifies local package resolution.

Raw transport records intentionally differ from complete DTOs. Web tests contain
`duration_type: "fixed"`, omit some required domain fields, and realtime tests
use both `live` and `active`. Normalizers validate only identity, envelope shape,
and authentication fields, and return raw records rather than asserting complete
domain objects. Unknown status/duration strings and extra payload fields survive;
no `live` to `active` mapping is assumed. Malformed contracts throw TypeError;
inactive current sessions normalize to null. HTTP errors and fallback behavior
belong to app adapters, not these normalizers.

Fixtures are synthetic examples derived from web query tests (session, part,
explanation), polling tests (inactive), AuthResponse (authentication), and
useActionCable/tests (application event envelopes). They are not captured backend
responses or proof of a native protocol. The explanation_updated empty payload
is an illustrative envelope, not a defined event-specific contract.

Transport, key/value storage, clock, timezone and realtime interfaces describe
injected capabilities only. Native authentication/refresh policy and native
ActionCable compatibility remain owner/backend decisions. No implementations,
network requests, navigation or platform configuration belong here.

The boundary guard checks every source file with the TypeScript AST, rejects
nonlocal imports (including type imports/re-exports/dynamic imports), escapes
outside src, platform globals and runtime dependencies. The compiler has no DOM
or Node ambient types. Node/TypeScript tooling is confined to tests and scripts.

Core has no dependencies, including devDependencies, and needs no lockfile or
node_modules. npm links local file dependencies without installing their own
dependencies, but `npm ls --all` traverses the link and checks devDependencies.
A separate core install would hide this clean-app CI failure. The package guard
rejects all dependency fields in core and both app locks, and regression tests
explicitly reject the original TypeScript devDependency. To verify install
isolation, start without root/core node_modules or core dist and run the sequence
above; each app's `npm ls --all` must pass before any core verification.
