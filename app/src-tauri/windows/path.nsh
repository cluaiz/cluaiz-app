!include "StrFunc.nsh"
!include "WinMessages.nsh"
${StrStr}
${UnStrRep}

!macro NSIS_HOOK_POSTINSTALL
  IfSilent cluaiz_path_read
  MessageBox MB_YESNO "Add cluaiz-app to your user PATH?" IDNO cluaiz_path_done
  cluaiz_path_read:
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
