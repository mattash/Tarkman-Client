import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { nativeBuildRequested } from '../../apps/mobile/scripts/native-inputs.mjs'

const groups = ['mobile', 'tv', 'design', 'legacy-web']
const regularModes = new Set(['000000', '100644', '100755'])
const mobileSource = /^apps\/mobile\/(app|components|design|features|tests|public|assets)\//
const tvSource = /^apps\/tv\/(src|assets|tests|docs)\//
const mobileProbeInputs = /^apps\/mobile\/(package(?:-lock)?\.json|tsconfig\.json)$/
const tvReadsMobile = /^apps\/mobile\/(app\.json|eas\.json|package\.json|assets\/fonts\/)/

function consumers({ path, before, after }) {
  if (![before, after].every(mode => regularModes.has(mode))) {
    return [groups, 'non-regular tree entry']
  }
  if (path.startsWith('packages/tarkman-core/')) return [['mobile', 'tv', 'legacy-web'], 'core package consumers']
  if (path.startsWith('packages/tarkman-reader/')) return [['mobile', 'tv'], 'reader package consumers']
  if (path.startsWith('packages/tarkman-design/')) return [['mobile', 'tv', 'design'], 'design package consumers']
  if (path.startsWith('packages/tarkman-lectionary/')) return [['mobile'], 'lectionary package consumer']
  if (mobileProbeInputs.test(path)) return [groups, 'mobile inputs also used by TV/runtime or legacy core probes; validate broadly']
  if (tvReadsMobile.test(path)) return [['mobile', 'tv'], 'TV identity or font checks read mobile inputs']
  if (mobileSource.test(path)) return [['mobile'], 'mobile source, test or asset']
  if (tvSource.test(path) || ['apps/tv/index.ts', 'apps/tv/README.md'].includes(path)) return [['tv'], 'TV source, test, asset or docs']
  if (path.startsWith('apps/web/')) return [['legacy-web'], 'legacy web app']
  return [groups, 'shared tooling, configuration or unaudited path']
}

export function proposeGroups(changes, title) {
  const reasons = Object.fromEntries(groups.map(group => [group, new Set()]))
  reasons.design.add('keep the existing required design check')
  const override = typeof title !== 'string' ? 'current PR title unavailable'
    : /\[full-ci\]/i.test(title) ? '[full-ci] requested'
    : nativeBuildRequested(title) ? 'preserve [native-build] qualification'
    : !changes.length ? 'empty diff; validate broadly' : null
  if (override) for (const group of groups) reasons[group].add(override)
  const paths = changes.map(change => {
    const [selected, reason] = consumers(change)
    for (const group of selected) reasons[group].add(reason)
    return { ...change, groups: selected, reason }
  })
  return {
    groups: Object.fromEntries(groups.map(group => [group, {
      selected: reasons[group].size > 0,
      reasons: reasons[group].size > 0 ? [...reasons[group]] : ['no affected paths in the verified diff'],
    }])),
    paths,
  }
}

export function changedPaths(data) {
  if (!data.length) return []
  const fields = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data).split('\0')
  if (fields.pop() !== '' || fields.length % 2) throw new Error('Incomplete Git diff')
  const paths = []
  for (let i = 0; i < fields.length; i += 2) {
    const meta = /^:([0-7]{6}) ([0-7]{6}) [a-f0-9]+ [a-f0-9]+ ([ADMT])$/.exec(fields[i])
    const path = fields[i + 1]
    if (!meta || !path) throw new Error('Unexpected Git diff entry')
    paths.push({ path, before: meta[1], after: meta[2], status: meta[3] })
  }
  return paths
}

export function planRevision({ base, head, revision, title, cwd }) {
  if (![base, head, revision].every(sha => typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha))) {
    throw new Error('Expected full event commit IDs')
  }
  const git = (...args) => execFileSync('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 })
  const text = (...args) => git(...args).toString().trim()
  if (text('rev-parse', '--is-shallow-repository') !== 'false') throw new Error('Full Git history is required')
  if (text('rev-parse', 'HEAD') !== revision || text('rev-list', '--parents', '-n', '1', revision) !== `${revision} ${base} ${head}`) {
    throw new Error('Checked-out revision is not the expected PR merge of the event base and head')
  }
  const mergeBase = text('merge-base', '--all', base, head)
  if (!/^[0-9a-f]{40}$/.test(mergeBase)) throw new Error('Cannot identify a unique PR merge base')
  // No rename detection means both paths of moves are present as deletion and addition.
  const diff = (from, to) => changedPaths(git('diff', '--raw', '-z', '--no-renames', '--no-ext-diff', '--ignore-submodules=none', from, to, '--'))
  const pr = diff(mergeBase, head)
  const checkedOut = diff(base, revision)
  const changes = [...new Map([...pr, ...checkedOut].map(change => [JSON.stringify(change), change])).values()]
  return { mode: 'observe', base, mergeBase, head, revision, ...proposeGroups(changes, title) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const plan = planRevision({
    base: event.pull_request.base.sha,
    head: event.pull_request.head.sha,
    revision: process.env.GITHUB_SHA,
    title: process.env.CI_PLAN_TITLE,
  })
  writeFileSync(process.argv[2], JSON.stringify(plan, null, 2) + '\n')
  const summary = [
    '### Proposed affected jobs (observation only)',
    '',
    `PR head: \`${plan.head}\` · tested merge: \`${plan.revision}\` · ${plan.paths.length} diff entries`,
    '',
    ...Object.entries(plan.groups).map(([group, { selected, reasons }]) =>
      `- **${group}** — would ${selected ? 'run' : 'omit'}: ${reasons.join('; ')}`),
    '',
    'The affected-job-plan artifact contains the complete classified diff. No existing job is gated by this plan.',
    '',
  ].join('\n')
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
}
