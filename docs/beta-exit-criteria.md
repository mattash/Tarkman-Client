# Beta exit criteria

This is the release-readiness checklist for the first TestFlight beta. It is not authorization to create a build, upload to TestFlight, or invite testers.

**Related roadmap:** [Expo 10 release checks (#78)](https://github.com/mattash/Tarkman-Client/issues/78), [Expo 11 TestFlight beta (#79)](https://github.com/mattash/Tarkman-Client/issues/79). **Tracking issue:** [#120](https://github.com/mattash/Tarkman-Client/issues/120).

## Exit gate

The owner reviews recorded evidence for the exact candidate commit before it reaches beta testers. On a physical iPhone, an authorised tester must be able to:

1. Join a live service and follow part changes through a real or representative service.
2. Change language, open explanations and part details, and keep reading without losing the live context.
3. Background the app and recover from interrupted connectivity; the reader returns to the correct current part or clearly labels unavailable/stale state.
4. Use service controls when signed in: each command is sent once, denied while offline or stale, and reported clearly when refused. The same controls remain unavailable when signed out.

The candidate commit must also pass its required CI checks. Record the device/OS, scenario results, commit, open defects and tester/date with the release evidence; simulator, browser, or mocked-test results alone do not satisfy the physical-device gate.

## Severity and disposition

| Severity | Beta disposition | Example |
| --- | --- | --- |
| **Blocker** | Do not distribute until resolved and retested. | The reader shows stale text as live, crashes in a required flow, sends a duplicate/wrong service-control command, exposes controls to an unauthorised reader, or mishandles credentials. |
| **Service degradation** | Resolve before beta when it affects a required flow; otherwise document the impact, workaround, and owner decision. | Reconnection needs a manual retry but clearly preserves the current reading, or explanations fail while the live reading continues. |
| **Non-blocking polish** | Track for follow-up; it may ship only when readability, accessibility, and required flows remain intact. | A spacing or colour refinement that does not obscure text, reduce a touch target, or change a control's behaviour. |

## Known beta boundaries

These are acceptable only when their current behaviour is explicit and tested:

- Android distribution is outside this iOS/TestFlight beta.
- Offline downloads are deferred; an unloaded service must say that a connection is required rather than present stale content as current.
- Visual or translation-quality follow-ups may remain open only when they do not impair readable liturgical text, accessibility, or a required flow.

The following are not acceptable for beta: relying solely on simulator/browser evidence; a failed required scenario; ambiguous current-part state after recovery; an unsafe or duplicate service-control action; a crash in a required flow; or private credentials/data embedded in or exposed by the client.
