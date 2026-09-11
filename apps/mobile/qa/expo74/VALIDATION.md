# Return-to-live follow-up — 2026-09-11

Work stayed in `Tarkman-Client-ReturnLive`, branch `expo/06-return-to-live-fix`.
Before edits, the worktree was clean and HEAD matched the prepared `origin/main`
base `b7edc761b77c33717cb33b8efe9bb1e449777b94`. Read root AGENTS.md,
CLAUDE.md, README.md, mobile README.md, reader components and existing UI tests.

Moved the conditional AppButton from the capped header ScrollView into normal
flex flow immediately after PartList. The footer is full width, capped at 800,
with 16pt token padding inside the root SafeAreaView (no duplicated safe-area
insets). It reserves space without covering readings. PartList is unchanged.
The hint describes automatic following; pressing dispatches `follow` and retries.

Fresh mobile Jest: **8 suites / 71 tests passed**, including absence while
following and manual-state visibility, accessibility hint, dispatch and retry.
Lint (zero warnings), typecheck, UI guard and both clean Expo web exports passed.
The export processes used `EXPO_NO_DOTENV=1`; only the fixture export received
process-local `https://reader.invalid` / `wss://reader.invalid/cable` endpoints.
No backend or real service was used. No .env, EAS or dependency values changed.

The updated [browser harness](browser-qa.cjs.txt) passed all four viewports.
It deliberately overfills the independent header, targets part 52, then wheels
6,000px backward in the separate list. Before any click can scroll a control into
view, it asserts full viewport bounds, hit-test visibility, a >=44px target,
normal-flow positioning, no list overlap, a full-width/max-800 footer and no
horizontal overflow. Part 53 arrives without moving the manual offset. Clicking
Return to live hides it, triggers fresh reads and places part 53 in the list
viewport. Existing language, modal, empty, offline and recovery checks also pass.
Normal runs have zero console errors/warnings; injected 503 errors are separate.

| Viewport | Return-to-live target | Footer width | Evidence |
| --- | --- | --- | --- |
| Phone 390×844 | 358×44px | 390px | [manual](phone-manual.png) |
| Tablet 820×1180 | 768×44px | 800px | [manual](tablet-manual.png) |
| Desktop 1440×1000 | 768×44px | 800px | [manual](desktop-manual.png) |
| Dark phone 390×844 | 358×44px | 390px | [manual](dark-manual.png) |

All four captures were visually inspected. [Results](results.json) contain fresh
measurements. `QA_COMPACT=1` retains earlier captures and writes only these four
new PNGs plus results; the earlier screenshots below remain historical evidence.
Replay from repository root with the two exports served on 8094 (unconfigured)
and 8093 (fixture), using the existing server:

```sh
QA_COMPACT=1 node apps/mobile/qa/expo74/browser-qa.cjs.txt
```

