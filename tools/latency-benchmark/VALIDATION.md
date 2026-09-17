# Validation — 2026-09-17

The final production integration run passed after backend PRs #429, #430, and #431 were merged and deployed to both Render services at `c517194`. Run `01b11908-b67b-4580-99ea-eb091c783946` completed twenty measured commands plus four warmups, restored session 4008, and captured 655 records: 559 requests, 72 cable transmissions, and 24 jobs. No requests/jobs were missing, no records were malformed, and no individual spans were dropped. All 35,952 partial-render events were retained as aggregate counts/timings. Ordinary worker completion logs independently matched all 24 jobs.

The final backend suite passed **957 tests** and all GitHub test/system/lint jobs passed. A confirmed duplicate-profile test fixture blocked the intermediate master run; its regression failed with two profiles before the fix, then passed with one afterward. The fix is test-only. The corrected recorder has nine focused examples; collector/report tests and browser validation pass. The Expo application build is unchanged from the baseline.

Final artifacts are under `results/production-complete/` in this worktree and copied to `/Users/mattash/Projects/Tarkman/output/latency-benchmark/2026-09-17/production-complete/`. The client runner commits remain local on `codex/session-latency-benchmark`. The original client checkout is untouched.

## Initial implementation checks

Implementation is on `codex/session-latency-benchmark` in both repositories. The client is in an isolated worktree based on main `791409d`; the original client checkout and its untracked work are preserved. Backend base matches the inspected production revision, `4e8df4c`.

| Check | Result |
| --- | --- |
| Mobile TypeScript | Passed |
| Mobile lint | Passed |
| Mobile full Jest suite | 36 suites, 385 tests passed |
| Benchmark Node tests | 5 passed |
| Production Expo web export | Passed |
| Synthetic browser run | 10 measured commands + 2 warmups, controller + 2 readers, all succeeded, position restored |
| Production preflight | Authenticated controller and both anonymous readers subscribed and agreed on state |
| Production browser baseline | 20 measured commands + 4 warmups, all succeeded, position restored |
| Report browser verification | 20 command selectors, last-command selection verified, no page errors |
| New Rails diagnostic specs | 8 passed, including single/multi-liturgy requests and job serialization |
| Full Rails parallel suite | 955 examples passed with 2 workers |
| Full Ruby lint | 235 files, no offenses |
| Brakeman | No security warnings |
| Bundler audit with refreshed advisory DB | No vulnerabilities |
| Runner npm audit | No vulnerabilities |
| Swagger YAML parsing and contract description | Passed |
| Both repositories' whitespace checks | Passed |

The first Rails suite run with ten workers hit an existing wall-clock-sensitive analytics example: 3600.131 seconds versus a 3600 ± 0.1 second expectation. The example passed independently and the complete suite then passed with two workers. Its source was not changed. Mobile Jest emitted existing gesture-worklet and worker-exit/open-handle warnings while returning success.

The initial production run used `--client-only` before backend deployment. Existing Rails completion logs were correlated by request ID, and Render CPU/memory/database-connection metrics were saved. The first instrumented pilot subsequently exposed partial-render detail overflow; it is retained separately with its warning. The corrected, complete integration run is described above.

Artifacts from this workspace are in `results/production-baseline/`, which is ignored by Git. Open `findings.md` for the measured breakdown and `report.html` for interactive command waterfalls. The exact diagnostic source patch is retained as `client-source.patch`; profile credentials and build outputs are excluded. `run.json` includes the base commit, dirty status, and served entry HTML fingerprint, which references content-hashed bundles.

Production web and worker now run the backend change with `LATENCY_BENCHMARK_SESSION_IDS=4008`. No migration, navigation optimization, timing-policy change, or analytics cleanup is part of this change. Native device behavior, cellular networks, and simultaneous rapid control commands are outside this baseline.
