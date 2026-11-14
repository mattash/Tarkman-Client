import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASE = 'd459fa5e9e2685b7cbc9f8e79605e0bc2f4b2b1d'
const here = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(here, '../..')

export function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`Expected exactly one layout/config anchor: ${before}`)
  return text.replace(before, after)
}

export function validateDestination(destination, repo = repository) {
  if (!destination || !path.isAbsolute(destination)) throw new Error('Output directory must be an explicit absolute path')
  const output = path.resolve(destination)
  const root = fs.realpathSync(repo)
  if (output === root || output.startsWith(`${root}${path.sep}`)) throw new Error('Output directory must be outside the repository')
  if (fs.existsSync(output) || fs.lstatSync(path.dirname(output)).isSymbolicLink()) throw new Error('Output must be NEW and its parent must not be a symlink')
  // Reject symlinks in any existing ancestor, including dangling output symlinks.
  if (fs.realpathSync(path.dirname(output)) !== path.dirname(output)) throw new Error('Output ancestors must not contain symlinks')
  try { fs.lstatSync(output); throw new Error('Output already exists (including symlinks)') } catch (error) { if (error.code !== 'ENOENT') throw error }
  return output
}

function run(command, args, cwd, options = {}) {
  return execFileSync(command, args, { cwd, stdio: 'inherit', ...options })
}

function copyNewTree(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Overlay symlink rejected: ${from}`)
    if (entry.isDirectory()) { fs.mkdirSync(to, { recursive: true }); copyNewTree(from, to) }
    else if (entry.isFile()) fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL)
    else throw new Error(`Unsupported overlay entry: ${from}`)
  }
}

export function prepare({ destination, baseline = false, install = true }) {
  const output = validateDestination(destination)
  // Only immutable, pinned tracked files. Never copy local node_modules, credentials, or native output.
  const tree = run('git', ['ls-tree', '-r', BASE, '--', 'apps/mobile', 'packages', 'tools/metro', 'vercel.json'], repository, { stdio: 'pipe', encoding: 'utf8' })
  if (tree.split('\n').some(line => line.startsWith('120000 '))) throw new Error('Pinned archive contains a symlink')
  const archive = run('git', ['archive', BASE, 'apps/mobile', 'packages', 'tools/metro', 'vercel.json'], repository, { stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 })
  fs.mkdirSync(output) // Exclusive: never overwrite, reuse, or delete any destination.
  run('tar', ['-xf', '-', '-C', output], repository, { input: archive, stdio: ['pipe', 'inherit', 'inherit'] })
  const mobile = path.join(output, 'apps/mobile')
  if (baseline) {
    const config = fs.readFileSync(path.join(here, 'overlay/apps/mobile/app.config.js'), 'utf8')
    fs.writeFileSync(path.join(mobile, 'app.config.js'), replaceOnce(config, 'const baseline = false;', 'const baseline = true;'), { flag: 'wx' })
  } else {
    copyNewTree(path.join(here, 'overlay'), output)
    const layout = path.join(mobile, 'app/_layout.tsx')
    let text = fs.readFileSync(layout, 'utf8')
    text = replaceOnce(text, "import '../global.css'", "import '../global.css'\nimport { OpeningIntentHandler } from '../features/siri/OpeningIntentHandler'")
    text = replaceOnce(text, '    <OnboardingNavigation />', '    <OnboardingNavigation />\n    <OpeningIntentHandler />')
    fs.writeFileSync(layout, text)
  }
  fs.writeFileSync(path.join(output, 'siri-spike-preparation.json'), JSON.stringify({ base: BASE, baseline, nativeDependency: baseline ? null : 'expo-app-intents@0.5.17' }, null, 2) + '\n', { flag: 'wx' })
  if (install) {
    run('npm', ['ci'], mobile)
    if (!baseline) run('npm', ['install', '--save-exact', 'expo-app-intents@0.5.17'], mobile)
  }
  console.log(`Prepared ${baseline ? 'baseline' : 'Siri prototype'}: ${mobile}`)
  return output
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const baseline = args.includes('--baseline')
  const positional = args.filter(arg => arg !== '--baseline')
  if (positional.length !== 1 || positional[0].startsWith('--')) {
    console.error('Usage: node spikes/siri-shortcuts/prepare.mjs [--baseline] /absolute/NEW/output-directory')
    process.exitCode = 1
  } else {
    try { prepare({ destination: positional[0], baseline }) }
    catch (error) { console.error(error.message); console.error('No cleanup attempted; partial output, if any, is left for inspection. Choose a NEW path for retry.'); process.exitCode = 1 }
  }
}