Local native command (from this worktree's apps/mobile):
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device 36FE0459-CDCB-44E9-9230-8B1D0E0704E2 --no-bundler`
exited 0: **Build Succeeded, 0 errors / 2 warnings**, installed on iPhone 17 Pro /
iOS 26.5 and opened `app.tarkman` / the development client. Warnings were duplicate
`-lc++` and the dev-launcher script's ambiguous dependencies. Generated native
files remain ignored; prebuild's automatic npm-script edits were reverted.
This is build/install evidence only: `--no-bundler` did not start this worktree's
Metro, and the opened development URL's JavaScript/runtime was not verified.
No native manual-scroll, physical-device safe-area, Dynamic Type, VoiceOver or
real Rails acceptance is claimed. No Expo Go or EAS was used.

Final `git diff --check` passed. PartList, package manifests/lockfile, app/EAS
configuration and backend are unchanged. No commit, push, PR or deployment.
The requested single completion notice is sent separately.

---

# Expo 06 / issue #74 — review evidence

Implemented in the isolated `Tarkman-Client-Live` worktree on
`expo/06-live-reader`. Initial HEAD and trusted prepared base were both
`bbce1e248506aa817fd19454553166fd698dc7c6`. Initial worktree was clean.
Root AGENTS.md/CLAUDE.md were read; no mobile-specific copies exist at this base.
Reviewed issue #74 and merged Expo 04 (`a7b6213`, #86) / Expo 05 (`bbce1e2`, #87).
No commit, push, PR, deployment, EAS, backend edit, environment-file edit or
credential change. The one requested completion notification is sent separately.

## Contract and scope evidence

Rails source inspected read-only at `0e5b95831c98b709188c39155719f856d9723657`:
`config/routes.rb`, `session_controller.rb`, `parts_controller.rb`,
`explanations_controller.rb`, their JSON builders, session navigation/notification
concerns, `SessionChannel`, `ApplicationCable::Connection`, and
`ExplanationBroadcastUpdateJob`. Public session/parts/current-explanation GETs
and anonymous channel connections already exist. Service discovery returns an
array of session wrappers or a message-only empty response. Position is one-based;
`liturgy_part_id` identifies occurrences. Events use `data.session` for
`part_change`, `data.session_id` for `status_change` / `explanation_updated`.

Only apps/mobile changes. The core's complete Session/Explanation types overstate
some actual nullable/missing fields; the reader uses narrow defensive read models
and core language types. No core contract was changed. Built-in fetch/WebSocket
avoid axios/query-client dependencies for this bounded owner; `expo-network
~57.0.2` is the sole new package, verified against Expo SDK 57's installed
`bundledNativeModules.json` and [official documentation](https://docs.expo.dev/versions/latest/sdk/network/).
The cable protocol was checked against [Rails connection handling](https://github.com/rails/rails/blob/main/actioncable/app/javascript/action_cable/connection.js).
The [standard Rails monitor](https://github.com/rails/rails/blob/main/actioncable/app/javascript/action_cable/connection_monitor.js)
assumes browser globals; this native adapter has no DOM shim and is mockable.

## Validation results

| Check | Result |
| --- | --- |
| Fresh mobile `npm ci` | Passed, independent lockfile |
| Mobile lint / typecheck | Passed, zero lint warnings |
| Mobile Jest | 8 suites / 69 tests passed |
| Existing UI / font guards | Passed; UI scan now includes features |
| Public Expo config | Passed; identifiers/profiles unchanged |
| Mobile `npm ls --all` | Passed |
| Two final `CI=1 npm run export:web` runs | Passed, unconfigured and fixture-configured, both with `--clear` |
| Fresh web `npm ci` / typecheck | Passed |
| All web tests / build | 38 suites / 341 tests passed; production build passed |
| Core test / boundary / consumer checks | Passed, both app consumers |
| `git diff --check` / protected-path diff | Passed |
| Local iOS build and simulator install | Passed; 0 errors, 2 build warnings |
| Physical iPhone / real Rails handshake | Not available; acceptance follow-up below |

[Command excerpts](validation-output.txt) preserve the final results. Existing
npm install-script/deprecation notices remain; no forced dependency upgrade was
used. Generated iOS files are ignored; ESLint excludes generated ios/android
folders. The native build's duplicate `-lc++` and script-phase warnings do not
establish a runtime defect.

Tests mock HTTP and cable. They cover service/part normalization (including
repeated multi-liturgy occurrences), configuration rejection, actual event
identifiers, canonical recovery, coalesced in-flight invalidation, transition
races, session disposal, stale/empty/error/explanation states, manual follow,
initial offline recovery, request timeout, silent sockets, rejection/reconnection,
subscription/timer cleanup, and foreground/network listener disposal. UI tests
exercise session input, language selection, current-part labels and sheet dismissal.

## Browser evidence

[Harness](browser-qa.cjs.txt) uses external Playwright/Chrome, adding no app test
dependency. API requests and ActionCable frames are intercepted for
`https://reader.invalid` / `wss://reader.invalid/cable`; no production host or
live backend is contacted. These are **mocked browser integration checks**, not
Rails handshake evidence. Fixture endpoints are supplied only to the export
process; no .env file changes. Use `--clear` when changing export environment:
Metro otherwise reused an earlier unconfigured transform during initial QA.

To replay, copy [the local SPA server](server.py.txt) to a temporary `.py` file
and serve the unconfigured export on 8094 and fixture-configured export on 8093.
Copy the harness to a temporary `.cjs` file and run from repository root;
`PLAYWRIGHT_MODULE` can identify an existing external Playwright installation.

[Results](results.json): phone 390×844, tablet 820×1180, desktop 1440×1000,
and dark phone. All normal runs have zero console errors, zero warnings, zero
uncaught page exceptions and no horizontal overflow. Visible controls are at
least 44×44 CSS pixels. The injected 503 run records its expected resource errors
separately and verifies recovery through Retry.

The 70-part/two-liturgy fixture jumps from part 1 to 52, pauses following on wheel
input, receives part 53 without changing the manual offset, and returns to live.
Armenian and Russian switches verify that the current part remains on screen
following measurement reset. Screenshots were visually inspected for wrapping,
readable current highlighting and modal layout. Keyboard Tab remains in sheets;
Escape and language selection return focus to their respective openers. Session
ID submission, no-service discovery and a session leaving discovery are exercised.
The unconfigured app opens the static gallery and returns without networking.

| View | Reading | Armenian | Russian | Explanation | Discovery / empty |
| --- | --- | --- | --- | --- | --- |
| Phone | [image](phone-reading.png) | [image](phone-armenian.png) | [image](phone-russian.png) | [image](phone-explanation.png) | [discovery](phone-discovery.png), [empty](phone-empty.png) |
| Tablet | [image](tablet-reading.png) | [image](tablet-armenian.png) | [image](tablet-russian.png) | [image](tablet-explanation.png) | [discovery](tablet-discovery.png), [empty](tablet-empty.png) |
| Desktop | [image](desktop-reading.png) | [image](desktop-armenian.png) | [image](desktop-russian.png) | [image](desktop-explanation.png) | [discovery](desktop-discovery.png), [empty](desktop-empty.png) |
| Dark | [image](dark-reading.png) | [image](dark-armenian.png) | [image](dark-russian.png) | [image](dark-explanation.png) | [discovery](dark-discovery.png), [empty](dark-empty.png) |

[Configuration](config-phone.png), [offline startup](offline-phone.png),
[recoverable error](recoverable-error.png).

## Local iOS and outstanding acceptance

Ran from apps/mobile:
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device 36FE0459-CDCB-44E9-9230-8B1D0E0704E2 --no-bundler`.
The configured local development client built and installed on iPhone 17 Pro /
iOS 26.5 simulator. No Expo Go or EAS build. Metro initially listened on IPv6
while advertising an IPv4 bundle URL; restarting local Metro with an IPv4-reachable
host resolved launch. Native bundling succeeded and the configuration screen
rendered. [Simulator capture](ios-config.png) includes Expo's first-run developer
menu over the app; it is startup/configuration evidence, not full native UI QA.

There was no running Rails Docker container/local backend endpoint, and Xcode
reported the physical iPhone offline. Do not mark the issue's real-device
acceptance complete. Follow-up requires an appropriate existing Rails endpoint
and physical iPhone: verify anonymous cable handshake/origin acceptance,
part/status/explanation updates, missed events, lock/background/foreground,
airplane mode and Wi-Fi restoration, multiple sessions, and long repeated-part
liturgies. Also verify maximum Dynamic Type, VoiceOver language/heading labels,
native Armenian shaping, safe areas, keyboard avoidance and modal focus return.

Rails discovery is date-based and has no explicit ended timestamp. “No longer
listed live” is the supported availability signal. The API has no atomic
snapshot/version; rechecking canonical session plus periodic recovery narrows
cross-request races but cannot eliminate them. HTML returned for variable English
parts remains inert literal text under the existing limited Markdown primitive.
