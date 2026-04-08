# infinite-neck.js appInit() Function Call Audit

This table is for triaging and refactoring the responsibilities in `appInit()`. Each row corresponds to a direct function call in `appInit()`. The table will be updated as we triage and refactor.

| Function Call / Assignment                | Where Defined / Lands                | MoveTo                | likelyHeadless | What it Does / Summary |
|-------------------------------------------|--------------------------------------|-----------------------|---------------|-----------------------|
| window.onerror = ...                      | infinite-neck.js                     | infiniteNeckController| Yes           | Installs global error handler (alerts/logs). |
| fetchVersionInBrowser()                   | infinite-neck.js                     | infiniteNeckController| Yes           | Fetches and displays app version. |
| gSong = new Song()                        | Song.js (class)                      | Song                  | Yes           | Creates main Song model instance. |
| gSong.ensureDefaultSection()              | Song.js                              | Song                  | Yes           | Ensures at least one Section exists. |
| installDefaultColorDicts()                | colorFunctions.js                    | Song or ColorDict     | Yes           | Installs default color dictionaries. |
| applyStylesheetsTo_gUserColorDict()       | colorFunctions.js                    | Song or ColorDict     | Yes           | Applies user color stylesheets. |
| buildColorDicts()                         | colorFunctions.js                    | Song or ColorDict     | Yes           | Builds color dictionaries. |
| $('#divColorDicts').hide()                | infinite-neck.js                     | infiniteNeckController| No            | Hides color dicts div. |
| $("#CustomColorEditors").hide()          | infinite-neck.js                     | infiniteNeckController| No            | Hides custom color editors div. |
| TuningsLibrary.ensureDefaultMyTuning(...) | TuningsLibrary.js                    | Song/TuningsLibrary   | Yes           | Ensures default tuning exists. |
| installAllTuningsTables()                 | infinite-neck.js                     | TuningsLibrary        | No            | Installs all tuning tables (UI). |
| installBtnHamburgerClicks()               | infinite-neck.js                     | infiniteNeckController| No            | Installs hamburger menu button events. |
| setupOpenFile()                           | infinite-neck.js                     | infiniteNeckController| No            | Sets up file open logic. |
| sectionChanged()                          | infinite-neck.js                     | Song/Section          | Yes           | Handles section change event. |
| installTDNoteClick()                      | infinite-neck.js                     | infiniteNeckController| No            | Installs table cell click events. |
| bindDesktopEvents()                       | infinite-neck.js                     | infiniteNeckController| No            | Binds desktop UI events. |
| applyScalingPrefs(true)                   | infinite-neck.js                     | infiniteNeckController| Yes           | Applies scaling preferences. |
| rebuildThemesDropdown()                   | infinite-neck.js                     | infiniteNeckController| No            | Rebuilds theme dropdown and binds events. |
| $('#selThemes').val("Autobahn").change() | infinite-neck.js                     | infiniteNeckController| No            | Sets default theme in dropdown. |
| $('#textareaFunctionSymbols').val(...)    | infinite-neck.js                     | infiniteNeckController| No            | Sets textarea value for function symbols. |
| $("#txtFilename").val()                  | infinite-neck.js                     | infiniteNeckController| No            | Gets current filename from input. |
| $(".lblSongName").html(currentFilename)  | infinite-neck.js                     | infiniteNeckController| No            | Sets song name label. |
| getSong().songName = currentFilename      | Song.js                              | Song                  | Yes           | Sets song name in model. |
| $('.topControlsCaptions').show()          | infinite-neck.js                     | infiniteNeckController| No            | Shows top controls captions. |
| $('#cbHighlight').prop('checked', false)  | infinite-neck.js                     | infiniteNeckController| No            | Unchecks highlight checkbox. |
| $("#palette").show()                     | infinite-neck.js                     | infiniteNeckController| No            | Shows palette div. |
| $('#cbAutomaticColor').prop('checked', true)| infinite-neck.js                   | infiniteNeckController| No            | Checks automatic color checkbox. |
| $("#cbAutomaticColor").trigger('change') | infinite-neck.js                     | infiniteNeckController| No            | Triggers change event for color checkbox. |
| $("#dropDownRootColors").val("noteKeep")| infinite-neck.js                     | infiniteNeckController| No            | Sets root colors dropdown. |
| $("#dropDownChordsColors").val("noteKeep")| infinite-neck.js                   | infiniteNeckController| No            | Sets chords colors dropdown. |
| $("#dropDownScalesColors").val("noteKeep")| infinite-neck.js                   | infiniteNeckController| No            | Sets scales colors dropdown. |
| $("#lblHideWarning").hide()              | infinite-neck.js                     | infiniteNeckController| No            | Hides warning label. |
| showHideDisplayOptionsPresent()           | infinite-neck.js                     | infiniteNeckController| No            | Shows/hides display options buttons. |
| hideAllMenuDivs()                         | infinite-neck.js                     | infiniteNeckController| No            | Hides all menu divs. |
| $("#divQuick").hide()                    | infinite-neck.js                     | infiniteNeckController| No            | Hides quick div. |
| $("#tabledestTopPad").hide()             | infinite-neck.js                     | infiniteNeckController| No            | Hides table top pad. |
| $("#CmdMenu").hide()                     | infinite-neck.js                     | infiniteNeckController| No            | Hides command menu. |
| updateFontLabel()                         | infinite-neck.js                     | infiniteNeckController| Yes           | Updates font label. |
| buildUserColors()                         | colorFunctions.js                    | Song or ColorDict     | Yes           | Builds user color dictionaries. |
| installRBColorChangeEvents()              | infinite-neck.js                     | infiniteNeckController| No            | Installs radio button color change events. |
| TuningsLibrary.showDefaultTuning()        | TuningsLibrary.js                    | Song/TuningsLibrary   | No            | Shows default tuning in UI. |
| TuningsLibrary.bindFormTuningsEvents()    | TuningsLibrary.js                    | Song/TuningsLibrary   | No            | Binds tuning form events. |
| bindDataActionHandlers()                  | infinite-neck.js                     | infiniteNeckController| No            | Binds data-action handlers for UI. |
| loadTemplates().then(...)                 | infinite-neck.js                     | infiniteNeckController| No            | Loads HTML templates and wiring widgets. |
| setWiringOpenState(false)                 | infinite-neck.js                     | infiniteNeckController| No            | Closes wiring UI. |
| $("#btnFlats").click()                   | infinite-neck.js                     | infiniteNeckController| No            | Triggers flats button click (reset notes). |
| $(document).on('keypress', ...)           | infinite-neck.js                     | infiniteNeckController| No            | Binds document keypress handler. |
| $("#txtCmdLine").on('keypress', ...)     | infinite-neck.js                     | infiniteNeckController| No            | Binds command line keypress handler. |
| $(document).on('keyup', ...)              | infinite-neck.js                     | infiniteNeckController| No            | Binds document keyup handler. |
| $(window).on('resize', ...)               | infinite-neck.js                     | infiniteNeckController| No            | Binds window resize handler. |
| transportResize()                         | infinite-neck.js                     | infiniteNeckController| No            | Resizes transport UI. |
| draggable(document.getElementById('transport'))| drag.js                        | infiniteNeckController| No            | Makes transport draggable. |
| showTransport()                           | infinite-neck.js                     | infiniteNeckController| No            | Shows transport controls. |
| scrollToTop()                             | utils.js                             | infiniteNeckController| No            | Scrolls window to top. |

---

- **MoveTo**: Suggests where the logic should ultimately reside. If not clear, defaults to `infiniteNeckController` as a marker for orchestration/controller logic.
- **likelyHeadless**: "Yes" if the call and its callees do not use jQuery/DOM, "No" otherwise (best guess, update as you triage).
- **What it Does / Summary**: Short description, update as you triage.

> Edit and check off rows as you refactor or triage.
