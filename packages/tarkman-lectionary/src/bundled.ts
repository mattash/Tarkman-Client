import { createLectionary, type DatasetManifest } from './index'

// Explicit module literals work in Metro and web bundlers. This is module loading,
// not filesystem access. Native bundling does not imply separate downloaded chunks.
declare const require: (id: string) => unknown
const manifest = require('../data/manifest.json') as DatasetManifest
export const bundledLectionary = createLectionary({
  manifest,
  loadYear(year, language) {
    if (year === 2026 && language === 'en') return require('../data/2026-en.json')
    if (year === 2026 && language === 'hy') return require('../data/2026-hy.json')
    if (year === 2027 && language === 'en') return require('../data/2027-en.json')
    if (year === 2027 && language === 'hy') return require('../data/2027-hy.json')
    return null
  },
})
