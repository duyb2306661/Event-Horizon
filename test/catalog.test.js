// Static checks on the tweak and boost-up catalogs. Runs on any OS.
const test = require('node:test');
const assert = require('node:assert/strict');
const { TWEAKS, CATEGORIES, PRESETS, BLOAT_APPS } = require('../src/main/tweaks');
const { BOOSTS } = require('../src/main/boosts');

test('catalog has the documented number of tweaks', () => {
  // Keep this in sync with README.md, docs/TWEAKS.md and the release notes.
  assert.equal(TWEAKS.length, 89);
});

test('tweak ids are unique, snake_case and stable', () => {
  const ids = TWEAKS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate tweak id');
  for (const id of ids) assert.match(id, /^[a-z0-9_]+$/, id);
});

test('every tweak has apply, revert and check scripts', () => {
  for (const t of TWEAKS) {
    for (const k of ['apply', 'revert', 'check']) {
      assert.equal(typeof t[k], 'string', `${t.id}.${k}`);
      assert.ok(t[k].trim().length > 0, `${t.id}.${k} is empty`);
    }
    assert.notEqual(t.apply.trim(), t.revert.trim(), `${t.id} revert is identical to apply`);
  }
});

test('every tweak has valid metadata', () => {
  for (const t of TWEAKS) {
    assert.ok(CATEGORIES[t.cat], `${t.id} has unknown category ${t.cat}`);
    assert.ok(['safe', 'medium', 'high'].includes(t.risk), `${t.id} risk`);
    assert.ok(t.name.length > 3 && t.name.length < 70, `${t.id} name length`);
    assert.ok(t.desc.length > 20 && t.desc.length < 300, `${t.id} description length`);
    assert.equal(typeof t.reboot, 'boolean');
    assert.equal(typeof t.recommended, 'boolean');
  }
});

test('high-risk tweaks are never in the Lite or Power presets', () => {
  for (const key of ['lite', 'power']) {
    const ids = TWEAKS.filter(PRESETS[key].filter).map(t => t.id);
    for (const id of ids) assert.notEqual(TWEAKS.find(t => t.id === id).risk, 'high', `${id} in ${key}`);
  }
  assert.ok(TWEAKS.filter(PRESETS.lite.filter).every(t => t.risk === 'safe'));
});

test('descriptions do not name a specific CPU or GPU model', () => {
  for (const t of TWEAKS) assert.doesNotMatch(t.desc, /\b(i[3579]-\d{4,5}|RTX\s?\d{4}|GTX\s?\d{4}\s?Ti)\b/, t.id);
});

test('user-scope tweaks only touch HKCU', () => {
  for (const t of TWEAKS.filter(x => x.userScope)) {
    assert.doesNotMatch(t.apply + t.revert, /HKLM/, t.id);
  }
});

test('boost-ups have unique ids and a script', () => {
  const ids = BOOSTS.map(b => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of BOOSTS) {
    assert.ok(b.script.trim().length > 0, b.id);
    assert.ok(['system', 'gaming', 'network', 'hardware'].includes(b.cat), b.id);
  }
});

test('bloat list contains only package family names', () => {
  for (const n of BLOAT_APPS) assert.match(n, /^[A-Za-z0-9.]+$/, n);
});
