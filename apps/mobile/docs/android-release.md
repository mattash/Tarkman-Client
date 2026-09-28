# Android release setup / #192

This stage stops at an accepted **internal-track draft**. Tester distribution,
completed listing/compliance, App Links and public release belong to stage 3 of
roadmap #189 and require their own verification and release approval.

## Identity and verified state

Inventory checked September 28, 2026:

| Item | Value / evidence |
| --- | --- |
| Android package | `app.tarkman`; preserve permanently |
| App / Expo owner | Tarkman / `mesropash` |
| Existing EAS project | `c76aa8c8-fb02-40b5-b4ae-8469b1bbeb47` |
| Version / runtime | `0.1.1` / `appVersion` policy; EAS owns versionCode |
| EAS access | Authenticated operator has Owner access to `mesropash` |
| Selected production build | `38b63fc4-3947-47ba-a8be-4fd1e35d97da`, source `6efb5c4e5b0f56e00134e3134e30f0e78c65670b`, versionCode `2`; build started, acceptance pending |
| Publisher / Console app ID | St. John Armenian Church, organization account `8031576529416400534`; existing draft Tarkman app `4974777608134427797` already identifies `app.tarkman` |
| Console operator | Mesrop Ash, Account owner; existing app reused without creating a duplicate or accepting new terms |
| Play acceptance / internal draft | Not yet verified; configuration is not registration or upload evidence |
| EAS signing credential | Existing default `Build Credentials 1vjAmhGihE`, JKS; inspected, not replaced |
| Submission service account | Existing EAS-managed `tarkman-eas-publisher@fast-and-pray-91ff3.iam.gserviceaccount.com`; active, Tarkman-only read access plus Release apps to testing tracks; no account-wide or production-release grants |
| Recovery | Signing and submission credentials are stored under EAS project → Credentials → Android → `app.tarkman`; owner-held backup/recovery location still needs confirmation |

Existing EAS upload/signing certificate (public fingerprints):

- SHA-1: `18:C6:78:AF:59:67:24:9E:26:05:E8:D4:98:D1:61:FC:76:D0:51:F8`
- SHA-256: `29:AE:13:E7:D8:B0:BF:E4:96:7D:53:47:9E:0D:4F:30:AD:F1:38:DB:FD:03:F7:EA:78:6C:20:21:88:E3:E3:73`

Play App Signing is already in use (Console labels it Quantum-ready beta).
The Console-provided Digital Asset Links JSON lists SHA-256
`1D:24:05:04:F7:93:87:6D:5D:53:8A:7A:C0:EF:38:13:7B:F6:55:7A:8B:27:BD:9F:E4:1D:0A:0E:B6:38:2C:23`.
A previous signing-key entry is dated September 13, 2026. No keys were changed.
Before the first upload, Console says upload-certificate fingerprints will
appear after the first bundle. Stage 3 must verify the applicable certificates
for Play-delivered App Links, including the existing signing-key history.
Never put private keys, passwords or service-account JSON in Git, screenshots,
issues, logs, client assets or `EXPO_PUBLIC_*` values.

## Publisher and signing prerequisites

1. Confirm the intended publisher and operator roles in Play Console. Search all
   applications, including drafts, before creating Tarkman. Account type,
   verification and production eligibility must come from this account.
2. Obtain owner values for name, default language, app/game, free/paid and support
   contact. The owner must approve applicable declarations and Play App Signing
   terms. Stop on package or ownership conflicts; never choose another package.
3. Confirm the existing EAS keystore is the approved upload key and the intended
   Play App Signing approach. Do not reset existing keys. Verify the existing
   submission service account has only the app access and testing-release
   permissions required for this task; do not grant production release access
   merely to upload an internal draft. Any new access grant needs owner approval.
4. If a service-account change is needed, use the approved EAS Credentials flow.
   Do not add a local key-file path to `eas.json`. Confirm secure owner recovery.

The directly installed #191 workflow APK uses a debug certificate. EAS APKs use
the configured keystore; its certificate authenticates AAB uploads as the upload
certificate. Google Play signs delivered APKs with the Play App Signing key,
which may differ. Different certificates prevent an in-place replacement even
when the package matches. Preserve tester data; never silently uninstall.

## Build and upload a selected artifact

Run all EAS commands from `apps/mobile`. `production.android.buildType` is
explicitly `app-bundle`; development/preview remain APKs. Production retains
store distribution, auto-increment, production environment/channel and the
existing runtime policy. `submit.production.ios` is unchanged.

```sh
npm ci
npm run check:store-config
npm test -- --watch=false
eas build --platform android --profile production
eas build:view BUILD_ID
# Only after the owner approves this exact build/SHA/versionCode upload:
eas submit --platform android --profile android-internal --id BUILD_ID
```

Before starting, verify production public API/WebSocket endpoints and Sentry
environment from EAS without printing secrets. Record the build ID, source SHA,
versionCode, AAB hash, embedded endpoints and certificate fingerprint. Inspect
the actual release manifest for `app.tarkman`, non-debuggability, target SDK and
permissions; verify native library/page-size compatibility against current Play
requirements. A successful build alone is not proof of Play validation.

At this check, Google's [target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
require API 36 for new phone apps. Follow the current
[16 KB native-library checks](https://developer.android.com/guide/practices/page-sizes)
on the actual AAB (including `bundletool dump config --bundle=FILE.aab` and ELF
alignment inspection). Do not infer compliance just from the Expo SDK version.

[New personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
apply to personal accounts created after November 13, 2023: at least 12 opted-in
closed testers for 14 continuous days before applying for production access.
This publisher is an organization account, so that personal-account rule does
not apply. Initial app setup still gates production; internal testing alone
does not establish production eligibility.

The submit profile sets `track: internal` and `releaseStatus: draft`. Do not use
`--latest`, `--auto-submit`, a production-track target, automatic invitations or
a push-triggered publishing workflow. Current Expo documentation supports first
submission once Console/app/service-account prerequisites are satisfied. Manual
Console upload is an acceptable fallback; record the method actually used.

After uploading, verify the Console package, exact versionCode and **draft**
status on Internal testing. Do not click rollout or send tester invitations.
Record remaining dashboard tasks, account-specific testing/production-access
requirements and any upload validation failures separately from code readiness.

## Console dashboard handoff

The internal track is inactive with no releases before this upload. App setup
shows 0 of 11 tasks complete: privacy policy, sign-in details, ads, content
rating, target audience, data safety, government apps, financial features,
health, category/contact details, and store listing. Closed/open testing and
production are gated on initial app setup. These are stage 3 tasks; this stage
does not invent or submit declaration answers. No account-level blocker was
shown on the app dashboard; that does not independently prove every account
verification requirement is complete.

Production public endpoints verified in EAS: `https://www.tarkman.app` and
`wss://www.tarkman.app/cable`; Sentry environment `production`. The build uses
the existing remote keystore and a clean checkout, excluding unrelated local
artifacts.

## Handoff evidence still required

- Any account-verification restrictions encountered during upload.
- Owner-held backup/recovery confirmation; retain the existing app setup and signing choices.
- Exact production build ID/SHA/versionCode/hash and release-artifact inspection.
- Accepted internal-track draft and remaining dashboard/account blockers.
- Stage 3 listing/compliance, testing eligibility, App Links and release approval.

`check:store-config` runs in mobile CI without credentials and guards APK/AAB
separation, package identity, draft targeting, iOS destination and runtime policy.
It does not check remote credentials, publisher enrollment or Play acceptance.

References (rechecked September 28, 2026):
[Expo Android submission](https://docs.expo.dev/submit/android/),
[Google app setup](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en).
