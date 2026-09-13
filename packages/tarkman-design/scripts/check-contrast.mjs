// Checks opaque foreground/background token pairs. Does not validate rendered UI or native assets.
import { readFile } from 'node:fs/promises'

const tokens = JSON.parse(await readFile(new URL('../tokens.json', import.meta.url), 'utf8'))

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const surfaces = ['surfaceCanvas', 'surfaceDefault', 'surfaceRaised', 'surfaceOverlay']
const pairs = [
  ...surfaces.flatMap((bg) => ['textPrimary', 'textSecondary'].map((fg) => [fg, bg, 4.5])),
  ...['actionPrimary', 'actionHover', 'actionPressed'].map((bg) => ['actionOnPrimary', bg, 4.5]),
  ['onSelection', 'selection', 4.5],
  // Disabled contrast is a product target, not a WCAG requirement.
  ['onDisabled', 'disabled', 4.5],
  ...['success', 'warning', 'danger', 'info'].map((role) => [role, `${role}Surface`, 4.5]),
  ...surfaces.flatMap((bg) => [['borderControl', bg, 3], ['focus', bg, 3]]),
]

let failures = 0
let total = 0
for (const [theme, colors] of Object.entries(tokens.themes)) {
  for (const [fg, bg, minimum] of pairs) {
    total++
    if (!(fg in colors) || !(bg in colors)) {
      console.error(`${theme}: missing token ${fg in colors ? bg : fg}`)
      failures++
      continue
    }
    const [hi, lo] = [luminance(colors[fg]), luminance(colors[bg])].sort((a, b) => b - a)
    const ratio = (hi + 0.05) / (lo + 0.05)
    if (ratio < minimum) {
      console.error(`${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`)
      failures++
    }
  }
}

console.log(`${total - failures}/${total} token color pairs meet their contrast target.`)
if (failures) process.exitCode = 1
