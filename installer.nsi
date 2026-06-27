; PurffleGrab installer — builds a per-user Setup.exe from the packaged app.
Unicode true
!include "MUI2.nsh"

!define APP "PurffleGrab"
!define VERSION "2.0.0"
!define PUB "Purffle"
!define SRC "C:\Users\Chama\Documents\PurffleGrab\release\win-unpacked"
!define ICON "C:\Users\Chama\Documents\PurffleGrab\build\icon.ico"

Name "${APP}"
OutFile "C:\Users\Chama\Documents\PurffleGrab\release\PurffleGrab-Setup-${VERSION}.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${APP}"
InstallDirRegKey HKCU "Software\${APP}" "InstallDir"
ShowInstDetails show
ShowUninstDetails show
SetCompressor /SOLID lzma

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch PurffleGrab now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"

  WriteRegStr HKCU "Software\${APP}" "InstallDir" "$INSTDIR"

  CreateShortCut "$DESKTOP\${APP}.lnk" "$INSTDIR\${APP}.exe" "" "$INSTDIR\${APP}.exe" 0
  CreateDirectory "$SMPROGRAMS\${APP}"
  CreateShortCut "$SMPROGRAMS\${APP}\${APP}.lnk" "$INSTDIR\${APP}.exe" "" "$INSTDIR\${APP}.exe" 0
  CreateShortCut "$SMPROGRAMS\${APP}\Uninstall ${APP}.lnk" "$INSTDIR\Uninstall.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Add / Remove Programs (per-user)
  !define ARP "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}"
  WriteRegStr HKCU "${ARP}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${ARP}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${ARP}" "Publisher" "${PUB}"
  WriteRegStr HKCU "${ARP}" "DisplayIcon" "$INSTDIR\${APP}.exe"
  WriteRegStr HKCU "${ARP}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${ARP}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "${ARP}" "NoModify" 1
  WriteRegDWORD HKCU "${ARP}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP}.lnk"
  RMDir /r "$SMPROGRAMS\${APP}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\${APP}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}"
SectionEnd
