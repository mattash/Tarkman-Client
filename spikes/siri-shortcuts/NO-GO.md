# Final timeboxed feasibility disposition: NO-GO

**Do not roll out the Siri/Shortcuts integration on the current evidence.**
This is a finished **negative feasibility recommendation**, not a shipped feature,
proof that Siri is impossible, or a claim that all #275 acceptance checks passed.
The isolated reproduction sources are retained for review; production integration
is not included. Phone work remains stopped by owner instruction.

## Why the timebox ends here

The reported physical spoken-ID attempt reached Siri's **Liturgy ID** prompt,
then failed after the reported answer “1.” Its resolved value and native/JS
execution stages were not captured, so there is no established code-level cause.
See the [reported failure and source limits](<evidence/voice-attempt-1.json>).

Later genuine device observations show a cold native AppIntent execution with
resolved canonical String`1`, accepted validation, one UUID correlated through
native dispatch and JS receipt/route/ack, an empty persisted pending queue and
an actual Divine Liturgy reader. They establish useful component behavior, **not
who invoked it or its exact entry method**. A queued typed-Shortcuts request was
followed by an unattributed Executor user-role completion report; sender,
originating channel, exact receipt time and explicit entry were not retained.
Earlier owner-created/owner-confirmed typed-entry claims are withdrawn. The
secondary automated acknowledgment is not human testimony.
[Qualified provenance](<evidence/typed-1-comparison.json>) ·
[unchanged native/JS events](<evidence/typed-1-phase-events.json>).

This combination is insufficient for a positive recommendation. Further
exploration is not silently extended to obtain a pass, and no phone rerun or
operator prompt is requested to repair provenance.

## Findings established by this spike

| Area | Established finding | Limit |
| --- | --- | --- |
| Native API | Expo58.0.25's obtainable alpha `expo-app-intents0.5.17` supports app-target Swift AppIntent/AppShortcuts plus a persisted native-to-JS invocation bridge. | Alpha API, not production stability certification. |
| Build | The separate baseline/prototype/diagnostic Release builds and strict signature checks pass; actual action metadata and English phrase training extract successfully. | Not Expo Go or an OTA-only addition: concrete Swift must compile into the app target. |
| Native graph | Normal manifest/lock/root layout match pinned main; fresh normal autolinking resolves33 modules with neither the bridge nor @expo/ui. Only the external prototype installs the alpha dependency and @expo/ui58.0.28. | A config flag alone did not isolate autolinking; production adoption would be a deliberate native-graph change. |
| OS | Signed app minimum remains16.4; physical observations were on iPhone15Pro/iOS27.2 with Xcode27.2/Swift6.4.2. | No runtime certification on16.4. The separate Apple OpenURLIntent compiler probe required18 availability gates and is not the chosen bridge implementation. |
| Signing/extension | Development-signed `app.tarkman.sirispike`0.2.7(1), distinct scheme, no production EAS/update/universal-link claims or App Groups. | This app-target foreground prototype needed no separate intent extension or shared container; do not generalize to other execution designs. |
| Foreground | `openAppWhenRun=true`; native persists until normal JS navigation/Library readiness, then existing reader routing. Later observed startup became active after queue/route/ack. | No always-on/headless JS capability is provided or promised; dispatch/route/ack is not content-success acknowledgment. Cross-process exactly-once delivery is not promised. |
| Reader boundary | Canonical positive safe ID text is revalidated; no arbitrary URL/environment/service-control payload and no second reader/cache. Actual reader rendering observed. | Availability, network, deletion/revocation and saved intent remain existing-reader responsibilities; unrun physical safety cases are not inferred. |
| Indexing | **Not needed** for an explicitly configured fixed target. No AppEntity catalog, donations, Spotlight index or private reading-history exposure was implemented. | Entity-removal verification is conditional on introducing indexing; any future index requires opt-in/minimal public metadata plus deletion/revocation tests. Reader revocation behavior still needs its own verification. |

## Deliverable and acceptance disposition

Completed: isolated buildable prototype/reproduction workflow; native API/build,
signing/OS/foreground/indexing findings; genuine labelled Before/After reader
captures; reported negative voice demonstration with limitations; separately
qualified native/process/reader evidence; this final NO-GO and bounded follow-up.
[Full evidence record](<../../apps/mobile/docs/siri-shortcuts-feasibility.md>).

**Not established:** a verified successful Shortcut/Siri entry with attributed
operator, successful cold **and warm** entry demonstrations, repeated invocation,
invalid/stale targets, actual offline saved/unsaved behavior, user-deleted
snapshots and authoritative known-unavailable/revoked snapshots on device.
These were requested spike verification expectations, **not merely optional
production polish**. They remain explicitly incomplete. Native/classifier/unit
checks and rendering captures do not satisfy them.

The issue permits a failed feasibility result. This report completes that
negative disposition; it does **not** claim full positive #275 acceptance or
pre-approve issue closure/merge. Any requirement for the full physical matrix
remains unfulfilled, rather than being relabelled as passed. It is not necessary
to perform those tests to justify withholding a positive recommendation now.
The [bounded matrix](<verification-matrix.md>) records exact statuses/gates.

## Narrow production follow-up — not implemented here

If the owner later authorizes reopening this work:

1. Resolve the voice failure with a **prepared, attributable** invocation and
   classified native/JS evidence, not an unchanged retry or an assumed “one”/“1”
   conversion. Assess a fixed-ID configured shortcut versus a suitable parameter
   representation only on evidence; keep the canonical/current-environment reader
   boundary. Do not add a second reader, service commands or indexing as a workaround.
2. Complete the still-mandatory positive-entry and safety rows in the bounded
   matrix using an actually validated targeted UI controller and controlled
   fixture data. Fixture503/timeout/server-stop is transport failure, not actual
   device offline. Generic404/catalog omission is not authoritative revocation;
   saved revocation requires explicit sync against a controlled unavailable
   response. No production mutations or device-setting changes are authorized.
3. Only after a positive result, propose a separate production integration with
   explicit native dependency/signing/oldest-OS/normal web validation. Remove
   diagnostic-only instrumentation; decide parameter UX/localization and optional
   indexing/privacy scope deliberately. Those integration/polish choices are
   production follow-up, not work shipped by this report.

## Validation and safety

- Normal baseline98 suites/1,305 tests, typecheck/lint/web export and public-link
  contracts pass. Normal production app/native graph is not changed.
- External diagnostic101 suites/1,335 tests,30 focused cases,15 cases compiled
  from actual Swift classifier/validator, preparation tests, typecheck/lint and
  signed native builds/signature checks pass. Earlier external prototype iOS JS
  export/prebuild/pods passed; diagnostic native builds rebundled their current
  JS rather than relying on that earlier export.
- Independent review/check status for the exact posted report head is recorded
  in the PR; scoped-clean review does not authenticate private operator evidence
  or certify unrun device outcomes.
- Production app/data/credentials/settings were not changed by this ticket.
  No phone accessibility toggle was performed by this ticket. All further
  device interaction stays held; restoration status is not resumption authority.
  No new owner action, accessibility re-enable, store submission or merge is
  requested or performed. A person decides scoped merge and issue disposition.
