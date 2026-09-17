# Session control latency benchmark

This runs the **Expo mobile app's web export**, one authenticated control screen and two independent readers. It presses the real Next/Back buttons on session **4008** and preserves the application's current recovery behavior. Each command is joined to browser, Rails, ActionCable, and job observations by opaque run/command IDs.

See [validation](VALIDATION.md) for completed checks and the production baseline's remaining integration boundary.

## Install and build

From the repository root (Node version required by `apps/mobile/package.json`, Chrome, and the authenticated Render CLI):

```sh
npm ci --prefix apps/mobile
npm ci --prefix tools/latency-benchmark
EXPO_PUBLIC_LATENCY_BENCHMARK=true \
EXPO_PUBLIC_API_URL=https://www.tarkman.app \
EXPO_PUBLIC_ACTIONCABLE_URL=wss://www.tarkman.app/cable \
npm run export:web --prefix apps/mobile -- --clear --output-dir dist-benchmark
```

Build flags are public configuration, never credentials. The production backend and worker must contain the matching instrumentation and set `LATENCY_BENCHMARK_SESSION_IDS=4008`. Other sessions and ordinary unmarked requests remain uninstrumented. HTTP and cable origin policy must allow `http://localhost:8101`; HTTP acceptance was verified on 2026-09-17. The runner requires a confirmed live subscription before testing.

In a separate terminal:

```sh
cd tools/latency-benchmark
node serve.mjs ../../apps/mobile/dist-benchmark
```

## Production run

```sh
cd tools/latency-benchmark
# Opens the actual controller login and readers; sends no control commands.
node run.mjs --prepare-only --client-only --out results/production-preflight

# First pilot: four warmups and twenty measured commands, at least two seconds apart.
node run.mjs --allow-session 4008 --samples 20 --warmup 4 --readers 2 --interval 2000
```

Sign in in the Chrome controller window with an account authorized to control session 4008. Its dedicated profile is under `.profiles/` (ignored by Git); reader contexts are anonymous. Fixture and production profiles are separate. The runner does not export credentials, HARs, console messages, response bodies, or liturgy text. Keep all windows visible and allow the run to finish without another controller moving this session.

The normal run automatically collects Render web and worker logs after a five-second worker grace period, using your existing CLI login. This is read-only. Missing or delayed jobs remain listed in `render-log-capture.json`. Collect again later if needed:

```sh
node collect-render.mjs results/<run>/run.json
```

Resources verified on 2026-09-17:

- Web: `srv-d4gimpali9vc73dl02vg`, standard plan, Oregon.
- Worker: `srv-d4gio34hg0os73fqro8g`, starter plan, Oregon.
- Database: `dpg-d4gi9e3uibrs73d0hqjg-a`, PostgreSQL 18, Oregon.
- Web and worker revision at inspection: `4e8df4c54df23bf43e7e1e57f7d0633bea4207fc`.
- Session 4008: three liturgies, initial production part 216, dated 2026-09-13. The runner always reads fresh state; it does not change the date to make it appear in Today's services.

`--client-only` permits a browser-only run before backend instrumentation is deployed. It cannot establish a complete server/worker breakdown and labels correlation accordingly. It does not bypass control authorization or subscription checks. Do not compare this population directly to a fully instrumented run without accounting for instrumentation overhead.

## Outputs and interpretation

- `run.json`: run settings, client base commit and dirty status, served HTML fingerprint, command outcomes, all browser marks, HTTP phases and bytes.
- `report.html`: median/p95 per client, per-command waterfalls, failures, request counts, and server spans.
- `server.jsonl`: only same-run structured diagnostic records from the web service and worker.
- `render-log-capture.json`: queried resource IDs/time window, pagination completeness, missing request/job IDs, malformed diagnostic records, and dropped span count.

Warmups and unsuccessful/incomplete observations are excluded from percentiles but retained in the outcome table. Median/p95 use nearest-rank estimation. Small pilots are exploratory; p99 is intentionally omitted. Increase to three separate batches of 100 commands after a clean pilot. Counts are even so Next/Back pairs return to the initial position on a normal run.

The endpoint is the top of the correct reading inside the viewport, stable across two animation-frame intervals after React commit. This is a **visibility estimate**, not proof of physical screen presentation. Scrolling remains enabled. Browser clocks use `performance.timeOrigin + performance.now()` in the same Chrome process on one awake host. Do not extend those assumptions to multiple machines. Server spans use monotonic durations within each process; queue wait is explicitly a wall-clock estimate. Network/Render-edge/OS scheduling not observed by these clocks remains unattributed, rather than being guessed by subtracting host timestamps. Parallel and nested spans must not be summed.

Render CPU/memory/database connection metrics can be fetched for the run window with the Render integration and imported as a JSON snapshot. These coarse metrics provide context rather than per-command causality:

```sh
node report.mjs results/<run>/run.json results/<run>/report.html \
  results/<run>/server.jsonl results/<run>/metrics.json results/<before>/run.json
```

Only compare runs with matching endpoint, reader count, language/viewport preferences, cadence, cache/warmup state, and instrumentation settings. Record the deployed backend revision from collected records. A locally dirty client must be accompanied by its exact patch when sharing results.

On timeout, disconnect, mismatched part, concurrent control, or missing broadcast, the runner stops. It never retries a control POST. A normal paired run restores position; after an uncertain mutation it records `position_requires_review` instead of sending a blind corrective move. Ctrl-C stops at the next bounded observation. It may leave a single successful outward move to review. Diagnostics do not introduce a transition version or change occurrence semantics; rapid/overlapping commands need a separate protocol test.

Production navigation and explanation reads still create normal analytics jobs. Treat session 4008/run windows as test activity when reporting analytics; this tool does not delete records or disable jobs. Readiness traffic and startup connection recovery are recorded separately from timed commands.

## Local verification fixture

```sh
EXPO_PUBLIC_LATENCY_BENCHMARK=true \
EXPO_PUBLIC_API_URL=https://localhost:8100 \
EXPO_PUBLIC_ACTIONCABLE_URL=wss://localhost:8100/cable \
npm run export:web --prefix apps/mobile -- --clear --output-dir dist-fixture

cd tools/latency-benchmark
node fixture.mjs
# Separate terminal:
node serve.mjs ../../apps/mobile/dist-fixture
# Separate terminal:
node run.mjs --fixture --api https://localhost:8100 --headless \
  --samples 10 --warmup 2 --interval 1000 --out results/fixture
```

The fixture creates a temporary local TLS certificate using OpenSSL, permits invalid certificates only in fixture browser contexts, uses a synthetic login, and injects 80 ms parts-fetch / 120 ms POST response delays. All results are prominently labeled synthetic. These are not production latency measurements.

```sh
npm test --prefix tools/latency-benchmark
npm run typecheck --prefix apps/mobile
npm test --prefix apps/mobile
```
