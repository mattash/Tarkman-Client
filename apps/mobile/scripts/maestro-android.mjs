#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { accessSync, constants, mkdtempSync, realpathSync } from 'node:fs'
import { constants as osConstants, tmpdir } from 'node:os'
import { delimiter, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobile = fileURLToPath(new URL('../', import.meta.url))
export const fixtureFlows = ['join', 'languages', 'explanations', 'auth', 'controls', 'onboarding']

export function selectDevice(output, requested) {
  const devices = output.split(/\r?\n/).map(line => line.trim().split(/\s+/))
    .filter(([, state]) => ['device', 'offline', 'unauthorized'].includes(state))
  if (requested) {
    const found = devices.find(([serial]) => serial === requested)
    if (found?.[1] !== 'device') throw new Error(`Device ${requested} is absent, offline, or unauthorized. Check adb devices -l.`)
    return requested
  }
  if (devices.length !== 1 || devices[0][1] !== 'device') {
    throw new Error('Expected exactly one ready Android device. Start/unlock an emulator or pass --device SERIAL (adb devices -l).')
  }
  return devices[0][0]
}

export function sdkPath(env) {
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT
  if (!sdk) throw new Error('Set ANDROID_HOME to the Android SDK containing platform-tools/adb.')
  if (env.ANDROID_HOME && env.ANDROID_SDK_ROOT && realpathSync(env.ANDROID_HOME) !== realpathSync(env.ANDROID_SDK_ROOT)) {
    throw new Error('ANDROID_HOME and ANDROID_SDK_ROOT point to different SDKs. Select one SDK.')
  }
  return resolve(sdk)
}

export function command(binary, args, env = process.env) {
  const result = spawnSync(binary, args, { encoding: 'utf8', env, timeout: 30000 })
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} ${args.join(' ')} failed (status ${result.status}, signal ${result.signal}): ${result.error?.message || result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

export function configureDevice(adb) {
  if (adb(['shell', 'getprop', 'sys.boot_completed']).trim() !== '1') throw new Error('Android is still booting. Wait for its home screen and retry.')
  if (!adb(['shell', 'pm', 'path', 'app.tarkman']).includes('package:')) throw new Error('Install an app.tarkman Android development APK first (see README).')
  if (!adb(['shell', 'dumpsys', 'package', 'app.tarkman']).includes('DEBUGGABLE')) throw new Error('app.tarkman must be a debuggable development client, not a release build.')
  const mappings = adb(['reverse', '--list']).split(/\r?\n/).map(line => line.trim().split(/\s+/))
  // Check both ports before making any changes; never overwrite another mapping.
  for (const port of [8081, 8100]) {
    const mapping = mappings.find(fields => fields.at(-2) === `tcp:${port}`)
    if (mapping && mapping.at(-1) !== `tcp:${port}`) throw new Error(`Conflicting adb reverse for tcp:${port}; remove it explicitly before retrying.`)
  }
  for (const port of [8081, 8100]) {
    if (!mappings.some(fields => fields.at(-2) === `tcp:${port}`)) adb(['reverse', '--no-rebind', `tcp:${port}`, `tcp:${port}`])
  }
  adb(['shell', 'pm', 'grant', 'app.tarkman', 'android.permission.CAMERA'])
}

export async function checkServers(fetchResponse = fetch) {
  try {
    // Expo --localhost may bind only ::1 on the host; the device still uses IPv4 via adb reverse.
    const status = await fetchResponse('http://localhost:8081/status', { signal: AbortSignal.timeout(3000) })
    if (!status.ok || (await status.text()).trim() !== 'packager-status:running') throw new Error('Metro not ready')
    const response = await fetchResponse('http://127.0.0.1:8100/services.json', { signal: AbortSignal.timeout(3000) })
    const services = await response.json()
    const session = Array.isArray(services) && services.length === 1 ? services[0]?.session : null
    if (!response.ok || session?.id !== 9001 || session?.current_part_position !== 1 || session?.current_part_id !== 901 || session?.status !== 'active') {
      throw new Error('Expected a fresh single-service fixture at part 1')
    }
  } catch (error) {
    throw new Error(`Fixture/Metro prerequisite failed: ${error.message}. Start fresh servers with the exact README environment; Metro status cannot verify bundled API URLs.`, { cause: error })
  }
}

export function artifactDirectory(base = tmpdir()) {
  const path = relative(realpathSync(resolve(mobile, '../..')), realpathSync(base))
  if (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`)) {
    throw new Error('Temporary directory must be outside the repository. Set TMPDIR to an external directory.')
  }
  return mkdtempSync(join(base, 'tarkman-maestro-android-'))
}

export function maestroArgs(serial, output) {
  // Maestro 2.10.0 `test --help`: device selection belongs to the test command.
  return ['test', '--udid', serial, '-s', '1', '--test-output-dir', output,
    '--debug-output', join(output, 'debug'), '--format', 'JUNIT', '--output', join(output, 'report.xml'),
    ...fixtureFlows.map(name => join(mobile, 'maestro', `fixture-${name}.yaml`))]
}

export async function runChild(binary, args, options, signals = process) {
  const child = spawn(binary, args, options)
  // Only signal this child. Servers and emulator are caller-owned.
  const interrupt = () => child.kill('SIGINT')
  const terminate = () => child.kill('SIGTERM')
  signals.on('SIGINT', interrupt)
  signals.on('SIGTERM', terminate)
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => resolve(code ?? (128 + (osConstants.signals[signal] ?? 1))))
    })
  } finally {
    signals.off('SIGINT', interrupt)
    signals.off('SIGTERM', terminate)
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length && (args.length !== 2 || args[0] !== '--device' || !args[1] || args[1].startsWith('-'))) {
    throw new Error('Usage: npm run maestro:android -- [--device SERIAL]')
  }
  const sdk = sdkPath(process.env)
  const adbBinary = join(sdk, 'platform-tools', 'adb')
  accessSync(adbBinary, constants.X_OK)
  if (!process.env.JAVA_HOME) throw new Error('Set JAVA_HOME to OpenJDK 17 before running Maestro.')
  accessSync(join(process.env.JAVA_HOME, 'bin', 'java'), constants.X_OK)
  const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, PATH: [join(process.env.JAVA_HOME, 'bin'), join(sdk, 'platform-tools'), process.env.PATH].join(delimiter) }
  command('maestro', ['--version'], env)
  const serial = selectDevice(command(adbBinary, ['devices', '-l'], env), args[1] || process.env.ANDROID_SERIAL)
  const adb = args => command(adbBinary, ['-s', serial, ...args], env)
  await checkServers()
  const output = artifactDirectory()
  configureDevice(adb)
  console.log(`Android: ${serial}\nMaestro artifacts: ${output}\nUsing existing fixture and Metro; reverse mappings and camera grant remain for reruns.`)
  process.exitCode = await runChild('maestro', maestroArgs(serial, output), {
    cwd: output, env: { ...env, ANDROID_SERIAL: serial }, stdio: 'inherit',
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Android Maestro: ${error.message}`); process.exitCode = 1 })
}
