import { readFile, writeFile } from 'node:fs/promises'

const tokensPath = new URL('../tokens.json', import.meta.url)
const outputPath = new URL('../web.css', import.meta.url)
const tokens = JSON.parse(await readFile(tokensPath, 'utf8'))

const properties = {
  surfaceCanvas: 'surface-canvas',
  surfaceDefault: 'surface-default',
  surfaceRaised: 'surface-raised',
  surfaceOverlay: 'surface-overlay',
  textPrimary: 'text-primary',
  textSecondary: 'text-secondary',
  actionPrimary: 'action-primary',
  actionOnPrimary: 'action-on-primary',
  actionHover: 'action-hover',
  actionPressed: 'action-pressed',
  selection: 'selection',
  onSelection: 'on-selection',
  borderDivider: 'border-divider',
  borderControl: 'border-control',
  focus: 'focus',
  disabled: 'disabled',
  onDisabled: 'on-disabled',
  success: 'success',
  successSurface: 'success-surface',
  warning: 'warning',
  warningSurface: 'warning-surface',
  danger: 'danger',
  dangerSurface: 'danger-surface',
  info: 'info',
  infoSurface: 'info-surface',
  shadowRaised: 'shadow-raised',
  shadowOverlay: 'shadow-overlay',
}

const block = (selector, theme, colorScheme) => {
  const declarations = Object.entries(properties)
    .map(([key, property]) => `  --reading-${property}: ${tokens.themes[theme][key]};`)
    .join('\n')
  return `${selector} {\n${declarations}\n  color-scheme: ${colorScheme};\n}`
}

const output = [
  '/* Generated from tokens.json. Run npm run check --prefix packages/tarkman-design to verify. */',
  block(".tarkman-design,\nhtml[data-tarkman-reading-theme='light']", 'light', 'light'),
  block(".tarkman-design[data-theme='dark'],\nhtml[data-tarkman-reading-theme='dark'],\nhtml[data-tarkman-reading-theme='dark'] .tarkman-design", 'dark', 'dark'),
  '',
].join('\n\n')

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== output) {
    console.error('Generated web.css is stale. Run the design package build.')
    process.exitCode = 1
  }
} else {
  await writeFile(outputPath, output)
}
