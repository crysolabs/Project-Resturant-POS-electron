# Phase 20: Desktop App Production Excellence

## Desktop-to-web compatibility contract

The Electron shell exposes a versioned compatibility object from `electronAPI.getAppInfo()`:

- `contractVersion`: desktop API contract implemented by this installed app.
- `minWebContractVersion`: oldest hosted web contract this app can safely run.
- `updateChannel`: `internal`, `preview`, or `stable`.
- `updatePolicy`: `optional` or `required`, with an optional minimum desktop version.
- `capabilities`: hardware bridge, customer display, offline recovery, diagnostics, staged updates, and support bundle availability.

The hosted web app must treat the contract as advisory during an active sale. If the desktop app is unsupported, the cashier gets upgrade guidance in the title bar; the sale flow is not redirected or cleared. New station registration includes the desktop contract metadata so support can spot stale terminals.

## Update channels and rollout

- `internal`: development and staff validation. Uses prerelease GitHub artifacts.
- `preview`: merchant pilot channel. Uses prerelease GitHub artifacts.
- `stable`: production merchant channel. Uses release GitHub artifacts.

Set `CRYSO_UPDATE_CHANNEL=internal|preview|stable` at build or runtime. Package `preview: true` defaults to `preview`; unpackaged development defaults to `internal`; packaged production defaults to `stable`.

Updates are never downloaded automatically. A failed check or download is recoverable and leaves the existing cashier app usable. Required updates are presented as finish-current-sale guidance; downloaded updates are installed only when the cashier restarts from the app controls or exits normally.

## Signed release requirements

Production release builds must be signed before being published to the stable channel. Windows releases require a valid Authenticode certificate and timestamp server. macOS releases require hardened runtime signing and notarization. `forceCodeSigning` remains disabled for local development only; CI release jobs must fail stable publishing when signing secrets are absent.

## Smoke test checklist

Run before promoting a packaged build:

1. Install over the previous stable build and confirm the current session persists.
2. Open `/pos`, register a station, print a test receipt, and open the cash drawer where hardware exists.
3. Disconnect the network and verify the offline recovery page retries without losing the current window.
4. Reconnect and verify the hosted app reloads and customer display can reopen on the remembered monitor.
5. Check update availability on the target channel, download, restart, and verify rollback by reinstalling the previous stable build if needed.
6. Export diagnostics and confirm no token, cookie, PIN, card, phone, email, or address values appear.

## Security and local data

Remote content runs with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, an allowlisted preload bridge, trusted-origin IPC checks, blocked downloads, and browser handoff for external navigation. There is no general-purpose local database in this shell; persistent local data is limited to the dedicated Electron session partition and station/display preferences. Uninstall currently preserves app data by design so merchants can reinstall without losing station identity; support may instruct a cache cleanup when decommissioning a terminal.
