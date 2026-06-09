# Desktop release configuration

## Server URLs

Development uses `http://localhost:3000`. Packaged builds use `MAIN_VITE_APPURI`, falling back to `https://resutrant-pos.crysolabs.com`. `MAIN_VITE_DEV_APPURI` can override the development URL.

## Updates

Packaged builds check GitHub Releases after startup, download in the background, and ask the operator before restarting to install. Configure `MAIN_VITE_GITHUB_USERNAME` and `MAIN_VITE_GITHUB_REPO` at build time.

## Guided installer UI

The Windows installer is an assisted NSIS setup, not a silent one-click setup. It includes a branded sidebar, header artwork, license page, installation directory selection, Start Menu shortcut, Desktop shortcut, and launch-after-install option.

Replaceable artwork lives in:

- `build/installerSidebar.bmp` - Windows welcome/finish sidebar, 164 x 314 BMP.
- `build/uninstallerSidebar.bmp` - Windows uninstall sidebar, 164 x 314 BMP.
- `build/installerHeader.bmp` - Windows installer header, 150 x 57 BMP.
- `build/assets/restaurant-interior-placeholder.jpg` - placeholder DMG/install artwork.
- `src/renderer/loader/src/assets/*` - loader carousel and brand assets.

## Windows trust and SmartScreen

Windows shows unknown publisher or SmartScreen warnings when the installer is unsigned, signed with an untrusted certificate, or has no reputation yet. UI artwork cannot remove that warning. Production installers must be signed with a valid code-signing certificate from a trusted CA.

Recommended CI secrets for electron-builder:

```powershell
$env:WIN_CSC_LINK="C:\secure\crysolabs-code-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD="certificate-password"
```

For public distribution, an EV certificate or Microsoft Trusted Signing builds SmartScreen reputation faster than a regular OV certificate. Keep the certificate subject aligned with the company/app metadata shown to users.

## macOS trust and Gatekeeper

macOS will warn users when an app is unsigned or not notarized. Production macOS builds need an Apple Developer ID Application certificate and notarization with Apple.

Typical CI variables:

```powershell
$env:CSC_LINK="C:\secure\developer-id-application.p12"
$env:CSC_KEY_PASSWORD="certificate-password"
$env:APPLE_ID="release@example.com"
$env:APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
$env:APPLE_TEAM_ID="TEAMID12345"
```

Build on macOS for final notarized `.dmg` and `.zip` artifacts. Windows can build Windows installers, but macOS signing and notarization must run on macOS infrastructure.
