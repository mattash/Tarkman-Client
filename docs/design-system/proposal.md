# Tarkman design system proposal

Status: literary serif direction selected by the user on 2026-09-12; the broader design system is not yet implementation-ready. Source baseline: main at `87a3f84`. This document and the accompanying interactive specimens do not change either application. See [Typography study and design completion gates](typography-study.md).

Workflow and ongoing references: [design-system workspace guide](README.md). Figma Design System Builder supplies the process reference, Impeccable supplies craft/critique guidance, and DTCG supplies the token-format reference. Values remain proposed until selected and verified for their intended use.

Current foundation candidate and verification evidence: [Foundations board decisions](foundations.md). Its review manifest is the current source for expanded state, depth and geometry values; earlier specimens remain visual studies.

Tarkman should feel calm, readable, and recognizably the same across web and native. Keep the web's burgundy identity, improve the hierarchy and reading surfaces, and share design decisions while allowing each platform to behave naturally.

## What the current code tells us

| Source | Current behavior | Design-system implication |
| --- | --- | --- |
| `apps/web/app/styles.css` | Custom brand backgrounds use `#6E3852`, `#4C2739`, and `#BA7295`; semantic light/dark variables also exist. | Use burgundy as the proposed brand anchor. Replace competing sources of color. |
| `apps/web/tailwind.config.js` | `tarkman-purple` is violet `#6B46C1`; a second `primary` key overrides the semantic primary configuration. | Resolve both the hue conflict and the duplicate key. A variable change alone will not theme the application. |
| `apps/web/app/routes/__root.tsx`, `components/SessionCard.tsx` | Shell and cards hardcode gray dark surfaces. | Migrate consumers to semantic roles before promising light mode. |
| `apps/mobile/design/tokens.ts` | Separate violet palette, type scale, spacing, radii, 44-point controls. | Reuse the role-based approach and native primitives; move common decisions to a shared package. |
| `apps/mobile/design/ThemeProvider.tsx` | Follows system appearance; explicit scheme supports gallery samples. | Add a persisted user choice of system/light/dark without losing live system updates. |
| `apps/mobile/features/preferences/PreferencesProvider.tsx` | Persists language only. | Appearance preference is new work; preserve existing language records during migration. |
| `apps/mobile/components/AppText.tsx`, `LiturgyText.tsx` | Scalable text, language tags, selectable reading, Armenian font handling. | Preserve these capabilities and establish matching web typography rules. |
| `apps/mobile/app/gallery.tsx` | Has light/dark, language, field, action, and modal specimens. | Extend this into the native reference gallery; add a corresponding web gallery. |

These are current source findings, not a live visual or accessibility audit. Existing screenshots are historical evidence, not verification of this proposal.

## Visual foundation

Use warm neutral reading surfaces, burgundy actions, and restrained rose selection. Burgundy identifies Tarkman; red indicates errors or destructive actions; green, amber, and blue express meaningful status. Always include status text. Avoid assigning every service mode its own decorative hue.

The following palette is a starting proposal. All values are shared decisions; raw values should be used only inside the token source.

| Role | Light | Dark |
| --- | --- | --- |
| canvas | `#FAF8F7` | `#171417` |
| surface | `#FFFFFF` | `#231E23` |
| surface.subtle | `#F1EBEE` | `#302730` |
| text.primary | `#272127` | `#F7F1F4` |
| text.secondary | `#6B5C65` | `#C4B6BF` |
| action.primary | `#6E3852` | `#E3A7C3` |
| action.onPrimary | `#FFFFFF` | `#351C29` |
| action.pressed | `#4C2739` | `#CF8AA9` |
| selection.surface | `#F2E4EB` | `#432C39` |
| selection.text | `#6E3852` | `#F2C8DD` |
| border.subtle | `#DFD5DB` | `#493C45` |
| border.control | `#87737F` | `#99838F` |
| focus | `#6E3852` | `#E3A7C3` |
| status.danger.text | `#B42335` | `#FFAFB7` |

Brand artwork retains its intended colors. Theme-dependent action colors can change luminance without recoloring the logo. Distinguish decorative dividers from input boundaries; one border color cannot do both jobs well.

Use a 4-unit spacing foundation with 4, 8, 12, 16, 24, 32, 48, and 64 steps. Begin with 8-unit control corners, 16-unit cards, and 24-unit sheets. Use whitespace and dividers first; reserve elevation for overlays and genuinely raised surfaces. Dark elevation should also change surface tone.

Typography has two purposes: interface and reading. The selected literary serif direction uses Source Serif 4 for English, Russian, and transliteration reading and service titles, paired with Noto Serif Armenian for Grabar; keep platform system sans-serif for controls. The user selected this visual direction on 2026-09-12. Exact assets, weights, script-specific metrics, and native rendering remain subject to the [multilingual study](typography-study.md). Preserve the existing Armenian static regular/bold assets during evaluation. Show English, Russian, and Armenian simultaneously, with transliteration and mark-stress specimens also available. Never use a Latin-only specimen as multilingual sign-off.

| Role | Web starting size / line height | Native starting size / line height |
| --- | --- | --- |
| caption | 14 / 22 | 14 / 22 |
| label | 15 / 23 | 15 / 23 |
| body | 16 / 26 | 17 / 27 |
| reading | 24 / 38 candidate | 24 / 38 candidate |
| heading | 24 / 32 | 23 / 32 |
| reading title | 40 / 48 | 34 / 44 |

