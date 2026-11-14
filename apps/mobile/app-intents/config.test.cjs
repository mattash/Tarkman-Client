/* global process, structuredClone */
// Run separately from Jest: node --test app-intents/config.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const configure = require('../app.config');
const base = require('../app.json').expo;

function withFlag(value, callback) {
  const previous = process.env.TARKMAN_SIRI_SPIKE;
  try {
    if (value === undefined) delete process.env.TARKMAN_SIRI_SPIKE;
    else process.env.TARKMAN_SIRI_SPIKE = value;
    callback();
  } finally {
    if (previous === undefined) delete process.env.TARKMAN_SIRI_SPIKE;
    else process.env.TARKMAN_SIRI_SPIKE = previous;
  }
}

test('normal config is returned unchanged; only exact opt-in enables native intent types', () => {
  for (const flag of [undefined, '', '0', 'true']) {
    withFlag(flag, () => assert.equal(configure({ config: base }), base));
  }
});

test('spike isolates identity, links, EAS, and updates without mutating production', () => {
  const original = structuredClone(base);
  withFlag('1', () => {
    const spike = configure({ config: base });
    assert.equal(spike.name, 'Tarkman Siri Spike');
    assert.equal(spike.slug, 'tarkman-siri-spike');
    assert.equal(spike.scheme, 'tarkman-siri-spike');
    assert.equal(spike.ios.bundleIdentifier, 'app.tarkman.sirispike');
    assert.equal(spike.android.package, 'app.tarkman.sirispike');
    assert.deepEqual(spike.ios.associatedDomains, []);
    assert.deepEqual(spike.android.intentFilters, []);
    assert.deepEqual(spike.updates, { enabled: false });
    assert.equal(spike.extra.eas, undefined);
    assert.equal(spike.extra.siriSpike, true);
    assert.equal(spike.plugins.at(-1), 'expo-app-intents');
    assert.deepEqual(spike.experiments.inlineModules.watchedDirectories, ['app-intents']);
    assert.deepEqual(base, original);
    assert.equal(base.extra.siriSpike, undefined);
    assert.equal(base.experiments?.inlineModules, undefined);
    assert.ok(!base.plugins.includes('expo-app-intents'));
  });
});
