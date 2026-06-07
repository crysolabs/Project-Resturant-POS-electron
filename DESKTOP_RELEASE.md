# Desktop release configuration

## Server URLs

Development uses `http://localhost:3000`. Packaged builds use `MAIN_VITE_APPURI`, falling back to `https://resutrant-pos.crysolabs.com`. `MAIN_VITE_DEV_APPURI` can override the development URL.

## Updates

Packaged builds check GitHub Releases after startup, download in the background, and ask the operator before restarting to install. Configure `MAIN_VITE_GITHUB_USERNAME` and `MAIN_VITE_GITHUB_REPO` at build time.

## Windows signing

Production installers must be signed before distribution. Add the certificate and password as protected CI secrets supported by electron-builder (for example `CSC_LINK` and `CSC_KEY_PASSWORD`). Signing credentials are intentionally not stored in this repository.
