# Design system implementation specification

Status: working specification for application trials, 2026-09-12. This foundation contains the selected design direction, an isolated native specimen, and a framework-free token package. Application adoption is reviewed separately; specimens and component APIs remain provisional.

## How to use this specification

The literary-serif direction, related light/dark burgundy palettes and multilingual reading are selected starting points. Geometry, density, layouts and component APIs remain provisional. The user explicitly wants to learn from applying the system in real screens before making specimens definitive or prescriptive.

Treat a specimen as an experiment: it demonstrates a choice and records evidence, not a canonical screen to reproduce pixel for pixel. Do not introduce screenshot gates, mandatory fixture layouts, or blanket styling bans from these samples. Keep correctness and accessibility requirements distinct from visual preferences. Record a useful adjustment with its context when application work exposes a problem; update the relevant design decision after review.

## Source and dependency boundaries

The initial semantic color/elevation source is `packages/tarkman-design`, separate from domain logic in `packages/tarkman-core`. Keep each application's existing installation model. A shared package would contain data and generators, without React, DOM, React Native, navigation, or icon dependencies.

Candidate exports: `@tarkman/design/tokens` for typed semantic values, `@tarkman/design/native` for native metric/font mappings, `@tarkman/design/web.css` for CSS custom properties, and `@tarkman/design/tailwind` for the existing web adapter. Verify Metro, Vite, TypeScript and clean local-file installation before adopting these entry points. Only `@tarkman/design/tokens` and `@tarkman/design/web.css` are available in this foundation. Native and Tailwind exports remain proposed APIs; importing the package into an app is a separate change.

The current `foundations.tokens.json` remains a review manifest. The native lab uses an explicitly copied snapshot. Its matching values establish the input to an experiment; they do not freeze the values. Production generators may later verify missing roles and stale generated files, but no visual enforcement is authorized now.

## Semantic token contract

Use role names at the component boundary. The following maps every existing palette key; provisional names should be settled during the first real application trial.

| Review keys | Candidate semantic names | Purpose |
| --- | --- | --- |
| canvas; surface; raised; overlay | `color.surface.canvas/default/raised/overlay` | Main background; bounded content; raised content; modal/sheet surface |
| text; muted | `color.text.primary/secondary` | Primary reading and supporting text |
| primary; onPrimary; hover; pressed | `color.action.primary.background/foreground/hover/pressed` | Primary action with explicitly paired text |
| selection; onSelection | `color.selection.background/foreground` | Chosen language or selected item |
| divider; control | `color.border.divider/control` | Decorative separation versus visible control boundary |
| focus | `color.focus.ring` | Keyboard focus indicator |
| disabled; onDisabled | `color.action.disabled.background/foreground` | Explicit disabled appearance without fading the whole component |
| success; successSurface | `color.status.success.foreground/background` | Live/available confirmation |
| warning; warningSurface | `color.status.warning.foreground/background` | Paused service or advisory |
| danger; dangerSurface | `color.status.danger.foreground/background` | Failure requiring attention |
| info; infoSurface | `color.status.info.foreground/background` | Reconnecting or informative status |
| shadowRaised; shadowOverlay | `elevation.raised/overlay` | Platform-adapted depth paired with surface tone |

Retain the manifest's light/dark values as the initial input. Use paired status roles on their corresponding surfaces; do not assume a foreground passes on every surface. Add backdrop as an explicit platform role when integrating: the native lab's 40% black Android scrim is experimental and not a new shared foundation value.

Geometry candidates: spacing 4/8/12/16/24/32/48/64; radius control 8, card 16, sheet 24, pill 9999; divider/control width 1, selection 2, web focus 3 with offset 3. Use rem for web type/spacing where appropriate and native logical units. A 1-unit divider is deliberate; use a native hairline only where optical inspection warrants it. Size touch regions to at least 48 units with separate non-overlapping targets. Content determines height; no fixed-height text containers.

Native elevation is an adapter decision: use native sheet presentation and tonal surfaces first. Do not pass CSS shadow strings to React Native or require identical shadows across OSes. Motion candidates are 150/200/250ms for feedback/disclosure/overlay; prefer platform navigation/sheet transitions and remove nonessential movement under reduced motion.

## Typography and language contract

| Role | Family | Starting metrics |
| --- | --- | --- |
| Reading | Source Serif 4 regular; Noto Serif Armenian regular for Armenian | 24/38; optional user sizes 30 and 36 with proportional leading |
| Reading title | Source Serif 4 semibold; actual Armenian bold asset for Armenian titles until a medium weight is evaluated | Web 40/48, native 34/44 |
| UI body | Platform sans | Web 16/26, native 17/27 |
| Control label | Platform sans semibold | 15/23 |
| Supporting caption | Platform sans regular | 14/22 |

The lab pins Source Serif 4 **4.005**, static regular and semibold TTFs from Adobe's official release. This tests a reproducible native candidate; it does not prove byte-equivalence or optical-size equivalence with the earlier Google Fonts variable web delivery. Before integration, compare the same chosen assets/optical treatment on web and native, add a genuine italic asset if real content requires italics, and never synthesize a missing weight silently.

Preserve the full Noto Serif Armenian regular/bold files already pinned in the mobile repository. Their provenance and OFL licenses travel with distributed fonts. The lab's `assets/sha256.json` identifies its exact bytes. Font failure shows explicit feedback and readable fallback; a fallback screenshot cannot approve typography.

