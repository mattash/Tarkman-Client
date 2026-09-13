# Installed app icons

Derived from the approved `apps/web/public/android-chrome-512x512.png`
(SHA-256 `cec44269cf66dfbeee3bca44e3238ae0bbed2b7c808f2683e725337d497c3ce8`).
These mobile-owned PNGs are build inputs; native builds do not read web assets.

- `app-icon.png`: 1024×1024 RGB, fully opaque. The source's four rounded
  corners were filled with its actual background color, `#6E3852`, before
  bicubic enlargement. The original white mark and placement are preserved.
  iOS and legacy Android use this square image and supply their own masks.
- `adaptive-foreground.png`: 1024×1024 RGBA. The white glyph was extracted
  from the source by reversing its blend over `#6E3852`, retaining edge alpha,
  cropped to its bounds and centered at 426×432 pixels. Its entire bounding
  rectangle fits inside Android's 66/108-diameter circular safe zone. Expo
  supplies the solid `#6E3852` background separately.

See [Expo icon configuration](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
and [Android's safe zone](https://developer.android.com/codelabs/basic-android-kotlin-compose-training-change-app-icon).

After changing these assets or `app.json`, regenerate local iOS resources from
`apps/mobile` with `npx expo prebuild --platform ios --no-install` before rebuilding
the development client. Metro reloads cannot replace an installed app icon.
The generated `ios/` directory remains gitignored; Expo recreates its
`Tarkman/Images.xcassets/AppIcon.appiconset` from `app-icon.png`.
