# Claude Design brief — Tarkman mobile live reading screen

Copy everything below the line into Claude Design. Attach the files listed in "Attachments".

---

## Context

Tarkman is a companion app for Armenian Apostolic church services. People open it on their phone **during a live service** to follow along. The service moves through ordered "parts" (prayers, hymns, readings). The app auto-scrolls to the part the clergy are on. Each part has text in Classical Armenian (Grabar), English, Russian and transliteration. The people using it are standing or sitting in a dim church, glancing between the altar and their phone, often older, often reading a second language. The screen must be calm, legible at a glance, and never distracting during prayer.

We have a provisional design system (attached tokens + docs):
- **Palette:** warm neutral reading surfaces, burgundy identity (`#6E3852` light / `#E3A7C3` dark), rose selection, paired status roles (success/warning/danger/info with matching surfaces). Light and dark both required.
- **Type:** Source Serif 4 (Regular, Semibold) for reading text and titles; Noto Serif Armenian (Regular, Bold) for Grabar; platform system sans for all controls. Reading 24/38, title 34/44, heading 23/32, body 17/27, label 15/23 semibold, caption 14/22.
- **Geometry:** spacing 4/8/12/16/24/32/48/64; radius control 8, card 16, sheet 24; 48pt minimum touch target.
- **Product rules already decided:** phone portrait shows **one active reading language** with quick switching among the user's selected languages; side-by-side columns only when each language gets ≥ ~300pt × font scale; selecting the language set and choosing the active language are separate actions. Manual scrolling leaves "follow live" mode, and there's an explicit return-to-live action. Appearance is System / Light / Dark. OS Dynamic Type must be respected, with no maximum and no shrinking to fit.

We applied these tokens to the existing Expo (React Native) reader. The attached iOS screenshots show the result. The tokens are in, but the screen is still the old layout in new colors. It does not yet feel designed, and several design-system contracts were never implemented.

## Critique of the current implementation (what to fix)

**1. No hierarchy in the header — it's a pile of equal buttons.**
"All services", the service title, and three identical rose-tinted buttons ("English", "Reading preferences", "Explain current part") wrap onto two rows. Together they take ~40% of the first screen before any prayer text shows. Every action has the same visual weight. There are no icons, even though the spec defines a semantic icon set (languages, explanation, preferences, close, back, next, selected). The back action is bare text with no chevron. The language button shows "English" but doesn't read as a switcher.

**2. Live state is invisible.**
While following live, nothing on screen says "Live". "Return to live" only appears after you scroll away. Service paused, reconnecting, connection lost, stale content and "no longer listed live" all render as plain grey caption text. The success/warning/info status tokens exist but are never used. The spec requires status to name the state and its consequence, never depend on color alone, and keep *service state* (active/paused) separate from *connection state* (live/reconnecting/offline).

**3. Every part is a bordered card.**
The spec says "avoid making every row a card". Right now every part is a raised, bordered card, and the current part differs only by a 2pt burgundy border plus a small "· Current part" suffix. Past, current and upcoming parts look the same. The part label "1 / priest" is raw data: a lowercase role, a slash, no liturgical name.

**4. Reading measure is too narrow and double-padded.**
List padding (16) plus card padding (24) plus border leave ~26–30 characters per line at 24pt on a 402pt phone. English breaks awkwardly ("who art in / heaven,"): the source line breaks and soft wrapping fight each other. Stanza gaps are a full 38pt blank line. The reading surface should feel like a page, not a form field.

**5. The reading-size control is missing, and the preferences sheet is mostly empty.**
The spec and every specimen include Standard / Larger / Extra large reading sizes. The app only has Appearance. It's shown as three full-width stacked buttons (a segmented choice rendered as a menu) in a full-height iOS page sheet that's ~70% empty, with a full-width "Close" pinned at the bottom instead of a native sheet header action. "Forget my reading choices" is a quiet link sitting right next to routine settings.

**6. Sheets don't fit their content.**
The language switcher (2–4 options), preferences and explanation all open as the same full-height page sheet. Short choices should use a medium/compact detent. The explanation deserves a proper reading surface (serif, comfortable measure).

**7. Button states lean on opacity.**
Pressed = 80% opacity; disabled = 55% opacity. The token set defines explicit `disabled`/`onDisabled` and `pressed` colors that aren't used. Secondary buttons use the *selection* tint, so "selected" and "just a button" look the same.

**8. The layout collapses at accessibility text sizes.**
At maximum Dynamic Type (screenshot `ios-dark-large-reader.png`), "All services", "Return to live" and the wrapped title fill the whole viewport. The header is a separate scroll region capped at 50% height, so the reading text is almost entirely hidden. The header should collapse or scroll away with content, and secondary actions should move into a single overflow.

**9. Landscape comparison is functional but unrefined.**
The two columns work, but the header still takes a big share of the short landscape height. The per-column language labels are tiny muted captions. The card looks tight against the leading safe area. Active vs. comparison language is shown only by caption color.

**10. Dark mode feels hot rather than candlelit.**
The saturated pink (`#E3A7C3`) is used for the back link, the current-part border, labels and the selected button all at once. In a dark church that's a lot of glowing accent. Consider restraint: accent for one thing at a time.

