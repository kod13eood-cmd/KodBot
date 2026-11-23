; Reset only the first-run server routing when KodBot is really uninstalled.
;
; electron-builder updates run the old uninstaller with --updated (and
; /KEEP_APP_DATA), so ${isUpdated} keeps this from firing during an upgrade.
; Bots, conversations, memory, and keys live elsewhere and are never touched:
; only server-connection.json is removed, so a genuinely fresh install asks
; KodBot Solo vs Business again instead of silently reusing an old answer.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$APPDATA\KodBot\server-connection.json"
    Delete "$APPDATA\kodbot\server-connection.json"
  ${endif}
!macroend
