# Modern Windows installer architecture

## Recommendation

Standard NSIS can brand a wizard, but it cannot deliver a fully modern Windows 11 animated UI with React components, accessible modals, rich validation, and guided repair/update/uninstall flows. The production architecture is a hybrid installer:

1. Build the normal app payload with `electron-builder --win` as an assisted/silent-capable NSIS package.
2. Build a small signed Electron bootstrapper from this `installer/` folder.
3. The bootstrapper owns the modern UI, validation, logs, repair/update/uninstall decisions, and user choices.
4. The bootstrapper launches the NSIS payload only for the privileged file-copy/install work, passing `/currentuser`, `/allusers`, and `/D=...`.
5. Sign both the payload and bootstrapper. The bootstrapper is what users download.

This gives a modern app-like installer without trying to force NSIS dialogs to behave like a Fluent React app.

## UX flow

- Preparing: checks Windows version, architecture, admin status, disk space, write permission, previous installs, and broken metadata.
- Welcome: plain-language setup intro, Advanced options link, version/publisher/license footer.
- Existing install: update, repair, reinstall, uninstall, or change options.
- Install type: current user by default; all users explains UAC.
- Destination: validates path, permissions, protected folders, disk space, and network paths.
- Options: shortcuts, launch after install, startup launch, updates, crash reports, previous settings. CLI/path/file/protocol options stay hidden unless supported.
- Review: shows scope, destination, options, required space, version, existing version.
- Installing: real step messages and indeterminate/determinate progress where available.
- Success: summary, launch checkbox, open log link.
- Error: friendly message, collapsed technical details, retry/folder/admin/log/cancel actions.

## Files

- `installer/src/main/main.ts` - bootstrapper Electron main process.
- `installer/src/main/ipc/installer-ipc.ts` - typed IPC bridge handlers.
- `installer/src/main/backend/environment.ts` - environment, existing install, path validation, metadata.
- `installer/src/main/backend/install-actions.ts` - install/repair/uninstall actions, rollback, logging, error mapping.
- `installer/src/preload/preload.ts` - safe preload API.
- `installer/src/shared/types.ts` - shared TypeScript interfaces.
- `installer/src/renderer/App.tsx` - installer state machine and screen flow.
- `installer/src/renderer/components/components.tsx` - reusable UI components.
- `installer/src/renderer/styles/*.css` - Windows 11 / Fluent-inspired tokens and styles.
- `installer/electron.vite.installer.config.mjs` - bootstrapper build config.
- `installer/electron-builder.installer.yml` - bootstrapper packaging config.
- `installer/nsis/bootstrapper.nsh` - tiny NSIS script for the bootstrapper shell.

## Build commands

```powershell
# Build app payload first
npm run build
npx electron-builder --win

# Build modern bootstrapper UI
npx electron-vite build --config installer/electron.vite.installer.config.mjs
npx electron-builder --config installer/electron-builder.installer.yml --win
```

The bootstrapper config expects the payload at:

```text
dist/Restaurant-POS-System-1.5.8-x64-setup.exe
```

Update `extraResources` in `installer/electron-builder.installer.yml` when the payload filename changes.

## Signing

Unsigned installers will still show Windows SmartScreen or unknown publisher warnings. UI changes cannot fix that.

Use a trusted OV/EV code-signing certificate or Microsoft Trusted Signing. Sign the app payload and the bootstrapper. Keep the certificate subject aligned with `[PUBLISHER_NAME]`.

Typical CI variables:

```powershell
$env:WIN_CSC_LINK="C:\secure\publisher-code-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD="certificate-password"
```

## Testing checklist

- Fresh current-user install without admin.
- All-users install with UAC.
- Protected destination triggers clear permission message.
- Invalid path and network path are blocked.
- Insufficient disk space maps to a friendly error.
- Existing same version shows Repair.
- Existing older version shows Update.
- Broken install shows Reinstall.
- Running app flow asks user to close before update.
- Cancel is disabled during unsafe payload step.
- Rollback log is written after payload failure.
- Desktop shortcut and Start Menu shortcut choices are respected.
- Startup launch is opt-in only.
- Crash reports are opt-in only.
- Reduced motion disables non-essential animation.
- Keyboard navigation reaches every control.
- Screen reader announces progress changes.
- High contrast mode remains usable.
- Installer log opens from error and success screens.
- Payload and bootstrapper are signed.

## Final polish checklist

- Replace placeholders in `installer/electron-builder.installer.yml`.
- Replace license modal text with the real EULA.
- Wire `closeRunningApp()` to the production app mutex/protocol.
- Wire shortcut/protocol/file association choices into the payload or registry layer.
- Add a real integrity check if the payload is downloaded instead of bundled.
- Add localized strings before public release.
- Test on clean Windows 11, Windows 10, standard user, and admin accounts.
