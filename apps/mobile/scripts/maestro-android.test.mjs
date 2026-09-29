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

const readFlow = name => yaml.loadAll(readFileSync(new URL(`../maestro/${name}.yaml`, import.meta.url), 'utf8'))

test('shared YAML parses as exactly a config and command document', () => {
  for (const name of [...fixtureFlows.map(name => `fixture-${name}`), 'launch', 'fixture-open-service', 'fixture-sign-in']) {
    const documents = readFlow(name)
    assert.equal(documents.length, 2)
    const [config, commands] = documents
    assert.equal(config.appId, 'app.tarkman')
    assert.ok(Array.isArray(commands))
  }
})

test('launch resets only Android, grants camera before the cold link, and never clears data on retry', () => {
  const [, launch] = readFlow('launch')
  assert.deepEqual(launch[0], {
    runFlow: { when: { platform: 'Android' }, commands: [
      'clearState', { setPermissions: { permissions: { camera: 'allow' } } },
    ] },
  })
  const handoff = launch[1].retry
  assert.equal(handoff.maxRetries, 1)
  assert.deepEqual(handoff.commands[1], {
    runFlow: { when: { platform: 'Android' }, commands: [
      { openLink: { link: 'tarkman://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' } },
    ] },
  })
  const visit = commands => {
    for (const command of commands) {
      assert.notEqual(command, 'clearState')
      assert.equal(Object.hasOwn(command, 'clearState'), false)
      if (command.launchApp) assert.equal(command.launchApp.clearState, false)
      if (command.runFlow?.commands) visit(command.runFlow.commands)
      if (command.retry?.commands) visit(command.retry.commands)
    }
  }
  visit(launch.slice(1))
})

test('iOS has exactly one cold link inside retry after stop, without launchApp', () => {
  const [, launch] = readFlow('launch')
  const handoff = launch[1].retry
  assert.equal(handoff.maxRetries, 1)
  assert.deepEqual(handoff.commands[0], {
    runFlow: { when: { platform: 'iOS' }, commands: [
      'stopApp',
      { openLink: { link: 'exp+tarkman://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' } },
    ] },
  })
  const launches = []
  const visit = commands => {
    for (const command of commands) {
      if (command === 'launchApp' || Object.hasOwn(command, 'launchApp')) launches.push(command)
      if (command.runFlow?.commands) visit(command.runFlow.commands)
      if (command.retry?.commands) visit(command.retry.commands)
    }
  }
  visit(launch)
  assert.equal(launches.length, 0)
  // The only iOS link is in the fresh-process branch, regardless of prior route.
  assert.equal(JSON.stringify(launch).split('exp+tarkman://').length - 1, 1)
})

test('handoff waits before conditional Continue and retries home/transient absence without requiring Close', () => {
  const [, launch] = readFlow('launch')
  assert.deepEqual(launch[1].retry.commands.slice(2), [
    { tapOn: { text: 'Open', optional: true } },
    { extendedWaitUntil: { visible: 'Continue|Close|close|xmark|Tools|Today', timeout: 60000 } },
    { runFlow: { when: { visible: 'Continue' }, commands: [
      { tapOn: 'Continue' }, { waitForAnimationToEnd: { timeout: 5000 } }, { assertNotVisible: 'Continue' },
    ] } },
    { extendedWaitUntil: { visible: 'Close|close|xmark|Tools|Today', timeout: 15000 } },
  ])
  // Both waits accept an already-loaded app/menu; only the initial wait accepts onboarding.
  const waits = launch[1].retry.commands.filter(command => command.extendedWaitUntil).map(command => command.extendedWaitUntil)
  for (const wait of waits) {
    const selector = new RegExp(`^(?:${wait.visible})$`)
    for (const state of ['Today', 'Tools', 'Close', 'close', 'xmark']) assert.ok(selector.test(state))
    for (const state of ['Android home', 'Loading', 'Unable to load script']) assert.equal(selector.test(state), false)
  }
})

test('menu cleanup is conditional, outside retry, disables Tools before closing and requires Today', () => {
  const [, launch] = readFlow('launch')
  const menu = launch[2].runFlow
  assert.deepEqual(menu.when, { visible: 'Close|close|xmark' })
  assert.deepEqual(menu.commands, [
    { scrollUntilVisible: { element: { text: 'Tools button' }, direction: 'DOWN' } },
    { runFlow: { when: { platform: 'Android' }, commands: [{ tapOn: 'Tools button' }] } },
    { runFlow: { when: { platform: 'iOS' }, commands: [
      { runFlow: {
        when: { visible: { text: '1', rightOf: 'Tools button', checked: true } },
        commands: [{ tapOn: { text: '1', rightOf: 'Tools button', checked: true } }],
      } },
      { assertVisible: { text: '0', rightOf: 'Tools button', checked: false } },
    ] } },
    { tapOn: { text: 'Close|close|xmark' } },
    { assertNotVisible: 'Close|close|xmark' },
  ])
  assert.deepEqual(launch.slice(3), [
    { extendedWaitUntil: { visible: 'Today', timeout: 60000 } },
  ])
})

test('returning client with Today and floating Tools skips menu cleanup without touching Tools', () => {
  const [, launch] = readFlow('launch')
  const visible = ['Today', 'Tools']
  const matches = selector => visible.some(text => new RegExp(`^(?:${selector})$`).test(text))
  for (const { extendedWaitUntil: wait } of launch[1].retry.commands) {
    if (wait) assert.ok(matches(wait.visible))
  }
  const menu = launch[2].runFlow
  assert.equal(matches(menu.when.visible), false)
  assert.deepEqual(launch.slice(3), [
    { extendedWaitUntil: { visible: 'Today', timeout: 60000 } },
  ])
  // Guard every nested branch against reopening the floating control or requiring its absence.
  const visit = commands => {
    for (const command of commands) {
      assert.notEqual(command.tapOn?.text ?? command.tapOn, 'Tools')
      assert.notEqual(command.assertNotVisible?.text ?? command.assertNotVisible, 'Tools')
      if (command.runFlow?.commands) visit(command.runFlow.commands)
      if (command.retry?.commands) visit(command.retry.commands)
    }
  }
  visit(launch)
})

test('shared open-service flow keeps platform-scoped keyboard behavior', () => {
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
