# Library HTTP 429 comparison (#271)

Actual repository Expo web application captures, not mockups or injected UI state.
Only the anonymous HTTP API is a local deterministic fixture; no production requests,
accounts, credentials or private service content were used.

| Evidence | Application source revision |
| --- | --- |
| [Before](<before-library-429.png>) | `bde6b9875e4f91542363c4162ab9c915df101aec` |
| [After](<after-library-429.png>) | `e89a14f990a7a62ee7e67178b3e02d160fbdee4f` |

Same scenario in both: initial `/library` focus, anonymous fresh browser storage,
no saved copies, All filter, empty search, top scroll position, light appearance,
en-US, UTC, reduced motion, 1280×900 CSS pixels, scale 1. Chromium 156.0.8078.4,
Playwright 1.65.0. The catalog returns HTTP 429, text/plain `Too many requests`,
`Retry-After: 60`, before the screenshot is taken. Readiness is visible application
feedback plus `document.fonts.ready`, before retry expiry. Both captures observed
one catalog GET and zero JavaScript page exceptions.

Before reports generic invalid content; After displays the pause and retains the
busy check action while waiting. No layout or style redesign.

Request/viewport/text observations: [Before record](<before-library-429.json>) and
[After record](<after-library-429.json>). PNG SHA-256 values:

```text
Before 5734c5b5210f0c7fdabe68881bee9f69e8f3442e3f1a4007e1fc75ade4a83246
After  c533d2cf9fe426172cc8bb6c09a33106e6a71ab195609c5350620a80ed2a79e6
```

## Reproduce

Extract each source revision into a separate clean snapshot with `git archive`.
Install dependencies in that snapshot's canonical `apps/mobile` directory with
`npm ci` (not a node_modules symlink into a different checkout), then export:

```sh
CI=1 EXPO_PUBLIC_LIBRARY_FIXTURE_BUILD=1 \
EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1 \
EXPO_PUBLIC_LIBRARY_API_URL=http://127.0.0.1:18771 \
npx expo export --platform web --output-dir /absolute/path/to/export
```

Install Playwright 1.65.0 in an external tooling directory and its Chromium browser.
Run the committed [capture harness](<capture.mjs>) sequentially from this evidence
directory, passing each export and exact application revision:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/tooling/node_modules/playwright \
node capture.mjs /absolute/path/to/before-export before-library-429 \
  'Something went wrong with this service. Anything you saved is still here.' \
  bde6b9875e4f91542363c4162ab9c915df101aec

PLAYWRIGHT_MODULE=/absolute/path/to/tooling/node_modules/playwright \
node capture.mjs /absolute/path/to/after-export after-library-429 \
  'Requests are paused. Please try again later. Your saved copies are still available.' \
  e89a14f990a7a62ee7e67178b3e02d160fbdee4f
```

`EVIDENCE_OUTPUT_DIR` changes output location; `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
selects an installed browser when needed. The harness owns a temporary loopback
server on port 18771 and closes it and the browser after capture. The captured
After export's changed runtime source files were byte-compared with its commit.

## Limits

This is web rendering with a synthetic HTTP response, not native physical-device,
offline-storage or deployed backend evidence. Same-origin headers are visible;
the comparison does not establish browser hidden-header fallback, pause timing,
jitter, retry bounds, cancellation or saved-copy retention (storage starts empty).
Those behaviors have deterministic regression tests. Only English was captured;
English/Russian key and placeholder parity is tested. Backend capacity and release
configuration are unchanged; separate devices cannot share this local pause.
