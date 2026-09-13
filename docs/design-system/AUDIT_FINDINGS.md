# Audit findings — live reading screen vs. "Tarkman Live Reading" design

Audited commit `a8b1904` on `codex/design-system-mobile-trial`, against `AUDIT.md` and `Tarkman Live Reading.dc.html` from the design handoff bundle. Findings only; no code was changed.

**How it was checked**
- **Source:** read in full: `SessionReader.tsx`, `PartList.tsx`, `ReaderStatus.tsx`, `AppButton`, `AppIcon`, `AppModal`, `SegmentedControl`, `StatusPill`, `LiturgyText`, `AppText` and `design/tokens.ts`.
- **Runtime:** the app ran on the iPhone 17 Pro simulator (iOS 26.5, 402×874pt, @3x) against `qa/design-system/mock-reader-server.cjs` at session 9001.
- **Screenshots:** taken with `xcrun simctl` at the default content size (`large`) and at AX5 (`accessibility-extra-extra-extra-large`). The saved device preferences were Dark + Grabar.
- **Measurements:** every point value comes from pixel analysis of those screenshots (pixels ÷ 3). The screenshots are in `output/design-system/audit/`.
- **Not exercised:** anything that needs taps or scrolling (manual mode, sheets, landscape, missing translation). The simulator-control integration was unavailable because Xcode isn't selected. Those items are judged from source and marked **source only**.
- **Excluded by owner:** swipe-to-details (`SwipeablePart.tsx`) was added after the design and gets a pass.

## Summary

| Result | Items |
|---|---|
| Pass | 2 Status, 3 Part list, 4 Reading measure, 5 Return to live, 6 Preferences, 8 Button states, 10 Missing translation, 11 Explanation, 13 Tokens, 14 Icons |
| Diverges | 1 Header (owner-sanctioned), 7 Sheets (platform constraint), 9 Accessibility sizes |
| Not measured | 12 Landscape (source only, passes on paper) |

**10 pass / 3 diverge / 1 not measured.**

This is a large improvement over the pre-design state. Every structural defect in the brief was addressed: unboxed rows, one 20pt inset, a real Live indicator, paired status tokens, reading size, token-based button states and icons.

**The three most consequential divergences**
1. **At AX5 the pinned header still takes 23% of the viewport.** It measures 205pt against the design's ~56pt. Controls wrap to two rows while icons stay fixed at 22pt, so prayer text gets 66% of the screen against the design's 84%. This is the old primary defect, much reduced but not solved.
2. **Every sheet is still a full-height iOS page sheet.** The installed React Native `Modal` has no detent API. This is a real constraint the design didn't account for.
3. **Status changes may push prayer text down in manual mode.** Status pills live in the list header, and the list doesn't preserve visible content position. This comes from reading the source; I haven't reproduced it.

## Findings

### [1] Reader header — diverges (owner-sanctioned)
**Expected:** a ~140pt header that scrolls away and condenses to 52pt (title 17/22, overflow menu). Back is a chevron with a ≥44pt target. Secondary actions are right-aligned icon buttons. Title uses the `heading` role.

**Found:**
- **Old 50% header gone:** yes. Title, parish and status now render as `ListHeaderComponent` and scroll with the readings (`SessionReader.tsx:60-65`, `PartList.tsx:66-68`).
- **Pinned bar:**
  - Back is a chevron, icon-only under 600pt width, 48pt target (`SessionReader.tsx:70`, `AppButton.tsx:36`).
  - A Live pill sits beside Back (`:71`).
  - The language button shows the icon plus a short code ("Գրբ"). Explain and Preferences are icon-only (`:74-82`).
- **Title:** `heading` (`:61`). Measured cap/ascender band 125–180pt, two lines.
- **No condensed title and no overflow:** the pinned bar has no title, and controls wrap (`flexWrap: 'wrap'`, `:67`, `:73`).
- **Measured at default size:**
  - Pinned bar 62→118pt, **56pt**.
  - The scroll-away details run 118→236pt, so on load the chrome above the current part is **174pt (19.9% of 874)**.
  - After scrolling, it's 56pt (6.4%).

