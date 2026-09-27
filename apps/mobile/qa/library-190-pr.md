# Draft PR: Add opt-in public liturgy Library with native downloads

Refs https://github.com/mattash/Tarkman-Client/issues/190 and
https://github.com/mattash/Tarkman/issues/452. Keep the end-to-end issue open until
backend integration, editorial and independent device acceptance are proven.

Services now separates Live and Library. Signed-out readers can browse the public
contract, explicitly choose downloads, read without a live cursor, and manage
saved copies separately from reading preferences and the saved live-service copy.
Native SQLite commits complete validated replacements; bounded sync preserves old
copies on recoverable failures and prevents removed/cancelled work from returning.
Typed public unavailability clears only the affected copy and open reader.

Remote Library integration remains disabled in release builds. Development QA is
explicitly opt-in; an additional fixture-build flag permits only loopback access
for embedded native offline testing. No production starter IDs are configured.
Expo web supports online reading and never claims a durable Library download.

Changes are confined to `apps/mobile`: routes/provider, Library contract/API/store/
coordinator/UI, Services/Settings integration, English/Russian copy, copied backend
fixtures, regression tests, local fixture server and QA documentation. No legacy
`apps/web`, dependency lockfile, `.env`, deployment or repository-setting changes.

Validation and remaining evidence: [verification](library-190-verification.md).
Independent rendered/native QA: [scenario instructions](library-190.md).
Schema, limits, policy and fixture provenance: [implementation notes](../features/library/README.md).

Parent verification passed all 65 test suites / 828 tests, lint, typecheck, UI/i18n/font guards, and the Expo web export. Do not merge or deploy until the remaining independent review and rendered/native acceptance gates are complete.
