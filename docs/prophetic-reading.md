# Prophetic reading

The active Expo client supports the backend prophetic-reading contract from
mattash/Tarkman#519 (merged as `1b483170c90ba743920c4fd70152e5b15b65c6d2`):

- Set, edit or clear `options.prophetic` beside Gospel and Epistle in session settings.
- Import explicitly selected references from the bundled lectionary in create/edit settings.
  The source has no prophetic role classification: all references are offered, none
  are selected automatically. Applying selections previews replacement of existing
  text; unselected fields remain unchanged. Nothing is persisted until Create/Save.
- Choose **Prophetic Reading** in the service display controls to send
  `showing_prophetic` (backend enum value 7; JSON uses the status name).
- Mobile, exported web, kiosk/projector and TV use the shared reader presentation.
  The display shows the session text with localized English/Russian labels; authored
  Armenian and Russian part text remains intact.

Canonical JSON publishes `readings.prophetic` as well as `options.prophetic`.
Missing/null values normalize safely. The reader prefers an explicit option,
including an intentionally empty value, and falls back to the canonical reading
when the option is absent. No configuration or migration is needed.

## Variable parts

The public session parts endpoint expands a variable part whose stored `en` accessor
is `prophetic` through the session option, just as it does for Gospel and Epistle.
The client renders that returned text; it does not substitute accessor names into
other languages or reinterpret admin-only `variable_accessor` metadata. Empty
readings use the existing missing-text behavior. Other authored language columns
are preserved by the backend and shared reader.

## Boundaries

The existing client imports citation references, not scripture passage text, from
its offline 2026/2027 English/Armenian packs. This change adds no live third-party
readings API dependency and does not infer a prophetic role from book or position.
The deprecated Vite client is unchanged, per repository policy.

See the paired actual application captures in [visual evidence](<evidence/issue-268/README.md>).
