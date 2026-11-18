# #276 continuation on actual main

Dependency [#280](<https://github.com/mattash/Tarkman-Client/pull/280>) is actually squash-merged as `35fbf4961c0e38cd64910a4126f1e8d7c3ee029f`. Only the reviewed #276 continuation was replayed onto that commit; Find's commits were not republished as new feature work.

## Replay and runtime identity

- Previous provisional base: `71890bb1a3a2423c4240d3208db5268bd36fd631`.
- Own continuation before replay: `298d6697dce997816f59dfedbe2131d7758ac274`; replay result before this documentation update: `b2ae7c3b423cd52ea329f19684ec920e16dcb587`.
- Full binary child diff before/after replay is byte-identical (`cmp`), SHA-256 `1412486406c285af6fdab23995c5f8331a024b80f975156bc650b14b15fecfd0`. This includes both accepted capture corrections, tests and evidence, not just a patch-id approximation. Subsequent edits document reconciliation only.
- All **279 preexisting runtime-source files** selected from captured After `7801efd40e1606acd9d92dd8bb90f481557c1510` retain identical Git entries/blobs. Current LiturgyText blob: `34151989752eabf93b9be208d5545731d1b8c1ce`.
- Mobile dependency lock, package/app/EAS configuration, Metro/Babel configuration and TypeScript configuration are identical to captured source. No new native module or app build was required.
- The provisional-parent→actual-main delta changes isolated Swift prototype/evidence files, not normal mobile/TV/shared-package runtime or regular test inputs. It does **not** establish whole-repository identity; standalone prototype code changed.
- Agent authorship and the existing review-credit trailer remain on every continuation commit.

## Verification scope

The actual combined run on the reconciled provisional stack passed **107 suites / 1,466 tests**, mobile types/lint/i18n/UI guards, web export and reader boundary. New focus-intent coverage then passed **24 focused tests** (11 new PartList API-intent cases plus 13 existing reader UI cases), types and scoped lint. No unchanged full/native/phone cases were repeated solely for this final replay.

Current required main-target CI/Vercel and the exact posted-head independent review are recorded on [PR #278](<https://github.com/mattash/Tarkman-Client/pull/278>); historical runs are not claimed as checks of another SHA.

## Capture identities and accessibility limits

Actual images remain **Before `7aa34e13` / After `7801efd4`**, for both the [web comparison](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/README.md>) and [owned-Simulator evidence](<https://github.com/mattash/Tarkman-Client/blob/agent/passage-bookmarks-resume-12a2065a622d/docs/evidence/issue-276/native-simulator.md>). They were not relabelled as captures of a rebased commit. Their original per-file hashes and image bytes are retained. Implementation documentation and test additions do not alter rendered runtime code.

Native labels, enabled states, modal dismissal and visible restoration have actual Simulator evidence; focus API intent/order has deterministic coverage. Actual UIKit/VoiceOver focus and audible announcements remain **unverified**, not a #276 physical-device waiver. [#284](<https://github.com/mattash/Tarkman-Client/issues/284>) tracks the separate Find-only deferral; no phone/settings action or operator prompt is authorized.
