!include "StrFunc.nsh"
!include "WinMessages.nsh"
${StrStr}
${UnStrRep}

!macro NSIS_HOOK_POSTINSTALL
  ClearErrors
  ReadRegStr $0 HKCU "Environment" "Path"
  ${If} ${Errors}
    ; ReadRegStr also fails for a value too long for NSIS. Leave an existing
    ; value alone in that case; a missing value can be created.
    StrCpy $3 0
    ${Do}
      EnumRegValue $4 HKCU "Environment" $3
      ${If} $4 == "Path"
        Goto cluaiz_path_done
      ${EndIf}
      IntOp $3 $3 + 1
    ${LoopUntil} $4 == ""
    StrCpy $0 ""
    ClearErrors
  ${EndIf}
  ${IfNot} ${Errors}
    ${StrStr} $1 ";$0;" ";$INSTDIR;"
    ${If} $1 == ""
      StrCpy $2 "$0;$INSTDIR"
      ${If} $0 == ""
        StrCpy $2 "$INSTDIR"
      ${EndIf}
      StrLen $3 $0
      StrLen $4 $INSTDIR
      IntOp $3 $3 + $4
      IntOp $3 $3 + 1
      ${If} $3 < ${NSIS_MAX_STRLEN}
        ClearErrors
        WriteRegExpandStr HKCU "Environment" "Path" "$2"
        ${IfNot} ${Errors}
          WriteRegStr HKCU "Software\Cluaiz\App" "NsisPath" "$INSTDIR"
          SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=1000
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
  cluaiz_path_done:
  ; The App needs the Engine. Offer the official installer (latest Engine release,
  ; chosen for this machine) only when it is not installed yet. "No" is fine: the
  ; App asks again on start and can install it later.
  IfSilent cluaiz_engine_done
  IfFileExists "$PROFILE\.cluaiz\bin\cluaiz.exe" cluaiz_engine_done
  MessageBox MB_YESNO|MB_ICONQUESTION "Cluaiz App needs the Cluaiz Engine.$\r$\n$\r$\nInstall the latest Engine release for this computer now?$\r$\n$\r$\nYou can also install it later from the App." IDNO cluaiz_engine_done
  ; Setup is a 32-bit program, so plain powershell.exe starts the 32-bit PowerShell, which
  ; reports x86 and the Engine installer stops with exit code 1 (seen 2026-11-28). Sysnative is
  ; the 64-bit System32 as seen from a 32-bit program.
  StrCpy $6 "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists $6 +2
  StrCpy $6 "powershell.exe"
  ExecWait '"$6" -NoProfile -ExecutionPolicy Bypass -Command "irm https://cluaiz.com/install.ps1 | iex"' $5
  ${If} $5 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "The Engine installer did not finish (exit code $5). You can install it later from the App."
  ${EndIf}
  cluaiz_engine_done:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ReadRegStr $1 HKCU "Software\Cluaiz\App" "NsisPath"
  ${If} $1 == $INSTDIR
    ClearErrors
    ReadRegStr $0 HKCU "Environment" "Path"
    ${IfNot} ${Errors}
      StrLen $3 $0
      IntOp $3 $3 + 2
      ${If} $3 < ${NSIS_MAX_STRLEN}
        ${UnStrRep} $2 ";$0;" ";$INSTDIR;" ";"
        ${If} $2 != ";$0;"
          StrCpy $4 $2 -1 1
          WriteRegExpandStr HKCU "Environment" "Path" "$4"
          SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=1000
        ${EndIf}
      ${EndIf}
    ${EndIf}
    DeleteRegValue HKCU "Software\Cluaiz\App" "NsisPath"
  ${EndIf}
!macroend
