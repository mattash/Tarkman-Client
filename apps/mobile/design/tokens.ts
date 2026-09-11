// Preserve the web's semantic roles and Tarkman purple; native values are points.
export const colors = {
  light: {
    background: '#FAF9F7', surface: '#FFFFFF', foreground: '#201D29', muted: '#625C6D',
    primary: '#6B46C1', onPrimary: '#FFFFFF', secondary: '#EEE8F8', onSecondary: '#45267E',
    border: '#82798E', destructive: '#B42335', onDestructive: '#FFFFFF',
    subtle: '#F1EEF4', focus: '#6B46C1', backdrop: 'rgba(18, 13, 28, 0.6)',
  },
  dark: {
    background: '#141119', surface: '#211C29', foreground: '#F5F0FA', muted: '#C0B6CC',
    primary: '#C8ACFF', onPrimary: '#24113F', secondary: '#392B4C', onSecondary: '#E7D8FF',
    border: '#8E809D', destructive: '#FFAFB7', onDestructive: '#420A14',
    subtle: '#2B2435', focus: '#C8ACFF', backdrop: 'rgba(0, 0, 0, 0.7)',
  },
} as const
export type ThemeName = keyof typeof colors
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const
export const radii = { control: 8, card: 16, sheet: 24 } as const
export const touchTarget = 44
export const typography = {
  title: { fontSize: 34, lineHeight: 44, fontWeight: '700' },
  heading: { fontSize: 23, lineHeight: 32, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 27, fontWeight: '400' },
  liturgy: { fontSize: 22, lineHeight: 38, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
} as const
export const elevation = {
  card: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' },
} as const
