# Display customization review

The customization branch builds on `codex/issue-158-display-projection`. It consumes
the additive Rails display-link fields `device_type`, `font_scale`,
`text_movement`, `language_sync`, and `margin_percent`; old payloads retain the
existing automatic size and linked continuous scrolling. Token values always win
over direct URL parameters. Invalid fields fall back independently.

Preview examples (Expo web on port 8084):

- `/display-preview?mode=parallel&lang1=grabar&lang2=en&device_type=projector`
- `/display-preview?sample=long&text_movement=none&font_scale=125`
- `/display-preview?sample=long&text_movement=paged&language_sync=linked`
- `/display-preview?sample=long&text_movement=manual&language_sync=independent`

These routes use synthetic excerpts, a 30-second duration, and the actual
projection renderer without fetching a service or subscribing to ActionCable.
The Rails setup form embeds this route at a chosen resolution, passing unsaved
settings without a token or owner ID. The full-size link uses the browser's actual
viewport. Configure Rails `FRONTEND_HOST` to this Expo web host for local review.
The standard Vercel deployment still serves Vite; deployment routing is unchanged.

Device presets supply a text multiplier and margins: automatic retains existing
behavior; projector uses 115%/4%, TV 100%/3%, tablet 85%/2%, phone 75%/2%. Explicit
text adjustment is 50–200% of that preset; margins are 0–15% on each edge or null
for automatic. The viewport still determines columns versus stacking.

Linked continuous movement shares the occurrence clock. Linked timed pages change
at the same instants, using enough pages for the denser column. Independent
movement paces each language by its word count within the estimated part duration.
Manual linked scrolling shares proportional positions; independent columns can
be scrolled separately. Stationary mode disables scrolling, and the preview warns
about overflow. Reduced-motion mode always uses discrete pages for automatic text.
Manual positions survive announcements and connection notices and reset for each
new part occurrence.

Existing occurrence, pause, resize and connection-recovery behavior remains in
place. This release does not add a server start timestamp or claim exact alignment
to speech, sentences, or another screen opened later.

## Validation — September 19, 2026

562 mobile tests across 47 suites passed, including normalization, token precedence
and timing regressions. Typecheck, ESLint, UI/i18n guards, production Expo web
export and diff whitespace checks passed. The existing full-suite open-handle
advisory remains; focused suites exit normally.

Synthetic browser review covered projector 1920×1080, portrait tablet 768×1024,
phone 390×844, and the Rails create/edit forms at desktop/phone widths. Linked
manual scrolling reached ~0.4/0.4; independent mode reached ~0.4/0. Linked paged
columns changed together at 0.067 and 0.133 normalized progress. Stationary
long-text samples showed overflow warnings. Browser error reports were empty.

Committed synthetic display captures: [projector](evidence/customization/projector.png),
[tablet](evidence/customization/tablet.png), and [phone](evidence/customization/phone.png).
Additional local review artifacts are under `output/playwright/` in this worktree.
Physical display distance and native device rendering remain unverified.
