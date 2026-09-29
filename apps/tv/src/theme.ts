import foundation from '@tarkman/design/tokens'

// tvOS lays out 1080p and 4K screens at the same 1920×1080 points, so these sizes hold for both.
export const colors = foundation.themes.dark

/** Apple's TV safe area: keep text and focus effects clear of overscanned edges. */
export const safe = { horizontal: 90, vertical: 60 }

export const type = {
  title: 57,
  heading: 44,
  body: 34,
  label: 29,
  caption: 25,
}
export const space = { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 }
export const radius = 16
