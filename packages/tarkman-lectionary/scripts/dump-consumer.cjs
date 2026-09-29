// Feed this output to generate.py --consumer-results for exhaustive Python/API parity.
const { bundledLectionary: library } = require('../dist/bundled.js')
async function main() {
  const results = {}
  for (let year = 2026; year <= 2027; year++) for (let month = 1; month <= 12; month++) for (let day = 1; day <= 31; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const { isCalendarDate } = require('../dist/index.js')
    if (!isCalendarDate(date)) continue
    for (const language of ['en', 'hy']) {
      const result = await library.getDay(date, { language })
      if (!result.ok) throw Error(`${date}/${language}: ${JSON.stringify(result)}`)
      results[`${date}/${language}`] = result.day
    }
  }
  process.stdout.write(JSON.stringify(results))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
