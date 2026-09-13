import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const hashes = {
  Regular: '2c489e2ed0cd0fe7a302e5e04cab452633afe77a51e96a4592eb2ef533300cf3',
  Bold: 'e7e59b075ee1cb526fe570491325c60574878b18756e83bff784bccc653de043',
}
// Verify unchanged release bytes, static SFNT tables and actual cmap glyph mappings.
const sample = 'Հայր մեր, որ յերկինս ես։ Տէ՛ր, ողորմեա՜։ Ինչո՞ւ։ Հա\u0301յր Ա\u0304 ա\u0301'
for (const [weight, hash] of Object.entries(hashes)) {
  const b = readFileSync(new URL(`../assets/fonts/NotoSerifArmenian-${weight}.ttf`, import.meta.url))
  assert.equal(createHash('sha256').update(b).digest('hex'), hash)
  const tables = new Map()
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const pos = 12 + i * 16
    tables.set(b.toString('ascii', pos, pos + 4), b.readUInt32BE(pos + 8))
  }
  assert(!tables.has('fvar'), 'Variable fonts are forbidden')
  const cmap = tables.get('cmap')
  assert(cmap)
  const glyphs = new Set()
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const sub = cmap + b.readUInt32BE(cmap + 8 + i * 8)
    if (b.readUInt16BE(sub) !== 4) continue
    const count = b.readUInt16BE(sub + 6) / 2
    for (let seg = 0; seg < count; seg++) {
      const end = b.readUInt16BE(sub + 14 + seg * 2)
      const start = b.readUInt16BE(sub + 16 + count * 2 + seg * 2)
      const delta = b.readInt16BE(sub + 16 + count * 4 + seg * 2)
      const rangePos = sub + 16 + count * 6 + seg * 2
      const range = b.readUInt16BE(rangePos)
      for (let c = start; c <= end; c++) {
        let glyph = range ? b.readUInt16BE(rangePos + range + (c - start) * 2) : (c + delta) & 0xffff
        if (range && glyph) glyph = (glyph + delta) & 0xffff
        if (glyph) glyphs.add(c)
      }
    }
  }
  for (const char of sample) assert(glyphs.has(char.codePointAt(0)), `${weight} missing U+${char.codePointAt(0).toString(16)}`)
  console.log(`${weight}: static, release SHA-256 matches, Grabar / punctuation / U+0301 / U+0304 covered`)
}

for (const [file, hash] of [
  ['SourceSerif4-Regular.ttf', 'e5a4ee6a3d87bb9024796be390c6771e2a0eb1883dae25effaf57ca01668e24b'],
  ['SourceSerif4-Semibold.ttf', '36db62940cb5728b12b1802476dc7fcf4c6c519a7bdd476ba23a4e555fc4655f'],
]) {
  const b = readFileSync(new URL('../assets/fonts/' + file, import.meta.url))
  assert.equal(createHash('sha256').update(b).digest('hex'), hash)
  const tables = new Set()
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const pos = 12 + i * 16
    tables.add(b.toString('ascii', pos, pos + 4))
  }
  assert(!tables.has('fvar'), file + ' must remain static')
  assert(tables.has('cmap'), file + ' must contain a character map')
  console.log(file + ': static, release SHA-256 matches')
}
assert(readFileSync(new URL('../assets/fonts/OFL.txt', import.meta.url), 'utf8').includes('Copyright 2022 The Noto Project Authors'))
assert(readFileSync(new URL('../assets/fonts/SourceSerif-LICENSE.md', import.meta.url), 'utf8').includes('Copyright 2014 - 2023 Adobe'))

assert.equal(JSON.parse(readFileSync(new URL('../assets/fonts/license.json', import.meta.url), 'utf8')).text, readFileSync(new URL('../assets/fonts/OFL.txt', import.meta.url), 'utf8'))
