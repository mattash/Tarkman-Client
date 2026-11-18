import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
test('real Swift classifier preserves canonical validation without persisting speech', { skip: process.platform !== 'darwin' }, () => {
  const swift = path.join(here, 'overlay/apps/mobile/app-intents')
  const intent = fs.readFileSync(path.join(swift, 'OpenLiturgyIntent.swift'), 'utf8')
  const validator = intent.match(/^func isCanonicalLiturgyId\(_ value: String\) -> Bool \{[\s\S]*?^\}/m)?.[0]
  assert.ok(validator, 'compile the actual validator, never a test substitute')
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'tarkman-siri-native-validation-'))
  fs.writeFileSync(path.join(temp, 'Diagnostics.swift'), fs.readFileSync(path.join(swift, 'SiriSpikeDiagnostics.swift')))
  fs.writeFileSync(path.join(temp, 'Validator.swift'), validator)
  fs.writeFileSync(path.join(temp, 'Validation.swift'), `
@main struct Validation {
  @MainActor static func main() {
    let cases: [(String, Bool, String)] = [
      ("1", true, "exact-one"), ("one", false, "english-word-one"), ("One", false, "english-word-one"),
      ("2", true, "other-canonical"), ("9007199254740991", true, "other-canonical"),
      ("0", false, "invalid"), ("-1", false, "invalid"), ("01", false, "invalid"),
      (" 1", false, "invalid"), ("1 ", false, "invalid"), ("1.0", false, "invalid"),
      ("1e2", false, "invalid"), ("9007199254740992", false, "invalid"),
      ("١", false, "invalid"), ("https://evil.example", false, "invalid")
    ]
    for (value, valid, category) in cases {
      precondition(isCanonicalLiturgyId(value) == valid)
      precondition(SiriSpikeDiagnostics.classify(value).rawValue == category)
    }
    // Never call record/recordJS here: do not write host UserDefaults/settings.
    print("15 native classification/validation cases passed")
  }
}
`)
  const binary = path.join(temp, 'validate')
  execFileSync('xcrun', ['swiftc', '-parse-as-library', path.join(temp, 'Diagnostics.swift'), path.join(temp, 'Validator.swift'), path.join(temp, 'Validation.swift'), '-o', binary], { stdio: 'pipe' })
  const result = execFileSync(binary, [], { encoding: 'utf8' })
  assert.match(result, /15 native classification\/validation cases passed/)
})
