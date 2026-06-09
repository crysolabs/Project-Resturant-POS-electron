!ifndef BUILD_UNINSTALLER
Var CrysoDialog
Var CrysoImage
Var CrysoImageHandle
Var CrysoRunCheckbox

!include nsDialogs.nsh
!include LogicLib.nsh

!macro customHeader
  BrandingText "CrysoLabs Restaurant POS"
!macroend

!macro customWelcomePage
  Page custom CrysoWelcomePage
!macroend

!macro customPageAfterChangeDir
  Page custom CrysoReadyPage
!macroend

!macro customFinishPage
  Page custom CrysoFinishPage CrysoFinishLeave
!macroend

Function CrysoWelcomePage
  InitPluginsDir
  File "/oname=$PLUGINSDIR\cryso_welcome.bmp" "${BUILD_RESOURCES_DIR}\customWelcome.bmp"
  nsDialogs::Create 1018
  Pop $CrysoDialog
  ${If} $CrysoDialog == error
    Abort
  ${EndIf}
  SetCtlColors $CrysoDialog 0x14233A 0xF6F8FB

  ${NSD_CreateBitmap} 0 0 210 292 ""
  Pop $CrysoImage
  ${NSD_SetImage} $CrysoImage "$PLUGINSDIR\cryso_welcome.bmp" $CrysoImageHandle

  ${NSD_CreateLabel} 230 24 190 16 "CRYSOLABS DESKTOP"
  Pop $0
  SetCtlColors $0 0x226CAE 0xF6F8FB

  ${NSD_CreateLabel} 230 48 188 42 "Install Restaurant POS System"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB
  CreateFont $1 "Segoe UI" 18 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 230 104 188 54 "This guided setup installs the desktop shell, shortcuts, update support, and local app resources needed for service."
  Pop $0
  SetCtlColors $0 0x475569 0xF6F8FB

  ${NSD_CreateGroupBox} 230 174 188 86 "Included"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB

  ${NSD_CreateLabel} 246 198 150 12 "Desktop and Start Menu shortcuts"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB
  ${NSD_CreateLabel} 246 218 150 12 "Secure update-ready shell"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB
  ${NSD_CreateLabel} 246 238 150 12 "POS, kitchen, and display launch flow"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB

  nsDialogs::Show
FunctionEnd

Function CrysoReadyPage
  InitPluginsDir
  File "/oname=$PLUGINSDIR\cryso_ready.bmp" "${BUILD_RESOURCES_DIR}\customReady.bmp"
  nsDialogs::Create 1018
  Pop $CrysoDialog
  ${If} $CrysoDialog == error
    Abort
  ${EndIf}
  SetCtlColors $CrysoDialog 0x14233A 0xF6F8FB

  ${NSD_CreateBitmap} 0 0 210 292 ""
  Pop $CrysoImage
  ${NSD_SetImage} $CrysoImage "$PLUGINSDIR\cryso_ready.bmp" $CrysoImageHandle

  ${NSD_CreateLabel} 230 24 190 16 "READY TO INSTALL"
  Pop $0
  SetCtlColors $0 0x16A34A 0xF6F8FB

  ${NSD_CreateLabel} 230 48 188 42 "Confirm setup location"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB
  CreateFont $1 "Segoe UI" 18 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 230 104 188 42 "Restaurant POS System will be installed to:"
  Pop $0
  SetCtlColors $0 0x475569 0xF6F8FB

  ${NSD_CreateText} 230 148 188 22 "$INSTDIR"
  Pop $0
  EnableWindow $0 0

  ${NSD_CreateLabel} 230 192 188 48 "Click Install to copy files, create shortcuts, and prepare the application for first launch."
  Pop $0
  SetCtlColors $0 0x475569 0xF6F8FB

  nsDialogs::Show
FunctionEnd

Function CrysoFinishPage
  InitPluginsDir
  File "/oname=$PLUGINSDIR\cryso_finish.bmp" "${BUILD_RESOURCES_DIR}\customFinish.bmp"
  nsDialogs::Create 1018
  Pop $CrysoDialog
  ${If} $CrysoDialog == error
    Abort
  ${EndIf}
  SetCtlColors $CrysoDialog 0x14233A 0xF6F8FB

  ${NSD_CreateBitmap} 0 0 210 292 ""
  Pop $CrysoImage
  ${NSD_SetImage} $CrysoImage "$PLUGINSDIR\cryso_finish.bmp" $CrysoImageHandle

  ${NSD_CreateLabel} 230 24 190 16 "SETUP COMPLETE"
  Pop $0
  SetCtlColors $0 0xE59A16 0xF6F8FB

  ${NSD_CreateLabel} 230 48 188 42 "Restaurant POS is installed"
  Pop $0
  SetCtlColors $0 0x14233A 0xF6F8FB
  CreateFont $1 "Segoe UI" 18 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 230 106 188 52 "The desktop app is ready. You can launch it now or start it later from the Desktop or Start Menu shortcut."
  Pop $0
  SetCtlColors $0 0x475569 0xF6F8FB

  ${NSD_CreateCheckbox} 230 182 188 18 "Launch Restaurant POS System"
  Pop $CrysoRunCheckbox
  ${NSD_Check} $CrysoRunCheckbox
  SetCtlColors $CrysoRunCheckbox 0x14233A 0xF6F8FB

  nsDialogs::Show
FunctionEnd

Function CrysoFinishLeave
  ${NSD_GetState} $CrysoRunCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    ExecShell "open" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  ${EndIf}
FunctionEnd

!endif


