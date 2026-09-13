# Typography study and design completion gates

Status: literary serif direction selected by the user, 2026-09-12. Exact typography specifications and native QA remain open. Application implementation has not started.

Update: the user subsequently approved the [foundation board](foundations.md). The [first component gallery](components.md) uses that selected baseline and the repository's pinned full-coverage Armenian fonts, after visual QA found missing combining marks in the Google Fonts subset. Earlier specimens below document the direction study; they do not supersede the newer font evidence or imply native sign-off.

Preserved visual comparison: [Typography specimen](specimens/tarkman-typography.html).

## Selected direction

User decision: “i like the literary serif.” Continue with the specimen's Source Serif 4 / Noto Serif Armenian pairing and quiet system-sans controls. Use this as the basis for subsequent component and complete-screen design. The original sans treatment is retained only as a comparison baseline. This selection settles the visual direction; it does not establish final size/weight tokens, exact font assets, or completed multilingual/native QA.

## What changes after the first review

The first proposal supplied readable text and a useful architectural outline, but its system-font reading treatment lacked character. Switching languages also hid the script differences that need to be compared. The next specimen makes English, Russian, and Armenian visible together and adds transliteration and punctuation stress text.

Selected direction: an editorial reading experience, with expressive service titles, deliberate paragraph rhythm, and generous but purposeful space. Use burgundy for hierarchy and controls sparingly. Keep body prayers upright and comfortably weighted; avoid decorative letterspacing, drop caps, forced all-caps prayers, or ornament that competes with the text.

## Selected pairing; weights pending QA

| Purpose | English / Russian / transliteration | Armenian / Grabar |
| --- | --- | --- |
| Service and reading title | Source Serif 4, semibold candidate | Noto Serif Armenian, real bold asset |
| Prayer / scripture body | Source Serif 4, regular candidate | Noto Serif Armenian, real regular asset |
| Strong reading emphasis | Source Serif 4, real bold candidate | Noto Serif Armenian, real bold asset |
| Controls / metadata | Platform system sans-serif | Evaluate existing Noto treatment at UI size before choosing a separate Armenian UI family |

