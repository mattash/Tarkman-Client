import { readdir, readFile, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sentryVitePlugin } from '@sentry/vite-plugin'
import { build, loadConfigFromFile, mergeConfig } from 'vite'

const release = 'sentry-release-verification-7f3c9d'
const sentryEnvironmentKeys = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']
const inheritedSentryEnvironment = new Map(
  sentryEnvironmentKeys.map((key) => [key, process.env[key]]),
)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let outputDirectory

async function findJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name)

      if (entry.isDirectory()) {
        return findJavaScriptFiles(entryPath)
      }

      return entry.isFile() && extname(entry.name) === '.js' ? [entryPath] : []
    }),
  )

  return files.flat()
}

try {
  for (const key of sentryEnvironmentKeys) {
    delete process.env[key]
  }

  const configEnvironment = {
    command: 'build',
    mode: 'production',
    isSsrBuild: false,
    isPreview: false,
  }
  const loadedConfig = await loadConfigFromFile(
    configEnvironment,
    resolve(repositoryRoot, 'vite.config.ts'),
    repositoryRoot,
  )

  if (!loadedConfig) {
    throw new Error('Unable to load vite.config.ts')
  }

  outputDirectory = await mkdtemp(join(tmpdir(), 'tarkman-sentry-release-'))

  await build(
    mergeConfig(loadedConfig.config, {
      configFile: false,
      root: repositoryRoot,
      logLevel: 'warn',
      build: {
        outDir: outputDirectory,
        emptyOutDir: true,
      },
      plugins: [
        sentryVitePlugin({
          silent: true,
          telemetry: false,
          sourcemaps: {
            disable: true,
          },
          release: {
            name: release,
            inject: true,
            create: false,
            finalize: false,
            setCommits: false,
            deploy: false,
          },
        }),
      ],
    }),
  )

  const packageJson = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'),
  )
  const packageVersionRelease = `tarkman-client@${packageJson.version}`
  const javaScriptFiles = await findJavaScriptFiles(outputDirectory)
  const emittedJavaScript = (
    await Promise.all(javaScriptFiles.map((file) => readFile(file, 'utf8')))
  ).join('\n')

  if (!emittedJavaScript.includes(release)) {
    throw new Error(`Injected release ${release} was not found in emitted JavaScript`)
  }

  if (emittedJavaScript.includes(packageVersionRelease)) {
    throw new Error(`Obsolete release ${packageVersionRelease} was found in emitted JavaScript`)
  }

  if (emittedJavaScript.includes('VITE_APP_VERSION')) {
    throw new Error('VITE_APP_VERSION was found in emitted JavaScript')
  }

  console.log(
    `Sentry release check passed: found ${release}; ${packageVersionRelease} was absent.`,
  )
} finally {
  try {
    if (outputDirectory) {
      await rm(outputDirectory, { recursive: true, force: true })
    }
  } finally {
    for (const [key, value] of inheritedSentryEnvironment) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}