**Assessment:** a divergence, deliberately chosen. `claude-reading-refinement.md` ("Header follow-up") records the owner's decision to keep every action visible with no overflow and no pinned title. Two points remain for the owner to weigh:
- On load the chrome is 34pt taller than the design's ~140pt target, because the title wraps to two lines at 23/32.
- The wrap-instead-of-overflow decision is what drives item 9.

### [2] Live and status — pass
**Expected:** a persistent Live indicator. Paused, reconnecting, lost and not-listed each get a distinct treatment with paired tokens, a glyph, a bold state name and a consequence sentence. Service and connection state stay separate. No layout shift.

**Found:**
- **Live:** a `success`/`successSurface` pill with a `radio-button-on` glyph (`SessionReader.tsx:71`, `StatusPill.tsx:11-12`). Measured contrast is 7.70:1 dark (`#9ED5B7` on `#20372B`) and 6.26:1 light (`#286346` on `#EAF3ED`).
- **Service state:** a `warning` pill with the pause glyph (`ReaderStatus.tsx:13-15`).
- **Not listed:** a `neutral` pill (`disabled`/`onDisabled`) with the offline glyph (`:16-17`).
- **Connection state:**
  - Connection lost uses `danger`.
  - Reconnecting uses `info` plus a spinner.
  - Lost-with-polling uses `danger` (`:18-20`).
- **Separation:** service and connection are separate, stackable elements.
- **Not color alone:** each pill has a glyph (or spinner), a semibold `label` and a `caption` consequence (`StatusPill.tsx:17-20`).
- **Strings:** all the original consequence strings survive verbatim, e.g. "Connection interrupted. Reading may be out of date." and "Live connection unavailable. Checking for updates every 30 seconds."

**Assessment:** passes. Three notes:
- **Possible layout shift (source only, not reproduced):**
  - The detailed pills render inside the list header (`SessionReader.tsx:63`).
  - The `FlatList` (`PartList.tsx:62`) has no `maintainVisibleContentPosition`.
  - In manual mode, a pill appearing or disappearing above the current scroll position changes header height and moves every row.
  - In following mode `onContentSizeChange` re-targets, which snaps back but may flicker.
  - At AX5 the pinned bar wraps, so Live disappearing on disconnect could also change the bar's height (`SessionReader.tsx:67-72`).
  - This conflicts with "prayer text must not move because the network changed." Worth a device check.
- **New copy:** "Text stays where it is." (`ReaderStatus.tsx:15`) and "Following the service" (`:12`, currently suppressed by `showLive={false}`).
- **Announcements:** every `StatusPill` is `accessibilityLiveRegion="polite"` (`StatusPill.tsx:13`), including Live, so reconnect cycles will announce "Live". Consider making the Live pill non-live.

### [3] Part list — pass
**Expected:** no per-row card. The current part is a full-bleed `surface.default` band with a 3pt leading rule. Past parts use `text.secondary` (not opacity). Rows get 1pt `border.divider`. Labels show the role only.

**Found:**
- **Rows:** a `View` on `background`, or `surface` when current, with `borderBottomWidth: 1` in `divider` (`PartList.tsx:81-82`).
  - Measured: band `#231E23` full width from 236→549pt, divider `#493C45` 1pt at 549pt, then canvas `#171417`.
- **Leading rule:** 3pt wide (`:83`). Measured pixels x=0–3pt are `#B07A93`; at x=3.5pt it's band color.
- **Past parts:** `tone="muted"` (`:97`). `grep opacity` finds no matches in `components/` or `features/live/`.
- **Label:** role only, capitalized, plus "NOW" / "PAUSED HERE" (`:87-88`).

**Assessment:** passes. Minor: `position` is still spoken. The accessibility label is `${item.position} ${item.role}` (`:85`), and the swipe label repeats it (`:79`). VoiceOver says "1 Priest, current part". The audit's rule was "not on screen", which holds. If position is internal identity, it probably shouldn't be announced either; that decision belongs to the owner.

### [4] Reading measure — pass
**Expected:** one 20pt page inset, a ~19pt stanza gap, source line breaks preserved.

