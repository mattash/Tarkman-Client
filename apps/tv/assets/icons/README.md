# Apple TV brand assets

These opaque sRGB PNGs use Tarkman's existing white mark on `#6E3852`.
The three icons were prepared from `apps/mobile/assets/icons/app-icon.png`;
the top shelf images center the same icon artwork on a wider background.

`app.json` supplies all seven images to `@react-native-tvos/config-tv`.
The plugin creates `TVAppIcon.brandassets`, including the layered large and
small app icons and both top shelf image sets. Xcode compiles this catalog
and writes `CFBundleIcons.CFBundlePrimaryIcon` and
`TVTopShelfImage.TVTopShelfPrimaryImageWide` into the app's `Info.plist`.
Apple rejects a tvOS upload without those declarations (ITMS-90513).

| Image | Pixels |
| --- | --- |
| App icon | 1280 × 768 |
| Small app icon | 400 × 240 |
| Small app icon, 2x | 800 × 480 |
| Top shelf | 1920 × 720 |
| Top shelf, 2x | 3840 × 1440 |
| Wide top shelf | 2320 × 720 |
| Wide top shelf, 2x | 4640 × 1440 |

`npm run check:identity` validates that all seven configured files exist,
are opaque RGB PNGs, and have the required dimensions. Prebuild must run
again after changing any of these build inputs. Before submitting, inspect
the finished IPA's `Info.plist` and compiled `Assets.car` as well.
