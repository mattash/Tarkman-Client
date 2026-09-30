# tvOS brand assets

The seven images `@react-native-tvos/config-tv` turns into the
`TVAppIcon.brandassets` catalog. Expo regenerates that catalog from these files
on every prebuild; the generated `ios/` directory stays gitignored.

**All seven are required.** `withTVAppleIconImages` calls `existsSync` on every
path and throws `One or more image paths not defined` / `No image found at path …`
if any is absent, so a partial set breaks prebuild rather than degrading. They are
wired in `../../app.json` under the plugin's `appleTVImages` option.

| File | Size | Role | SHA-256 (first 16) |
| --- | --- | --- | --- |
| `tvos-icon-1280x768.png` | 1280×768 | `icon` — App Icon, Large | `54aa50f973e928eb` |
| `tvos-icon-small-400x240.png` | 400×240 | `iconSmall` — App Icon, Small 1x | `80e8ad12373b0d78` |
| `tvos-icon-small-800x480.png` | 800×480 | `iconSmall2x` — App Icon, Small 2x | `df9e2f0c684da7b1` |
| `topshelf-1920x720.png` | 1920×720 | `topShelf` 1x | `3bf836f6b7bdec0a` |
| `topshelf-3840x1440.png` | 3840×1440 | `topShelf2x` | `c0cc40335d0f732f` |
| `topshelf-wide-2320x720.png` | 2320×720 | `topShelfWide` 1x | `75b90a9b7ff8b39c` |
| `topshelf-wide-4640x1440.png` | 4640×1440 | `topShelfWide2x` | `6d0d0227042d5f11` |

All are 8-bit sRGB PNG with **no alpha channel**. An alpha channel fails
asset-catalog validation, so preserve that if these are ever regenerated.

## App icons

Created 2026-09-28 alongside the App Store work in #219. Background is the
approved brand maroon `#6E3852`, matching
[`apps/mobile/assets/icons`](../../../mobile/assets/icons/README.md), whose README
records the shared lineage back to the approved
`android-chrome-512x512.png`. tvOS app icons are layered 16:10 image stacks, not
the square iOS icon.

## Top shelf images

Added 2026-09-30 for the first tvOS App Store submission. The top shelf is the
full-width art tvOS shows on the home screen when the app is in the top row.

Composition: an Armenian Apostolic sanctuary blurred behind, a television in the
focal plane showing the app's **Live services** screen, and hands holding an
iPhone showing the mobile **control screen** — the phone drives what the room's
TV displays.

Produced by an image-generation agent from the brief in
`deliverables/tv-topshelf-prompt/PROMPT.md`, which is kept outside the repository
with its reference assets. Method, and the reason for it: the scene is generated,
but **both screens are composited from real screenshots** by perspective warp,
never drawn by the model. A generative model renders the Armenian liturgical text
and the wordmark as plausible nonsense, which for this app misrepresents both the
product and the language.

Screen sources, both tracked in this repository:

- TV — `apps/tv/qa/215/appstore/1-live-services.png`
- Phone — `apps/mobile/qa/issue200/phone-control-before.png`

The sanctuary background is a service livestream frame supplied by the
maintainer. It is deliberately degraded, not enhanced: heavy Gaussian blur, with
a stronger pass over face regions so no individual is recognizable, and the
frame's burned-in stream timer and projected text panel cropped out. No religious
detail was generated, relocated or added — every devotional element present comes
from that photograph.

Verified on the delivered files: exact dimensions, 8-bit sRGB, no alpha, zero
residual `#FF00FF` chroma-key pixels, each 1x a Lanczos downscale of its 2x
sibling, and `expo prebuild` generating a complete `TVAppIcon.brandassets`.

Known limitation, per the generator's notes: the foreground TV and hands were
generated at 2048×768 and Lanczos-enlarged to the 2x canvases rather than
rendered natively at 2x. The composited screens were warped in at full 2x, so the
UI is sharp; the surrounding hardware and hands are softer than a native 2x render
would be. Replace with native-resolution foregrounds if the artwork is ever
revisited.