**Found:**
- **Inset:** `page = fontScale > 2 ? 16 : 20` (`PartList.tsx:30`). Measured text left edge at the default size is **20.7pt**, where 0.7pt is glyph side bearing. **Total edge-to-text padding: 20pt**, down from 42pt.
- **Stanza gap:** line pitch measured at 38.0pt (325.7→363.7). The first line of stanza 2 starts 57.0pt after the last line of stanza 1 (363.7→420.7), which is **38 + 19**. The gap scales with `fontScale` and reading size (`LiturgyText.tsx:22`).
- **Line breaks:** stanzas split on blank lines only; the source newlines inside a stanza are preserved (`LiturgyText.tsx:16-21`).

**Assessment:** passes exactly.

### [5] Return to live — pass (minor divergence)
**Expected:** floating above the home indicator, ≥48pt, a caption naming what happened, a non-directional icon, an opaque scrim, and unchanged behavior.

**Found (source only):**
- **Position:** a bottom strip outside the list with an opaque `background` (`SessionReader.tsx:90-95`).
- **Button:** `primary`, `rounded`, 48pt min height, `sync-outline` icon (`AppIcon.tsx:9`).
- **Caption:** "Live reading moved on" appears only when the current part changed during manual reading, otherwise "Reading at your own pace". It's hidden at accessibility sizes (`:92`).
- **Action:** dispatches `follow` and then `retry()` (`:94`).

**Assessment:** passes. It's docked rather than floating: the strip is in the flex column, so entering manual mode shrinks the list viewport from the bottom. Text doesn't move, and nothing overlaps glyphs. That's arguably safer than an overlay.

### [6] Reading preferences — pass
**Found (source only):**
- **Appearance:** a `SegmentedControl` (`SessionReader.tsx:122-123`).
- **Reading size:** Standard / Larger / Extra large at 24/38, 30/46 and 36/54 (`tokens.ts:58-62`), with a live preview from the current part's first line (`:128-131`).
- **Caption:** "Reading size adds to your device's text size setting." (`:132`).
- **Reset:** "Forget" sits below a divider and asks for inline confirmation with a `destructive` Reset button (`:133-139`).

**Assessment:** passes. The segmented control stacks vertically above `fontScale 1.3` or under 360pt width (`SegmentedControl.tsx:11`), which is a reasonable accessibility adaptation.

### [7] Sheets — diverges (platform constraint)
**Expected:** content-sized detents (~375 / 436 / 640 / 700pt), commit actions in the header, bottom safe area cleared.

**Found (source only):**
- **Detents:** none. iOS always uses `presentationStyle="pageSheet"` with the shell at `flex: 1` (`AppModal.tsx:27`, `:31`).
- **Header actions:** yes, the title plus Done, or Cancel plus "Apply languages" (`AppModal.tsx:34-38`, `SessionReader.tsx:98-99`).
- **Bottom padding:** `max(insets.bottom, 24)` (`:33`).

**Assessment:** all sheets are full height. The refinement doc records the cause: RN 0.86's `Modal` exposes no detents, so fixing this needs a new sheet dependency or native module. That's a design assumption rather than an implementation defect. Minor: the header order is `[title][Cancel][Apply]`, and it wraps at large text. iOS convention puts Cancel leading and the confirm action trailing.

### [8] Button states — pass
**Found:**
- **No opacity:** there's none left. Background and foreground are `disabled`/`onDisabled` when inactive, `pressed`/`onPrimary` when pressed, and `secondary`/`onSecondary` when selected (`AppButton.tsx:26-29`).
- **Secondary variant:** `surface` with a `divider` border, not the selection tint (`:27`, `:37`).

**Assessment:** passes. Observation: the pressed state for **quiet** and **secondary** buttons also becomes a solid `actionPressed` fill with `onPrimary` text. Header icon buttons flash burgundy/pink on touch, which is heavier than the design's quiet feedback. That's a style call, not a defect.

### [9] Accessibility sizes — diverges
**Expected at AX5:** nothing capped, header ~56pt, targets 56pt, actions folded into an overflow, padding 20→16 above AX3, prayer text ~84% of the viewport.