**11. Transitions and states are undesigned.**
Auto-advance to the next part jumps with no transition. Loading, empty, error and missing-translation states are text-only. (Motion should stay brief, honor Reduce Motion and never flash during prayer.)

## What I want from you

Design an improved **native iOS phone** live reading experience using the existing tokens. Treat the tokens as a starting point, not a cage. If a value needs to change (for example, dark accent restraint), propose the change explicitly and say why. Keep the burgundy identity, the literary serif reading type and the platform-sans controls.

Produce these artboards (iPhone 17 Pro, 402×874pt), light **and** dark for the core screens:

1. **Reading — following live (English).** The core screen. Compact header with back chevron, service title, and a clear, calm live indicator. Icon-led actions for language, explanation and preferences, with a clear hierarchy. The current part is distinguished from past and upcoming parts without a card around every part. The reading measure is comfortable.
2. **Reading — manual (scrolled away).** How "Return to live" appears (consider a floating pill anchored above the home indicator) and how the header condenses on scroll.
3. **Reading — Grabar (Armenian), dark.** Check that the Armenian and Latin serifs balance in perceived size and weight.
4. **Language switcher sheet (medium detent).** Quick switching among the selected languages, a clear selected state, and an entry into "Choose languages".
5. **Choose languages.** Multi-select with a minimum-one validation state and Cancel/Apply.
6. **Reading preferences sheet.** Appearance as a segmented control, a reading-size control with a live text preview, and "Forget my reading choices" appropriately separated.
7. **Current-part explanation sheet.** A serif reading surface, with loading / none available / error variants.
8. **Status states.** Service paused; reconnecting (last text kept, marked possibly out of date); connection lost with retry; service no longer live. Show how each sits in the header without pushing prayer text off screen.
9. **Missing translation.** The active language has no text for this part. State it explicitly and offer switching, without silently substituting another language.
10. **Accessibility XXXL Dynamic Type.** The following-live screen at maximum text size, with the header collapsed so prayer text dominates.
11. **Landscape two-language comparison** (English + Grabar), respecting safe areas.

For each artboard, annotate:
- the tokens used (color role, type role, spacing) and any **new token or changed value** you're proposing;
- touch targets (≥ 48pt) and VoiceOver labels for icon-only controls;
- motion notes (current-part advance, sheet presentation, reduce-motion fallback).

Finish with a short **change list for engineering**, ordered by impact. For each item give: screen area → what changes → which component it touches. The components are `AppButton`, `AppModal`, `AppText`, `LiturgyText`, `Surface/Card`, `PartList`, `SessionReader`, `ReaderStatus`, plus any new `AppIcon`, `StatusPill`, `SegmentedControl` or `ReturnToLive` components.

### Constraints — do not violate
- Don't stack all translations down the page in portrait.
- Don't disable or cap text scaling, and don't shrink text to fit.
- Status never depends on color alone.
- No decorative per-mode hues, no gratuitous shadows (tonal surfaces first), and no tab bar.
- Keep text selectable and preserve the line and stanza breaks from the source.
- Use native iOS sheet presentation (detents, grabber) rather than custom overlays.
- Sample text is the Lord's Prayer (below). Don't invent liturgical content beyond clearly labeled placeholders.

### Sample content
- Service: "Divine Liturgy", St. John Armenian Church. Part roles: priest, deacon, choir, people.
- English: "Our Father, who art in heaven, / hallowed be thy name. // Thy kingdom come. Thy will be done, / on earth as it is in heaven."
- Russian: "Отче наш, сущий на небесах! / Да святится имя Твоё. // Да приидет Царствие Твоё; / да будет воля Твоя и на земле, как на небе."
- Grabar: "Հայր մեր, որ յերկինս ես, / սուրբ եղիցի անուն քո։ // Եկեսցէ արքայութիւն քո, / եղիցին կամք քո որպէս յերկինս եւ յերկրի։"
- Transliteration: "Hayr mer, vor hergins yes, / surp yeghitsi anun ko. // Yegestse arkayutyun ko, / yeghitsin gamk ko vorbes hergins yev hergri."

## Attachments to include
- `packages/tarkman-design/tokens.json` (color roles)
- `docs/design-system/implementation-spec.md` (component and behavior contracts)
- `docs/design-system/foundations.md` and `docs/design-system/typography-study.md`
- `apps/mobile/design/tokens.ts` (native type/spacing scale)
- Screenshots in `apps/mobile/qa/design-system/evidence/`: `ios-light-english.png`, `ios-light-russian.png`, `ios-dark-armenian.png`, `ios-dark-preferences.png`, `ios-dark-landscape.png`, `ios-dark-large-reader.png`, `ios-dark-large-header.png`, `ios-dark-large-explanation.png`
- Optional, for visual intent: `docs/design-system/specimens/tarkman-reading-journey.html`
- Fonts, if uploads are supported: `apps/mobile/assets/fonts/SourceSerif4-*.ttf`, `NotoSerifArmenian-*.ttf`
