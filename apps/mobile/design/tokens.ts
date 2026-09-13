import foundation from '@tarkman/design/tokens'

type FoundationTheme = typeof foundation.themes.light

function nativePalette(theme: FoundationTheme, dark: boolean) {
  return {
    background: theme.surfaceCanvas,
    surface: theme.surfaceDefault,
    raised: theme.surfaceRaised,
    overlay: theme.surfaceOverlay,
    foreground: theme.textPrimary,
    muted: theme.textSecondary,
    primary: theme.actionPrimary,
    onPrimary: theme.actionOnPrimary,
    secondary: theme.selection,
    onSecondary: theme.onSelection,
    border: theme.borderControl,
    divider: theme.borderDivider,
    destructive: theme.danger,
    dangerSurface: theme.dangerSurface,
    onDestructive: theme.actionOnPrimary,
    subtle: theme.selection,
    focus: theme.focus,
    pressed: theme.actionPressed,
    currentRule: dark ? '#B07A93' : theme.actionPrimary,
    success: theme.success,
    successSurface: theme.successSurface,
    warning: theme.warning,
    warningSurface: theme.warningSurface,
    info: theme.info,
    infoSurface: theme.infoSurface,
    disabled: theme.disabled,
    onDisabled: theme.onDisabled,
    // Backdrop is an explicit native adapter role, not a CSS shadow/token reuse.
    backdrop: dark ? 'rgba(0, 0, 0, 0.70)' : 'rgba(39, 33, 39, 0.48)',
  } as const
}

// Shared burgundy roles come from @tarkman/design; metric choices remain native.
export const colors = {
  light: nativePalette(foundation.themes.light, false),
  dark: nativePalette(foundation.themes.dark, true),
} as const
export type ThemeName = keyof typeof colors
export const spacing = { xs: 4, sm: 8, md: 16, page: 20, stanza: 19, lg: 24, xl: 32, xxl: 48 } as const
export const radii = { control: 8, card: 16, sheet: 24 } as const
export const touchTarget = 48
export const typography = {
  title: { fontSize: 34, lineHeight: 44, fontWeight: '600' },
  heading: { fontSize: 23, lineHeight: 32, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 27, fontWeight: '400' },
  explanation: { fontSize: 17, lineHeight: 27, fontWeight: '400' },
  liturgy: { fontSize: 24, lineHeight: 38, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
} as const

export const readingSizes = {
  standard: { fontSize: 24, lineHeight: 38 },
  larger: { fontSize: 30, lineHeight: 46 },
  extraLarge: { fontSize: 36, lineHeight: 54 },
} as const
export type ReadingSize = keyof typeof readingSizes
