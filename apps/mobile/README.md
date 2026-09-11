# Tarkman mobile

Managed Expo SDK 57, React Native and Expo Router. The home route is a native-first
design-system gallery with static liturgy examples (`en`, `ru`, `grabar`,
`translit`). It makes no API/auth requests. The production website remains the
separate Vite app in `../web`.

## Develop and verify

Use Node >=22.13; install each app independently. No workspaces or root install.

```sh
cd apps/mobile
npm ci
npm start                  # Expo Go or an existing development client
npm run ios                # requires local simulator tooling
npm run web
npm run lint
npm run typecheck
npm test
npm run check:ui
npm run check:fonts
npm run config
CI=1 npm run export:web
npm ls --all
```

Core is a source-linked `file:` dependency. After installing both apps, run
`npm run core:test` and `npm run core:check-consumers` at repository root. The
static gallery uses core types only; its samples and labels are local, so Metro
needs no custom core resolver. Runtime core integration remains separate work.

NativeWind **4** with Tailwind **3** is configured through `global.css`, the
NativeWind preset, Babel and `withNativeWind` in Metro. Scanning is limited to
mobile `app`, `components` and `design`. Restart Metro after configuration edits.
NativeWind supplies layout utilities; native style objects use semantic tokens
for theme colors, typography and platform-specific elevation.

## Design primitives

`design/tokens.ts` owns light/dark roles, Tarkman purple (`#6B46C1`), point-based
spacing, radii, typography/line heights, elevation and the 44pt minimum target.
These preserve the web's role vocabulary and brand accent without importing or
changing web styles. `ThemeProvider` follows system appearance; its optional
`scheme` isolates the gallery's light/dark samples. The root owns safe areas,
status bar appearance and local font loading, without gating the router. A loading/failure notice explains system-font fallback and possible Armenian mark differences; failure offers an accessible retry without remounting the gallery.

- `AppText`: title, heading, body, liturgy, label and caption; semantic tone,
  language tag and Armenian static-font selection only after both fonts load. English, Russian
  and transliteration use the platform system font. Dynamic Type stays enabled.
- `AppButton`: native Pressable; primary, secondary, quiet and destructive.
  Loading/disabled suppress actions and expose disabled/busy accessibility states.
  Labels wrap; controls have minimum dimensions, never fixed text heights.
- `Surface` / `Card`: themed native containers; card spacing/radius/elevation.
- `TextField`: visible and accessible label, focus/error styling, native keyboard
  props, text scaling and disabled state. Return/submit behavior belongs to the
  caller; the gallery dismisses single-line keyboards on Done.
- `AppModal`: native Modal presented as a bottom sheet, scrollable content,
  safe-area padding and keyboard avoidance. Close button, backdrop, Android back,
  web Escape and accessibility escape dismiss it. Initial focus targets Close; callers
  pass an `openerRef` for return focus. Web uses host focus and RN Web’s focus trap;
  native requests accessibility focus through AccessibilityInfo. Android restores
  on the frame after removal; iOS/web use onDismiss. No exit animation or
  drag-to-dismiss gesture. Native assistive-tech behavior still needs device QA.
- `LiturgyText`: selectable by default; preserves the complete plain string,
  paragraphs and line breaks. Null/empty/whitespace shows an explicit English
  fallback with an English language tag. Uses the limited native Markdown strategy below.

## Limited native Markdown

`LiturgyText` renders nested React Native Text runs, with no HTML parser, DOM
renderer, sanitization dependency, remote images, or heavyweight Markdown library.
Paragraphs and line breaks remain intact. Supported inline forms are `**bold**`,
`*emphasis*`, single-backtick code (a subtle background, preserving the reading
font), and `[label](https://example.org/path)`. Formatting does not nest or cross
newlines. Link labels are plain text; URLs cannot contain parentheses. Only
absolute HTTPS URLs with a hostname, no credentials, whitespace, control
characters or backslashes are actionable. Native uses Linking.openURL with a
visible failure message; web uses keyboard-accessible anchors with noopener and
noreferrer. Accessible labels include the destination and native links include
an opening hint. There is no URL autolinking.

