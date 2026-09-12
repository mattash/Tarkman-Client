# Tarkman visual foundations, candidate v1

Status: foundation board visually approved by the user on 2026-09-12, with native icon-library selection left open. The literary serif direction is selected. Neither application consumes these files. Approval of this board is not application implementation approval or native-runtime verification. The board and review manifest retain their candidate labels as the reviewed snapshot; this document records the subsequent approval.

## Review board

The conversation specimen [tarkman-foundations-board.html](specimens/tarkman-foundations-board.html) compares light and dark across four sections: Shape & spacing, Color & type, Depth & icons, and States & motion. The control-corner comparison allows 4–12 px variations without changing the proposed 8 px source value. English, Russian and Grabar appear together; the earlier typography study also covers transliteration and stress marks.

## Decisions and rationale

The values below are the **selected visual baseline**, subject to component and platform validation. Native icon family and implementation remain open. Figma's builder workflow and Impeccable inform the process and review criteria; neither dictates these values. See the pinned references and authority rules in [README](README.md).

| Foundation | Candidate | Rationale and source |
| --- | --- | --- |
| Identity and appearance | Web burgundy anchor, warm neutral canvas, semantic light/dark palettes | Preserve the observed web brand anchor and the user's cross-app direction. System appearance resolves to one of these palettes; the board forces both for comparison. |
| Reading typography | Source Serif 4; Noto Serif Armenian for Grabar; 24/38 reading | User-selected literary direction. The board renders regular text in all three scripts. Pair by optical rhythm rather than assuming equal numeric sizes create identical visual weight. |
| Type hierarchy | Web reading title 40/48; compact/native title 34/44; body 16/26 web and 17/27 native; label 15/23; caption 14/22 | Separate expressive service titles from quiet interface controls. The board uses the compact title to fit paired panels. Specimen annotations are review chrome, not product caption tokens. |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 | Proposed compact scale with room for reading. Start with control padding 12/16, page gutters 24 native and 32 roomy web, and section gaps 32/48. Layout must reflow with large text. |
| Corners | Control 8; card 16; sheet top 24; fully rounded status pill | Recognizable roles with increasing softness by surface size. A radius token permits a card when grouping requires one; it does not require wrapping every section in a card. |
| Borders | Divider 1; control 1; selected 2; focus ring 3 with 3 offset | Quiet grouping, visible interactive boundaries, and distinct selection/focus. Decorative divider contrast is intentionally lower than functional boundary contrast. Selected state also includes a text cue. |
| Elevation | Flat; raised 0/2/8; overlay 0/12/32 (x/y/blur) | Shadows indicate depth. Dark surfaces also step from #231E23 to #302730 to #392F39, since shadow alone is insufficient to communicate the intended hierarchy. Opacities are theme-specific in the manifest. |
| Gradients | None in core controls or reading surfaces | The typography and existing burgundy identity provide character. Any future gradient needs a particular product purpose and separate review. |
| Icons | Web specimens: Lucide outline, 20/24, stroke 1.75. Native library: open. | Share meaning, apparent size, visual weight, color roles and touch targets across platforms. Use a consistent native family appropriate to Expo; do not require Lucide or its numeric stroke width on native font icons. No dependency was installed. |
| Touch and layout | Minimum 48 logical-unit target; single-column reading measure up to 60ch | Carry forward the proposal's native target and readable measure. CSS pixel specimens do not validate native logical units, safe areas, or Dynamic Type. |
| States | Explicit default, hover, pressed, selected, focus, disabled, loading, success, warning, danger and information roles | Avoid opacity-based unreadability and color-only status. Hover is a web state; native uses press feedback. Loading disables the sample action and includes text. |
| Motion | Feedback 150ms; disclosure 200ms; overlay 250ms; easing cubic-bezier(0.16,1,0.3,1) | Functional response without animating reading content. The board demonstrates disclosure only. Reduced-motion preference removes that transition; native mapping and haptics remain pending. |

## Token contract

### Icon platform policy

The user's approval explicitly preserves a separate native icon-library choice. Define semantic names such as reading, language, settings, back and close, then map those roles to each platform's library. Compare actual glyphs in the future web/native galleries for optical weight, alignment and selected states. Keep one coherent family per platform and respect native navigation conventions.

Lucide does provide a [React Native package](https://lucide.dev/guide/react-native); this is a platform-fit decision rather than a compatibility prohibition. [Expo's current icon guidance](https://docs.expo.dev/guides/icons/) points new work toward `@react-native-vector-icons` and marks `@expo/vector-icons` for deprecation. Ionicons is a candidate family, not a selected dependency. The current mobile package manifest has no direct icon-library dependency. Recheck SDK compatibility when implementation is authorized.

[foundations.tokens.json](foundations.tokens.json) is the review source for paired palettes, metrics, geometry, motion and policy. It is deliberately labeled a review manifest, **not a DTCG export**. The board embeds an equal copy and uses its colors and spacing directly. No shared package or platform adapter has been implemented.

When implementation is authorized, export primitive values and semantic aliases in the agreed DTCG format, then generate web/native adapters. Keep `action.primary`, `text.primary`, `border.control`, `border.divider`, and elevation roles distinct. Express dimensions appropriately for rem-based web scaling and native logical units. Preserve static Armenian font assets until actual native comparison supports a change.

The board's compact specimens illustrate roles rather than all token combinations. Do not copy its review navigation, paired-panel shell, or annotation styles into application components.

## Evidence and limits

- `python3 docs/design-system/check-foundation-contrast.py`: **50/50 pairs pass**. [Recorded ratios](foundation-contrast.json) cover text and secondary text on four surfaces, action states, selection, disabled text, status pairings, control boundaries and focus against four surfaces in each theme.
- Text pairs target at least 4.5:1; controls/focus at least 3:1. The disabled-text threshold is an intentional product preference, not a claim that WCAG requires contrast for inactive controls. Decorative dividers are excluded. The initial light disabled text failed the product target and was darkened to #72636D.
- Impeccable 4.3.1 static detector returned `[]` for the board. This is a narrow static check, not a formal Impeccable critique or accessibility sign-off.
- Browser inspection covered desktop 1280px and narrow 390px layouts: paired themes stack, reading fonts load, and English/Russian/Armenian samples render without visible clipping. Section switching and disclosure expansion worked. Both theme palettes and elevation levels were inspected.
- Native font shaping, large-text scaling, screen-reader journeys, keyboard focus behavior, OS appearance changes, and reduced-motion emulation remain unverified. The CSS reduced-motion rule is present; its runtime behavior has not been separately tested. No native runtime or projector surface was changed or signed off.

## Next gate

The foundation review is accepted. Next, expand into a standalone component gallery and compare native icon candidates. That gallery should stress these foundations with long labels, large text, loading/error/empty states, and language controls in both appearances. Actual app integration remains a separate authorized step.
