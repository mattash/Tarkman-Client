# Eastern Armenian display-link validation

Contract: `lang1` and `lang2` accept `hye`, which reads public part `hy_east`
into `LivePart.hyEast`. `hyw` continues to read `hy_west`. Missing or blank
Eastern content shows the existing unavailable-text message; there is no fallback.
The production owner is apps/mobile (including the Expo web display routes),
with apps/tv sharing the reader presentation engine. Deprecated apps/web is unchanged.

Verified in the cloud Linux environment:

- `npm test`: 85 suites, 1,113 tests passed.
- `npm test --prefix apps/tv`: 6 suites, 53 tests passed.
- Mobile and TV type checks and ESLint passed.
- `npm run core:test`: 13 tests and core boundary passed.
- `npm run reader:check`, mobile i18n guard, both font guards passed.
- `npm run build`: production Expo web export passed.
- Independent agent review: no blocking findings; stale display-language docs corrected.

`node apps/mobile/qa/eastern-armenian/verify.cjs` requires the repository's
loopback display fixture on 8101 and Expo web on 8082 (see cloud START.md),
plus the cloud-supplied Playwright and Chromium. It intercepts only synthetic
part/config reads: Eastern text `Ալելուիա` is copied from the existing
part-detail fixture, not a new translation. The parallel screenshot uses the
fixture's existing English prayer as a separate column; these sample strings
are not represented as translations of each other.

The browser checks token configuration, `hy_east` parsing, parallel Eastern
and English display, Armenian computed font, direct single-language missing
content, absence of Western substitution and page errors. Screenshots:
`parallel.png`, `missing.png`. No real user data or live backend was used.

Native iOS/tvOS build/device checks require macOS/Xcode and were not performed.
This client change requires the backend to accept `hye` and publish existing
Eastern Armenian content as `hy_east`; data coverage remains the backend task.
The setup preview retains its existing sample languages and honestly shows
missing text for Armenian translations it does not contain.
