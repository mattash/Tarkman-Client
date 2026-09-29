// Classifies a PR's mobile changes and fingerprints each platform's native build inputs
// for CI (#204). A successful iOS or Android compile is recorded under the fingerprint of
// the tree it built; a later run of the same PR with an identical fingerprint may reuse
// that result instead of compiling again. Other changes retain the Linux bundle
// smoke checks and the unconditional mobile validation job on every head.
//
// Usage (from the repository root, in a full-history checkout of the PR merge commit):
//   node apps/mobile/scripts/native-inputs.mjs --platform ios --base <sha> --head <sha> [--tree HEAD] [--salt <text>]
// Add --title <PR title> to opt in with [native-build].
// Prints mobile=, native=, requested= and fingerprint= lines, suitable for $GITHUB_OUTPUT.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'

export const platforms = ['ios', 'android']

// Paths whose change makes a PR mobile-relevant at all.
export const mobilePathspecs = [
  'apps/mobile/',
  'packages/tarkman-core/',
  'packages/tarkman-design/',
  'packages/tarkman-reader/',
  'packages/tarkman-lectionary/',
  'tools/metro/',
  '.github/workflows/node.js.yml',
]

// Native build inputs shared by both platforms. The workflow pins the runners and
// toolchains, and this script decides what is native, so both count as inputs.
// CI runs Expo prebuild + xcodebuild/Gradle directly, without an EAS profile.
// eas.json and .easignore affect EAS builds/uploads, not these compiles. The
// check-store-config script only asserts configuration in the Linux mobile job.
// If prebuild/plugins start consuming those files, add them back as inputs.
const sharedNativePatterns = [
  /^\.github\/workflows\/node\.js\.yml$/,
  /^apps\/mobile\/scripts\/native-inputs\.mjs$/,
  /^apps\/mobile\/(app\.json|package\.json|package-lock\.json|npm-shrinkwrap\.json)$/,
  /^apps\/mobile\/app\.config\.[^/]+$/,
  /^apps\/mobile\/app\.plugin\.[^/]+$/,
  /^apps\/mobile\/(plugins|config-plugins|assets\/icons)\//,
]

const platformNativePatterns = {
  ios: [/^apps\/mobile\/ios\//],
  android: [/^apps\/mobile\/android\//],
}

export function isNativeInput(path, platform) {
  assertPlatform(platform)
  return [...sharedNativePatterns, ...platformNativePatterns[platform]].some(pattern => pattern.test(path))
}

// `git ls-tree -r` lines are "<mode> <type> <object>\t<path>"; the object IDs pin content.
export function fingerprint(treeListing, platform, salt = '') {
  assertPlatform(platform)
  const entries = treeListing
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const tab = line.indexOf('\t')
      const [mode, , object] = line.slice(0, tab).split(' ')
      return { mode, object, path: line.slice(tab + 1) }
    })
    .filter(({ path }) => isNativeInput(path, platform))
    .map(({ mode, object, path }) => `${mode} ${object} ${path}`)
    .sort()
  if (entries.length === 0) {
    throw new Error(`No ${platform} native inputs found; refusing to fingerprint an empty set.`)
  }
  const hash = createHash('sha256')
  hash.update(`tarkman-native-inputs v1\nplatform ${platform}\nsalt ${salt}\n`)
  for (const entry of entries) {
    hash.update(`${entry}\n`)
  }
  return hash.digest('hex')
}

// Only valid numeric release-version edits receive this exception. Missing/invalid
// JSON or versions, file additions/deletions, and every other field remain native.
export function isVersionOnlyChange(path, before, after) {
  if (!['apps/mobile/app.json', 'apps/mobile/package.json'].includes(path)) return false
  try {
    const previous = JSON.parse(before)
    const next = JSON.parse(after)
    const a = path.endsWith('/app.json') ? previous.expo : previous
    const b = path.endsWith('/app.json') ? next.expo : next
    const version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
    if (typeof a?.version !== 'string' || typeof b?.version !== 'string' ||
        !version.test(a.version) || !version.test(b.version) || a.version === b.version) return false
    delete a.version
    delete b.version
    return isDeepStrictEqual(previous, next)
  } catch {
    return false
  }
}

/** The PR title tag that opts a PR into native compiles: iOS, Android and tvOS (apps/tv). */
export function nativeBuildRequested(title = '') {
  return /\[native-build\]/i.test(title)
}

export function classify({ platform, base, head, tree = 'HEAD', salt = '', title = '', git = runGit }) {
  assertPlatform(platform)
  // Disable rename detection so moving a file out of mobile still counts as a change.
  // Git pathspecs avoid API pagination and changed-file count limits.
  const changed = git(['diff', '--no-renames', '--name-only', `${base}...${head}`, '--', ...mobilePathspecs])
    .split('\n')
    .filter(Boolean)
  const requested = nativeBuildRequested(title)
  const mergeBase = git(['merge-base', base, head]).trim()
  const native = changed.some(path => {
    if (!isNativeInput(path, platform)) return false
    if (!['apps/mobile/app.json', 'apps/mobile/package.json'].includes(path)) return true
    try {
      return !isVersionOnlyChange(path, git(['show', `${mergeBase}:${path}`]), git(['show', `${head}:${path}`]))
    } catch {
      return true
    }
  })
  return {
    mobile: changed.length > 0 || requested,
    native,
    requested,
    fingerprint: fingerprint(git(['ls-tree', '-r', '--full-tree', tree]), platform, salt),
  }
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function assertPlatform(platform) {
  if (!platforms.includes(platform)) {
    throw new Error(`Unknown platform: ${platform}`)
  }
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`Expected --name value pairs, got: ${argv.join(' ')}`)
    }
    options[name.slice(2)] = value
  }
  if (!options.platform || !options.base || !options.head) {
    throw new Error('--platform, --base and --head are required.')
  }
  return options
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = classify(parseArgs(process.argv.slice(2)))
  for (const [key, value] of Object.entries(result)) {
    console.log(`${key}=${value}`)
  }
}
