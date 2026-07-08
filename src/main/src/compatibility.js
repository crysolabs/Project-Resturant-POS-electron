export const DESKTOP_CONTRACT_VERSION = 2;
export const MIN_WEB_CONTRACT_VERSION = 1;
export const SUPPORTED_UPDATE_CHANNELS = ['internal', 'preview', 'stable'];

const CHANNEL_ALIASES = new Map([
  ['dev', 'internal'],
  ['development', 'internal'],
  ['beta', 'preview'],
  ['prerelease', 'preview'],
  ['prod', 'stable'],
  ['production', 'stable']
]);

export function resolveUpdateChannel({ env = process.env, preview = false, packaged = false } = {}) {
  const raw = String(env.CRYSO_UPDATE_CHANNEL || env.UPDATE_CHANNEL || '').trim().toLowerCase();
  const normalized = CHANNEL_ALIASES.get(raw) || raw;
  if (SUPPORTED_UPDATE_CHANNELS.includes(normalized)) return normalized;
  if (preview) return 'preview';
  if (!packaged) return 'internal';
  return 'stable';
}

export function updateReleaseType(channel) {
  return channel === 'stable' ? 'release' : 'prerelease';
}

export function compareSemver(left = '0.0.0', right = '0.0.0') {
  const parse = (value) =>
    String(value)
      .split(/[.-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

export function resolveUpdatePolicy({ currentVersion, minimumVersion, force = false } = {}) {
  const forced = Boolean(force || (minimumVersion && compareSemver(currentVersion, minimumVersion) < 0));
  return {
    forced,
    minimumVersion: minimumVersion || null,
    installMode: forced ? 'required' : 'optional'
  };
}

export function desktopCompatibility({ app, channel, updatePolicy = {} }) {
  const version = app.getVersion();
  return {
    contractVersion: DESKTOP_CONTRACT_VERSION,
    minWebContractVersion: MIN_WEB_CONTRACT_VERSION,
    appVersion: version,
    updateChannel: channel,
    updatePolicy: resolveUpdatePolicy({ currentVersion: version, ...updatePolicy }),
    capabilities: {
      hostedApp: true,
      hardwareApi: true,
      customerDisplay: true,
      offlineRecovery: true,
      diagnostics: true,
      stagedUpdates: true,
      supportBundle: true,
      securePreloadBridge: true
    }
  };
}
