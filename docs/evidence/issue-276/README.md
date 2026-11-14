# Draft #278 / issue #276 — real Expo web evidence

## Source and safety

Before is genuine corrected #280 dependency `7aa34e13fb04cfdf6c110255d8591f4467a81e69`, extracted with `git archive` into `/tmp/issue276-baseline-7aa34e13` ([baseline provenance](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-source.json>)); never a CSS approximation or toggled After UI. Only baseline tooling was adapted: the Metro dependency guard derives its accepted dependency directory from `realpath(react/package.json)`, as in #274. Installed mobile dependencies were linked individually; `@tarkman/*` links point to **baseline** source packages, not current shared packages. No dependency installation, production edits, commits, native builds, phone/device interactions, or shared server changes were performed by the evidence worker.

Both Before and After were fully recaptured after rebasing onto corrected #280 dependency `7aa34e13fb04cfdf6c110255d8591f4467a81e69`. Earlier captures are preserved in Git history, not reused as the corrected-baseline evidence. After was captured at HEAD `ed7f67764adb94937f9e276cd05a35b730e06601`; the final verified runtime commit is `e375f95167e86fe411aff15cfa5008119737b7d8`. Only regression tests and implementation documentation differ between those commits, not runtime components. After manifests use the final verified `sourceRevision` and preserve the actual `capturedHead`. Original capture per-file SHA256 and aggregate `9f3e7c9ecf3c8ec1c9ad6f3b0c8e85f5cf935fc5aedd9849cdbb6d4f0ab1899a` are in [source provenance](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-source.json>). Every recorded source-file hash was unchanged immediately after capture; final-commit verification finds only the non-runtime implementation notes document changed among recorded files. The original aggregate is retained honestly rather than rewritten. The corrected dependency fixes native repeated-selection geometry caching; this Mac-only web rerun does **not** verify that native fix. Saved-sheet captures explicitly disclose that removing a saved service also clears its saved places. [Provenance script](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/source-provenance.cjs>) generates a new source manifest when recapturing.

Actual production Expo Router client, synthetic `/liturgies/701`, signed out, fresh browser context for each width/scenario, light scheme, English reading language, en-US locale, America/Los_Angeles timezone, device scale 1. Fonts awaited. Desktop default comparison languages remain Grabar/transliteration. No private content or credentials; browser storage manifests contain synthetic anchor identifiers/offsets only.

## Matched initial reader

| Viewport | Genuine Before | Current After |
| --- | --- | --- |
| 390×844 | [Before](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-web-390-light.png>) | [After](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-light.png>) |
| 320×844 | [Before](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-web-320-light.png>) | [After](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-320-light.png>) |
| 1440×900 | [Before](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-web-1440-light.png>) | [After](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-1440-light.png>) |

[Before manifest](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-web.json>) and [After manifest](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web.json>) record zero page and console errors. Initial states use identical unmodified fixture payloads and default reading size. Added Saved passages entry is visible without crowding the pinned toolbar.

## Meaningful within-row bookmark and resume

A browser request interceptor derives 70 numbered English paragraphs in the first synthetic occurrence and computes a new revision. It changes only the synthetic API response, not fixtures or production source. [Long baseline](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-web-390-long-initial.png>) and [long After initial](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-long-initial.png>) use that same derived payload.

390×844: actual mouse wheel reaches scrollTop 4756 inside occurrence 901; the saved anchor is source offsets 2880–2905, **not the row start**. [Scrolled passage](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-scrolled.png>) → [bookmark sheet](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-saved.png>) → [reloaded reader with Resume](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-reopened.png>) → [resumed highlighted passage](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-resumed.png>). After reload and explicit Resume click, scrollTop is 4729 and the saved glyph is y=72–105, fully within the viewport.

320×844 additionally uses the largest **in-app** reading-size option, “Larger”, not OS text scaling: [large reading](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-320-larger.png>), [saved sheet](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-320-saved.png>), [reopened](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-320-reopened.png>), [resumed](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-320-resumed.png>). ScrollTop 4916 → 4926; saved offsets 1084–1099 and glyph y=72–121. Labels fit and controls remain available.

[Long interaction manifest](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-long.json>) includes actual persisted localStorage anchors, scroll offsets and bounding geometry for both widths; zero page/console errors. [Long Before manifest](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/before-long.json>) records the matched baseline payload state.

## Repeated occurrence and unavailable revision

The separate repeat scenario extends both occurrences with clearly numbered synthetic continuation paragraphs so the second match can genuinely be the top visible reading location (the tiny original fixture cannot scroll its second short row to the top). Find “Peace” → Enter selects match 2 → Escape → Saved passages → Bookmark → open bookmark. [Saved second occurrence](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-repeated-saved.png>) and [opened second occurrence](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-repeated-open.png>) show the second occurrence's text and highlight. Persisted anchor is `liturgyPartId:902`, `occurrenceIndex:1`, `partId:801` (same underlying part as occurrence 901), proving occurrence disambiguation; opened glyph y=138–171.

A subsequent intercepted payload revision change followed by reload produces [unavailable revision UI](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-web-390-unavailable.png>): disabled Resume and Passage 1, explicit explanation, and still-available Clear/Remove actions. [Repeated/unavailable manifest](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/after-repeated.json>) records disabled state and zero page/console errors. No rendering regression observed in these runs.

## Reproduce

Requires existing Playwright `/tmp/issue-271-evidence/harness/node_modules/playwright` and Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; no install needed. Own fixture API used port 4296 and own baseline/After Metros used 8096/8097. All evidence worker servers were stopped after capture; shared ports and #274 phone slot were untouched.

Start synthetic API from repository root:

```sh
LIBRARY_FIXTURE_PORT=4296 node apps/mobile/scripts/library-fixture-server.mjs --scenario=normal
```

For each source's mobile directory, start Expo (baseline 8096, current 8097):

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SENTRY_DSN= EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1 EXPO_PUBLIC_LIBRARY_API_URL=http://127.0.0.1:4296 CI=1 node node_modules/expo/bin/cli start --localhost --port 8097 --clear
```

CI disables source watching: restart after source changes before claiming refreshed evidence. Run [capture script](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/capture.cjs>) and [repeat script](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/capture-repeated.cjs>) from repository root:

```sh
QA_APP=http://localhost:8096 QA_PHASE=before QA_SOURCE_REVISION=7aa34e13fb04cfdf6c110255d8591f4467a81e69 node docs/evidence/issue-276/capture.cjs
QA_APP=http://localhost:8096 QA_PHASE=before QA_LONG=1 QA_WIDTHS=390 QA_SOURCE_REVISION=7aa34e13fb04cfdf6c110255d8591f4467a81e69 node docs/evidence/issue-276/capture.cjs
node docs/evidence/issue-276/capture.cjs
QA_LONG=1 QA_INTERACT=1 QA_WIDTHS=390,320 node docs/evidence/issue-276/capture.cjs
node docs/evidence/issue-276/capture-repeated.cjs
```

## Native evidence remains pending

All images here are Chromium **web**, including phone-sized viewports. Actual #276 native evidence remains **UNVERIFIED**: no iOS/Android/native evidence was obtained or claimed. Native visual comparison, VoiceOver, device persistence and native scroll/restore behavior remain pending. The owner has explicitly stopped all physical-phone/accessibility testing; no device actions were performed, and any global hold release requires owner direction, not a worker slot grant. Native artifacts belonging to dependency #274 do not establish #276 behavior. Web screenshots do not establish those native behaviors.
