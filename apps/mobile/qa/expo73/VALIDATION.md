# Expo 05 / #73 review validation

Reviewed 2026-09-11 against the actual [issue #73](https://github.com/mattash/Tarkman-Client/issues/73), including its requirement to preserve safe links and supported formatting. Read root AGENTS.md and CLAUDE.md before editing.

## Git preparation and scope

Trusted existing worktree: `Tarkman-Client-Design`, branch `expo/05-design-primitives`.
HEAD and fetched `origin/main`: `a7b6213d3eb718d00ffc5ef4b01b2cfb55e07480`, divergence `0 0`. Local main is stale (18 commits behind HEAD); origin is the canonical remote. No remote feature-branch ref is present locally. Existing uncommitted gallery work was retained and repaired in place. No commit, push, PR, external message, history rewrite, EAS or credential action occurred.

All changes remain under apps/mobile. `git diff --exit-code HEAD -- apps/web packages/tarkman-core` passes. NativeWind 4 / Tailwind 3 and separate app dependency trees remain; font provenance, licenses and hashes are retained.

## Required validation

| Check | Result |
| --- | --- |
| Fresh `npm ci --prefix apps/mobile` | Passed |
| Mobile lint / typecheck | Passed, zero lint warnings |
| Mobile Jest | 2 suites, 31 tests passed |
| UI guard / font guard | Passed; both static fonts and U+0301/U+0304 coverage verified |
| `expo config --type public` | Passed; existing EAS identifiers retained |
| `npm ls --all --prefix apps/mobile` | Passed |
| Web export | Passed |
| iOS + Android export | Passed for both platforms |
| `npm run core:test` | 13 tests and boundary guard passed |
| `npm run core:check-consumers` | Web and mobile live/fixed/future compile probes passed |
| Fresh `npm ci --prefix apps/web` | Passed |
| Web typecheck / test / build | Passed; 38 suites / 341 tests |
| `git diff --check` | Passed |

Command output excerpts are in [validation-output.txt](validation-output.txt). Fresh installs emitted npm install-script policy notices; these are not browser errors. No dependency upgrades were made in response to those notices.

Exports were run as `CI=1 npm run export:web --prefix apps/mobile` and, from apps/mobile, `CI=1 npx expo export --platform ios --platform android --output-dir /private/tmp/expo73-dist-native`. Exports were rerun after the final renderer/favicon changes. Generated bundles remain outside the source diff.

## Browser evidence

Production mobile web export served on localhost:8087. Agent-browser inspected the accessible controls; Playwright/Chrome ran assertions and captured the final images. [results.json](results.json) records each viewport, loaded fonts, control dimensions, console errors and warnings. All four final runs have **zero console errors, zero warnings, zero uncaught exceptions**, no document horizontal overflow, and button targets at least 44×44 CSS pixels. No legacy shadow-style warning remains.

| Viewport | Screenshots |
| --- | --- |
| Phone, 390×844 | [Top](phone-top.png), [typography](phone-type.png), [Markdown](phone-markdown.png), [themes](phone-themes.png), [controls](phone-controls.png), [modal](phone-modal.png) |
| Tablet, 820×1180 | [Top](tablet-top.png), [typography](tablet-type.png), [Markdown](tablet-markdown.png), [themes](tablet-themes.png), [controls](tablet-controls.png), [modal](tablet-modal.png) |
| Desktop, 1440×1000 | [Top](desktop-top.png), [typography](desktop-type.png), [Markdown](desktop-markdown.png), [themes](desktop-themes.png), [controls](desktop-controls.png), [modal](desktop-modal.png) |
| Dark phone, 390×844 | [Top](dark-top.png), [typography](dark-type.png), [Markdown](dark-markdown.png), [themes](dark-themes.png), [controls](dark-controls.png), [modal](dark-modal.png) |

Visual inspection found readable wrapping, intact visible Armenian marks, clear formatting/link distinction, and usable sheet/field layouts in the captured browser views. These are browser observations, not native glyph-shaping certification.

Assertions cover initial modal focus on Close, four Tab steps remaining inside the dialog, return to the reading opener after Escape/Close/backdrop, and initial/return focus for the separate license opener. They also cover note entry, clear/save/reset feedback, disabled/loading controls, and a focusable HTTPS anchor with no javascript anchor. External websites were not opened; native link dispatch and rejection feedback are mocked in Jest.

[Font failure screenshot](font-fallback.png) and [failure results](font-fallback.json) come from aborting both local TTF requests. The gallery remained mounted and usable with system fonts and the explicit Armenian caveat. Removing the fault and pressing Retry loaded Noto while retaining the typed reading note. The injected-failure run necessarily has expected failed-network console output; it is separate from the error-free normal runs and has no uncaught exceptions.

The exact browser harnesses are retained as [normal QA source](browser-qa.cjs.txt) and [font fault source](browser-fallback.cjs.txt). Copy to a `.cjs` file and run from repository root with an external Playwright installation (`PLAYWRIGHT_MODULE` can specify its module path); no browser dependency was added to either app.

## Native QA boundary

No iOS/Android app visual or assistive-technology QA was completed in this review. A read-only simulator check found an iOS 26.5 runtime and booted iPhone 17 Pro, but no compatible running gallery/client was verified. The client-container lookup did not complete promptly. Native exports and Jest mocks do not establish VoiceOver/TalkBack focus, Dynamic Type, native keyboard/inset behavior, or physical-device font shaping. Those issue acceptance checks remain pending; browser proof is distinct.
