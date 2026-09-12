# Web reading application trial

Status: implemented locally and accepted by scoped independent finish review, 2026-09-12. This is a provisional application trial, not release approval. Branch: `codex/design-system-web-trial`. Main was freshly fetched and already current before branching. Sol handles implementation; the main task owns design decisions and review. Luna prepares a local fixture for browser checks.

## Scope

Apply the selected literary-serif typography and light/dark semantic foundation to the participant reading route `/sessions/$id/parts` and its language selection. Reuse the pinned local font assets so comparison with the native experiment has a known input. Establish only the token exports and web primitives needed by this slice.

Preserve projector display routes, operator control buttons/logic and the mobile app. Authenticated operators share this reading route, so their surrounding reading surface is affected; the separate projector views are not. Changes to the surrounding web shell must be narrowly scoped to this route. Keep service fetching, event subscriptions, part navigation and occurrence identity outside this design refactor. The user subsequently requested the foundation be committed first, followed by separate app-redesign PRs. This web trial has its own commit and draft PR above the foundation branch. Deployment, merging and a full application rollout remain outside scope.

The current web participant view uses a single-language context and automatically scrolls to part events. It does not have the native proposal's explicit manual/following interaction model. The implementation extends the existing language provider with a small per-session selection map while retaining its single-language API; preserve automatic following and document this difference rather than presenting the web trial as domain parity. Repeated occurrence behavior remains owned by existing domain code.

## Review criteria

- Source Serif 4 for English, Russian and transliteration; pinned Noto Serif Armenian for Armenian. Confirm actual font loading; fallback is not typography approval.
- Selected light/dark colors, semantic boundaries and visible focus; system appearance responds to the OS, with an explicit choice taking precedence.
- Readable, selectable multilingual content, correct language metadata, preserved paragraph content and explicit missing translations. A missing Russian translation must never silently become English under a Russian label.
- Draft language selection supports Apply, Cancel and at least one language. Applying it or changing appearance preserves the route and does not trigger an extra live-scroll operation from visual state alone.
- Keyboard-operable controls and dialog, visible dismissal, focus containment/return and no clipped actions. Narrow live reading shows one active language with a switcher; selected languages appear side by side only when there is enough readable width.
- Inspect desktop and narrow web layouts in both appearances using the real route and local fixture responses. Keep fixture evidence distinct from authenticated/live-service testing and physical-device accessibility checks.
- Run typecheck, the repository's unit suite and production build. Add meaningful behavior coverage for newly introduced state, not screenshot enforcement.

## Provisional decisions

Specimens remain examples. Review may revise geometry, density and component APIs based on real application use. Do not impose golden screenshots or build a broad component catalogue before this slice is assessed. Native text-remount workarounds remain inside the native experiment.

## Implemented

- The participant reader renders the service title, a language picker, appearance choice and responsive reading columns. The initial trial stacked languages on narrow screens; the subsequent user-selected rule replaces that with one active language and switching. Other routes retain their current presentation.
- The language provider keeps each service’s selected set and active language in memory across passage-detail navigation. The active language also updates the legacy single-language value. A full reload still resets language selection; this trial does not introduce language-preference migration. The existing detail page displays all available languages.
- Appearance uses `tarkman.reader.appearance.v1` in local storage, defaults to System and tolerates blocked storage access/writes. OS changes affect System mode; explicit Light/Dark wins. Theme styling is limited to the reader and its dialog.
- `packages/tarkman-design/tokens.json` is the application trial’s source for semantic colors/elevation, with generated `web.css`. Exports currently available are `@tarkman/design/tokens` and `@tarkman/design/web.css`. Native and Tailwind exports remain proposals. Geometry, layout and type metrics remain in the web adapter while they are being tested; the review manifest remains historical design evidence.
- Four pinned font files and their attribution travel with the web app. All four match the native specimen bytes. Bold/italic delivery still needs comparison against authoritative rich service content before broader adoption.

## Verification

Sol ran `npm run typecheck`, `npm run test` (41 files / 355 tests), `npm run build`, `npm run check --prefix packages/tarkman-design`, `npm ls --all --prefix apps/web` and `git diff --check`; all passed. Check output was captured by the task tools, not saved as standalone log files. Tests cover draft/cancel/minimum language selection, missing content and language metadata, per-session selection, no extra live-scroll call on language Apply, and appearance resolution/OS changes/storage failure. Existing ExplanationDrawer Radix description warnings and a stale Browserslist-data notice remain.

The main task reviewed the real `/sessions/design-trial/parts` route against a loopback-only sample HTTP server. API/WebSocket URLs were explicitly local and Sentry was disabled. The fixture supplies repeated prayer content with distinct occurrence IDs, missing Russian and long Armenian text; it does not implement WebSocket updates.

Observed in the Codex in-app browser for the initial trial (before the single-language mobile revision):

