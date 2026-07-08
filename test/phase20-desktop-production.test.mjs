import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DESKTOP_CONTRACT_VERSION,
  MIN_WEB_CONTRACT_VERSION,
  resolveUpdateChannel,
  resolveUpdatePolicy,
  updateReleaseType
} from '../src/main/src/compatibility.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('desktop compatibility contract is versioned and exposes staged update channels', () => {
  assert.equal(DESKTOP_CONTRACT_VERSION, 2);
  assert.equal(MIN_WEB_CONTRACT_VERSION, 1);
  assert.equal(resolveUpdateChannel({ env: { CRYSO_UPDATE_CHANNEL: 'beta' } }), 'preview');
  assert.equal(resolveUpdateChannel({ env: {}, preview: true, packaged: true }), 'preview');
  assert.equal(resolveUpdateChannel({ env: {}, preview: false, packaged: false }), 'internal');
  assert.equal(resolveUpdateChannel({ env: {}, preview: false, packaged: true }), 'stable');
  assert.equal(updateReleaseType('stable'), 'release');
  assert.equal(updateReleaseType('preview'), 'prerelease');
});

test('required update policy can force upgrade without bricking current app', () => {
  assert.deepEqual(resolveUpdatePolicy({ currentVersion: '1.5.9', minimumVersion: '1.6.0' }), {
    forced: true,
    minimumVersion: '1.6.0',
    installMode: 'required'
  });
  assert.deepEqual(resolveUpdatePolicy({ currentVersion: '1.6.1', minimumVersion: '1.6.0' }), {
    forced: false,
    minimumVersion: '1.6.0',
    installMode: 'optional'
  });
});

test('hosted app receives compatibility and support diagnostics metadata', () => {
  const site = read('src/main/src/site.js');
  const updater = read('src/main/src/updater.js');
  const diagnostics = read('src/main/src/diagnostics.js');
  const docs = read('docs/phase-20-desktop-production-excellence.md');
  assert.match(site, /desktopCompatibility/);
  assert.match(site, /updateChannel/);
  assert.match(updater, /CRYSO_UPDATE_CHANNEL|updateReleaseType/);
  assert.match(updater, /recoverable/);
  assert.match(diagnostics, /compatibility/);
  for (const token of ['Signed release', 'Smoke test', 'sandbox', 'internal', 'preview', 'stable']) {
    assert.match(docs, new RegExp(token, 'i'));
  }
});
