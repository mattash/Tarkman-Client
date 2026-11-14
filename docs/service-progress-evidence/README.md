# Actual-source Before / After

## Matched scenario and revisions

Both sides use synthetic public **service 42**, active at **occurrence 1 of 3, Reader**,
English, light appearance/default text size, iPhone 18 Pro / iOS 27.0,
**1206×2622 pixels / 402×874 points @3x**, default wallpaper and the actual Nov 14
system clock (no time override). Capture times differ naturally; original bytes
and UTC times are preserved in the provenance records.

- **Before:** original application at
  `d459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d`, compiled unsigned and actually loaded.
  The only tracked source difference is its isolated bundle ID
  `app.tarkman.progressbaseline`. Its original reader UI/Metro source are unchanged.
  The existing external synthetic fixture uses service 42 and Reader role for the
  controlled comparison. [Original reader proof](<before-original-reader.png>).
- **After:** standalone native renderer at
  `15e4e8e2a842e9ed2c370b0251b5d9b5c112c159`, with identical app/widget/attributes/
  localization/test source hashes in the current branch. It uses its own isolated
  app/extension, not a production reader integration. Explicit per-service disclosure
  plus system permission was granted before the Activity was started.

The primary pair is the **same Notification Center / Lock Screen-style system
surface**, after the selected service's app has been backgrounded. This is not a
physically locked iPhone demonstration and not an assertion that the production
app gained a widget. A new-harness pre-opt-in screen is not substituted for the
original-source baseline.

| Before — original app, no Activity | After — opted-in isolated native Activity |
| --- | --- |
| ![Before: original source, no system Activity](<before-system-no-activity.png>) | ![After: last-reported service progress](<after-background-reported.png>) |

## Freshness observation — do not infer a 60-second redraw guarantee

ActivityKit returned an actual staleDate 60 seconds after the update. After explicit
app termination and a 75-second wait, the visible card **still retained Last reported
part 1/3 Reader**. The background-only cycle and an immediate system-surface reopen
also retained that snapshot. A later still, without app relaunch or forced stale
flags, showed the genuine **Stale — open public parts** branch with ordinal/role
hidden, around 180 seconds after that cycle's request. This is an observation time,
not an exact transition time or a maximum delay.

| 75-second observation — cached last-reported snapshot | Later observation — real native stale rendering |
| --- | --- |
| ![Cached last-reported content after termination](<after-terminated-75s.png>) | ![Eventual stale state with ordinal and role hidden](<after-stale-observed.png>) |

There is no unqualified live/current-part badge. The experiment confirms eventual
native stale rendering, **not** exact 60-second visual expiry, background delivery,
physical force-quit behavior or APNs end-to-end updates. #277 live delivery remains
incomplete.

## Additional real captures and provenance

- [Default-off disclosure; Start disabled](<after-disclosure-off.png>)
- [Explicit disclosure ON and foreground local request](<after-foreground-requested.png>)
- [Original reader, actual Our Father text and Reader current-part state](<before-original-reader.png>)
- [Baseline source/binary/capture metadata and SHA256](<baseline-captures.json>)
- [Native captured source hashes, screenshots and UTC times](<native-captures.json>)
- [Native build, signature, interaction checks and limitations](<../../apps/mobile/prototypes/service-progress-ios/EVIDENCE.md>)

All chosen captures were visually inspected. No mockup, private reading history,
credential or private service data is present. Earlier launcher/loading/permission
prompt captures are excluded. Separate signed development build/signature proof is
retained; ordinary Expo app CI is not presented as a standalone-harness compile.