- Desktop at 1280×900 and narrow layouts at 390×844 and 320×740; light/dark reading and language-dialog states. Content reflows into columns or a stack. At 320px, the root content was 305px wide after its scrollbar and the dialog’s client/scroll width was 288px; neither showed horizontal overflow.
- Apply three languages, reject an empty selection, Cancel a draft, Escape to close, focus return to Languages, and Tab wrapping from Apply to the close action.
- Russian-only reading → existing passage detail → Back to Service retained Russian-only reading and Light appearance.
- Explicit missing-Russian feedback and visible Armenian text. FontFaceSet reported loaded and checks for both reading families returned true. Independent byte comparison confirms all four local font files match the native specimen.
- Static Impeccable scan of the changed reader and generated CSS returned no findings. An early development reload briefly reported missing CSS while package wiring changed; final page rendering was verified after implementation settled.

Captures (observations, not golden baselines):

- [Desktop light](evidence/web-trial/desktop-light.png)
- [Desktop dark dialog](evidence/web-trial/desktop-dark-dialog.png)
- [Narrow dark reader](evidence/web-trial/narrow-dark.png) and [dialog](evidence/web-trial/narrow-dark-dialog.png)
- [320px light Armenian/missing translation](evidence/web-trial/narrow-light-reading.png) and [dialog](evidence/web-trial/narrow-light-dialog.png)
- [Font byte comparison](evidence/web-trial/font-byte-check.json) and [static scan](evidence/web-trial/impeccable-detect.json)

TanStack Query’s floating development icon appears in some captures. The existing Need help drawer and navigation remain legacy UI. Their presence does not establish that they have adopted this system.

## Remaining application evidence

### Single-language mobile revision, 2026-09-12

The user clarified that mobile portrait must show only one language at a time with switching, rather than a vertical stack of translations. Below the provisional 48rem breakpoint, the toolbar now offers a native select labeled Reading language. Languages still opens the selected-set dialog. Only the active translation is visible and exposed to accessibility; larger widths restore the selected translations in the existing columns. The active choice survives width changes and passage-detail navigation. Removing it from the selected set chooses the first remaining language in stable product order. This implements the shared behavior rule in the web trial; native adoption remains separate.

Validation: 358 tests in 41 files passed, web type checking and production build passed. The focused tests cover switching without an extra live-scroll call or query fetch, active-language fallback and state retention across a reader remount. Browser checks used a local sample operator session at `/sessions/9001/parts`, with fake fixture authentication, and no live-service mutations. At 390px, switching among English, Russian and Armenian displayed only the chosen language, including in the accessibility tree. Missing Russian remained explicit. At 1280px, all three translations occupied separate 352px columns; returning to narrow width retained Armenian. Passage-detail navigation and Back to Service also retained Armenian. At 320px, the page had no horizontal overflow (305px client and scroll width), both language controls were 48px high, and their final gap was 12px.

Revised captures (sample data, not prescriptive layouts): [390px Russian light](evidence/web-trial/mobile-single-russian-light.png), [390px Armenian dark](evidence/web-trial/mobile-single-armenian-dark.png), [320px Armenian dark](evidence/web-trial/mobile-single-320-dark.png), and [wide comparison](evidence/web-trial/single-language-desktop-dark.png). The old narrow screenshots above document the superseded stacked-language trial. The blue navigation buttons and purple status control remain legacy UI, including their floating overlap with reading content. This revision does not redesign that control bar. Resized browser evidence does not establish physical-phone touch, Safari, screen-reader speech or live synchronization behavior.

This is a local application trial, not release approval. Live synchronization/reconnection, authenticated operator use, real browser zoom, physical-device screen readers, long authoritative service content and font-failure handling have not received full end-to-end review here. System appearance event handling was tested with a mocked media query rather than by changing the host OS. The pre-existing web auto-follow behavior and native proposal’s manual/following model remain different.

Review this slice in real use before beginning the mobile adaptation or widening the web rollout. The native experiment’s open maximum-text/selection/focus checks still apply before reusing its implementation. No specimen has become definitive or prescriptive.

## Handoff

The independent finish reviewer found no material blocker or required design redirection for this bounded trial. A separate documentation review found no material source/document mismatch or broken local links. These reviews retain the validation limits above.

The local preview is left running at `http://127.0.0.1:8095/sessions/design-trial/parts`, backed by `docs/design-system/evidence/web-trial/mock-read-server.js` on loopback port 8096. Temporary browser viewport overrides were cleared. The foundation and web trial were subsequently committed separately and prepared as draft PRs. No merge or deployment was performed.

Review order: merge the foundation first, then retarget the web PR to `main` so its normal main-targeted CI can run. While the web PR targets the foundation branch, the current Node.js CI workflow does not trigger for it. Local web checks remain recorded above.
