# App Store submission handoff

This records the release configuration that is checked into the app and the
remaining owner decisions for Tarkman’s first TestFlight and App Store release.
It does not authorize a build, upload, or tester invitation.

## Checked into the app

- `ios.config.usesNonExemptEncryption` is `false`. The app uses platform
  transport and Keychain services only; it does not implement non-exempt
  encryption. This writes `ITSAppUsesNonExemptEncryption = NO` into the native
  `Info.plist`, avoiding the repeated export-compliance question.
- The managed iOS privacy manifest declares the required-reason API categories
  from the current statically linked Expo and React Native SDK manifests:
  disk space, file timestamps, system boot time, and user defaults. The
  configuration guard and the native-prebuild smoke check both verify it.
- iPad remains enabled. The release candidate therefore needs an approved iPad
  screenshot set as well as an iPhone set.

## App Store Connect privacy review

Do not infer the App Store privacy label solely from this client. The owner must
confirm the server’s collection, retention, and disclosure practices and the
enabled Sentry project settings for the exact release.

The client evidence to use in that review is:

- A clergy or parish-staff sign-in sends an email address and password to the
  Tarkman API; the client stores only its returned token in the device Keychain.
- Location is requested only after an explicit reader action, used to match the
  already-listed churches locally, then discarded. It is never sent or stored.
- QR scanning occurs on-device. The app does not upload camera frames.
- Sentry starts only when a public DSN is configured. It removes user and
  request data, disables default PII, screenshots, view hierarchy, failed
  request capture, and console breadcrumbs. Error reporting and production
  tracing still require the owner to review Sentry’s release settings and data
  retention before declaring App Store collection labels.

Record the owner’s resulting answers in App Store Connect, including the
privacy-policy URL and the source/date used for each answer. A privacy manifest
describes required-reason APIs; it does not replace the App Store privacy label.

## Versioning

Decided by the owner on 2026-09-16:

- `eas.json` uses `appVersionSource: remote`, so EAS stores the iOS build
  number. The first remote build starts at `1`.
- The `production` profile sets `autoIncrement: true`, so every store build gets
  a new build number. Preview (ad hoc) builds reuse the current remote number.
- `expo.version` is the version customers see. It stays `0.1.0` through the
  TestFlight beta and changes to `1.0.0` for the public App Store release.
- The `submit.production.ios` profile names the Apple Team ID and App Store
  Connect app ID, which are not secret. The App Store Connect API key is stored
  on EAS through `eas credentials`, never in the repository.

## Privacy policy URL

The App Store privacy policy URL is `https://tarkman.app/privacy`, served by the
Rails app (mattash/Tarkman#428). It does not exist yet and must be published and
reviewed before the privacy answers are entered. `web.tarkman.app/privacy` is not
a privacy page: the Expo web app shows its not-found screen there.

## Screenshot release task

Capture the current App Store Connect-required iPhone and iPad device classes
from the exact candidate build. Include the public reading journey and, when an
authorized account is available, service controls. Check the sizes Apple shows
at submission time rather than relying on a static screenshot-size list.

## Local verification

Run from `apps/mobile`:

```sh
npm run check:store-config
npm run config
npx expo prebuild --platform ios --clean --no-install
```

Then inspect `ios/Tarkman/Info.plist` and
`ios/Tarkman/PrivacyInfo.xcprivacy`. The generated `ios/` directory is ignored
and must not be committed.