These are baseline values, not fixed text-box heights. Script-specific optical adjustments remain open; identical numbers do not guarantee matching visual size. Web uses rem-based output; native retains system scaling. Reading measure starts around 50–60 characters in a single-language layout and must be checked with actual Armenian and parallel-language content. User-selected reading size composes with accessibility scaling and does not cap it. Final type tokens must specify family, actual weight asset, size, leading, measure, paragraph gap, emphasis, and fallback per role/script.

## Shared contract, platform-specific components

Create `packages/tarkman-design` as a framework-independent package alongside `tarkman-core`. Do not put UI dependencies in the domain package. Retain the current separate app installs; a workspace conversion is unnecessary.

The dependency direction is: source palette and scales → semantic light/dark roles → web and native adapters → local primitives → product screens. Platform adapters may express units, typography, elevation, and interaction differences. They must not invent independent brand colors.

Publish typed runtime values for native, generated CSS custom properties and a Tailwind mapping for web, plus a small public token contract. Use the existing local `file:` dependency pattern. Choose a single editable source and check generated output freshness in CI. Verify clean installation and package resolution in both app build systems before migration.

Keep rendering separate: web Button can keep the existing DOM/CVA approach; native AppButton stays a Pressable. Align their names, variants, states, and visual roles. Do not pull Radix, Vaul, or DOM components into mobile.

Initial shared component specifications:

- Text and ReadingText: roles, language behavior, selection, wrapping, missing translation, font fallback.
- Button and IconButton: primary, secondary, quiet, destructive; default, pressed, focus, loading, disabled. Define explicit foreground/background pairs, not global opacity alone.
- Surface, Card, Divider: hierarchy, padding, radius, and appropriate elevation.
- TextField: label, description, error, keyboard behavior, disabled/read-only, focus and value states.
- Status and Notice: live, paused, reconnecting, offline, error, empty, and announcement states. Distinguish current service state from connection state and cached content.
- LanguagePicker and ReadingControls: language names, selected state, reading size, clear follow-live versus manual-reading state.
- Dialog/Sheet: title, dismissal, focus/announcement behavior, safe areas, scrolling, keyboard accommodation, and a visible close action.

Reserve additional semantic groups for navigation, success/warning/information, overlay, motion, and density. Add tokens for an actual repeated need rather than speculative one-off features.

## Appearance and native behavior

Both apps should offer System (default), Light, and Dark. Persist the choice per device. Follow OS changes only in System mode. Apply the resolved theme before visible web paint where possible; storage failure must not block startup. Native navigation, modals, keyboard appearance where supported, and status/system bars should agree with the resolved theme. React Native exposes system appearance and change subscriptions through its [appearance APIs](https://reactnative.dev/docs/appearance).

Use a shared minimum 48-unit interactive target for primary touch UI, allowing platform-specific presentation. This exceeds the current mobile 44-point minimum and meets Android's recommended [48dp touch target](https://developer.android.com/guide/topics/ui/accessibility/apps). Targets may exceed their visible icons but must not overlap. Desktop may use denser layouts; narrow web still needs touch-friendly controls.

Preserve safe-area insets, native back behavior, swipe-back where appropriate, keyboard avoidance, text selection, screen-reader labels and sensible focus order. A language selector can be a web popover and a native sheet. Use native navigation patterns for actual destinations; do not add a tab bar without destinations to justify it.

Keep motion brief and functional, honor reduced motion, and avoid animated flashes during prayer. Haptics should be sparse, optional, and tied to deliberate actions; ordinary reading and live text changes should stay quiet. Use the existing reading and connection flows as the basis for status treatment, without promising new offline capabilities.

Projection is a separate presentation context. Keep it independent of the operator's appearance setting. Preserve distance typography, content positioning, and current projection behavior until a dedicated review on real display hardware. Changing the app theme must not silently restyle projected content.

## Adoption sequence and acceptance

1. **Agree the foundation.** Review burgundy versus the current violet conflict, light/dark surfaces, multilingual reading, and geometry in the specimen. Establish the existing logo as an asset source. Deliver the documented roles and paired palettes.
2. **Trial shared outputs and components.** Generate web/native outputs from one source when integration is authorized. Demonstrate variants, long text, languages and connection states as provisional experiments. Structural checks can catch missing roles and stale generated files; defer visual enforcement until application experience shows which decisions should stabilize.
3. **Wire appearance and migrate primitives.** Add persisted System/Light/Dark, test initialization and OS changes, migrate shell/actions/fields/surfaces, and remove the duplicate primary definition. Verify both applications from clean installs. Preserve preferences and reading position.
4. **Migrate one complete journey in both apps.** Start with service discovery → language selection → reading → explanation. Include loading, empty, failure, paused, reconnecting, missing translation, and long-content fixtures. Label fixture screenshots as fixtures. Then migrate operator tools and remaining routes in focused changes.
5. **Learn and expand.** Review changes discovered while applying the system, update the working decisions, and only then consider stable examples or targeted visual baselines. The user does not want specimens made definitive or prescriptive before real use. Review projection separately.

Validation gates: token contract/contrast checks; web typecheck, tests, and production build; mobile typecheck, Jest, UI/font guards, and exports; then browser and actual iOS/Android verification. Cover narrow phone, tablet, desktop, keyboard, large text, VoiceOver/TalkBack, reduced motion, and background/resume appearance changes. Browser-rendered mobile samples are not native-device sign-off.

Normal text pairs must meet [WCAG's 4.5:1 minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), with 3:1 permitted for qualifying large text. Target 7:1 for primary reading text as a product preference. Check controls/focus separately against actual adjacent surfaces. Contrast calculations alone do not establish accessibility compliance.

No application code, dependency, persisted preference, or projector behavior is changed by this proposal. The interactive specimen uses sample prayer text and represents proposed appearance only; it is not a running native screen.
