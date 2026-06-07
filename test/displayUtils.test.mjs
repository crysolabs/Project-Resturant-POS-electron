import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_WINDOW_ID } from '../src/main/src/constants.js';
import {
  selectDisplay,
  validateDisplayPreferences,
  validateFullScreenOptions,
  validateOpenWindowOptions
} from '../src/main/src/displayUtils.js';
const displays = [
  { id: 1, internal: true },
  { id: 2, internal: false }
];
test('validates and defaults customer display options', () => {
  assert.deepEqual(validateOpenWindowOptions({}), {
    windowId: DISPLAY_WINDOW_ID,
    displayId: null,
    fullscreen: true,
    kiosk: true
  });
  assert.throws(() => validateOpenWindowOptions({ windowId: 'wrong' }));
  assert.throws(() => validateOpenWindowOptions({ kiosk: 'yes' }));
});
test('requires explicit fullscreen boolean and stable window id', () => {
  assert.deepEqual(validateFullScreenOptions({ windowId: DISPLAY_WINDOW_ID, fullscreen: false }), {
    windowId: DISPLAY_WINDOW_ID,
    fullscreen: false
  });
  assert.throws(() => validateFullScreenOptions({ windowId: DISPLAY_WINDOW_ID }));
});
test('selects requested, remembered, external, then primary display', () => {
  assert.equal(selectDisplay(displays, 1, 2).id, 1);
  assert.equal(selectDisplay(displays, 9, 2).id, 2);
  assert.equal(selectDisplay(displays, 9, 8).id, 2);
  assert.equal(selectDisplay([displays[0]], null, null).id, 1);
});
test('validates cashier and customer display preferences', () => {
  assert.deepEqual(validateDisplayPreferences({ cashierDisplayId: 1, customerDisplayId: null }), {
    cashierDisplayId: '1',
    customerDisplayId: null
  });
  assert.deepEqual(validateDisplayPreferences({ customerDisplayId: '2' }), {
    customerDisplayId: '2'
  });
  assert.throws(() => validateDisplayPreferences(null));
  assert.throws(() => validateDisplayPreferences({ cashierDisplayId: {} }));
});