Keep `en`, `ru`, `grabar`, `translit` as existing product language identifiers. Map text metadata to `en`, `ru`, `hy`, and `hy-Latn`; pronunciation support depends on available platform voices and needs listening checks. Tag fallback messages by their actual language. Keep text selectable, preserve line/paragraph breaks, and allow wrapping. Missing translation has its own state and must not relabel another translation as the missing one.

Reading size composes with OS text scaling; do not disable `allowFontScaling`, shrink text to fit, or impose an arbitrary maximum. At accessibility sizes, stack actions/languages and keep sheets scrollable. Preserve Armenian punctuation and decomposed combining marks. English/Russian/Armenian together is a useful comparison fixture, not a mandatory production language selection or screen layout. Authoritative long passages and fluent-reader review remain needed.

## Component and behavior contracts

| Component | Candidate inputs/states | Required behavior for the trial |
| --- | --- | --- |
| Text / ReadingText | role, language, children; ready/loading/fallback/missing | Scalable, selectable reading; native language metadata; web `lang`; no silent truncation of prayer text |
| Button / IconButton | variant, label, disabled, busy, onPress/onClick | Default, pressed, web hover/focus, disabled, loading; busy prevents repeat action and retains label/width; icon-only controls have accessible names |
| Surface / Card / Divider | surface role, padding, boundary/elevation | Group only related content; avoid making every row a card; theme-aware boundaries |
| TextField | label, value, onChange, description, error, readOnly, disabled | Persistent label; errors associated with field; suitable native keyboard; editable text visible above keyboard; clear stale validation after edit |
| Status / Notice | service state, connection state, message, optional recovery | Name state and consequence; status never depends only on color; avoid announcing every live text update |
| LanguagePicker | value, draft, onApply, onCancel | At least one language; cancel discards draft; apply preserves passage/following state; stable product ordering |
| ReadingControls | position, following, available actions | Manual reading stays manual across updates; return-to-live is explicit; position identity remains the app's domain identity, not an array index |
| Dialog / Sheet | title, visible, dismiss, opener, content | Safe areas, scroll, keyboard accommodation, visible close, accessibility escape/back, focus placement and return; protect unsaved draft appropriately |

These are conceptual cross-platform inputs, not a universal component implementation. Keep web DOM/CVA primitives and native Pressable/Text/Input implementations. Trial one component in context before expanding its API. Current live-reader query, lifecycle, synchronization and occurrence identity remain owned by the existing app/domain layer.

## Platform decisions

**Icons.** Use a semantic `AppIcon` boundary (`languages`, `explanation`, `preferences`, `close`, `back`, `next`, `selected`). Web retains Lucide. Native trial uses `@react-native-vector-icons/ionicons` 13.1.4: `language-outline`, `book-outline`, `options-outline`, `close-outline`, `chevron-back`, `chevron-forward`, `checkbox-outline`. Keep actionable labels visible where useful and hide decorative icons from accessibility. Match weight and prominence optically; stroke width is not a portable API between glyph and stroke libraries. The package is installed only in the isolated lab. This is a provisional implementation choice pending the trial, not a permanently selected library. Expo's current guidance recommends moving new work away from `@expo/vector-icons`.

**Web.** Use native button/field semantics, meaningful heading hierarchy and visible keyboard focus. Use an accessible dialog/popover implementation for production, including focus containment, Escape, return to opener, background isolation and appropriate scroll containment. The earlier in-flow mockups do not supply those behaviors.

**iOS.** The lab uses React Native's native `pageSheet` presentation with `allowSwipeDismissal`, `onRequestClose` and visible dismissal. Keep the OS's sheet behavior; do not simulate an iOS sheet with a browser panel. The exact detents/compact-height behavior remain an integration decision. Navigation back/swipe behavior is a separate screen-navigation contract, not something this sheet test verifies.

**Android.** The lab uses a modal bottom surface with explicit insets and system Back dismissal. A production bottom-sheet library is not selected. Do not claim predictive-back animation parity merely because Back closes the modal. Evaluate native sheet mechanics and keyboard behavior in the first integration trial.

**Appearance.** `system` is the default; resolve to light/dark and observe OS changes only in that mode. Explicit light/dark wins. Production persistence must preserve existing language records and tolerate storage failure. Keep surfaces, text, status bars, native sheets and keyboard appearance coordinated. The lab keeps all preferences in memory and cannot validate migration or cold-start persistence.

## Evidence and next decisions

See [native validation](native-validation.md) for actual runtime results and limitations. Type checks, exports, a screenshot and a screen-reader listening pass establish different facts; none substitutes for the others.

Before integration, resolve findings from the native trial, compare the pinned font treatment on web, and choose the smallest real reading slice in each app. Review density, language layout, sheet behavior and tokens in those real screens. Defer definitive specimens and visual regression baselines until that use provides a stable reason to adopt them. Projector and operator interfaces remain separate scope.

## Primary references checked for this specification

- [Expo icon guidance](https://docs.expo.dev/guides/icons/)
- [React Native Modal](https://reactnative.dev/docs/modal) and the installed 0.86.3 `Modal.d.ts` for the lab's actual API surface
- [Adobe Source Serif 4.005 release](https://github.com/adobe-fonts/source-serif/releases/tag/4.005R)

These references establish available APIs/assets. They do not prescribe Tarkman's appearance.