Backslash-escaped punctuation displays literally (the escape backslash is
removed). HTML tags, images, fenced code, headings/list markers, underscore
formatting and strikethrough remain plain text; they do not create HTML, images,
or block layouts. Invalid links retain their source text and stay inert. This is
a small inline grammar, not CommonMark compatibility; unsupported block markers
can coexist with supported inline text. Examples:

```text
First line
Second line

**Bold reading**, *gentle emphasis*, and `inline code`.
[Noto Armenian](https://notofonts.github.io/armenian/)
\*literal stars\*  <No HTML is rendered.>
[Unsafe link](javascript:alert)  ![No image](https://example.org/image.png)
```

Card shadows use React Native/RN Web `boxShadow` (SDK 57's New Architecture),
not deprecated RN Web shadow properties. The mobile export serves a local copy
of the existing Tarkman favicon to avoid the browser's implicit favicon 404.

The mobile lint gate uses ESLint 10, TypeScript and React Hooks flat configs.
Jest/Expo and React Native Testing Library cover actions, fallback text, language,
selection, text scaling, input behavior and modal dismissal. Watchman is disabled
for deterministic one-shot tests. `check:ui` is a bounded source/dependency guard,
not a general security scanner or proof of runtime compatibility.

## Font provenance and license

Bundled **static Regular and Bold Noto Serif Armenian v2.008** come exclusively
from the [official Noto Armenian project release](https://github.com/notofonts/armenian/releases/tag/NotoSerifArmenian-v2.008),
under SIL OFL 1.1. Copyright 2022 The Noto Project Authors.
The gallery’s “Font license & attribution” sheet embeds the full license in the
app/export via `license.json`; the font guard verifies it matches OFL exactly.
Keep [OFL.txt](assets/fonts/OFL.txt), [AUTHORS.txt](assets/fonts/AUTHORS.txt) and
[source paths, license review and hashes](assets/fonts/SOURCE.md) with the fonts.
The full static `googlefonts/ttf` files in that official archive include combining
marks omitted by its smaller Armenian-only builds. No variable fonts or remote
font requests are used. `check:fonts` checks hashes, static tables and glyph maps.

The real Grabar sample is the public-domain Lord's Prayer excerpt beginning
“Հայր մեր, որ յերկինս ես”. A separately labeled stress sample includes Armenian
`։`, `՛`, `՜`, `՞` and decomposed U+0301/U+0304. It is a shaping test, not an
editorial claim about liturgical accent placement.

## Visual QA checklist

- Phone (390px), tablet (820px), desktop preview (1440px): inspect each section,
  long text, all four languages, null/empty fallbacks and theme samples. No
  horizontal overflow, clipped ascenders/marks or unreadable text contrast.
- Confirm both bundled fonts loaded; inspect Grabar punctuation and decomposed
  accents. Select/copy a multiline paragraph without losing line breaks.
- Change OS appearance; check background, surface, muted text, fields and sheets.
- At large and maximum accessibility text sizes, read and scroll all content;
  ensure labels grow and every control remains at least 44×44pt.
- Use keyboard Tab/Enter on web; verify focus, disabled/loading buttons, input
  values, Done behavior and email keyboard on native. Try input near screen bottom.
- Open the sheet, type a multiline note, dismiss the keyboard, scroll the reading,
  and close by button/backdrop/back/Escape. Reopen and check focus containment and
  return to the opener. Check portrait, landscape and home-indicator/notch insets.
- VoiceOver/TalkBack: headings, language pronunciation, labels, errors, disabled/
  busy states, modal isolation and accessibility escape. Native assistive-tech
  behavior needs device verification; browser checks alone cannot establish it.

## Configuration boundaries

`app.json` retains the existing owner, EAS project link, identifiers and scheme.
This gallery adds only automatic appearance and the Expo font plugin. No EAS
commands, credentials, build profiles or deployment settings change. Run any
future EAS operations only from `apps/mobile` under separate release authorization.

The gallery needs no environment file. `.env.example` reserves public values for
future networking work; do not put secrets in `EXPO_PUBLIC_*`. Authentication,
networking, web-screen migration and native publication remain separate tasks.

See [review validation and screenshots](qa/expo73/VALIDATION.md) for the latest browser evidence and remaining native QA.
