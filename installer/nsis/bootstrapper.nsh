!macro customHeader
  RequestExecutionLevel user
  BrandingText "[PUBLISHER_NAME]"
!macroend

!macro customInstall
  ; The modern Electron bootstrapper owns the UI. NSIS only installs the bootstrapper and payload.
  ; Keep this script small so the signed bootstrapper remains predictable and easy to audit.
!macroend
