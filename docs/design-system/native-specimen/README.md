# Tarkman native design lab

Provisional, isolated Expo experiment for reading typography, language selection, explanation sheets, appearance, accessibility scaling and keyboard layout. Nothing here is imported by `apps/web` or `apps/mobile`. No service endpoints, credentials, telemetry configuration, EAS project or persistent preferences are included.

The specimen is evidence for design decisions, not a definitive component library or screenshot baseline. Change it when real application use reveals a better approach. See [working specification](../implementation-spec.md) and [validation record](../native-validation.md).

## Run

From this directory:

```sh
npm ci
npm start -- --port 8094
```

Open `exp://127.0.0.1:8094` in Expo Go SDK 57 on an iOS simulator. For an Android emulator, forward `adb -s <serial> reverse tcp:8094 tcp:8094` before opening the same URL. Metro uses IPv4-first DNS because this machine otherwise bound `localhost` to IPv6 while Expo opened an IPv4 URL. Use Metro's reload command after specimen changes if the native client shows stale layout.

This run uses **Expo Go**, so the installed host remains Expo Go. The separate `app.tarkman.designlab` identifiers apply only to any future standalone lab build. No production Tarkman app was installed or overwritten. No EAS commands are needed or authorized by this specimen.

## Review

- Start with three-language reading. Move to passage 2, open Explanation, then return and verify position/manual-reading state.
- Open Languages, clear every choice, apply, and check feedback. Cancel preserves the prior choices. Apply one or more languages and verify reading context remains intact.
- Preferences offers System/Light/Dark and three reading sizes. The note field exists only to exercise the keyboard; it is not a proposed product feature.
- Review tools exposes font-load status, OS font scale, safe-area insets and a decomposed Armenian mark fixture. The mark string is a rendering test, not normalized liturgical copy.
- Check sheets at normal and maximum OS text sizes, then with the software keyboard, dismiss by Close/Back and supported gestures, and inspect accessibility focus with VoiceOver/TalkBack. Source inspection alone is not sign-off for those interactions.

The lab currently remounts iOS native Text leaves when OS font scale changes to work around stale measurements observed in this Expo Go runtime. Inputs and parent state remain mounted. This is provisional: verify text selection and screen-reader focus before adopting it in any component. See the validation record for the limited up/down transition check.

## Assets and reproducibility

`tokens.json` is a snapshot of `../foundations.tokens.json`. `samples.ts` copies the existing mobile prayer fixture with a local language type. These are explicit experiment inputs, not generated production outputs.

Source Serif regular/semibold are unmodified static TTFs from [Adobe's 4.005 desktop release](https://github.com/adobe-fonts/source-serif/releases/tag/4.005R). The ZIP is `source-serif-4.005_Desktop.zip`, files under `TTF/`; `assets/SourceSerif-LICENSE.md` retains its OFL. Noto Serif Armenian regular/bold and its license/provenance were copied unchanged from the mobile assets. `assets/sha256.json` pins all four font files. Native static Source Serif is not asserted to be optically identical to earlier Google Fonts variable web specimens.

Ionicons 13.1.4 is the provisional native library used by the lab. It renders through the package's font loader in Expo Go; its action labels remain explicit and independent of glyph names. Do not add this dependency to either production app merely because the lab uses it.

## Checks

```sh
npm run typecheck
npx expo install --check
npm run export:ios
npm run export:android
```

The two export commands each replace the ignored `dist/` directory. They verify native JavaScript/asset bundling, not a compiled standalone binary. Font-coverage results and typecheck/export logs live under `docs/design-system/evidence/native` and `docs/design-system/evidence/native-followup` at repository root. Simulator screenshots are not committed; rerun the specimen to reproduce them. There are intentionally no golden-image tests.
