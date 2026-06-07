import { DISPLAY_WINDOW_ID } from './constants.js';

export function normalizeDisplayId(value) {
  return value === undefined || value === null || value === '' ? null : String(value);
}

export function selectDisplay(displays, requestedDisplayId, rememberedDisplayId) {
  const requested = normalizeDisplayId(requestedDisplayId);
  const remembered = normalizeDisplayId(rememberedDisplayId);
  return (
    displays.find((display) => String(display.id) === requested) ||
    displays.find((display) => String(display.id) === remembered) ||
    displays.find((display) => !display.internal) ||
    displays[0] ||
    null
  );
}

export function validateOpenWindowOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('Options must be an object');
  if (options.windowId !== undefined && options.windowId !== DISPLAY_WINDOW_ID)
    throw new Error('Unsupported windowId');
  if (options.displayId !== undefined && !['string', 'number'].includes(typeof options.displayId))
    throw new Error('displayId must be a string or number');
  for (const key of ['fullscreen', 'kiosk']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean')
      throw new Error(key + ' must be a boolean');
  }
  return {
    windowId: DISPLAY_WINDOW_ID,
    displayId: normalizeDisplayId(options.displayId),
    fullscreen: options.fullscreen !== false,
    kiosk: options.kiosk !== false
  };
}

export function validateWindowOptions(options) {
  if (!options || typeof options !== 'object' || options.windowId !== DISPLAY_WINDOW_ID)
    throw new Error('windowId must be ' + DISPLAY_WINDOW_ID);
  return { windowId: DISPLAY_WINDOW_ID };
}

export function validateFullScreenOptions(options) {
  const result = validateWindowOptions(options);
  if (typeof options.fullscreen !== 'boolean') throw new Error('fullscreen must be a boolean');
  return { ...result, fullscreen: options.fullscreen };
}

export function validateDisplayPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences))
    throw new Error('Preferences must be an object');
  const result = {};
  for (const key of ['cashierDisplayId', 'customerDisplayId']) {
    if (preferences[key] === undefined) continue;
    if (preferences[key] !== null && !['string', 'number'].includes(typeof preferences[key]))
      throw new Error(key + ' must be a string, number, or null');
    result[key] = normalizeDisplayId(preferences[key]);
  }
  return result;
}
