import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as core from '../dist/index.js'
import { checkBoundary, inspectSource } from '../scripts/check-boundary.mjs'
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)))

test('session wrapper and inactive sentinel preserve existing shapes', () => {
  const input = fixture('session')
  assert.deepEqual(core.normalizeSession(input), input.session)
  assert.deepEqual(core.normalizeCurrentSession(input), input.session)
  assert.equal(core.normalizeCurrentSession(fixture('inactive-current-session')), null)
  for (const status of ['live', 'active', 'future_status']) {
    assert.equal(core.normalizeSession({ session: { ...input.session, status } }).status, status)
  }
})
test('part transport duration stays open without filling missing domain fields', () => {
  const input = fixture('part')
  assert.deepEqual(core.normalizePart(input), input.part)
  assert.equal(core.normalizePart(input).duration_type, 'fixed')
  assert.equal('sheet_music' in core.normalizePart(input), false)
  for (const duration_type of ['default', 'custom', 'future_duration']) {
    assert.equal(core.normalizePart({ part: { ...input.part, duration_type } }).duration_type, duration_type)
  }
})
test('both explanation shapes unwrap without inventing domain fields', () => {
  const expected = fixture('explanations-array')
  assert.deepEqual(core.normalizeExplanations(fixture('explanations-wrapped')), expected)
  assert.deepEqual(core.normalizeExplanations(expected), expected)
  assert.deepEqual(core.normalizeExplanations({ explanations: [] }), [])
  assert.equal('liturgy_id' in expected[0], false)
})
test('auth validates the existing response, retaining open role names', () => {
  const input = fixture('authentication')
  input.user.roles.push('future_role')
  assert.deepEqual(core.normalizeAuthResponse(input), input)
  for (const bad of [{ ...input, token: '' }, { ...input, user: { ...input.user, roles: [1] } }, { token: 'x' }]) {
    assert.throws(() => core.normalizeAuthResponse(bad), TypeError)
  }
})
test('realtime envelope preserves status and string/numeric part identifiers', () => {
  for (const input of fixture('actioncable-envelopes')) {
    assert.deepEqual(core.normalizeActionCableEnvelope(input), input)
  }
  const future = { event: 'future_event', data: { extension: true } }
  assert.deepEqual(core.normalizeActionCableEnvelope(future), future)
})
test('critical boundaries reject malformed payloads', () => {
  for (const normalize of [core.normalizeSession, core.normalizeCurrentSession, core.normalizePart, core.normalizeExplanations, core.normalizeAuthResponse, core.normalizeActionCableEnvelope]) {
    for (const bad of [null, undefined, 42, 'text', {}]) {
      assert.throws(() => normalize(bad), TypeError)
    }
  }
  for (const bad of [{ session: { id: '1' } }, { session: { id: 1, status: 2 } }, { session: { id: NaN } }]) {
    assert.throws(() => core.normalizeSession(bad), TypeError)
  }
  assert.throws(() => core.normalizePart({ part: { id: 1, duration_type: 2 } }), TypeError)
  assert.throws(() => core.normalizeExplanations({ explanations: [{}] }), TypeError)
  assert.throws(() => core.normalizeActionCableEnvelope({ event: 'x', data: [] }), TypeError)
})
test('language helpers preserve null and do not conflate display languages', () => {
  assert.deepEqual(core.LANGUAGES.map(item => item.value), ['en', 'ru', 'grabar', 'translit'])
  assert.equal(core.isLanguage('hyw'), false)
  assert.equal(core.isLanguage('ru'), true)
  assert.equal(core.getPartText({ en: 'English', ru: null, grabar: '', translit: '' }, 'ru'), null)
})
test('query keys match existing web cache identities and policy units', () => {
  assert.deepEqual(core.sessionsKeys.sessionParts('123'), ['sessions', 'session', '123', 'parts'])
  assert.deepEqual(core.sessionMutationKeys.controls('123'), ['sessionControls', '123'])
  assert.deepEqual(core.partQueryKeys.detail('123', 4), ['part', '123', 4])
  assert.deepEqual(core.explanationQueryKeys.citations('2', '3'), ['explanation', 'liturgy', '2', '3', 'citations'])
  assert.deepEqual(core.currentSessionKeys.current(), ['currentSession'])
  assert.deepEqual(core.currentSessionKeys.user(null), ['userCurrentSession', null])
  assert.equal(core.SESSION_POLLING.activeIntervalMs, 1000)
  assert.equal(core.SESSION_POLLING.inactiveIntervalMs, 10000)
  assert.equal(core.DEFAULT_EXPLANATION_LOOKAHEAD, 3)
})
test('boundary guard scans core and rejects platform imports and globals', () => {
  checkBoundary()
  for (const module of ['react', 'react-dom', 'react-native', 'expo', 'axios', '@rails/actioncable', '@tanstack/react-query', '../../../apps/web/app/api.js', 'node:fs']) {
    for (const source of [`import type { X } from '${module}'`, `export * from '${module}'`, `import('${module}')`, `type X = import('${module}').X`]) {
      assert.ok(inspectSource(source).length, source)
    }
  }
  for (const source of ['window.x', 'document.x', 'localStorage.x', 'process.env.X', 'globalThis["fetch"]()', 'import.meta.env.X', 'require("react")', 'import(name)']) {
    assert.ok(inspectSource(source).length, source)
  }
  assert.deepEqual(inspectSource("import type { Part } from './part.js'"), [])
})
