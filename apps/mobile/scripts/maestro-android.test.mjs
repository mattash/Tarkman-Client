import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { EventEmitter } from 'node:events'
import { readFileSync, rmSync, statSync } from 'node:fs'
import { basename, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { artifactDirectory, checkServers, command, configureDevice, fixtureFlows, maestroArgs, runChild, sdkPath, selectDevice } from './maestro-android.mjs'

const listing = 'List of devices attached\nemulator-5554 device product:test\n'
test('selects the sole ready device or an explicit ready serial', () => {
  assert.equal(selectDevice(listing), 'emulator-5554')
  assert.equal(selectDevice(`${listing}usb-1 device\n`, 'usb-1'), 'usb-1')
})
test('refuses ambiguity, missing, offline and unauthorized targets', () => {
  for (const output of ['', `${listing}usb-1 device`, 'usb-1 unauthorized', 'emulator-5554 offline', `${listing}usb-1 offline`]) {
    assert.throws(() => selectDevice(output), /exactly one/)
  }
  for (const output of ['', 'usb-1 offline', 'usb-1 unauthorized']) assert.throws(() => selectDevice(output, 'usb-1'), /absent/)
})
test('requires a selected SDK and rejects conflicting SDK roots', () => {
  assert.throws(() => sdkPath({}), /ANDROID_HOME/)
  assert.equal(sdkPath({ ANDROID_HOME: '/tmp' }), '/tmp')
  assert.throws(() => sdkPath({ ANDROID_HOME: '/tmp', ANDROID_SDK_ROOT: '/' }), /different SDKs/)
})
function device(overrides = {}) {
  const calls = []
  const answers = {
    'shell getprop sys.boot_completed': '1',
    'shell pm path app.tarkman': 'package:/data/app/base.apk',
    'shell dumpsys package app.tarkman': 'flags=[ DEBUGGABLE ]',
    'reverse --list': '',
    ...overrides,
  }
  return { calls, adb: args => { calls.push(args.join(' ')); return answers[args.join(' ')] ?? '' } }
}
test('reverses exactly the two required ports and grants camera', () => {
  const { adb, calls } = device()
  configureDevice(adb)
  assert.deepEqual(calls.slice(-3), [
    'reverse --no-rebind tcp:8081 tcp:8081', 'reverse --no-rebind tcp:8100 tcp:8100',
    'shell pm grant app.tarkman android.permission.CAMERA',
  ])
})
test('preserves existing matching reverses and rejects conflicts before mutations', () => {
  const existing = device({ 'reverse --list': 'UsbFfs tcp:8081 tcp:8081\nUsbFfs tcp:8100 tcp:8100' })
  configureDevice(existing.adb)
  assert.equal(existing.calls.filter(call => call.includes('--no-rebind')).length, 0)
  const conflict = device({ 'reverse --list': 'UsbFfs tcp:8100 tcp:9999' })
  assert.throws(() => configureDevice(conflict.adb), /Conflicting/)
  assert.equal(conflict.calls.some(call => call.includes('--no-rebind') || call.includes('grant')), false)
})
test('fails before device mutations for incomplete boot, missing app or release app', () => {
  for (const overrides of [
    { 'shell getprop sys.boot_completed': '0' },
    { 'shell pm path app.tarkman': '' },
    { 'shell dumpsys package app.tarkman': 'flags=[ SYSTEM ]' },
  ]) {
    const { adb, calls } = device(overrides)
    assert.throws(() => configureDevice(adb))
    assert.equal(calls.some(call => call.startsWith('reverse') || call.includes('grant')), false)
  }
})
test('only includes standalone fixture flows', () => {
  assert.deepEqual(fixtureFlows, ['join', 'languages', 'explanations', 'auth', 'controls', 'onboarding'])
})

// These checks never invoke Maestro, adb, or a device.
test('checks Metro on localhost and the fresh fixture on IPv4 loopback', async () => {
  const session = { id: 9001, current_part_position: 1, current_part_id: 901, status: 'active' }
  const requests = []
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const responses = body => async (url, options) => {
    requests.push(url)
    assert.ok(options.signal instanceof AbortSignal)
    if (url === 'http://localhost:8081/status') return new Response('packager-status:running\n')
    assert.equal(url, 'http://127.0.0.1:8100/services.json')
    return response(body)
  }
  await checkServers(responses([{ session }]))
  assert.deepEqual(requests, ['http://localhost:8081/status', 'http://127.0.0.1:8100/services.json'])
  for (const body of [
    [], { message: 'No sessions today' }, { sessions: [{ session }] }, [null],
    [{ session }, { session }], [{ session: { ...session, id: 4006 } }],
    [{ session: { ...session, current_part_position: 2 } }],
    [{ session: { ...session, current_part_id: 902 } }],
    [{ session: { ...session, status: 'ended' } }],
  ]) await assert.rejects(checkServers(responses(body)), /fresh single-service fixture/)
})

test('rejects unavailable, non-Metro, HTTP-error and malformed server responses', async () => {
  await assert.rejects(checkServers(async () => { throw new Error('connection refused') }), /prerequisite failed.*connection refused/)
  for (const status of [200, 503]) {
    await assert.rejects(checkServers(async () => new Response('wrong server', { status })), /Metro not ready/)
  }
  for (const response of [new Response('not json'), new Response('[]', { status: 503 })]) {
    await assert.rejects(checkServers(async url => url.endsWith('/status') ? new Response('packager-status:running') : response), /prerequisite failed/)
  }
})

test('uses test --udid, one shard, explicit artifacts and only standalone fixtures', () => {
  const output = '/tmp/maestro artifacts'
  const args = maestroArgs('emulator-5554', output)
  assert.deepEqual(args.slice(0, 13), [
    'test', '--udid', 'emulator-5554', '-s', '1', '--test-output-dir', output,
    '--debug-output', `${output}/debug`, '--format', 'JUNIT', '--output', `${output}/report.xml`,
  ])
  assert.deepEqual(args.slice(13).map(path => basename(path)), fixtureFlows.map(name => `fixture-${name}.yaml`))
  assert.ok(args.slice(13).every(isAbsolute))
})

test('creates artifacts outside the repository and rejects a repo TMPDIR', () => {
  const directory = artifactDirectory(tmpdir())
  try { assert.ok(statSync(directory).isDirectory()) } finally { rmSync(directory, { recursive: true }) }
  assert.throws(() => artifactDirectory(fileURLToPath(new URL('../', import.meta.url))), /outside the repository/)
})

test('reports prerequisite command errors, nonzero status and signals', () => {
  assert.equal(command(process.execPath, ['-e', 'process.stdout.write("ok")']), 'ok')
  assert.throws(() => command('/nonexistent/tarkman-command', []), /ENOENT/)
  assert.throws(() => command(process.execPath, ['-e', 'process.exit(7)']), /status 7/)
  assert.throws(() => command(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM")']), /signal SIGTERM/)
})

test('propagates child success, failure, signal and spawn errors; removes listeners', async () => {
  const signals = new EventEmitter()
  for (const [source, expected] of [
    ['process.exit(0)', 0], ['process.exit(9)', 9],
    ['process.kill(process.pid, "SIGINT")', 130],
    ['process.kill(process.pid, "SIGTERM")', 143],
    ['process.kill(process.pid, "SIGKILL")', 137],
  ]) {
    assert.equal(await runChild(process.execPath, ['-e', source], { stdio: 'ignore' }, signals), expected)
    assert.equal(signals.listenerCount('SIGINT'), 0)
    assert.equal(signals.listenerCount('SIGTERM'), 0)
  }
  await assert.rejects(runChild('/nonexistent/tarkman-maestro', [], {}, signals), /ENOENT/)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('forwards cancellation only to the child it started', async () => {
  for (const [signal, expected] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    const signals = new EventEmitter()
    const result = runChild(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }, signals)
    signals.emit(signal)
    assert.equal(await result, expected)
    assert.equal(signals.listenerCount(signal), 0)
  }
})

test('shared YAML parses with platform-scoped reset and keyboard behavior', () => {
  const readFlow = name => yaml.loadAll(readFileSync(new URL(`../maestro/${name}.yaml`, import.meta.url), 'utf8'))
  for (const name of [...fixtureFlows.map(name => `fixture-${name}`), 'launch', 'fixture-open-service', 'fixture-sign-in']) {
    const [config, commands] = readFlow(name)
    assert.equal(config.appId, 'app.tarkman')
    assert.ok(Array.isArray(commands))
  }
  const [, launch] = readFlow('launch')
  const branches = launch.filter(command => command.runFlow).map(command => command.runFlow)
  assert.deepEqual(branches.map(branch => branch.when.platform), ['iOS', 'Android'])
  assert.deepEqual(branches[0].commands, [
    { launchApp: { clearState: false } },
    { openLink: { link: 'exp+tarkman://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' } },
  ])
  // Keep the deep link cold and require both overlay controls before app assertions.
  assert.deepEqual(branches[1].commands, [
    'clearState',
    { setPermissions: { permissions: { camera: 'allow' } } },
    { openLink: { link: 'tarkman://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' } },
    { extendedWaitUntil: { visible: 'Continue', timeout: 60000 } },
    { tapOn: { text: 'Continue' } },
    { extendedWaitUntil: { visible: 'Close', timeout: 15000 } },
    { scrollUntilVisible: { element: { text: 'Tools button' }, direction: 'DOWN' } },
    { tapOn: 'Tools button' },
    { tapOn: { text: 'Close' } },
  ])
  assert.deepEqual(launch.slice(2), [
    { tapOn: { text: 'Open', optional: true } },
    { extendedWaitUntil: { visible: 'Today', timeout: 60000 } },
  ])
  // Device Metro traffic must use adb reverse, independently of host readiness checks.
  assert.equal(new URL(branches[1].commands[2].openLink.link).searchParams.get('url'), 'http://127.0.0.1:8081')
  const [, open] = readFlow('fixture-open-service')
  // Android types into the autoFocused field without tapping it under the keyboard.
  // Keep iOS's explicit field tap and Go submission, in their original order.
  assert.deepEqual(open.slice(0, -2), [
    { runFlow: 'launch.yaml' },
    { tapOn: { id: 'today-scan' } },
    { tapOn: { id: 'scan-session-id' } },
    { runFlow: { when: { platform: 'iOS' }, commands: [{ tapOn: { id: 'session-id' } }] } },
    { inputText: '9001' },
    { runFlow: { when: { platform: 'iOS' }, commands: [{ tapOn: 'Go' }] } },
    { runFlow: { when: { platform: 'Android' }, commands: ['hideKeyboard', { tapOn: 'Open session' }] } },
  ])
})
