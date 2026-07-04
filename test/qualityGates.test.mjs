import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('desktop package exposes a non-mutating CI test command', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts.test, 'node --test test/*.test.mjs');
  assert.match(packageJson.scripts['test:ci'], /npm run lint/);
  assert.match(packageJson.scripts['test:ci'], /npm test/);
  assert.match(packageJson.scripts['test:ci'], /npm run build/);
  assert.doesNotMatch(packageJson.scripts['test:ci'], /npm run format\b/);
});

test('release workflow runs quality gates before packaging and does not mutate formatting', () => {
  const workflow = read('.github/workflows/commit.yml');
  for (const expected of [
    'npm ci',
    'gitleaks/gitleaks-action',
    'npm run lint',
    'npm test',
    'npm run build',
    'npm audit --audit-level high',
    'npm run build:win'
  ]) {
    assert.match(workflow, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(workflow, /npm run format\s/);
});

test('preload exposes only the documented Electron API surface', () => {
  const preload = read('src/preload/index.js');
  const declarations = read('src/preload/electron-api.d.ts');
  for (const name of [
    'getDisplayInfo',
    'setDisplayPreferences',
    'windowControl',
    'checkForUpdates',
    'openExternal',
    'openWindow',
    'onAccessStateChanged'
  ]) {
    assert.match(preload, new RegExp(`${name}:|${name}\\(`));
    assert.match(declarations, new RegExp(`${name}\\(`));
  }
  assert.match(preload, /Object\.freeze/);
  assert.match(preload, /allowedEvents/);
});

test('desktop navigation and IPC stay allowlisted for hosted POS routes and trusted senders', () => {
  const navigation = read('src/main/src/navigation.js');
  const site = read('src/main/src/site.js');
  for (const route of [
    '/pos',
    '/pos/kitchen',
    '/pos/inventory',
    '/pos/menu',
    '/pos/reports',
    '/pos/settings',
    '/pos/display'
  ]) {
    assert.match(navigation, new RegExp(route.replace('/', '\\/')));
  }
  assert.match(site, /isTrustedSender/);
  assert.match(site, /event\.sender === this\.webContents/);
  assert.match(site, /access-state-changed/);
  assert.match(site, /clearStorageData/);
});
