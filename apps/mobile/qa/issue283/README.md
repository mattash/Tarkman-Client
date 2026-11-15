# #283 isolated UI audit and working improvements

Production code, not a mockup: shared [SegmentedControl](../../components/SegmentedControl.tsx), [TextField](../../components/TextField.tsx), and [Today](../../features/home/Today.tsx). Full findings and platform assessment: [audit](../../../../docs/design-system/issue283-audit.md).

## Run locally

Use Node >=22.13. No credentials, production endpoint, native build or deployment is needed. Use these ticket-owned ports only if free; substitute unused ports consistently if necessary. Keep each process in its own terminal and stop only your processes with Ctrl-C.

```sh
npm ci --prefix apps/mobile
FIXTURE_PORT=18283 node apps/mobile/qa/design-system/mock-reader-server.cjs
```

From `apps/mobile`, in another terminal:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SENTRY_DSN= \
EXPO_PUBLIC_API_URL=http://127.0.0.1:18283 \
EXPO_PUBLIC_ACTIONCABLE_URL=ws://127.0.0.1:18283/cable \
CI=1 npx expo start --web --localhost --port 18383 --clear
```

Open `http://localhost:18383/settings`: Tab into Appearance, use Left/Right, Home/End, then Tab to Reading size and Shift+Tab back. At widths below 360, use Up/Down instead. Selection and focus move together; a group is one Tab stop. Mouse/touch choices still work. CI-mode Metro does **not** watch edits: restart it after changing source. Do not reuse stale bundles.

Open `/gallery`, scroll to **Field with feedback**: its visible error is explicitly associated with the invalid input in the DOM. Native names, keyboard behavior and error hints are preserved; web-only caller `aria-describedby` is retained alongside an error.

Open `/sessions/9001/parts` for synthetic multilingual prayer, explicit missing Russian text on part 2, explanation and preferences. The fixture lacks the revisioned state endpoint and changing live publications; 404 legacy fallback here is not evidence of a production defect or live recovery certification.

## Automated browser check and screenshot capture

Playwright is QA tooling only, not an application dependency. Install it outside the repository, then run from the repository root against the isolated server:

```sh
npm install --prefix /tmp/tarkman-283-browser playwright
NODE_PATH=/tmp/tarkman-283-browser/node_modules \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
QA_OUTPUT_DIR=/tmp/tarkman-283-review \
node apps/mobile/qa/issue283/verify.cjs
```

Alternatively omit `CHROME_PATH` if Playwright's own Chromium is installed. The script uses a fresh headless browser, asserts keyboard focus/selection/Tab order, checks field error relations, samples multilingual gallery widths/themes and intercepts **only local** discovery to add a paused sample service. Today must retain the active service's live dot/name, omit the paused service's live dot/name and use the neutral Services heading. It never sends live-control actions. The script refuses a non-loopback app URL (`QA_BASE_URL` defaults to `http://localhost:18383`). It closes its browser on failure as well as success.

## Matched actual application evidence

Both pairs: Chrome 157.0.8103.79, 390×844 CSS px, DPR 1, light OS/browser theme, fresh synthetic state, same local fixture. No screenshot compositing, mockup or private content.

- **Before:** baseline `feda077b2a8ab9fdaaf4bc44cd824d0c365ab2e1`, served before the source-changing Metro restart.
- **After:** implementation revision identified in the PR description; subsequent documentation-only revisions do not change these captures.

| Scenario | Before | After |
|---|---|---|
| Settings, focus System then press ArrowRight | [System remains selected/focused](evidence/keyboard-before.png) | [Light becomes selected/focused](evidence/keyboard-after.png) |
| Today, identical active + paused sample listing | [Paused service falsely looks live](evidence/today-before.png) | [Only active service looks live; neutral group heading](evidence/today-after.png) |

For manual baseline reproduction, run that baseline in a separate worktree with the same endpoints/viewport and actions (the old fixture uses fixed port 8100; change only its local QA port constant or point both revisions at the same isolated fixture). The working comparison is not a screenshot-approval gate.

Coverage: actual Expo web browser checks plus native-renderer unit tests and iOS JS bundling, **not native iPhone/iPad runtime, VoiceOver, Dynamic Type, Android/TalkBack or tvOS**. Those unrun checks remain unrun; see [#284](https://github.com/mattash/Tarkman-Client/issues/284) and [#285](https://github.com/mattash/Tarkman-Client/issues/285). Physical VoiceOver stayed off. No shared native configuration, credentials, #277 provider/routing scripts, store release or production rollout changed.
