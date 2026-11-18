# Actual native v1 Before / After — #282 continuation

These are real application/system captures, not mockups. They compare the previous
isolated native experiment with the versioned native implementation. They are **not
physical-device, backend, APNs or live-delivery acceptance**.

## Matched scenario and revisions

Both: owned **ServiceProgress3429** simulator
`BA0449F1-92EC-4D80-A869-4E183F56BEC4`, iPhone 18 Pro / iOS 27.0,
1206×2622 portrait, English, light/default text, same default wallpaper. Synthetic
public service 42, occurrence 12, **Choir, last reported part 2/3, active**. Real clock
and last-update times naturally differ; no time/theme/system setting was changed.
The visible surface is Notification Center / Lock Screen-style presentation, not
proof of physically locking a phone. Production app/data were untouched.

**Before revision:** `d38d1e072e289fa03ae1fc3d078d7dbca100ec7c` App/Widget/resources,
actually built and run before editing those sources. The added capture test only
taps the genuine disclosure, Start and Advance controls; it does not substitute a
renderer or inject a fake previous UI. Result `MatchedBeforeV1-01.xcresult`,
attachment `84D0AC52-D0D2-497C-8DCD-766757B11079.png`, captured
**2026-11-14T22:01:43.765Z**. It uses the original five-field local Activity type.

**After revision:** `2181553cd654b35fe1614df0ed0515f449d80ca5`, whose committed
App/Widget/view/validator/resources match the captured source. Result
`V1FinalNative-03.xcresult`, attachment
`F4C20BE1-2403-4FAC-B588-50392D3B9030.png`, captured
**2026-11-14T22:19:21.464Z**. It uses `ServicePublicationIdentity` + validated v1
content with immutable generation, real backend role keys and local-only updates.
The capture test waits for actual synthetic card presence and localized Choir,
not merely a successful Activity.request call. No .token request/provider is used.

| Before — five-field native fixture | After — validated v1 native fixture |
| --- | --- |
| ![Before native card](<before-system-choir.png>) | ![After native card](<after-system-choir.png>) |

The matched reported appearance is intentionally preserved; this is contract and
semantic integration, not a restyling. New local controls/preview additionally
exercise unknown and terminal state:
[unknown total](<after-unknown-total.png>) · [deleted/cleared title and tap](<after-deleted-cleared.png>).

## Expiry without app rerun

Same After source, separate synthetic occurrence 11 / Priest / 1 of 3 cycle. ActivityKit
returned source update **22:15:41Z**, staleDate **22:16:41Z** (`pushType=nil`,
`schemaVersion=1`). The app was explicitly terminated using XCTest after background
presentation. This is **not OS eviction or user force-quit**.

- [75-second post-termination observation](<after-terminated-75s.png>), attachment
  `0850DF87-3A68-42FB-BABF-E2B84C8F0EAF.png`, **22:17:11.800Z**: Last reported
  part1/3Priest is still retained, roughly91s after source update /31s after expiry.
- [Later genuine stale rendering](<after-terminated-later-stale.png>), attachment
  `DAB2AF19-FF40-418B-B37C-8A43A2910A34.png`, **22:18:57.530Z**: Stale — open
  public parts; ordinal and role hidden, roughly197s after source update /137s
  after expiry, without app relaunch between observations.

Capture names describe test waits after termination, **not exact source ages or
transition times**. These are observations, not a measured maximum latency or
60-second onscreen deadline. iOS schedules redraws; staleDate does not end an
Activity. The renderer always qualifies retained progress as Last reported part.
No fake stale flag, background timer, source refresh or clock manipulation was used.

## Verification and boundaries

Three focused native UI tests pass: matched system card/localized role; visible
unknown/empty/paused/deleted local preview; background→deliberate termination→75s
and later stale captures. Selected screenshots were separately visually inspected;
passing XCTest interactions alone were not called visual proof. No private phone
content is in these owned-simulator captures. Raw physical xcresult/logs must never
be added here. Full Dynamic Island, Russian runtime, dark/large text/assistive
technology and physical remote delivery remain separate acceptance gates.

Files retain the exported PNG bytes unchanged. File signature/decoder inspection
confirmed PNG encoding; filenames match that encoding. SHA256 source/capture provenance:

```text
Before App:    72dd591167384b80410f32291de21757fc63e4f2be2f84588c61d37d09db8f98
Before Widget: ddf857f058585aeba1f8b7b910c9f7091a5ada2c991793f524bcc1347045a890
Before en:     873fd992421bf382af7a2824778c7c480efc75d4bed590587a24e515c46af511
After App:     aca85fbfedc34dd3d02c4fc77c533a304971989b2523345c9ad257cab7cbc10a
After Widget:  1739c89a135f12f41aa49db98cb7d0b95916649045806f64b27d6bcf68631fab
After en:      1e8ae9ad7530ae3d5f9863098b684b1b543eb2404b19feb40547d018e7fc531e
before-system-choir.png: 7b447d39f58daafb02c3c8ab24def3593aad544278dbe8eb2bdf47e6dfc26567
after-system-choir.png: fd8bf67c4ce02fa88ac6f1c8958f9aa196216e56f5be0a3933a5a3f274463051
after-terminated-75s.png: f874476da25f943abea74b6f9dcff099abd5bd11786459836389c915e006a7da
after-terminated-later-stale.png: 678d2456094f22fa7ff8e2d51254050979b3af345630be5f760e34abdc1b8a79
```

## Selected-service caller — current default-off Before / After

**Before:** `06b5df1418943836517ba77620716fec3770b2ed` app/UI, actually built and
captured before adding the caller section. **After:**
`d84ebe709e9497992c8db424068e200c90b64b40`, matching the final captured production
sources. Both use the same owned simulator, viewport, English/light/default text
and unchanged settings above. State: fresh launch, disclosure OFF, no Activity,
scrolled to the Form's end. The extra section increases content height; this is the
same end-of-Form state rather than a fabricated fixed pixel offset. Real clocks differ.

| Before — no development caller | After — caller visibly off, controls disabled |
| --- | --- |
| ![Before default-off app](<before-caller-default-off.png>) | ![After default-off caller](<after-caller-default-off.png>) |

Before result `RemoteCallerBefore-01.xcresult`, source attachment
`C2892AC5-71E9-4CCB-B8A9-D0AAAB864EC6.png`, **2026-11-14T22:51:07.047Z**.
After result `RemoteCallerDefaultAfter-02.xcresult`, source attachment
`2FB5849A-FF16-4906-A6A5-158A2FCADBAE.png`, **2026-11-14T23:52:53.324Z**.
The final test asserts the actual localized off status and disabled selection,
verification and start controls. Built/signed Info contains Boolean false and no
backend/reader origin; signing has no APNs/App Group entitlement. No enabled
remote path, Keychain operation, endpoint request or real token issuance is
claimed by these captures. Synthetic policy/flow tests cover that preparation separately.

The original matched native card was also refreshed on the current source:
[Current After — local Choir2/3](<after-caller-system-choir.png>), attachment
`E47AF402-3CC1-4221-B1E8-A8C20067A54F.png`, **2026-11-14T23:52:37.765Z**.
Compare it with the genuine [five-field Before](<before-system-choir.png>) above:
same service42/occurrence12/active/Choir2/3, viewport/theme/wallpaper and qualified
reported wording, now with the actual current caller code present but off.

Three focused UI tests passed on the caller source (default gate, matched native
card and unknown/empty/paused/deleted controls); after the final native terminal
invalidation guard, the two matched captures were refreshed and passed again.
The earlier expiry observations remain historical, explicitly scoped above;
unchanged 75/180-second suites were not repeated. All selected images were separately
visually inspected, not inferred from test exit status. No raw private phone results
or phone content is included. Phone work remains explicitly held.

These files preserve the original exported PNG bytes (not the read tool's normalized
JPEG previews), verified by file signatures. SHA256:

```text
before-caller-default-off.png: ac2ad6a9580106056c0420e4fdee0ad6717c6addd224e502a849a4dd9a162336
after-caller-default-off.png: ebed942b996906a49c5039aaa3ce89e66345c3386a71da0d95d124d5b2f6a060
after-caller-system-choir.png: 804821c7181511c10bf36d14b36853195acc9318e1916770eee961c40bda2aa7
```