Source Serif 4 supports Latin and Cyrillic according to the [official Adobe specimen](https://adobe-fonts.github.io/source-serif/). That makes it a candidate for coordinated English and Russian reading, not proof that it harmonizes with Armenian. Armenian remains a deliberate separate font choice. Review the visual darkness, perceived size, line rhythm, and heading weight together before adopting the pair.

The comparison includes the original system-sans reading treatment as a baseline. It is a focused comparison of reading personality, with the same colors, content, and layout. It does not reopen the entire app design.

The inline specimen uses Google Fonts web delivery for Source Serif 4 and Noto Serif Armenian and reports loading status. Those files are not the native app's pinned full-coverage Armenian TTFs. It can support a visual direction decision; it cannot sign off exact native font assets or combining-mark coverage. If loading fails, the displayed fallback is explicitly unsuitable for judging the candidate.

## Type specification to finish

- **Hierarchy:** Distinguish application titles, service titles, section headings, prayers, rubric/instructions, translations, and metadata. Use a serif title around 36–40 on roomy web layouts and 30–34 on narrow layouts, with prayer text starting at 24/38. These remain optical starting points, not approved final tokens.
- **Per-script sizing:** Evaluate Armenian independently at the same physical viewport, then adjust size and leading only if the visual comparison warrants it. Never shrink Russian to make its paragraph finish at the same height as English. Do not stretch text or force aligned line endings across translations.
- **Rhythm:** Define paragraph gaps, stanza breaks, list spacing, and title-to-body spacing. Separate semantic paragraph breaks from line wrapping. The short prayer is necessary but insufficient; include real long service content in the next screen pass.
- **Emphasis:** Check bold with real assets. Decide Armenian italic behavior explicitly: use an available real face or an agreed alternative; do not accept synthetic slant by accident. Review existing Markdown behavior before migration.
- **Responsive layouts:** Use natural reflow for a single language. Define stacked and parallel translations separately; do not cram three desktop reading columns into a phone viewport. Keep language labels close to the relevant text.
- **Accessibility:** Preserve native text scaling and web zoom, selection, language tags, screen-reader reading order, visible focus, and selectable text. Reading-size preference must compose with system accessibility settings.
- **Assets:** Pin source/release, exact filenames, weights, hashes, coverage and required notices for any selected new font. Decide whether production uses static files across platforms or a tested web variable/static-native mapping. Preserve Armenian assets documented in `apps/mobile/assets/fonts/SOURCE.md` until replacement is specifically justified.
- **Resilience:** Test cold start, failed font loading, offline restart, and fallback-to-loaded layout shift. A loaded family name is insufficient evidence that every glyph was rendered by that family.

## Required multilingual content

Use the existing mobile gallery prayer in `apps/mobile/design/samples.ts` as the initial fixture, preserving its text without editorial correction. It is a design fixture, not approval of a liturgical edition.

| Sample | What to inspect |
| --- | --- |
| English prayer and a long paragraph | Reading character, measure, bold/italic rhythm, punctuation, line breaks |
| Russian prayer and a long paragraph | Cyrillic shape/weight, `ё`, `й`, `ъ`, `ы`, `ь`, stress accents, wrapping |
| Armenian prayer and a long paragraph | Real Armenian face, baseline, ascenders/descenders, punctuation and mark placement |
| Armenian `Տէ՛ր, ողորմեա՜։ Ինչո՞ւ։` | Armenian emphasis/question marks and full stop, at regular and bold |
| Deliberate `Ա̄ ա́` stress fixture | Combining macron/acute coverage, fallback, clipping; not normative liturgical spelling |
| Russian `Ёё Йй Ъъ Ыы Ьь — «мир»; мо́ре` | Cyrillic glyphs, punctuation, combining stress; not an additional prayer translation |
| Transliteration from existing fixture | Latin reading parity and diacritics if present in authoritative service data |
| Mixed Armenian/Russian/Latin, digits and links | Font-run transitions, baseline, emphasis, selection, screen-reader order |
| Missing translation and unavailable font | Honest fallback presentation and stable layout |

Do not automatically normalize or rewrite liturgical text to make the rendering pass. Record content provenance and have a fluent reader assess linguistic typography where needed.

## Visual QA matrix

| Dimension | Required coverage |
| --- | --- |
| Appearance | Light and dark; OS appearance transition; explicit override |
| Viewport | 320/390-width browser, tablet portrait/landscape, desktop, actual iOS and Android phone |
| Scale | Default; web 200% zoom; large native accessibility text; user reading-size change |
| Content | All samples above, short and long content, parallel and single-language reading |
| Weight/state | Regular, real bold, agreed emphasis treatment, selected text, link, loading/fallback |
| Navigation | Reading → explanation sheet → return, preserving position and language |
| Devices | Browser specimen for direction; exact font assets on actual native runtime for approval |

Capture labeled screenshots with font asset/version, viewport, OS/runtime, scheme, text scale, language, fixture source, and loading state. Fail on missing glyphs, unintended fallback, clipped marks, overlapping lines, truncated controls, horizontal overflow in a single-language reading view, or inconsistent semantic hierarchy. Script harmony and reading personality also need human review; numeric checks cannot settle those decisions.

## What else the design-system proposal still needs

1. **Complete the selected visual direction:** Literary serif is selected. Finish script-specific metrics, hierarchy and representative multilingual screenshots. Palette values are also still proposed.
2. **A complete semantic token contract:** Hover/pressed/focus/disabled/loading states, status foreground/background pairs, elevation, motion, density, focus and interaction boundaries. The initial palette is not a complete component-state specification.
3. **A component specification and gallery:** Buttons, fields, service rows/cards, status/connection notices, language/reading controls, dialog/sheet. Show both themes and long labels; document keyboard, screen-reader and native behavior.
4. **Representative complete screens:** A first [reading-screen review](screen-review.md) now covers multilingual reading, explanation, language selection, and appearance/reading preferences in web and native-style mockups. Service discovery, empty/failure/reconnecting states, operator controls, long content, and actual native behavior remain to be designed or verified. These are visual proposals, not application changes.
5. **A migration and ownership contract:** Exact public package exports, generated output verification, app adapters, legacy-token mapping and removal criteria, affected file batches, regression gates, and how a developer proposes a new token or component.

Do these in that order. Finish the typography direction before investing in every component. Then prove one complete reading journey in both platforms before broad migration. Projector typography stays a separate distance-reading review.

## Evidence status

- Current repository sources and existing Armenian font provenance inspected.
- Candidate English/Cyrillic coverage checked against the font author's documentation.
- Multilingual interactive direction specimen created, with explicit font-load feedback.
- Temporary browser check: candidate regular/bold web font loads reported success. Inspected the light desktop view and Russian/Armenian dark rendering at a 390×844 browser viewport, including 38px enlarged reading. The inspected prayer text reflowed without visible horizontal clipping. This is limited specimen evidence, not the full matrix above, glyph-by-glyph font attribution, or native approval.
- Exact asset glyph/rendering checks, long-content screen QA, and iOS/Android typography approval remain pending.

No application code, production font asset, dependency, or account preference changes are included in this study.
