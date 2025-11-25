!macro customInit
!macroend
!macro customInstall
CreateDirectory "$DOCUMENTS\SupaScrapeR"
CreateDirectory "$DOCUMENTS\SupaScrapeR\Error Logs"
CreateDirectory "$DOCUMENTS\SupaScrapeR\Exported Posts"
CreateDirectory "$DOCUMENTS\SupaScrapeR\Exported Settings"
!macroend
!macro customUnInstall
RMDir /r "$INSTDIR"
RMDir /r "$APPDATA\supascraper"
RMDir /r "$LOCALAPPDATA\supascraper"
RMDir /r "$LOCALAPPDATA\supascraper-updater"
MessageBox MB_ICONQUESTION|MB_YESNO "Would you like to keep your scraped data, settings, and logs?$\n$\nSelecting 'No' will permanently delete all data in Documents\SupaScrapeR" IDYES SkipDelete IDNO DeleteData
DeleteData:
RMDir /r "$DOCUMENTS\SupaScrapeR"
Goto Done
SkipDelete:
MessageBox MB_OK "Your data has been preserved in Documents\SupaScrapeR"
Done:
!macroend