**Found (measured at AX5):**
- **Nothing capped:** reading text scales (`AppText.tsx:24`, `allowFontScaling`). The Armenian first line wraps after one word ("Հայր").
- **Pinned bar:** wraps to two rows, 62→266.7pt, **205pt (23.4%)**. Row 1 holds Back and Live (66–156pt ink). Row 2 holds language, explain and preferences (160–263pt ink).
- **Icons don't scale:** `maxFontSizeMultiplier={1}` at 22pt (`AppIcon.tsx:17`). The language icon is visibly tiny beside the scaled "Գրբ".
- **Touch targets:** fixed at 48 (`tokens.ts:47`). They don't grow to 56.
- **Overflow:** none; the `more` icon exists but is unused.
- **Padding:** steps to 16 at `fontScale > 2` (`PartList.tsx:30`). Measured text edge at AX5 is 18–19pt, which fits 16pt plus side bearing of large glyphs.
- **Reading region:** the list starts at 266.7pt, and the band runs to the 840pt home-indicator inset: **573pt (65.6%)**. The pre-design screenshot showed ~12%.

**Assessment:** a big improvement (12% → 66%), but short of the 84% target. It's a direct consequence of the owner's no-overflow decision in [1], not a coding error. The remaining gap is the two-row wrap. Options that keep "all actions visible":
- Drop the Live pill's text at `accessibilitySize`, keeping the glyph with an accessible label.
- Show the language as an icon only.
- Let icons scale with a cap, so glyphs don't look broken next to scaled text.

### [10] Missing translation — pass
**Found (source only):**
- **Fallback text:** "Translation not available." renders at reading size in `muted`, with language tag `en` (`LiturgyText.tsx:25-26`).
- **Alternatives:** the panel offers "Read in {language}" for **selected** languages that **have text** for this part (`PartList.tsx:98-104`).
- **No substitution or error styling:** there's no silent substitution and no danger tokens.

**Assessment:** passes. Two minor defects:
- If no other selected language has text, the caption "Choose another reading language for this part." appears with no buttons, which is a dead end.
- The Grabar button's accessibility label is "Read in Grabar" while its visible text is "Read in Գրաբար" (`:101-102`). Voice Control users saying the visible label won't match.

### [11] Explanation sheet — pass
**Found (source only):**
- **Body:** `LiturgyText variant="explanation"`, Source Serif 17/27 (`tokens.ts:52`, `AppText.tsx:19`), selectable by default, 24pt modal padding (`AppModal.tsx:33`).
- **States:** loading uses an info pill with a spinner, stale uses Reconnecting, error uses a danger pill (`accessibilityRole="alert"`) plus Retry, and none is plain text (`SessionReader.tsx:143-149`).

**Assessment:** passes. The "loading" branch keys off service-level `state.loading`. Explanations arrive in the same snapshot (`controller.ts:30-43`), and the opener is disabled until a part exists, so that branch is effectively unreachable. That's harmless.

### [12] Landscape — not measured (source passes)
**Found:**
- **Width:** the comparison width comes from the list's actual `onLayout` width, which is inside the root `SafeAreaView` and so already excludes the sensor-housing inset (`PartList.tsx:59`).
- **Two-column gate:** `readingWidth / n − columnIndent ≥ 300 × fontScale × size/24` (`:33-34`). This subtracts the indent as the audit asks, and also scales with reading size, which improves on the design.
- **Active column:** a 3pt rule plus the label "{Language} · reading" in `text.primary` `label`. Comparison columns get a 1pt divider rule and "· comparison" (`:92-96`).
- **Header:** the pinned bar has no title, so it stays one row at the default size.

**Assessment:** it passes on paper. I couldn't rotate or measure the inset without simulator input tooling.

### [13] Tokens — pass
**Found:**
- **`spacing.stanza: 19`** (`tokens.ts:45`), measured at runtime in [4].
- **`currentRule`:** `#B07A93` in dark only, `actionPrimary` in light (`tokens.ts:25`). Measured non-text contrast is 4.72:1 against the band `#231E23` and 5.27:1 against the canvas (≥3:1 needed). Light `#6E3852` on `#FFFFFF` is 8.93:1.
- **`type.reading.hy`:** not adopted; Armenian stays 24/38. `claude-reading-refinement.md` records this as deliberate, pending a fluent reader.
- **Status colors:** unchanged. `nativePalette` maps `success/warning/info/danger` and their surfaces straight from `@tarkman/design` (`tokens.ts:19-31`).
- **Dark accent `#E3A7C3` (`colors.primary`) on the reader:**
  - It paints **3 roles**: the Return-to-live fill (`AppButton.tsx:27`), markdown link text (`LiturgyText.tsx:44`) and the focus ring (`AppButton.tsx:37`).
  - It does **not** paint the back link (icon uses `foreground`), the part label (muted in dark, `PartList.tsx:87`) or the current rule.
  - The header language button uses the selection pair `#F2C8DD` on `#432C39`, measured at 8.49:1.

