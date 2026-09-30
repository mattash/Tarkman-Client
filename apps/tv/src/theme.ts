import foundation from '@tarkman/design/tokens'

// tvOS lays out 1080p and 4K screens at the same 1920×1080 points, so these sizes hold for both.
export const colors = foundation.themes.dark

/** Apple's TV safe area: keep text and focus effects clear of overscanned edges. */
export const safe = { horizontal: 90, vertical: 60 }

export const type = {
  title: 72,
  heading: 44,
  body: 34,
  label: 29,
  caption: 25,
}
export const space = { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 }
export const radius = 16
/** Liquid Glass shapes: generous corners that read from across the room. */
export const glassRadius = { pill: 999, card: 44, panel: 64 }
/** The lifted focus surface and its ring. Text and destructive labels on it are dark, for contrast on white. */
export const focusSurface = { background: 'rgba(255,255,255,0.95)', ring: 'rgba(227,167,195,0.6)', text: '#251821', danger: '#8C1D2B' }
/** The translucent fallback for glass (older tvOS, tests) and the search field that shares its look. */
export const glassSurface = { fill: 'rgba(255,255,255,0.10)', edge: 'rgba(255,255,255,0.16)' }
/** The soft light behind every screen, so glass has something to refract. */
export const backdropGlows = { plum: 'rgba(140,63,104,0.85)', violet: 'rgba(75,58,143,0.75)', rose: 'rgba(181,88,127,0.6)' }
/** The Live chip: light green on glass, dark green on the lifted white focus surface. */
export const liveChip = { text: colors.success, surface: colors.successSurface, textOnFocus: '#1F6B44', surfaceOnFocus: 'rgba(31,107,68,0.14)' }
