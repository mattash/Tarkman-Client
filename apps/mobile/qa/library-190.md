# Independent UI Operator handoff — issue #190

No rendered screenshots, native bridge test, device cold start, VoiceOver/TalkBack,
production contract test or production starter verification is claimed by the
implementation agent. Record those gates independently on the final source SHA.
Production Library networking stays disabled. Do not manipulate a worship session.

## Reproducible synthetic run

From `apps/mobile`, with Node >=22.13 and installed lockfile dependencies:

```sh
node scripts/library-fixture-server.mjs --scenario=normal
```

In another terminal, also from `apps/mobile` (no `.env` file):

```sh
EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1 EXPO_PUBLIC_LIBRARY_API_URL=http://127.0.0.1:4190 npm run web
```

For iOS simulator, replace `npm run web` with `npm run ios` using an existing
compatible development client. For Android, use the runnable development build
from #191, `adb reverse tcp:4190 tcp:4190`, and `npm run android` with the same
variables. Devices must reach an explicitly approved test endpoint; the fixture
server intentionally binds only loopback. Do not infer localhost on a physical
phone points to the Mac. For a physical device, an approved HTTPS tunnel/test host
is needed; provisioning that host is outside this handoff.

Open Services → Library while signed out. Live may show its normal configuration
error because the synthetic server deliberately exposes no live/session endpoints.
The Library must still work. A Metro-dependent development client cannot prove offline
cold start. For a **local iOS simulator embedded QA build**, use the authorized local
build runtime (this generates native build files only in that QA checkout):

```sh
EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1 EXPO_PUBLIC_LIBRARY_FIXTURE_BUILD=1 EXPO_PUBLIC_LIBRARY_API_URL=http://127.0.0.1:4190 npx expo run:ios --configuration Release
```

For the Android #191 runnable QA build, supply the same three variables when bundling
its embedded JS, and reverse port 4190 before downloading. The extra fixture flag
works only for a loopback URL; release builds cannot contact a remote Library API.
No production release/deployment is authorized. Keep generated native files outside
this implementation change. Test the default release export separately: `CI=1 npm run
export:web` with no fixture flags; its Library capability must be unavailable.
Do not interpret an unavailable capability as a successfully empty catalog.

Stop/restart the fixture server at the same port with `--scenario=SCENARIO` to
change responses while retaining native downloads. Scenarios:

| Scenario | Expected exercise |
| --- | --- |
| normal | Two synthetic liturgies; recommended consent; 304 unchanged checks |
| unconfigured | No starter candidates; browsing still works |
| empty | Empty catalog, existing downloads remain |
| partial | One catalog row per page; title filter admits more results may remain |
| error | HTTP 503; cached copies remain usable |
| updated | Revised explanation; explicit Update, pinned open reader, reopen notice |
| unavailable | Typed per-item 404 on update; remove only that copy and clear open reader |
| invalid | Invalid schema on bundle; retain old copy |
| slow | 25-second response; client 20-second timeout; background/cancel/remove races |
| long | Long Armenian line (derived synthetic fixture) |
| large | Approximately 7 MiB synthetic bundle; explicit data-size warning |

Base JSON files are copied unchanged from backend-owned fixtures. ID 702, long
and large scenarios are explicitly derived synthetic QA data, not backend golden
files or production records. The server performs no production calls. No account,
auth token, session creation/control, reader websocket or presence is required.
Network log assertions should show only the two dedicated public paths for Library
work; existing tab-wide live listing behavior is a separate pre-existing provider.

## Required scenario evidence

1. Signed out, switch Live/Library; verify the same Services tab identity, live
   church/status labels, scan/refresh and session route. Fail each branch separately.
2. Opening Library or Choose downloads must issue metadata requests only. Deselect
   one of the two candidates and Download selected. Verify only one bundle transfer.
   Skip survives relaunch; quiet entry remains. No app-launch modal or first-launch
   content download. Delete a recommended item; Sync must not restore it.
3. On iOS and Android, explicitly download both; airplane mode, force quit and
   relaunch. Read both immediately. Switch all existing reader languages and size;
   select occurrences 901 and 902 (same Part ID, different explanations). Occurrence
   903 explains session context, null translations remain honest, page is unknown.
   Native durability is **not** proven by a browser screenshot or Node SQLite tests.
4. An unsaved web/native online read must not create a Downloaded item. Web must
   offer online reading and truthful unsupported-download copy, with no native
   library SQLite import or offline promise.
5. Keep a reader open and update from another screen/test action. Old text stays
   pinned with a reopen notice. Reopen to read the revised explanation. Verify an
   unchanged conditional check preserves the saved date. Generic error/invalid/slow
   responses preserve the old copy and expose retry; never display false success.
6. Start slow transfers; double tap, cancel, background, Remove and Settings →
   Remove all. Late callbacks must not restore copies. Reopen app and verify actual
   disk state. Settings confirmation removes only current-environment Library
   downloads/intent, not saved live-service copy, prompt dismissal or preferences.
7. Exercise authoritative unavailable while its reader is open (sync via a second
   mounted screen or controller-driven test). Text and explanations must clear;
   generic 404/503 and catalog omission must not clear them. Offline revocation
   cannot be promised. Disk-write/deletion failure needs native fault-injection QA.
8. At 390×844, 768×1024 and 1440×900 on web, and named iOS/Android devices, verify
   long Armenian, maximum text scaling, light/dark, portrait/landscape, modal focus
   return, VoiceOver/TalkBack reading order, radio/checkbox state and action targets.
   Review new English/Russian wording with a fluent reader before enablement.

Evidence manifest per scenario: source SHA, build SHA/channel, host and named
simulator/device, OS/version, URL or installed build, viewport/orientation/theme/
font scale, exact steps, screenshot path and observed result. Missing Android #191
package, devices or hardware are **incomplete**, never inferred passes. Keep #190
open until real-backend and required device acceptance is demonstrated.

## Implementation environment limitations

The implementation sandbox blocks localhost listeners (`listen EPERM`), registry
DNS, and writes to the worktree's shared Git metadata. The fixture server therefore
cannot be served here; independent UI Operator must run it in the authorized QA
runtime. Existing `display-qr-fixture.test.ts` also needs a local HTTP/WebSocket
listener. See `library-190-verification.md` for actual command results.