**Assessment:** passes. The dark accent is appropriately restrained.

### [14] Icons — pass
**Found:**
- **Names added:** `more` (`ellipsis-horizontal`), `live` (`sync-outline`), `alert`, `paused`, `offline` and an extra `connected` (`radio-button-on`) (`AppIcon.tsx:5-11`).
- **Busy:** uses `ActivityIndicator` (`StatusPill.tsx:17`).
- **Selected:** `selected` → `checkmark` for single-select, `checkbox` / `unchecked` for multi-select (`:8`, `SessionReader.tsx:170`).

**Assessment:** passes. `more` is horizontal rather than the design's vertical ellipsis, which is fine (horizontal is the iOS idiom) and currently unused. The icon font is the pinned Ionicons 13.1.4, rendered through a `TarkmanIcons` family.

## Measurements

| Metric | Default (`large`) | AX5 | Design target |
|---|---|---|---|
| Status-bar safe area | 62pt | 62pt | — |
| Pinned header bar | **56pt (6.4%)** | **205pt (23.4%)** | 52pt / ~56pt |
| Chrome above current part on load (bar + scroll-away title/parish) | **174pt (19.9%)** | 205pt (title scrolled off) | ~140pt (16%) / ~56pt (6%) |
| Edge-to-prayer-text padding | **20pt** (20.7 incl. side bearing) | **16pt** (18–19 incl. side bearing) | 20 / 16 |
| Stanza gap | **19pt** (57pt line-to-line vs 38 pitch) | scales | 19 |
| Reading region share (list viewport, excluding home inset) | 604pt (69.1%) on load; 722pt (82.6%) after the title scrolls away | **573pt (65.6%)** | — / **~84%** |
| Dark accent `#E3A7C3` distinct roles on reader | **3** (return-to-live fill, links, focus ring) | — | selected states only |
| Dark current rule contrast | 4.72:1 vs band, 5.27:1 vs canvas | — | ≥3:1 |

"Reading region" means the part list's visible area, including each part's role label row. It doesn't count prayer glyphs alone.

## Design errors

1. **"Every status string is verbatim from `ReaderStatus.tsx`" is false.** The pre-design `ReaderStatus` had no state names. "Connection lost", "Not live", "Reconnecting" as a label, "NOW" and "PAUSED HERE" all originate in the design's HTML (each string appears there), not in source. They're new copy and do need review; the implementation adopted them.
2. **Content-sized sheet detents aren't available** with the installed React Native `Modal` (0.86). The design specifies heights as though they're a styling choice. They need a sheet library or native module, which is a separate dependency decision.
3. **The collapsing header and overflow menu were superseded** by the owner's screenshot review (`claude-reading-refinement.md`, "Header follow-up"). The design's AX5 targets (~56pt header, ~84% prayer share) assumed the overflow. Under the owner's rule those numbers aren't reachable without further compaction, so the design should be updated to the chosen model before it's used as an AX5 reference.
4. **"Touch targets grow to 56pt at AX5"** has no token or platform basis. `touchTarget` is a single shared 48 in both the spec and the code. If wanted, it needs a new scaled-target rule in `implementation-spec.md`.
5. **"Page padding steps 20 → 16 above AX3":** React Native exposes `fontScale`, not the content-size category. The implementation uses `fontScale > 2`. The design should express its threshold as a scale factor.
6. **Position in accessibility labels:** the design says position is internal identity that must not be on screen, but it's silent on announcement. The implementation still speaks it (see [3]). The design should decide.
7. **`type.reading.hy = 23/38`** remains unverified by a fluent Grabar reader. The implementation correctly declined to adopt it.

## Known-unresolved (as picked by the implementation)
- **Armenian reading size:** kept at **24/38**; 23/38 was not adopted.
- **Icon optical weight:** real Ionicons 13.1.4 glyphs at a fixed 22pt (16pt in pills), with no scaling. Weight against the platform-sans labels still needs verification, especially at AX sizes where labels scale and glyphs don't (see [9]).
