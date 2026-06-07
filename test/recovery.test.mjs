import test from 'node:test';
import assert from 'node:assert/strict';
import { reconnectDelay } from '../src/main/src/recovery.js';
test('reconnect delay is capped', () => {
  assert.equal(reconnectDelay(0), 1000);
  assert.equal(reconnectDelay(2), 5000);
  assert.equal(reconnectDelay(99), 30000);
  assert.equal(reconnectDelay(-1), 1000);
});
