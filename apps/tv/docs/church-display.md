# Church display: a saved default for this TV (#215)

An installer chooses the church where the TV is installed, then one of that
church's published displays. The TV stores that choice and opens it at every
launch, following whichever service is current. No sign-in, location or
operator credential is involved, and the TV only ever reads.

## Behavior

| Situation | What the TV does |
| --- | --- |
| First launch | Live services, plus **Set up a church display** |
| Saved display | Blank until storage is read, then straight to the display; setup never flashes |
| No service live | "Waiting for the next service"; the display starts by itself |
| Service ends or a new one starts | Follows the church's current service; the saved choice is unchanged |
| Network loss, timeouts, 5xx | Keeps the saved choice, retries on its own, never claims live until it recovers |
| Link removed (404/403), expired (410) | "This display is no longer available" with **Try again**, **Change display**, **Reset**; the saved identity is kept until an explicit replace or reset |
| Saved record damaged, or written by a newer app | Explained on screen, left in place; **Choose a display again** (overwrites on save), **Erase**, or browse live services |
| Display configuration edited by the church | Adopted live (revisioned: an older revision never wins) |

Changing or resetting is reachable from every state: a running
saved display always shows a **toolbar** along the bottom (live services, settings, change display,
reset), and the projection is sized to the space above it. Select acts on the focused toolbar button;
**Menu (Back)** is the only way out of the display, and leaves the app for the Apple TV home screen.
The waiting, error and unavailable screens show the same buttons directly; Settings has a Church
display section. Reset always asks twice, with Cancel focused. Backing out of
setup never changes the saved display, and browsing another live service never
replaces it.

## Storage

The choice is stored in the **Keychain** through `expo-secure-store`
(`src/storage.ts`, service `app.tarkman.tv`, accessible after first unlock).
tvOS apps have no persistent Documents directory and the system may purge the
Caches directory, which is where file-based stores such as AsyncStorage live,
so they are not suitable for a preference the TV must keep.

Stored (`tarkman.tv.saved-display.v1`): schema version, save time, church
`{id, name, locality}` and link `{id, title, token}`. Never a session ID. The
token is a public launch capability (see the contract below).

Honest limits, to confirm on a device (see the checklist):

- Survives app relaunch and Apple TV restart, and should survive app updates.
- A factory reset of the Apple TV erases it. Whether it survives deleting and
  reinstalling the app on tvOS has not been verified; do not promise it.
- Writes are read back: a Keychain that accepts a write it cannot return is
  reported as a failed save and the previous choice stays.
- Nothing is synced between Apple TVs.

Recovery is never silent. An unreadable record is not deleted on read, and a
storage read failure is treated as "unreadable", never as "nothing saved".

## Public directory contract (backend v1, mattash/Tarkman#457 / #459)

Implemented by the backend and documented there in `docs/public-church-discovery.md`. The client's
side is isolated in `src/directory.ts` (routes, DTO parsing and error mapping), with fixtures in
`tests/fakeServer.ts`. All requests are anonymous `GET`s (`credentials: 'omit'`, `cache: 'no-store'`,
no redirects).

- `GET /public/churches?q=&page=1&per_page=25` returns `{ schema_version, churches: [{id, name,
  locality}], pagination: { page, per_page, total_count, next_page } }`. `q` is a case-insensitive
  substring of the church **name** only (max 100 chars); `per_page` is 1-50. The app passes an opaque
  cursor, which the client maps to the next page number. Churches with no live service are listed.
- `GET /public/churches/:id/display_links` returns `{ church, display_links: [{id, church_id, title,
  token, launch_path, user_id, mode, ...}] }`. The client reads only `id`, `title` and `token`;
  everything else is ignored by an allowlist.
- Publication is opt-in (`display_links.published_at`, set with `display_link[published]` by the
  owner or an admin). Existing links are **not** published, so the directory is empty until someone
  publishes one. Unpublishing only removes discovery; the token keeps working.
- Errors: `400 invalid_parameter`, `404 church_not_found` (unknown or currently unlisted church),
  `429 rate_limited` (60 requests/minute/IP; treated as transient), 5xx transient. Success replies are
  cached for 30 seconds, errors are `no-store`.
- **Choosing** validates the token with the existing token read; only a `200` is saved. `404/403`
  means "unavailable", `410` means "expired", anything else means "could not check", and none of those
  saves. The token read is authoritative: a link that is unpublished but not revoked keeps working.
- `user_id` from the token read identifies the operator whose current service the display follows.

## Automated checks

Synthetic fixtures only (`tests/fakeServer.ts`), no public service is touched:

- `tests/directory.test.ts`: allowlisting, malformed and duplicate rows, request
  shape (reads only, no credentials), failure mapping.
- `tests/savedDisplay.test.ts`: round trip, no session IDs, unreadable and newer
  records, read-back failure, reset.
- `tests/churchDisplay.test.tsx`: anonymous church → link → save → relaunch →
  direct display; waiting and rollover; network failure; unavailable and
  expired links; revisioned configuration; change, cancel, replace and reset;
  damaged and newer records; every request is a `GET`.

```sh
npm ci --prefix apps/tv
npm test --prefix apps/tv
npm run typecheck --prefix apps/tv && npm run lint --prefix apps/tv
```

## Device checklist (not done in the cloud session that built this)

Needs a Mac, Xcode 27 and an Apple TV. `expo-secure-store` is a **new native
module**, so build fresh:

```sh
git switch <this branch>
npm ci --prefix apps/tv
cd apps/tv
export LANG=en_US.UTF-8   # CocoaPods fails on a non-UTF-8 locale
npm run prebuild:tvos      # regenerates ios/; autolinks expo-secure-store for tvOS
npm run tvos               # build and launch (simulator), or build to the Apple TV from Xcode
```

1. **Publish a display link** on the backend (`display_link[published]=true`), or the
   directory is empty. Point `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ACTIONCABLE_URL` at the
   deployed server (for example `https://www.tarkman.app` and `wss://www.tarkman.app/cable`).
2. **Setup with the Siri Remote alone:** Set up a church display → church →
   display. Confirm focus is visible and predictable, Back/Menu restores focus
   to the church left, and the on-screen keyboard works for search (search is
   optional).
3. **Persistence:** quit and relaunch, then restart the Apple TV. It should
   open the display directly with no setup flash.
4. **Keychain on tvOS:** confirm the save succeeds on device (a failure shows
   "Couldn't save the display on this TV"). Then delete and reinstall the app
   and record whether the choice survives.
5. **Waiting and rollover:** with no live service it should say waiting; start a
   service and confirm it begins on its own; end it and confirm it returns to
   waiting.
6. **Failure:** disconnect the network; the saved choice must remain and the
   display must recover when the network returns.
7. **Unavailable link:** revoke or expire the link on the backend; confirm the
   unavailable screen, Try again, Change display and Reset, and that the saved
   choice is kept until reset.
8. **Configuration update:** edit the display's languages or text size on the
   server and confirm the TV adopts it without a relaunch.
9. **Legibility:** 1080p and 4K, long Armenian text, and the explanation cue if
   the display enables it.
10. Record results in the Evidence table of `apps/tv/README.md`, separating
    simulator results from physical-device results.
