# tvOS design: Liquid Glass (#233)

The Apple TV app uses a Liquid Glass look, drawn in a Claude Design canvas (private to the
maintainer) and implemented in `apps/tv`. This page records the direction and the rules that keep it
readable on a TV. Tokens live in `src/theme.ts`; do not hard-code colors in screens.

## Direction

- **Glass over soft light.** Every screen except the running display sits over a plum and violet
  backdrop (`Backdrop`, three radial gradients from `backdropGlows`), so glass has something to
  refract. React Native has no blur filter on tvOS, so the light is gradients, not blurred shapes.
- **Real glass where the system has it.** `Glass` uses the system material through
  `expo-glass-effect` on tvOS 26 and later. Older tvOS, and Jest, get a translucent fill with a fine
  edge (`glassSurface`). `expo-glass-effect` is a native module, so a change to it needs a fresh
  prebuild.
- **Focus is a lift.** At rest a control is glass. Focused, it scales to 1.05, turns bright white
  (`focusSurface`) and gains a soft pink ring, so focus reads from across the room. Text on the
  focused surface is dark. A destructive action is pink at rest and dark red when focused.
- **Large, rounded shapes** (`glassRadius`) and TV-sized type (`type`). 1080p and 4K share one
  1920×1080-point layout.
- **The mark** sits beside a screen's title (`ScreenHeader`). It is decorative and hidden from screen
  readers, since the title already names the app.

## The running display stays flat

A running saved church display shows only its content: no glass, backdrop, chip, hint, badge or
toolbar. Back (Menu) opens a management screen (glass) and Back from it returns. Its own notices
(waiting for a part, connection lost) stay plain text. Do not add chrome to `DisplayScreen`.

## Rules that keep glass legible

- **Live chip** (`LiveChip`): only for an active service and only while the list is fresh
  (`online` and no failed refresh). Cached rows after a failed refresh never claim to be live. On the
  white focus surface the chip turns dark green (`liveChip`), because light green on white fails
  contrast.
- **Status icons** (`StatusIcon`, opt-in through `Notice icon`): decorative, hidden from screen
  readers; the message text carries the meaning. Waiting is a clock, unavailable or failed is a
  warning, a damaged saved record is a warning, a newer record is an up arrow, and an unreadable
  Keychain is a lock. Only saved-display frames and the recovery screen use them.
- **Glass clips.** `Glass` hides overflow, so a focused control's scale, ring and shadow would be cut
  at a panel edge. Panels use `Glass` as an absolute-fill background beside their content and keep
  generous inner padding.
- **Display options keep a dim overlay** under the glass panel, so light projection text behind it
  cannot wash out the panel. Its focus trap and every test ID are unchanged.
- **Focus order and Back are unchanged** by the redesign: the same controls, the same preferred
  focus, the same Menu behavior.

## Screens

| Screen | Notes |
| --- | --- |
| Live services | Header with the mark and brand line, glass cards with a Live chip, glass Set up and Settings buttons |
| Choose your church | Header, glass search pill, glass rows (no Live chip: the directory does not report live services) |
| Choose a display | Header, glass rows |
| Back menu on a running display | Centered glass panel: change display, live services, settings, reset (confirmed) |
| Waiting, unavailable, failed | Centered icon, message and glass actions |
| Saved record problem | Centered icon per reason, explanation, actions (retry only when the Keychain could not be read) |
| Settings | Header and a glass panel holding the church display, display options and interface language |
| Display options | A floating glass panel over a dim overlay |
| Running display | Flat, content only |

## Verification

Simulator captures (Live services, church list, running display, Back menu) and the App Store set are
in `qa/215/`. The simulator tool cannot press Select or Menu, so the other screens were checked on the
Guest room Apple TV (tvOS 26.6) by the maintainer. See the Evidence table in `README.md`.
