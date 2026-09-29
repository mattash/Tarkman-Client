# Bundled Armenian lectionary

Implementation of [#211](https://github.com/mattash/Tarkman-Client/issues/211).
**Release is pending maintainer clarification of derived-data rights.**
The repository owner authorized uploading this implementation and its generated packs for PR review on September 29, 2026. That authorization does not establish upstream data rights. Keep package publication and production deployment blocked until the question is resolved.

## Contract

730 dates, January 1, 2026 through December 31, 2027, in English (`en`) and
Classical Armenian (`hy`): 1,460 complete upstream responses. Each year/language
is a separate explicitly required JSON module. There is no runtime Python,
filesystem, backend, browser storage, network access, or external dependency.

```ts
import { bundledLectionary } from '@tarkman/lectionary/bundled'
const result = await bundledLectionary.getDay('2026-06-01', { language: 'hy' })
if (result.ok) {
  console.log(result.day.Observances, result.day.Readings, result.dataset.datasetId)
} else {
  console.log(result.reason) // invalid-date / unsupported-language / out-of-range / data-load
}
```

`createLectionary({ manifest, loadYear })` from `@tarkman/lectionary` isolates the
public lookup API from storage. A different implementation can retain the public
`Lectionary` interface. Additional years use manifest coverage and injected
loaders; the session UI never needs year filenames. New upstream fields survive
unchanged, including nested metadata. Schema version 1 describes the pack and
required upstream fields; incompatible changes require a new schema and migration.

Dates must be real `YYYY-MM-DD` Gregorian dates. The library never computes today
or converts dates into timestamps. English is the API and initial content-selector default, independently of
interface language. The app's small `features/lectionary` adapter requires an explicit
language and takes the creation draft's date verbatim. Zone and midnight behavior
remain owned by the existing creation bootstrap/draft contract.

Only a requested year/language pack loads. Concurrent requests share one promise;
failed loads can be retried. Every loaded pack is structurally validated, then
detached from the loader's object. Each success returns independent day and
manifest copies; mutation never contaminates later lookups. Build tests verify
all file hashes and sizes. Runtime validation detects wrong identity, schema,
coverage, and malformed records; it does not implement cryptographic hashing in
the client. Missing packs and thrown loads produce explicit data-load results.

## Reproduce and verify

Run from the repository root. Acquisition is a separate network step; generation
and comparison use only the verified local archive. The exporter extracts only
`armenian_lectionary/` into a temporary directory, not dev code or oracle caches.

```sh
curl -fL --retry 3 \
  https://codeload.github.com/andylitalo/armenian-lectionary/tar.gz/38302406bce0f0dd7c4e09d3e20ba762c15a7418 \
  -o /tmp/armenian-lectionary-3830240.tar.gz
python3 packages/tarkman-lectionary/scripts/generate.py /tmp/armenian-lectionary-3830240.tar.gz
npm ci --prefix apps/mobile
npm run lectionary:test
node packages/tarkman-lectionary/scripts/dump-consumer.cjs > /tmp/lectionary-consumer.json
python3 packages/tarkman-lectionary/scripts/generate.py /tmp/armenian-lectionary-3830240.tar.gz \
  --check --consumer-results /tmp/lectionary-consumer.json
```

Archive SHA-256: `ca5922da837ea37c537c5786085be1530695470f96a6bd6d24bf48ca0aaf7304`.
Upstream commit: `38302406bce0f0dd7c4e09d3e20ba762c15a7418`, package 2.1.0.
Exporter: 1.0.0, Python >=3.9 standard library only, verified with Python 3.9.6.
Use the app's locked TypeScript (6.0.3); the repository targets Node 24.
No pip dependencies or installation of the Python source is needed. Environment
overrides beginning `LECTIONARY_` are removed before loading the engine.

The manifest includes schema, source commit/version/archive hash, exporter version,
languages, coverage, record counts, and each pack's bytes/SHA-256. Payloads and
manifest contain no timestamps, machine paths, or other volatile values.
`--check` regenerates all bytes without modifying files; `--consumer-results`
also compares every public TypeScript result to fresh Python output, including
array order and scalar types. Parity is not independent liturgical validation.

For an update:

1. Obtain an immutable upstream commit/archive and inspect the source, contract,
   attribution and data rights. Change both pins deliberately in `generate.py`
   and the acquisition URL in CI. Refresh LICENSE/NOTICE from that same archive.
2. Copy the old `data/` directory outside the checkout. Adjust explicit loader
   cases/coverage for any additional years and increment exporter/schema as needed.
3. Generate twice (second pass `--check`), run the TypeScript tests and exhaustive
   public-result/Python comparison above.
4. Review `python3 packages/tarkman-lectionary/scripts/diff-data.py OLD_DATA NEW_DATA`
   and the manifest diff. This reports changed dates/fields, retaining absent/null
   distinctions; additions/removals are explicit. Do not approve only file sizes.
5. Repeat platform measurements and product/backend verification. Record independent
   source validation separately. Clear the data-rights gate before distribution.

CI's mobile job runs package compilation, checksum/shape tests, full-result
comparisons with checked-in packs, and mobile adapter tests. It acquires the
pinned archive separately and runs exhaustive Python/public-API parity too.

## Preserved source limitations and attribution

LICENSE and NOTICE are upstream originals, unmodified. Tarkman's additions are
the exporter, JSON packaging, TypeScript API, adapter and tests; generated JSON
is derived from the pinned upstream source. No Bible passage text is bundled.
The source attributes traditional material to the 1915 Jerusalem Tōnatsooyts and
SacredTradition as a development oracle. Its Python docstring also says Armenian
feast/book forms were scraped offline into bundled maps. The Apache-2.0 software
license/NOTICE does not settle the issue's outstanding question about every
modern rendering/source-derived dataset. Maintainer confirmation has not been
provided in this implementation session; do not represent it as received.

Upstream README describes 2027 as separately validated, while its
`tests/test_observance_contract.py` says the source oracle ends in 2026 and that
2027 pages were empty at its July 30 probe. Full Python parity is verified here;
independent authority for all 2027 readings is not established.

`is_fast` and `is_comm` are independent marks on each observance, not date-level
fasting decisions. No feast/fast precedence, service/office assignments, `Calendar`
routing object, Russian content, transliteration, or passage text is invented.
`ReadingsRefs.citation` remains the upstream canonical English back-pointer even
when display strings are Armenian; composite readings have multiple references.
Eight distinct dates intentionally have empty readings (16 localized results).
Provenance, lower-confidence annotations and optional fields are retained verbatim.

## Creation behavior

The following decisions were recorded and communicated before wiring the UI.
They keep application deliberate, with no automatic service mapping:

- Look up the selected creation draft date only on explicit request. Never infer
  a different date from the clock; a bootstrap/date change invalidates a preview.
- Show all readings. Let the user select Gospel/Epistle references; maintain
  upstream order and join multiple selections with `; `. Other categories are
  reference-only. Do not map categories to selected liturgies, including ordered
  sessions containing multiple liturgies.
- Default the content selector to English, independently of interface language,
  with Classical Armenian available. Show source/confidence/note annotations.
- Apply only after an explicit action, clearly confirming replacement of the
  selected Gospel/Epistle fields. Preserve unselected fields, messages, manual
  entries and defaults until then. Date changes do not automatically clear or
  reapply readings; late responses must never overwrite edits.
- Out-of-range, load errors and intentional empty readings leave manual entry
  available. Applying modifies only the creation draft. The existing authenticated
  Create action sends the existing `options.gospel`/`options.epistle` attributes.

Examples: January 5 has five Gospel references; none is
assumed to belong to a service or automatically chosen. January 26 has no appointed
readings; existing draft text remains. A manually typed Gospel stays after moving
the date to January 27 until an explicit replacement. A 2030 session remains valid
for manual entry. Crossing midnight never causes an unsolicited reading import.

NewSession supplies the optional picker to SessionForm; editing receives no
picker. Applying is one atomic controller update, guarded by the exact previewed
draft and editable phase. It marks selected options and the chosen date touched,
so late bootstrap/midnight defaults cannot relocate applied readings or overwrite
them. Existing field-length validation, deliberate Create, idempotent retries and
backend attributes are retained. Synthetic tests round-trip applied values through
the authenticated create contract; they do not claim production backend writes.
Web available-module lookup requires no lectionary request; browser cold-start
offline support is not claimed (the app has no service worker).

See [VALIDATION.md](VALIDATION.md) for measured evidence and remaining acceptance.
