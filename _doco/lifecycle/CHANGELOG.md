# ChangeLog

### 20260823

Tag: v2.1-beta-11

- 933450e **2026-08-23** Cleanup
- e474b01 **2026-08-23** Desktop page working with buttons from help file, with stylesheet working too.
- c851634 **2026-08-23** Ready for Desktop tabs group
- ad5d728 **2026-08-23** Adding MobileKeyboard to Desktop page.
- 519098f **2026-08-23** Adding MobileKeyboard to Desktop page.
- 8c78074 **2026-08-23** Ready for implementation of runMobileCommandLine()
- bf2faae **2026-08-23** Moved constant
- 2305b4f **2026-08-23** Moved Macro calls into new MacroMenu.js and created Messages.js and UserLog.js
- 2e590af **2026-08-21** Added 4ths calculator to test the badges.  Probably won't use that, because the wired listener to P46 is better--it shows the cycle of fourths for the key in each section.
- 0c660a5 **2026-08-21** Added SHIFT-G for Grabbles on Floating windows toggle. Added 12-major-scale-w-ccalc.json which has a C-Calculator
- 051f799 **2026-08-20** These files missed the tag for v2.1-beta-10 but get included in the deployment.
- c4f20cd **2026-08-20** Fixed bug in 5thsCalculator, notes were wrong midi numbers. Added ListenerNotesource example badge to song-list description. Added 4ths calculator listener to 12-major-scales song.  This shows the notes in each key on the 4ths calculator, rather than just wiring the 4ths calc to all notes as the defailt calculator does with /vscp.  This is a cool use of 4ths calc.


### 20260820

Tag: v2.1-beta-10

- c4f20cd **2026-08-20** Fixed bug in 5thsCalculator, notes were wrong midi numbers. Added ListenerNotesource example badge to song-list description. Added 4ths calculator listener to 12-major-scales song.  This shows the notes in each key on the 4ths calculator, rather than just wiring the 4ths calc to all notes as the defailt calculator does with /vscp.  This is a cool use of 4ths calc.
- 97bba2f **2026-08-20** Added 12-major practice song
- 38d6d33 **2026-08-20** Song with black keys highlighted, and all 12 major scales
- c0e45ea **2026-08-19** Swapable top captions in Tool tables is working.  Added to schema and noteTableLayout and survives persistence round trip.  Tool table top captions are smaller, but follow normal caption role coloring.
- ca28aa8 **2026-08-19** Working on custom caption handling for Tool tables.
- 8e91898 **2026-08-19** Added special coloring for Role badges and captions when being a Notesource listener.
- be58bb7 **2026-08-19** Tweaking captions for Tool tables.  Kind of janky in that there are now multiples.
- 48a08aa **2026-08-18** FillPlugin and Notesource now respect automaticFromChart && literalChartedChord.  When both are true, we use the chart chord as entered, even if it does match the notes that may be in the Section.  User has entered a Chart Chord, and expects it to be filled as such and not re-rooted to Section Key.
- 1d1e649 **2026-08-18** Tweaks to get ready to add FillPlugin:literalChartedChord.
- c84da83 **2026-08-18** removed BS hardcoded html tests
- 3d84443 **2026-08-18** Spiffy changes for instrument role badges widget table and file save dialog uses white-space: nowrap now for roles.
- 2b18283 **2026-08-18** Added dockAll reFloatAll, changed button style on keyhelp for File, SHIFT+ESC,
- 6987cb0 **2026-08-18** Added T to show Themes menu. Added z to dock all, Z to re-float all. Added re-floating current menu if Floaty and menu is visible and re-float. Changed width on Event Wiring panel added getVisibleMenu Made all Menu floats have zIndex = 900.
- 7b234c6 **2026-08-18** Made all menu divs floatable by the Floaty checkbox in the menu now.  palette and themes have their Float buttons removed.  Info keeps its button.
- e11b42b **2026-08-18** Removed red border on .instrumentBackground when inside a floated .toolWindowRounded so that it is black on black. Added anchor button after Float button to anchor tables that should not be re-floated.
- 2338722 **2026-08-18** Fixed "visible" checkbox should hide floating windows too.
- 23a7a08 **2026-08-18** Implemented SHIFT+ESC to dock-all and float-all
- de62f32 **2026-08-18** Ready for it4
- aaabcb3 **2026-08-17** sprint-141 mostly complete.  Could add zIndex now.
- 16af4c7 **2026-08-17** It3
- 0ea16e4 **2026-08-17** Ready for Iteration 3
- 3751b2d **2026-08-17** Fixed sprint-141 Iteration 2
- 4ed8106 **2026-08-17** Ready for Iteration 2
- aafd222 **2026-08-17** Iteration 1
- e29eade **2026-08-17** Add it1 scope to request.
- cf57fa8 **2026-08-17** Ready for analysis
- d70a270 **2026-08-17** This test has a Perfect4ths Calculator, and it opens correctly.  However, it does not open floated.
- 259aba9 **2026-08-17** Perfect4thsCalculator working as singleton float window from command line /vscp. Has cute Fr and UN (Freeze and UnFreeze) buttons. /vscp floats automatically.  But opening from file shows it docked. Fixed missing mocks from jest tests.
- 1c742a6 **2026-08-17** Tool window for Perfect4thsCalculator working. Programmatic pop-up for calculator working from menu /vscp. Changed Perfect4ths to EveryNamedNote
- e7a9d38 **2026-08-17** Fixed ghost-table warning for ns notesource tables.  Tested Tool windows without notesource wirings still freeze DisplayOptions, such as widths for Presentation mode.  Also, toggling Diamonds doesn't work when instruments are floated.  This is a bug. Added minimal instrument caption to Tool tables.
- f5e53a8 **2026-08-16** Notesource working as a wiring source, Perfect4thsCalculator working as Tool.
- a0c6fd2 **2026-08-16** Ready for implemention
- 7709e44 **2026-08-16** Ready for alt analysis
- 0f75295 **2026-08-16** Ready for sprint-140 design
- c48571c **2026-08-16** Prep for Tool table: options looked up in Layout.ToolDisplayOptions, special Instrument Caption Row with just a Float button, Tunings now supports Tool as a checkbox and a tuning option.
- ebbdad2 **2026-08-15** Added section-status examples and diagram of parts
- 8e727a0 **2026-08-14** added command-line keyboard link.
- 0078fb8 **2026-08-14** Added space
- 1f16fd1 **2026-08-14** removed extra key displays from table.
- 7831c42 **2026-08-14** Fixed the /p menu so that all fingerings work, especially Finger0 and the "o" shortcut, the keep and find work again, the chromatic, and added the missing /prn "n) note (degree)" choices for selecting by scale degree (note1, note2,...)
- 6f1f903 **2026-08-14** Fixed the /p menu so that all fingerings work, especially Finger0 and the "o" shortcut, the keep and find work again, the chromatic, and added the missing /prn "n) note (degree)" choices for selecting by scale degree (note1, note2,...)
- 32283f4 **2026-08-14** Added macro examples.
- 374ffdd **2026-08-14** helpfile enhancements around section-status, LeftRail, and moving section-status to its own section, out of TonalPicker.
- 99a3ba9 **2026-08-14** Moved toggleCaptionLooperLayout to layout.js, added remaining keyboard-shortcut-only actions to menu (e.g. show/hide Caption).
- 04f0a72 **2026-08-14** Added setUIFromNoteTablesLayoutOptions which rips through noteTablesLayout and sets all LeftRail options for each table.
- 244839b **2026-08-14** ready for implementation
- edb53d7 **2026-08-14** NoteTablesLayout options round-tripping.
- 69c01ed **2026-08-14** NoteTablesLayout options round-tripping.
- f3d4423 **2026-08-14** Got the C and S buttons to read from data-tableid, and toggle thence.  Next we will persist these values.
- 6d66b68 **2026-08-14** Installed Song.Layout to handle toggles of CaptionRow, WidgetRow, SongTitle, LeftRail, LeftRailCaption, LeftRailSectionStatus, separately in fullscreen and escaped.  Persists to file and loads on no song and on open song.  Grays out left rail layout buttons on SHIFT-E when hiding.
- c3fbc5d **2026-08-12** Added details about roles and colors used in the Left Rail and section-status widgets.
- e380403 **2026-08-12** More examples and images for View Layout help, and Variables for Captions, with plugin status widgets.
- a8cbb31 **2026-08-12** Added help for View Layout and all toggling keystrokes, with images.
- bc15421 **2026-08-12** Added ability to toggle useCaptionForSectionCaption from menu, which then persists in song.  No feedback in menu, just use /vdf to see if it is there. Added toggle for song title in /vht /vst
- 799a4e3 **2026-08-12** show/hide widget row (caption row with widgets).
- 8a7880f **2026-08-11** thicker border
- cf8dc80 **2026-08-09** added midi8x8-black-keys
- def3bcd **2026-08-09** added MIDI 8x8-P4
- 24a05a5 **2026-08-09** removed escapeHtml() which was unnecessary
- 8c765dc **2026-08-05** turned into two separate macros for white and black to shorten the runtime.
- e555b22 **2026-08-05** Added switch links for P4<-->S6
- c3b4ac9 **2026-08-05** added do-all-keys which calls fill-one-key which calls fill-tiny-automatic
- 6099131 **2026-08-05** Added hidden S6 listener so it can be turned on by macro.
- efd5f1a **2026-08-05** sprint-139-macro-call Iteration 3: refactor into own module MacroEngine.js
- 721227e **2026-08-05** sprint-139 Iteration 2 to make a MacroEngine with yields is basically working, but has clogged up key-handlers.js
- 25dda39 **2026-08-05** Added S6 listener to supersong-C, but not template yet.
- 8c5d68d **2026-08-05** added supersong template
- 948c051 **2026-08-05** Added working call-all macro
- 4888dcb **2026-08-05** sprint-139-macro-calls working, and added song which uses them: supersong-calls.json
- b026c3d **2026-08-05** sprint-139 ready for coding.
- 5f6f0b5 **2026-08-05** ready for design
- b1f7943 **2026-08-05** ready for sprint-139 design
- e951de1 **2026-08-04** Added other chords to macro.  Made it so macro clones and navs rather than doing C every time.
- e6192b0 **2026-08-04** Made tutorial strict mode controls hamburger follow Sections like the sectionList does, by cloning that toggle button into the hamburger button, including an upside-down arrow pair.   Hidden in wizard mode because wizard mode does not do sectionList or looper controls.
- 92c3d2a **2026-08-04** macro working to fill tiny notes in chord using noteAutomatic, against noteTransparent diatonic named in C.
- ab22fff **2026-08-04** Added handling for tutorial strict such that if song.tutorial.useCaptionForSectionCaption is present and true, then the Section.caption values are used for song.section.tutorial.caption.

### 20260803

Tag: v2.1-beta-9

- 1439db3 **2026-08-03** added supersong-C
- 85305f3 **2026-08-02** added superson
- cecdc84 **2026-07-31** Added css rule for `.infoRendered u a` which creates pseudo buttons.  Added this to help.
- 4637792 **2026-07-30** updated double-blues-scale.json song
- 22409c0 **2026-07-30** added double-blues-scale.json song
- 612aa6d **2026-07-28** Added key::leadKey to LeadSheet detail line display, similar to other Bar Style displays.  You can turn it off (with the beat counts) by turning off "Show section detail line". No real reason to split it out from beat counts.  Did not add to LeadSheetLine.
- 2f5d67a **2026-07-28** Made keymap entry smaller
- 10f9de4 **2026-07-28** Fingerings regression is on much older version on server, so not in last commit. Fixed helpfile un-closed i tag.
- aecb3ad **2026-07-28** Removed imports and providers that VSCode said were not being used.  Did basic testing to see if things still worked.  Only thing funny is that /pf setting of fingerings doesn't check the Fingerings radio button, which seeems like a regression because I think we fixed this already--TODO.
- 2dffb77 **2026-07-28** Added Beat Looping keyboard shortcut to allowed keys in tutorial strict, also -,=,_,+, and ) for resizing fonts. Added menu /fml to list all macros (macroListAll) to showMessages because once you have more than 9 macros, you can't run, edit, etc. them by number, just ID.  So you can get the list of IDs by /fml. Added macros to test LeadSheet and LeadSheetLine to L001-1.json tutorial.
- 870d6bb **2026-07-28** Cleaned up help and added help around keyboard shortcuts (beat looping, stop looping), new transport image, updated transport actions table. Fixed keyboard shortcut span radii.
- 177cf34 **2026-07-28** simplified to just one menu item to hide charts, does the right thing in fullscreen and normal, since you can't show both LeadSheet and LeadSheetLine. Added Legend and coloring in keymap help. Added B keymap  to toggleLoopBeats(). Added N keymap (New Beat) to addBeat()
- 9612640 **2026-07-27** Updated sprint documents
- af236dd **2026-07-27** Added feature required by sprint-138-tutorial-mode to have fullscreen Chart in addition to existing fullscreen LeadSheetLine.  They are exclusive, in that in fullscreen or strict tutorial, only Chart or LeadSheetLine may be seen at one time only related to fullscreen.  And the choice of showing either is unrelated to non-fullscreen normal mode.  They are persistent at run-time in each of these modes.
- 420445a **2026-07-27** Added help for keyboard E (toggle left rail)
- e0e086a **2026-07-27** Added quick-n-dirty toggle to left rail with SHIFT+E.  Sync is a bit funny when you have instruments out of sync with toggle. Added scales-major practice song.
- 8bd5f0e **2026-07-27** Added hand entity for sharps/flats to plugin allowed value so it can be chosen, and so that it can be absent for key of C with no sharps/flats.
- bc79c2f **2026-07-27** tonalChartModeNotes to enharmonicTransposedModeNotes because it hints that you'll get double-flats, which happens, e.g. in Bbb in Db minor.  Also that you'll get a Cb in Ab minor.
- a123d69 **2026-07-27** Added small to flats in getApprovedCaptionValue.  Added scales-major-minor.json which uses this.
- 5ace326 **2026-07-27** Taught TonalPlugin show transposed notes in correct sharps/flats.  To do this, I moved  ChartInput.getPreferredRootName to call  Constants.getPreferredRootName. approved-values now has tonalChartModeNotes, in addition to recently added tonalTransposedModeNotes.
- c72c06f **2026-07-26** Added getApprovedCaptionValue() with "tonalTransposedModeNotes" to TonalPlugin which dumps out the note names in the mode of the current Section when used in the Caption.
- 78663a5 **2026-07-25** Added param  to hideAllMenuDivs(openingSong) so that we can hide divs without triggering mid-song-load persistence of non-existent info or openInfo.
- cb99dd4 **2026-07-25** Fixed bug where FillPlugin was not respecting the key of the Section but using the key embedded in the chart chord and mode when "automatic from chart" was true.
- 9f2c15f **2026-07-25** Added more space below left caption.
- 7eb39ef **2026-07-23** Fixed tests for Tutorial layout changes, and added function in Themes.
- 97aa362 **2026-07-23** Added 'Allow Theme Automation' checkbox and display of values to View, and its stored 'sectionTheme' variable in Song, schema, and DisplayOptions. Added collapsing of menus and hiding of command-line when a file or URL is opened, including tutorial links.  This especially hides the Song Library when you click on a song.
- 8c2c013 **2026-07-23** td without class snuck in and corrupted all td's.
- a776a5d **2026-07-23** Fixed left rail caption/section-status widget side-by-side versus vertical.  Removed Cody error of flipping the CaptionRow versions. Fixed %2F instead of / in URLs. Added themes by id to menu for macros. Tweaked tutorial layout (added arrow for section toggle). Added dump theme ids to menu. Added show/hide for left rail widgets to menu. Mostly fixed no-drop for tutorial cells, but some nav actions replace it with regular hand, but cells are still locked to KEEP anyway. Made Instrument Captions have background colors for Observer and Listener--mostly black but subtly green and blue.  Regular is pure black now.
- 5fb381b **2026-07-22** Updated lockKeep in presentation.js and infinite-neck.js so that if tutorial.mode==strict, then keep button stays selected across navigation actions.
- 95039c7 **2026-07-22** Keep, keyboard shortcut filtering, and chrome removal and reset are now working via resetTutorialChrome().
- ab8b393 **2026-07-21** Sprint 138 basically working.  Looping tutorial buttons aren't getting all the broadcasts, so they lose captions when the section rebuilds the tutorial prompt area.  Chrome not removed, keyboard shortcuts not removed.  No splash screen.
- 8a11334 **2026-07-18** Ready for Iteration 4 Implementation
- 1203801 **2026-07-17** Preparing for Iteration 4.  Tutorial Song in place.
- 815ebaf **2026-07-17** Building tutorials
- f61d852 **2026-07-17** Fixed bug where Fingering didn't respect font size when a recordedNote, and no Fingerings were respecting hides, per comment, which Cody fixed.
- afcb093 **2026-07-17** Building tutorials
- 1594219 **2026-07-17** Added one-string guitar
- ba8e7b1 **2026-07-17** fixed bad link
- f4b4e3d **2026-07-16** Putting stub prompts files in for the course outline songs.
- ba7fa37 **2026-07-16** working on it4
- 4fb4c21 **2026-07-15** Ready for It3
- 4566225 **2026-07-14** got rid of splash animation
- 912a97c **2026-07-14** 138 it2 implementation plan done
- df685d4 **2026-07-13** Ready for It2
- 971e5f7 **2026-07-13** Ready for Iteration 2
- 4166bcf **2026-07-11** Preparing for sprint-138-tutorial-mode; one small change to key-handlers to add AddBeat.
- 535aaa9 **2026-07-10** Added tonal plugin actions: prinnt chord, print mode.
- 66a7886 **2026-07-10** Added note1 to root in addition to already having noteRoot
- d400fa3 **2026-07-09** Fixing FillPlugin
- 24bf56a **2026-07-08** Added song to show natural minor against ebony/ivory
- 16326a5 **2026-07-07** Brought Info into update with "lines"
- 75593e6 **2026-07-07** Fixed Info in both songs
- d6c2ccf **2026-07-07** switched from <menu> to <cmd-line>
- 5378f70 **2026-07-07** Added helpfile link to songs Info page.  Changed kbd to menu.
- aa5ef43 **2026-07-07** Swapped <kbd> and <menu> in Info editing.  Added more song library help notes.
- 95f23d6 **2026-07-06** updated Info
- b8b339e **2026-07-06** Added song library instructions to help, and updated LooperLight images.
- 2a9c27c **2026-07-06** Help for fragments updated
- 8786185 **2026-07-06** added URL parameter handling, and sanitizer allowance of, opening a song by URL, and pasting a song like like this in Info.
- 456874b **2026-07-06** Updated all to 60BPM, all these now have Info.lines[] array instead of single line.
- f041bd2 **2026-07-06** Changed Info to be array of string lines instead of one string with linefeed chars.
- 0ee099b **2026-07-05** Condenscing songs into multi-instrument flavors with macros to turn instruments on and show them, and wire to plugins.  Moved single-instrument versions to _trash for now.
- 9b703eb **2026-07-05** Cleaned of old notes, Cleared, Reset.
- 7cfd6ea **2026-07-05** wired new /fptgri into key-handlers.js, fixed pantatonics song to actually use this new command in a macro for P48 only.
- b90c4a4 **2026-07-05** added /fpfgri for example, but to all graveyard raise... now they all support raise by stable id.  Also, added superlink-style links to Info for pentatonics-7-m-V7-in-6-keys-with-fill-ALL.json so it could run with selected instruments AND set the chord/mode raise.
- 8b608e7 **2026-07-04** Added basic Macros help
- b881ae3 **2026-07-04** Added more multi-Instrument action to songs using macros.
- 3682177 **2026-07-04** Fixed some keymappings.  Added screenshot for DisplayOptions-from-other-pages.png
- 318d1a2 **2026-07-03** Added Event Wiring, Observer, Listener, Roles, and color-scheme examples.  Reordered main sections under File.
- ebf4661 **2026-07-03** Cleaned up File Info help.
- 70ad779 **2026-07-03** Made name-that-note-bass-ALL.json the official song.
- 1a9cdec **2026-07-03** Obviated by name-that-note-bass-ALL.json
- a225baa **2026-07-03** sprint-137 Iteration 2 complete.
- 2f0fb3c **2026-07-03** Sprint-137 Iteration 1 complete.
- a09681c **2026-07-03** More options commented on.
- abba0c2 **2026-07-03** Ready for 137 implementation.
- 010c737 **2026-07-03** sprint-137 opened.
- 6637ece **2026-07-02** real file is tunings.js, this was for validation at some point, no longer needed.
- 9eebab6 **2026-07-02** Cleaned up Song Library intro. Fixed broken tests.
- afb4df6 **2026-07-02** Added chartreuse to changed properties, inputs, and outputs in Plugin Audit.
- 9309ebe **2026-07-02** Removed PianoSkeuomorphic as an actual Tuning, because now it is a behavior based on the PianoSkeuo checkbox.  Now Piano is the base Piano tuning which can be skeuo'd.
- 5aedc56 **2026-07-02** Tweaking captions in new Role borders with padding and margins
- e95663c **2026-07-02** Iteraiton 5 implemented.
- eb18e19 **2026-07-02** Next iteration
- 6374762 **2026-07-01** Added badges to File save as area.
- 3f2ee4e **2026-07-01** 134-it4 implemented
- 7e1a058 **2026-07-01** Ready for Iteration 4 Design
- c2eecb4 **2026-07-01** Updated visibility
- 1b77da4 **2026-07-01** Moved relativeSection down below REC light in LooperLight.  Tweaked Song Library badges CSS.  Removed obviated directory ./css/ from build.  Defaulted row height to 30.
- 79fae9d **2026-07-01** v2.1-beta-8


### 20260701

Tag: v2.1-beta-8

- 1cbe7af **2026-07-01** Added demo with Observer, tweaked update-song-list, tweaked CSS for not visibles.
- 7dbd776 **2026-06-30** 134-it3 done
- 9bc6762 **2026-06-30** Ready for implementation 134-it3
- 1c6803d **2026-06-30** Ready for implementation 134-it3
- 8170176 **2026-06-30** fixed tests for, and removed legacy handling of, visibleNoteTables.
- d4bf098 **2026-06-30** getting rid of visibleNoteTables
- 692a3bd **2026-06-30** finally got rid of all songs with visibleNoteTables.
- 47ae7be **2026-06-30** test no longer needed
- 7889ec5 **2026-06-30** song cleanup
- b908a63 **2026-06-30** song cleanup
- a2af138 **2026-06-30** song cleanup
- 3c17f57 **2026-06-30** cleanup
- 43aa2fb **2026-06-30** song cleanup
- 541a5a0 **2026-06-30** old test song cleanup
- 3a5f2ef **2026-06-30** removed obviated visibleNoteTables
- de55171 **2026-06-30** bad copy
- f88a6b0 **2026-06-30** song cleanup
- 352d81a **2026-06-30** song cleanup
- 2e45d7a **2026-06-30** cleaning
- faa288d **2026-06-30** cleaning up obviated songs
- a82f436 **2026-06-30** plan reviewed
- d8e1c08 **2026-06-29** Ready for sprint-134-it3
- 45b2a0b **2026-06-29** Ready for 134-it3
- 3c6621f **2026-06-29** added theory/*S6*
- e09af16 **2026-06-29** Add ChartInput
- 818aecf **2026-06-29** New directory for songs/theory, with two songs showing transposing modes with light themes.
- 1cc60ef **2026-06-29** Added ./fill/ to deploy
- 86c3885 **2026-06-29** Cleanup
- 45a3b4c **2026-06-29** Added Section to ChartInput
- 15b611a **2026-06-29** Cleanup _doco and bin.  All are obviated, some are moved to _doco/archive
- 718e65f **2026-06-29** migration complete, plus this thing had a bug that lost some information.
- a4d48a6 **2026-06-28** v2.1-beta-7

### 20260628

Tag: v2.1-beta-7


- efd03fc **2026-06-28** Moved name-that-note* into own directory. Added new build.sh script. experimental.
- 1434153 **2026-06-28** chart-input focus fixes
- 8dd2258 **2026-06-28** chart-input Iteration 2 with help and easter egg to create new Sections "!f/c" creates new Section in C with LeadKey F.
- 677793d **2026-06-28** Ready for sprint-136 it1
- 60ef4c0 **2026-06-28** Cleaned up sprint doco and tweaked PluginAudit for more graying out of impossible audit cells.  Preparing for sprint-136
- c28bf43 **2026-06-27** Updated FillPlugin to emit "root" instead of "r", similarly "chord" and "scale" for outputs column of audit plugins.
- a0c9830 **2026-06-27** Iteration 3 working
- 9d45783 **2026-06-27** Ready for Iteration 3, sprint 135
- 0ce1df6 **2026-06-27** sprint-135 Iteration 1 done.
- f05b9d4 **2026-06-27** Ready for Iteration 1 sprint-135
- db05266 **2026-06-27** Ready for sprint 135.
- d58d2f8 **2026-06-27** Rounded corners for LooperLight using em not percent. Added CSS corner-shape as themed variable noteCornerShape. Used this to fix theme 'Blade'. Added theme Mahjong. Added i, em to info.css from song-library.css Added positions to name-that-note for S6.
- 438b0a2 **2026-06-26** moved piano-f-guitar to piano-follows-guitar.  Stylized song-list more.
- 63a13ae **2026-06-26** Added more instruments
- eb00c4a **2026-06-26** This song was broken.  See the remaining, similarly named songs
- f01817c **2026-06-26** Cleaning up song-list and curating songs.
- c326bf7 **2026-06-25** moved to demo; duplicate songs.
- ec86d3e **2026-06-25** SongLibrary redo. sprint-134.  Also, moved songs into new folders
- d85cb6b **2026-06-25** Ready for 134 Iteeration 1 implementation plan.
- 2f47df5 **2026-06-25** Ready for sprint-134
- e5b390a **2026-06-25** Added rule so that help.html and help-plugins.html can be linked from File > Info. Added help link to name-that-note-bass-4.json song.
- c4c7716 **2026-06-25** Added one-line command-line
- 1a58092 **2026-06-25** Cleaned graveyard, and mojo currentColorDict
- 2493423 **2026-06-25** Added /vt (view toggle) menu.
- 3fc9a97 **2026-06-25** Fixed id's chrome devtools was complaining about
- 6844779 **2026-06-25** Added index to show/hide; top-aligned text for action columns.
- e934f37 **2026-06-25** Broke the stylesheet with bad comment on :root
- a1033c0 **2026-06-25** cleaned out graveyard, disabled Fill
- 9c87483 **2026-06-24** name-that-note-bass-4 is working
- 840bc88 **2026-06-24** Fixed startup keys.
- 8397534 **2026-06-24** Same song, different USER theme.
- 81e5d00 **2026-06-24** Song works with transpose, fill, and arpeggio in positions.  Fill puts in TinyNotes so that Arpeggio skips them and just arpeggiates the chords. Both plugins listen to chart.  This is a good baseline practice song, which you could change with plugin links.
- 80a304c **2026-06-24** updated with file import completion
- c53ede6 **2026-06-24** Added to themes: singleNoteShrink and singleNoteShadowColor. Added import/export between plugin properties for /fpap and /fpfop.
- 6a523f9 **2026-06-23** Fixed cyan for Fill active position, just like Arpeggio.
- 2ea6103 **2026-06-23** 133-it8 testing well.  Ready for positions linkage import/export between plugins.
- fd066a8 **2026-06-23** ready
- 045863d **2026-06-23** typo in name
- 0883ba4 **2026-06-23** Ready for 133-it7
- ca38502 **2026-06-23** Cleanup
- d8172dc **2026-06-23** Added practice song that excercises Arpeggio reading from chart doing chords and/or modes.
- d5926b5 **2026-06-23** Edits to Fill lists to line up with Tonal suggestions.  Extended Wester Filter. Fixed tests with expectations.
- a258a8b **2026-06-22** Moved aliases and captions to match triggers.
- 5e8ee4d **2026-06-22** Ready for 133-it6 Fill page refactor to use FillPlugin.
- 9850f9c **2026-06-22** Refactor of Tonal normalization is working well, except Fill page has been marooned.
- 630054a **2026-06-22** Arpeggio with auto chart is working well for chord and mode.  M7sus4 comes up empty because it is a Tonal.js set, but not in Fill defaults from infinite-neck.
- e529c6e **2026-06-22** FillPlugin fixed for auto chart.
- a2624b4 **2026-06-22** Added 'none' to fill mode and chord defaults.
- 356e1df **2026-06-22** sprint-133 working. random and flashcard work based on named and single.
- 2a1e422 **2026-06-22** arpeggio basically doing name-that-note randomly, based on SingleNotes for now.
- ad6569b **2026-06-22** Ready for implementation of sprint-133 Iteration 3.

### 20260621
Tag: v2.1-beta-6

- 6762c5b **2026-06-21** sprint-132 Iteration 2 song loops per position is working, and works with different settings per Section.
- d154d3b **2026-06-21** sprint-132 working
- b5164a3 **2026-06-21** Ready for sprint-132 implementation.
- f4cf70b **2026-06-21** updated screenshot of file menu. 130-it2 complete.
- e7cc269 **2026-06-21** Added space back in for modes. Added gif of infinite-neck looping over modes with transposition and transposed chord names.
- 28b60cd **2026-06-20** Add transpose root back into chart and leadsheet etc. when checkbox is checked.
- 2516705 **2026-06-20** Added html tags to sanitizer for kbd and children i and b to support special styling for these so User can do command-line examples. Added 'automatic from chart' to FillPlugin. Cleaned up dropdown command-line results. Added UserLog for frequent messages that shouldn't disrupt flow, but need to be saved for longer than showMessages. Added special view-only handling of Chart for transposition: strip chord root name from chord using approved Tonal.js root stripper for chord and mode.  Thus, when you transpose from the chart, the chart looks right and displays only the chord function not the root.  Will need to be added back in with current key, but works for practices, where you can watch the Key status widget. See: formatChordWithoutRoot. Fixed plugin>graveyard>raise to use number every time.
- 1d89d6d **2026-06-20** sprint-129 working!  Link (URI fragment) is placed in Info, and superlink can be constructed by editing Info.  Link and superlink work to revive one plugin(link), or many(superlink).
- a3cc6b9 **2026-06-19** This was sprint 903 Phase 2. Cache and logging are in place.
- bd3a3c1 **2026-06-19** sprint-903 Phase 1 complete
- c0aa547 **2026-06-19** plan accepted
- 1345c0c **2026-06-19** investigate optimization
- 5fdae3c **2026-06-19** sprint cleanup
- e595f11 **2026-06-18** Removed menu brittle test in menu-value-resolver.test.js Cleaned menu.js from old presentation switches.  Added two new ones to show View dialog and to /vdd from /vp. Added tag v2.1-beta-5

### 20260618
Tag: v2.1-beta-5

- d4b06b9 **2026-06-18** Moved TinyNote defaults around a bit so they don't cover the radius on SingleNotes, and hang out nearer the fret.  Made them round by default.  Square is still there for customization of radius. Updated help for palette. Fixed presentation.js and palette.builder.js so that Fingerings participate in Last Color chosen radio button scheme.
- 3213023 **2026-06-18** Updating headers
- 61a8dea **2026-06-18** added bass5, bass6. Added instructions on noteRoot
- ab6af73 **2026-06-18** Added overview of Listeners and Observers
- c3e0dee **2026-06-18** renamed rootNote* noteRoot*
- 473502a **2026-06-18** test case for multiple players claiming noteRoot
- 8b4b9a2 **2026-06-18** Song that shows how different players set noteRoot
- d49af01 **2026-06-18** Special treatment for noteRoot, without messing up the color lookup context. Fixes bug where placing noteRoot of G in the bass changes colors in the guitar even though the Section is in C.
- cc54441 **2026-06-18** song demonstrate noteRoot bug
- ae3b4b9 **2026-06-18** Updated build date
- b84629d **2026-06-18** Ready for v2.1-beta-4

### 20260618
Tag: v2.1-beta-4

- 3683c09 **2026-06-18** Removed test that tested menu structure.  We need to get rid of all of these.
- 9e7d308 **2026-06-18** Updated help with lots of screenshots and text explanations of TonalPicker.
- 37d4cc9 **2026-06-18** Updated help with lots of screenshots and text explanations of TonalPicker.
- 90d03d6 **2026-06-17** Added Tonal to help
- 9311505 **2026-06-17** sprint-119 cleanup
- 28a3f0e **2026-06-17** Fixed MiniPalette to have clickable cells.
- 284652f **2026-06-17** Moved noteRoot first on palette (after special Emboss and Auto). Added to theme and controlsToDisplayOptions etc: noteRoot and --note-root-color.  And added noteHatchedRoot instead of noteHatched. Moved palette radio button functions from key-handlers.js to new independent module paletteUtils.js
- b32866c **2026-06-16** updated scp instructions
- 599f493 **2026-06-16** ready for v2.1-beta-3
- 2c9e3e3 **2026-06-16** commit version tag

### 20260616 
Tag: v2.1-beta-3

- 2c8c071 **2026-06-16** Added BS mock to test so it matches the actuality of runtime. :(
- aa10ee9 **2026-06-16** sprint-119 Iteration 7 done.
- da82c57 **2026-06-16** 119 iteration 7
- f01f199 **2026-06-16** Ready for sprint-119 mini-fixes autoColor, currentColorDict display and dirty flag.
- 5fc4ad0 **2026-06-16** Removed brittle test that just checked the menu structure of TransposePlugin. Moved Special Spacebar Mapping to section where it is already partly defined
- b779e79 **2026-06-16** Help file updates.  New intro with animated gif, special SPACEBAR mapping, ebony-ivory image.
- c4af744 **2026-06-16** added .deadCell to css and removed inline style when deadCell due to banjoNut etc.
- cadb293 **2026-06-16** ca
- b3afac8 **2026-06-16** sprint-128 complete
- 35095a2 **2026-06-16** /vp presentation menu re-org
- 3e264d9 **2026-06-16** 128-it3 working
- 856a21b **2026-06-16** tweak
- 122450f **2026-06-16** Ready for Iteration 3
- e3ccf9f **2026-06-15** 128-it2 working.  Played notes and recorded notes diverge when chroma exceeds 12.
- 489e491 **2026-06-15** Ready for 128-it2
- b3d5d86 **2026-06-15** ready for 128-it2 analysis
- 2de0fdc **2026-06-15** Fixed bug where rootIDLead was being treated as falsy for TinyNote when it was 0, but -1 is the real "not set" value.
- 3e11a0c **2026-06-15** 128-transpose-recorded working well.
- 1b98920 **2026-06-15** Ready for 128-transpose-recorded
- 7c9a399 **2026-06-15** Fixed algorithm where Bend was hitting the Nut and disappearing/dropping rather than jumping up an octave for "string" and "octave".
- 784bd3a **2026-06-15** Remove test entry which forced error message.  Testing done, we are back to the correct set in runtimeChildrenActionMap
- fbb3387 **2026-06-15** Cleaned up warnings from `npm run validate:cmdmenu`
- 2a0884d **2026-06-15** Added midi paste option to /fpcrpm. Removed default from /seii.
- 5337609 **2026-06-15** Fixed caption and default for INPUT for /seii
- 9588d1d **2026-06-15** sprint-116-it6 implemented
- 204bf27 **2026-06-14** getting ready for sprint-119-it6
- 9e91221 **2026-06-14** 119-it5 changes for /sei, including plugin-style menu resolvers for static command-line menus.
- d5e9e45 **2026-06-14** Working on adding descriptions to help-plugins.html
- ed7ca57 **2026-06-12** small edit
- 2905e91 **2026-06-12** Updated help with Wiring updates: MUTE and Capture.  Added screenshots of Guitars and Pianos
- 1b1e20d **2026-06-12** Actual fix for staleness on /fpoa is to refresh all plugins on command-line menu dives.  sectionChanged==>pluginManager.refreshPluginsMenuNode(). Also key-handlers.js: parkCommandLineAtPath()==>pluginManager.refreshPluginsMenuNode(); and case '/'.
- 0a17e80 **2026-06-12** Rolled back change from previous commit.  this is pristine to how it was before previous commit that had commented out attempt by Cody to fix /fpoa
- ae6471b **2026-06-12** This commented out block is wrong.  Real change goes in infinite-neck.js and key-handlers.js in next commit.  This attempt by one of the Cody brothers was to fix /fpoa by hard-coding it into command-line.js.
- 44626ff **2026-06-12** Handle special AutoColor when noteRoot
- e18d8f6 **2026-06-12** Fixed TinyNote and Bend to have important on 2px orange border, so now TinyNote of I shows up against NamedNote note1. Moved Themes Gallery in TOC in help. Added /vpa and /vpm to set presentation mode from command-line. Modified NoteTableController: createNotetableLookupContext so that tableID can be passed in when doing special AutoColor case of noteRoot. section-printer: tightened up Caption width allowed in Chart>Notes TonalFunctions.js: Added rule that TinyNotes, since they follow leadKey, noteRoot is different for them if used in tonalSourceSet. Added a bunch of multi-row Organs in tunings.js. Defaulted Piano to PianoSkeuomorphic. Changed noteRoot to use noteHatched, not noteHatched6 so it would be more dramatic. Added /fpoaN to automatically accept Chord, Mode, and do next section.
- 1ad6008 **2026-06-12** Special fix put in for how userColors.js resolves noteRoot, so that a bass player playing noteRoot (or any other table) can inform Tonal.js in tonalResult.noteRootTablename .  Now noteRoot is shown in noteRoot styling instead of note1 in any table that own noteRoot in AutoColor mode.
- 58b1fb6 **2026-06-12** v2.1-beta-2
- 0e35ca6 **2026-06-12** fixed test for multi-level Piano Skeuo.
- a4b7114 **2026-06-12** Removed restriction that it has to be one string.  Multi-string Piano instrument seems to be working well as a model of multi-level organs.  Keyboards scroll together.
- d62e397 **2026-06-12** Updated copilot instructions for filename clarity.  Removed copilot phone notes since phone flow didn't work well.  Updated daily.md and sprint planning docs for V2.1 readiness.
- 417987f **2026-06-12** Instructions and build process as part of sprint-124


### 20260612
Tag: v2.1-beta-2 

- Added multi-level keyboards for Piano when in "Piano Skeuo" mode, so "Piano Guitar 2Row"/PianoFrets2 works.
Tag: v2.1-beta-1

- 2a84855 **2026-06-12** added new chart options to schema. Changed file,download dialog to ask for confirmation of song loss, not append-song, which is moved. Fixed bug where you couldn't add highlights to instruments listened to. Added feature to TonalPlugin where you can set the Tonal source set (Named, Single, Tiny) from the command-line, and apply it to all Sections optionally. Added new sprint-121 songs.
- 8cd2edf **2026-06-11** PianoSkeuomorphic  now has Fingering horizontal position as a DisplayOption
- 40e3224 **2026-06-11** Capture and MUTE on Wiring work.
- b0c554a **2026-06-11** Fingering was bleeding through the Nut when un-fingered. ClipPlugin was ignoring Piano notes.
- 9bfb51f **2026-06-11** Added new chart HEADNames values.
- 9487236 **2026-06-11** Added Chart HEADNames, fixed Nut showing duplicate midiNum, notefunction.
- 0941807 **2026-06-11** PianoSkeuomorphic now has more brown-ish black keys to work better with noteRoot.  Also, various fixes to Bends and Fingerings and bug where Fingerings where causing white keys to jump to foreground.
- 9eb34fa **2026-06-10** PianoSkeuomorphic now has adjustable white-key/black-key width ratios, from 1 - 2.5, since standard is somewhere between 2.2 and 2.3, but infinite-neck note names look better closer to 1.5.  1 gives equal width, which is useful.  Less than 1 would break as black keys would overlap.  More than 2.5 is silly because no pianos are like that, and the note widths are difficult.  Also, dropped all custom colors and use now the standard color/role/note scheme colors such as noteRoot, noteChord, and note1.
- 3ffc826 **2026-06-10** Did a push with the new build process, rescaled some theme examples, updated help to use new, smaller images, removed manual coloring from piano-skeuomorphic.css because it was not participating in the note/role/color scheme, but was instead hardcoding some browns and such in the css.
- 36afcca **2026-06-10** New 4-button radio state in effect, bugfix round 1 done.
- 6ec9206 **2026-06-09** Ready for 127-ui-consitency mode refactor for KEEP,CLEAR,Find,paint radio group.
- 947aefa **2026-06-09** Fixed the noteDropper to handle the other note types like SingleNote, that were apparently broken when we went away from namedNotes at Section level.
- 4944e1d **2026-06-09** Ready for noteDropper fix
- ae6fa34 **2026-06-09** Changed DisplayOptions to propogate to other Sections for any navigation.  Added .riskyButtonActionRequired class so Display Options can clue that SAVE is needed on View options page.  This required a "dirty" mode flag.  Fixed radio buttons in palette, so KEEP works and has special cursor and border shadow highlight to clue user a bit more, CLEAR now has a special cursor, and works for all NamedNote and playedNotes, but leaves recordedNotes untouched.  Special handling for Multi and Pitch highlights--nothing in REC mode, otherwise CLEAR just the highlight in the current cell, leaving others, and don't place new highlights, and clear NamedNote and playedNotes, even though Multi and Pitch may be selected.  Most work is done in clearPlayedNotesAtCell and clearNamedNoteAtPitch and clearTransientHighlightsAtCell.  Current palette last button now has a backglow box shadow in updateRestoreRbColorButton(). Minor tweaks to section-status.
- 25e5830 **2026-06-09** Tightened up vertical left-rail looper light padding and border spacing.
- 165dc24 **2026-06-09** SongFunctions.js was a test, and now its one function lives in Song.js::getDisplayOptionsInEffect
- 65b8ce7 **2026-06-08** Added radius and more positions and font sizes to TinyNotes
- fe92d65 **2026-06-08** Added percent positioning of TinyNotes all around the cell.
- 1938eeb **2026-06-08** Finally figured out max() and calc() with var() for css rules.  Got TinyNotes to behave on small cell sized.
- 059d84b **2026-06-08** Sprint-122 COMPLETE. Also bugfix for command-line one-line, and section-status widget not following observer section numbers correctly.
- 3c0abaa **2026-06-08** Observers can't listen to each other, Context lookup is fixed for Observers getting autocolor from current section, Observers can't be clicked.
- 06f41dd **2026-06-08** tweaks to keys in section-status.  regex to prevent non-identifiers in instrument names, because they become css selectors.
- 823951c **2026-06-07** cmdBackgroundOpacity installed in menu. Guitar themes tweaked and added with Glow options. Added thin blue border on noteBlack so it works with black on black themes and note1 doesn't just disappear. Subtle enough not to mess up other themes. added on setOneCssVar() call in infinite-neck.js to set command-line opacity.  Added REC light to LooperLight near section mark.  Tweaked left rail section-status to center align.
- 037db00 **2026-06-07** Sprint-122 Iteration 5 Round 5 wrapping up.
- 1828b1c **2026-06-07** Ready for 122-it5 coding.
- 52b1fbf **2026-06-07** clean empty tables, empty recorded beats.  Added remove unused tables to /far  menu. Prep for sprint-122 it5.  Organized all sprint-122 doco.
- 6445fcd **2026-06-07** Got rid of defaults in tunings that show string divider. You can still add it, but no instruments do it by default now.
- 2150c2e **2026-06-06** More Guitar Themes, tweaks in Chart, Caption line; added "from" to Tunings in Song to clarify fields for User tuning creation and figuring out MIDI paste compat.
- 2aeeaa2 **2026-06-06** Organized sprint doco
- 6bfebed **2026-06-06** Cleanup
- 0f56ff9 **2026-06-06** sprint-126 COMPLETE
- f93447a **2026-06-06** sprint-126-piano-listener passing UI Acceptance
- eff2d2c **2026-06-06** Ready for coding.
- 1176cf3 **2026-06-06** Ready for sprint-126-piano-listener
- 558299f **2026-06-06** Fixed 122-it4 incompleteness.  Now Theme selected persists and loads correctly, preserviing last USER choice in userTheme.
- 8e5db55 **2026-06-06** 122 it4 bug
- 923bf28 **2026-06-06** sprint 121 updates
- d4ff060 **2026-06-06** added songs/sprint-121
- d623b4c **2026-06-06** Added 'piano+guitar.json' song which tests the new guitar strings skeuomorphic, plus overrides note1 with a hatch for piano, and noteRoot with a prominent hatch for testing noteRoot, which is defaulted now to a subtle hatch.
- 09e6386 **2026-06-06** guitar skeuomorphic theme working
- 51dc7ce **2026-06-05** user color dicts are now filtered on download and put in the right order on load.  finishes sprint-122 for colordicts
- 5d7fe92 **2026-06-05** Before winnowing userColors
- 8d53d9e **2026-06-05** Tweak section count and beat count with min-width, when Show LooperLight Beats is off.
- 90fee7b **2026-06-05** Lots of work on sprint-122 persistence, and revamped My Tunings now called Tunings in Song with Add One Tuning instead of USER tuning; plus section-status widths, background color changed, min-widths on tonal chord and mode in song widget caption line,
- d48e378 **2026-06-04** sprint 119 changes in.  beat loop count added to section-status, Arpeggio behaves correctly with resets: resets the positions counters.  section-status widget is refactored.
- 3cbebce **2026-06-04** Before 119 Iteration 3 implementation.
- e62597a **2026-06-03** Remove menuTable changed to menuDiv, removed menuPage.  formatted html.
- 36a630f **2026-06-03** Sprints 120 and 125 complete
- 0af49f7 **2026-06-03** sprint-125-tonal-plugin working
- 3982735 **2026-06-03** sprint-125-tonal-plugin working
- e01eb5f **2026-06-02** Sprint 120 complete, 903 is planned.
- 0962c0e **2026-06-02** Iteration 3 changes in, Iteration 4 planning ready.
- 558756e **2026-06-02** Tonal.js chords and Constants.js infinite-neck nameds are aligned.  New convenience menus for FillPlugins.
- 37a17bd **2026-06-01** Ready for sprint-120 Iteration 1 coding.
- bd55487 **2026-06-01** added different color for next row but BAR
- d1df1dd **2026-06-01** Sprint 118 done.
- bc1fb43 **2026-05-31** Ready for leadsheet-line
- 252157d **2026-05-30** Updated sprint indices.
- 461178f **2026-05-30** Test fixture installed
- 1a1f742 **2026-05-30** Chart working with LeadSheet.  Beat inserts broadcast correctly to % repeats.  /cc and friends added.
- f184937 **2026-05-30** Ready for Iteration 5 implementation coding.
- e254f00 **2026-05-30** Ready for Iteration 5.  Iteration 4 etc. are complete and working well.
- b907bb8 **2026-05-30** New Chart is functional.
- 2652d34 **2026-05-30** Ready for implementation!
- d225f70 **2026-05-30** Chart Notes now scrolls horizontally when it gets too wide.
- d3a4df9 **2026-05-30** Removed old getTonal() and used only per-table version in section-printer and in other code that calls into tonal.  Fixed SongHeadless to use this, and also added arg to SongHeadless so it can now handle any song on the command line.   Added the ability in getTonalForTable() to look around the Section and see if the current table, then any other table (e.g. a Bass player) has a "colorClass":"noteRoot", and use that as the chord and mode roots, injecting it into the notes set if found.  Blame is showed in the chart::Chart Notes, as "noteRoot" which shows the tablename where it found it.
- 96c89a7 **2026-05-29** cleanup
- 2a921fe **2026-05-29** Added workflow to push help.html to docs/index.html or somesuch.
- a790c14 **2026-05-29** Refactor finished
- 0ae1bb2 **2026-05-29** Fixed off-by-one cellcol calculation for diamonds row around arpeggio showing the position ranges.  Still doesn't show a position for the Nut, but that seems correct, actually.
- 74e8efb **2026-05-29** plugin note type matrix added #transport buttons blur fixed.
- 6602038 **2026-05-29** added /fmss and /fmbb
- f308bee **2026-05-29** sprints 115 and 116 plus blur on transport
- 2d3b7c5 **2026-05-29** When Arpeggio::positions::values, diamondsRow shows active positions in a highlight color.
- 67cd283 **2026-05-29** UI Tweaks, moved Palette::Keep warning. piano to 88 notes and midi 21 bottom.
- 5735210 **2026-05-28** Plugin help moved from help.html to help-plugins.html
- d8b41fb **2026-05-28** Plugin Help help-plugins.html now integrated from help.html plugin-help.html now has top nav, scroll-top working, and more styles from help.html
- 70ca932 **2026-05-28** Ready for scroll-margin-top fixes
- 66b4cb1 **2026-05-28** TOC and row links now working for all option rows
- 3dc4972 **2026-05-28** Ready for hover links
- 41bff62 **2026-05-28** help-plugins.html has most of the section layout complete.  Now it just needs the text.
- 365bf45 **2026-05-28** ready for euro quotes.
- 30afd7b **2026-05-28** file transformed
- 969161a **2026-05-28** Added CLIP help. Preparing for help-plugins options table.
- fa9f033 **2026-05-27** Fixed menu validation errors, and wrote document showing how to deal with dynamic and info-only menu items.
- 026efe1 **2026-05-27** PianoSkeuomorphic layout and scaling fixes, along with show all note names.
- 0378f71 **2026-05-26** PianoSkeuomorphic now showing all note types and note names correctly, except fingering, which slides under black keys, and which must be adjusted to 40% indent so it centers on the key.
- f64d5ab **2026-05-26** fixed a bunch of menus and triggers.  fixed the themes to use noteWhiteFontColor and noteBlackFontColor for universal lane where show note names lives.
- a3bd4aa **2026-05-26** 114 implemented.  Tweaks next.
- 760cdf0 **2026-05-26** Ready for sprint 114.
- 2764748 **2026-05-26** Menu trigger cleanup, menu dump simplification.
- 386673b **2026-05-26** 113 working
- 6ca0185 **2026-05-26** Fixed triggers in test after changing them in the plugin
- 8cd5ae4 **2026-05-26** Fixed broken tests from sprint-111. Fixed Fill triggers for dynamic menus for note types, such that SingleNote was conflicting with s for strings.
- c027a99 **2026-05-25** Hosed after copilot reset.
- 7aa2ac5 **2026-05-25** Iteration 1
- e6ef6e7 **2026-05-25** Ready for sprint 113
- a777278 **2026-05-25** Updated to point to sprint planning.
- 2a86b45 **2026-05-25** Web-friendly links and intro added.
- c763a50 **2026-05-25** SingleNote black key corner restored. Sprint complete.
- ef5a57f **2026-05-25** Small spacing tweaks, but more to come after this commit.  Otherwise accpted as useable.
- 7e2136d **2026-05-25** PianoSkeuomorphic first pass done, and working!
- 81db5ed **2026-05-25** Before PianoSkeuomorphic
- 7a1a82d **2026-05-25** Sprint 111 Iteration 2 complete. help.html menu dump hosed.  Regenerate from app and paste in manually in next iteration.
- 17b5a08 **2026-05-25** Reorganized all sprint planing documents
- 318f8cf **2026-05-24** Ready for sprint-planning changes to _doco.
- f7b9ceb **2026-05-24** TonalPicker tweaks in style.
- 1f42e67 **2026-05-24** Tonal widget switched over to using compact SELECT that chooses NamedNote, SingleNote, TinyNote.  Fixed live update events so chart is more live now.
- e2ab1cf **2026-05-24** ClipPlugin now does MIDI paste, and you can copy from P46 and paste to S6. Next, we are refactoring Tonal widget to handle SingleNote and TinyNote.  Tagging here.
- 521ad4b **2026-05-23** Documentation of command-line one-line. Planing for ClipPlugin
- 5060d8d **2026-05-23** Added /vmo for one-line display
- 69c06d6 **2026-05-23** Moved design documentation into feature and sprint directories. Implemented sprint-2 "more-types" for FillPlugin.
- f823f33 **2026-05-23** These all are part of transport, really.  Moved to _doco/design/transport/
- d4a0709 **2026-05-23** Moved design docs into separate directories in _doco/design/
- 3af2dfe **2026-05-23** Added lower and upper string bounds to ArpeggioPlugin, and extended its widget to show.
- bc1aac3 **2026-05-22** TransposePlugin and all its tests now have options for PlayedNotes and RecordedNotes elided, as do the stubs in the core.
- c32ae67 **2026-05-22** Help updated with MovePlugin dependencies on note types and highlights and glossary entries for these.  Prior to cleaning up RecordedNotes and PlayedNotes from TransposePlugin.
- 8bdb004 **2026-05-22** MovePlugin added
- a67433e **2026-05-22** Iteration 4 coding changes are in.
- 4cb096c **2026-05-22** Fixed menu caption for "jump down" to be capital J.  Changed menu caption for "clear dropped notes" to be "clear/backup". Action is the same.
- 8b07b1f **2026-05-22** Wow! MovePlugin is working great on the first coding Iteration.  Remember to have all options selected, especially "include" must include played and or recorded, then hit A for apply!
- 5fea11d **2026-05-22** MovePlugin feature Iteration 1
- 339714f **2026-05-21** Put in getter to resolve spacebarActionName so menu.js can read it in a var pointing at ${spacebarActionName} and show the current value in the /fm menu
- 6f48d4c **2026-05-21** Added help for Songfile Info. Made Tonal fonts bigger. Cleaned up unused classes for Songfile Info CSS.
- cbf89ae **2026-05-21** whitespace
- 7c00e2f **2026-05-21** Info is working: Open parked or float or none on song open if text present.  Auto-saves.  Simple HTML supported, but no fancy/hackable markup.
- 751e5cd **2026-05-21** Shadow on rendered, inset on edit, tabs in Landau colors.  Shared edit controls, to be hidden.  Shared close controls inside tab group page.
- e2d3c65 **2026-05-21** Info is mostly working.  Now tweaking layout and CSS
- 1bc81f8 **2026-05-21** trying to fix some bugs...
- c6b64f7 **2026-05-21** file info is implemented
- 27cb211 **2026-05-21** Tonal widget now has optional display of sub-widget of available modes. Caption row now has a sub-hamburger for hiding all the buttons except Tonal.
- 6d08e35 **2026-05-21** Widget added for ArpeggioPlugin status.  ArpeggioPlugin now handles positions.
- 9de5df7 **2026-05-21** TransportController working well. OnSectionBegin/OnSongBegin fixes for no-op when not looping.
- e0db4e1 **2026-05-20** EventBus has fancy output of events in console using Chrome stylesheet logging, so we get badges for the event names.  This is enabled with a JSON input field in /vde . Remove the array elements of "filter" to show all events.
- b7c458b **2026-05-20** Sprint: transport-controller is complete, minus some post-sprint changes to clean up action verbs, and to sweep through and see which other verbs and buttons should use the new TransportController.  See transport-controller-implementation-plan.md for what was included in this sprint.
- cd47150 **2026-05-20** Commit before refactoring transport handling.
- d94a1a1 **2026-05-20** position plan almost ready. Hit snag in that OnSectionBegin was not being fired as  much as we had thought fixing all the map spacebar targets.   We are ready to fix the Looper and infinite-neck to do more OnSectionBegin triggering.
- 7fa20c1 **2026-05-19** map spacebar is now implemented with new navigation actions
- f0f248f **2026-05-19** Ready for map spacebar implementation.
- 907a47d **2026-05-19** nuked duplicate backups.  See git diffs in originals.
- 3d29c13 **2026-05-19** Got rid of tabledestTopPad
- 190bbcc **2026-05-17** Iteration 3 complete with implementation plan and final questions.
- 345d049 **2026-05-17** Ready for Iteration 2 copilot
- da1d289 **2026-05-17** Planning for Iteration 2
- ef68bfc **2026-05-17** TransposePlugin has intervalsStatusWidget working.
- 5969e37 **2026-05-15** Help plugins updated. TransposePlugin - starting work on intervalsStatus widget.
- 0af6e5a **2026-05-14** Added pictoral examples of transposing and I-IV-V progressions transposed and also moved.
- d2db789 **2026-05-14** Added help for new transposeProgression* family of variables
- d90a639 **2026-05-14** ${transposeProgressionFunctions} ${transposeProgressionDistances} ${transposeProgressionFunctionDistances} all working perfect with html template output and CSS styling.
- 94b6c50 **2026-05-14** Template is in place for html widget around steps.
- 4cd0070 **2026-05-14** Template is close for transposeProgressionFunctionDistances
- 35e5429 **2026-05-13** approved-values now incorporated into TransposePlugin.   See design documents.
- 3033fdf **2026-05-12** Plugins now use the ${foo} form of approved variable expansion, not $foo.
- d10ded2 **2026-05-12** Migrated to ${foo} from $foo, in approved-values.js and consumers, like menu.js,  e.g. ${graveyardRecordCount} from $graveyardRecordCount
- a33ca32 **2026-05-12** tested baseline for menus that use $graveyardRecordCount and getters that call getTinyNoteOpacity.  Fixed bug in getTinyNoteOpacity where startup code was not initilizing tiny note opacity in SongPersistence::tinyNoteOpacity.
- 64c081f **2026-05-12** approved values replaces old eval() in infinite-neck.js for captions.
- 9643f0f **2026-05-12** Updated to include Iteration 6
- 87e5010 **2026-05-12** Target table now available as a chooser for Arpeggio and Fill.  Doesn't make sense for Transpose, which is Song-global.
- 2c5d1f4 **2026-05-11** All three plugins (Arpeggio, Transpose, Fill) are working together now.  Transpose now does do lead key.
- d8fcfc5 **2026-05-11** Code changes to get FillPlugin to persist correctly, to not show a change state and show a persistence model on startup, but wait for options changes as the other plugins do.  With this work, FillPlugin initialized its row and fret numbers correctly.
- a9764e1 **2026-05-10** Design and implementation plan are in place for FillPlugin.
- 22e72f0 **2026-05-09** Some bugfixes: cleanup of Note was leaving values in model like "C":{}.  Arpeggio test was broken.  Plugins were adding to songfile persistence even when not touched. Markdown files had incorrect indentation. help.html added to with plugin help.
- 899931a **2026-05-08** Added help.html help on plugins. Added programmers-reference doco for all the parts of this sprint.
- 6515853 **2026-05-08** Fixed Plugin played notes to use NoteActive.  ArpeggioPlugin now working in color and hideNamedNotes, and flashcard mode.
- 71f90d5 **2026-05-08** ArpeggioPlugin now can call to Emboss played notes, all, or one.  This works with AutoColor on or off. It works with hide named notes, but doesn't draw a namedNote border.
- 3373c8f **2026-05-08** Added parkTransport to a second menu location so it is also availble under /vwp.
- 34ff7d7 **2026-05-08** Added checkmark to Color button when its rbColor radio button is actually checked.
- 91bebcf **2026-05-08** Worked on an old UI glitch: when the user clicks Hide Named Notes etc. the handler selects "KEEP" on the palette so you don't go adding notes with clicks but not seeing them.  Problem was: there was no way back but to know you had to un-AutoColor and then click a radio button, any radio button, to get placing notes to work again.  So now, we've added a new button next to "KEEP" "CLEAR" and "Find Color" called "Color: foo" where foo is the last color you clicked.
- d0319a0 **2026-05-07** More "bach" fixes, this one for turn-around should not repeat notes.
- 6b5cf4b **2026-05-07** "bach" rewritten after I uploaded  songs/tests/arpeggio-bach-sec2-manual.json for Cody.
- 606f89f **2026-05-07** Supposedly added EventBus messages to get messages from plugin to command-line dropdown, but not seeing them yet.
- bcea9fd **2026-05-07** looper now works with VISUAL and TRANSPORT timers.  VISUAL starts the clock after the Section has loaded, so is better for arpeggio practice.  TRANSPORT is better for realtime correctness, although the timer in the browser is not MIDI-level accurate.  Doco added in looper-programmers-reference.md
- 767db17 **2026-05-07** Loop timing now set to "Visual Timing" where the loop beat clock starts after the Section has loaded.  So this is not "Transport Timing" which is good for syncing with MIDI etc., and which is deferred to a later sprint.  But it works well for practicing songs.
- 882c82f **2026-05-07** ArpeggioPlugin working.  Now we have identified that Looper is taking too long loading the new Section so that beat 0 is robbed of display time.  We are next fixing Looper to have two options: visual timing, vs. transport timing.  transport timing will be disabled/no-op for now.
- a8598bd **2026-05-07** moved comment
- 9f2f943 **2026-05-07** Changed constNoteNamesArray -> NOTE_NAMES_ARRAY. Cleaned up and updated README.md with latest test scripts, doco links, etc. Cody fixed the validate-command-menu.js and the plugins to know about runtimeChildren nodes in the menu. Getting ready for ArpeggioPlugin implementation.
- f133e63 **2026-05-06** Added all Role menu items and key-handlers.  Automatic button has a bug.
- e6218d0 **2026-05-06** Updated README.md and linked doco for Copilot.
- 884da87 **2026-05-06** changed to .md since it is a markdown file
- 8578b71 **2026-05-06** Songs now get validated against real JSON Schema specs.  Helpers are in place, and documentation is in  _doco/developer/schema-programmers-reference.md
- 22c5038 **2026-05-06** Songfile schema validation is in place using Ajv and json-schema.org validator.
- 8646b91 **2026-05-06** Cleaned up from mermaid support and extraneous VSCode settings, now going Vanilla.  Preparing for json schema.
- 9521ee4 **2026-05-06** PresentationMode fix.
- 20eb170 **2026-05-05** Cody cleaned up more jQuery bindings.  Then he found naturaFontScaling, which I've fixed.  then he said he aligned displayOptionsToControls
- c57f81e **2026-05-05** Cody fixed more old click handlers in infinite-neck
- b413b99 **2026-05-05** Fixed some fishiness with Fingerings.  .click moved to .off().on() style.  Also .attr calls deprecated.  Bug was that you'd do the keyboard shortcut for 1, then 2, then 1 would not be available.
- 2f21977 **2026-05-05** backups
- f70c819 **2026-05-05** org.dynamide.toggle now applies to PluginManager managed booleans: enable and enableOnLoad
- 2f86f11 **2026-05-05** added org.dynamide.toggle to Properties in plugin command-lines.
- 653d0be **2026-05-05** Added updatePrintSections so we can granularly update the chart without triggering updateSectionStatus
- caf3888 **2026-05-05** Added Function+Offset to contain both Function and Offset as an option.
- 37bbee3 **2026-05-05** tweaked beats (add at end), added chart (moved from /spn etc.)
- 3c5c056 **2026-05-05** Added Graveyard and clone links, added styled footer at page end.
- fe66f45 **2026-05-05** All-Chords from library better than All-Chords in tests/persistence/, so copied over.  Also, all load library tests working, though old file format files are sailing past tests.
- 88e35b0 **2026-05-05** moved songs to test/persistence
- 3928a9b **2026-05-05** before refactor
- 0aecbaa **2026-05-05** Added highlight to section-printer:notes to current section row.
- 2b51c69 **2026-05-05** Plugin architecture implemented.  See chat files for Design and Implementation notes.  Transpose and Arpeggio in place.  Transpose is working.
- 182d2ee **2026-05-04** New test.
- b6ad177 **2026-05-04** Added new test song with Listeners, Observers, multiple instruments, and all the SectionNotes types, and most of the Note styleNum types.
- 3f8f3d0 **2026-05-04** Cody fixed this one by fixing renameTuningIDInModel in Song.
- 7d8ea75 **2026-05-04** renameTuningIDInModel was never migrated to V2.  This is Cody's version.
- fa67d34 **2026-05-04** This thing was kinda pointless.  Come up with some other headless test for it, or a script to test in UI.
- 439c46b **2026-05-04** Tests fixed and updated.  A few skipped.
- 6949e5f **2026-05-04** Cleaning up Jest tests, and found bug in handler for songLibrary that was putting array brackets around song name: data-action-args='["+song+"]'>"
- 1c86b5e **2026-05-04** Fixed imports for some tests.
- e28192a **2026-05-04** Implementation plan from Cody.
- b8817f0 **2026-05-04** Added Shift-L as Loop Stop. Added PluginManager as a test into infinite-neck.js Removed DaCapo.js and PluginFillChords.js and PluginRegistry in preparation for new plugins architecture. Added help hint ("title")  to some buttons. Added chat conversation about having Song Preferences be a merged object and how to do it.
- 4e03dbc **2026-05-01** Added File menu button shortcut, Added Tunings button shortcut, added underline CSS fix for "g" in Tunings, Fixed small SectionNotes not available and long-ass modes list when Section is empty in TonalPicker pickTonal bug.  Updated help file with keymap additions. Fixed bug introduced earlier, where there were two body tags in index.html. Tweaked save to chart and AllChords buttons and used Kanji.
- 5122422 **2026-05-01** After TonalPicker updated to have table-level chart and chord.
- 1873b96 **2026-05-01** Ready for TonalPicker-fix-20260430
- 551a931 **2026-05-01** mode is now Section.chartMode and Section.SectionNotes.mode.
- fe90477 **2026-04-30** Added U.S. keyboard layout for keymap in help file.
- a721b61 **2026-04-30** Base file
- 914bc7b **2026-04-30** New menu: Chart, (keyboard shortcut 'r') with Tab group added for Section Print Notes|Details|Summary.  These all get run and placed in their divs automatically every time, but to the user it seems like these three functions have to do with either clicking the tab buttons, or running /spn, /spd, /sps.  Changing Tonal pickers runs the updates for these also.  All have ChartChords and Mode columns.
- 741a8af **2026-04-29** Added shadows to tonal picker buttons
- c35685f **2026-04-29** Widgets distinguishing between tableID, also doing strikethrough if not in valueArray.  Section Print Notes is clobbering selected value of picker across widgets.
- a68f9fb **2026-04-29** Fixed, and back to non-class functional programming.
- 41c9c0e **2026-04-28** Pickers working for both chords and modes, striped colors for rows, <clear> added to clear selection. Everything works except when calling pickTonal, the bolded currentValue is not bolded, that only happens when NoteTableController kicks it.  Next we will try to move it to a class.
- 9237bb8 **2026-04-27** Pickers working for both chords and modes, striped colors for rows, <clear> added to clear selection.
- cd1f0b8 **2026-04-27** Pickers for both chord and mode are working.
- 1cc7f31 **2026-04-27** changes for getting documentation.js to work smoothly.  Ditched jsdoc and TypeDoc.
- db1466b **2026-04-24** Last version before ditching jsdoc-only treatment.  Moving to documentation.js or other.
- 702b49a **2026-04-24** Adding jsdoc config
- 13f4c9c **2026-04-24** Widgets working, loading, fetching, and participating in DOM.  JSDoc comments added.
- 9fb845a **2026-04-22** Widget working
- 08a0be9 **2026-04-21** Added tagonomy/dynamide widget types as an experiment before moving to a separate repository.
- cda9500 **2026-04-20** Dropper and Clear work again, as does Fill, by removing references to the V1 section.namedNotes.
- 4921994 **2026-04-20** Fixed alternating column colors in /spn
- 8caf821 **2026-04-20** added modes to tonal printout.
- 9ee8dc0 **2026-04-20** Tonal detect chords working well, and links in Tonal button in subcaption and also in /spn will put that choice in the Section.chartChord which shows up in /sp printouts and in Lead Sheet Caption.
- 5600aef **2026-04-20** detect chord still summing across instruments.
- db992f8 **2026-04-19** Tonal chords mostly working.  Before changing data-action args.
- cdb3b7d **2026-04-16** Got the Left buttons to toggle
- 686c071 **2026-04-15** Got the SectionStatus Left/vertical mode widgets working.
- 9abd43f **2026-04-14** working on section-status widget, and made copy of menu.js as menu-duplicate.json to try with Extension JSON editors.
- 2653e8e **2026-04-14** updated doco
- 88ac301 **2026-04-14** Installed SectionStatus widget.  Updated doco to include the programmer's reference and the Design discussion.
- 698695f **2026-04-14** SectionStatus changes in but not tested.
- c13345a **2026-04-13** templates and builders ready for GP4 to implement. Moved to SectionStatus folder to encapsulate widget package.
- 5f74dba **2026-04-13** Getting ready to design SectionStatus widget
- 5a94352 **2026-04-13** Caption row has buttons a la sectionDrawerButton
- bb6f1d5 **2026-04-13** keyboxes worked in caption row, now adding them to leftcaption
- 8a27548 **2026-04-12** Cody has threaded lookupContext through to colorFunctions::lookup*  so that getCurrentSection() is not called from deep within.
- d99b260 **2026-04-12** Cleanup prior to refactor.
- 3c36baf **2026-04-12** Transport resizing is now greatly refined and in its own module, transport.builder.js which will be the home for the template version of the transport.  But for now, they are all just static functions to manage toggling and placement and viewport.
- ffb57be **2026-04-12** Section Drawer now pops up with the button, the "s" key, and the button acts like a main menu button, so that it interacts with hideAllMenuDivs.  toggleSectionDrawer handles all this.
- cef4aa8 **2026-04-12** added section-printer.css
- 0fc15ff **2026-04-12** Moved section-printer css rules to its own file
- 3471a2a **2026-04-12** transportResize now works with the Section Drawer, and also supports a parkAtBottom param so that appInit can park it down there, but any moving by the user later is preserved, and the Section Drawer pops up onscreen.
- 759c11b **2026-04-12** working...
- d2d6d7d **2026-04-11** looper.js Provider mess eliminated, and EventBus now emits these: "Looper:OnLoopBeatsStart" "Looper:OnLoopSectionsStart" "Looper:OnLoopBeatsStop" "Looper:OnLoopSectionsStop"
- 96be7bf **2026-04-11** Cleaned out btnLoopBeats. Gone.
- 31d40c2 **2026-04-11** Beat looper works again.
- 1b39ee8 **2026-04-11** Loop Beats now works with LOOPER button in Section Drawer from old Section page.  Must refactor this thing away, since it held critical state.
- a84a0ac **2026-04-11** Organized all loadTemplates into a Promise block, so that fullRepaint() will not get called until everything is loaded.
- 827e9be **2026-04-11** S now pops up Section drawer in transport.
- e718413 **2026-04-10** Halfway through moving Section menu page to transport.  Event handlers next.
- b6ee4a1 **2026-04-10** Floating of Palette is mostly working.  Little float button disappears on float.  And the Palette menu button makes the div disappear from the floated window.  Make it work like themes.
- d961918 **2026-04-10** Added instrument prefs.  Made infinite-neck have a showDefaultTunings() method that does 1) check url query params, 2) check preferredTuning in localStorage, 3) the tuning default.  Loading a song goes through this as well.
- 3af76a0 **2026-04-10** Instrument width now not 100%, so it scrolls overflow and also can be less wide than container if num fret is shorter.
- d5b0903 **2026-04-09** Moved graveyard to real Graveyard class using new Persistence layer,  and getting rid of "providers" by connecting imports properly. Changed copy-paste name of graveyard.buildNoteTable to Graveyard.buildGraveyardTable.
- e443d3b **2026-04-08** construction and cloning clean and bulletproof.
- 806aef6 **2026-04-07** Created Persistence layer for Song, Section, SectionNotes.  Each of these classes have a parent class, e.g. SongPersistence, which is passed the JSON obj and the concrete class of owned class that it will create, e.g. Section is passed as SectionClass.  Wiring and Note handle the same Persistence idiom in their constructors.  Graveyard still does it the old way with .make().  Ditched all the fromJSON and toJSON and normalize() glop from Cody et al.
- c62031e **2026-04-05** Chunky version that is a result of some hand-waving by Cody.  Plus a stub of SongFile.js by Laramie.  Likey most of this will be ditched.  We are working towards a clean object persistence based on fromJSON and toJSON, which will start from an earlier commit.
- 669c96b **2026-04-05** Moved all SectionV2 -> Section, removed all V2 references except a few comments and .md files.
- ea81983 **2026-04-05** Added blur() to Theme SELECT so that typing a letter after selecting a Theme doesn't select a different Theme starting with that letter.
- bd75df5 **2026-04-04** This three-section, two observer song has wite-out theme and is easy to see the beats coming and going.
- 4db08dc **2026-04-04** Relative section observer working perfectly with recordedNotes: a lookAhead observer shows the first beat that is upcoming.  A lookBack observer shows the last beat played.  These only apply to the first beat as in beat 1 and the last beat as in nBeat === getBeatCount. nBeat is 1-based.
- acd42cc **2026-04-04** Added some hamburger buttons back to taborder by removing taborder=-1, so that you can keyboard toggle the hamburger menu within each instrument and the mini color dict.  Not the event wiring button because that has the "E" keyboard shortcut.
- 0f914f8 **2026-04-04** showHighlightsForBeat has been updated to use getReplayOptionsArray, which is refactored from replay() so that it returns an array of options, to be replayed in array order.  The first one will either be the table, or the table you are observing, or listening to.  If you are listening to another table, the second array member will be the option for your own table, which then get replayed after the listener.  (This order could be changed with an option at some point.)  Two issues remain with this implementation: 1) all beats are shown for observer tables, which is wrong, because with observers we are looking at a different Section, so numBeats may be different, and we were going to deal with this by just playing last or first beat depending on whether it was a lookahead or lookbehind. 2) This implementation, as all showBeats prior implementations, ignores hide* such as hideNamedNotes (immaterial since namedNotes can't be recorded), hideSingleNotes, hideTinyNotes, hideBends.  No implementation hides highlights multi or MIDI.
- ac56d2f **2026-04-01** section-printer now supports /spn or /section | print | notes, in played order, and beat order (not MIDI order) showing all notes played by name, tablularized by section, instrument, and note type, with live links to sections. It also supports the old hash of doing namedNotes, plus counts of playedNotes and recordedNotes, using /sps (/section|print|summary).  Fixed bug where namedNotes were counted if present but empty {}.
- 7c00004 **2026-04-01** single notes workinng again, and Cody has fixed printSections
- 0fa32ef **2026-04-01** Banjo nut fixes, button and form fix because tunings form was causing submision.
- 650512f **2026-04-01** Fixing Banjo Nut in USER tuning so that it has a picker widget with examples.
- 4f07043 **2026-04-01** MyTunings button mostly behaving now.  Reworked EventBus events for My and All tunings updates.
- 576ad88 **2026-03-31** Clicking a dockable's arrow orientation buttons causes a window resize if the grabble is out of bounds.  Using the command-line to gather also resizes the window to fit the viewport, but by first moving it up to the top left with cascade and margin.  clearHighlights and clearAll now iterate over all visible tables, so that clearAllForTable and clearHighlightsForTable are available for more targeted clears and replays when dealing with listener tables. To help this, Song now triggers Wiring:added, Wiring:removed, and NoteTableController consumes Note:colored, Wiring:removed, and Wiring:added.
- 8545f02 **2026-03-31** Dockables working and dragging.  Cody has already created a dockable registry of windows and window management/gathering/cleanup functions.  Next we will wire to command-line.
- f522d9b **2026-03-31** Added dockable.js and its functions to float and re-dock instruments.  Also need to update drag.js next, after this commit.
- e0ba21b **2026-03-31** Hide wiring when going fullscreen. Styled the Move buttons for the MyTunings
- f97df56 **2026-03-31** Tweaked the themes a bit.
- 046e1bc **2026-03-30** Added automatic theme calculation of --instrument-border-thickness (via instrumentBorderThickness) when themeOptions.instrumentBorderImage is present.  For themes that use celtic-black, that width is 1.4em, so that has to be added to the padding for things in instrument.css.  When the theme removes these, e.g. with the Theme button, we set the --instrument-border-thickness var back to 0 so we don't get a useless black border gap.
- bd339b7 **2026-03-30** moved css/instrument.css to root.
- 5322beb **2026-03-30** moved css/instrument.css back up into root because relative img url doesn't work, as they are relative to the CSS file!  Also, did a bunch of monkeying around with flex width handling so tables scroll but page don't.
- 920b3b2 **2026-03-30** Before horizontal scrolling of table within fretTableWrapper.
- d655299 **2026-03-30** Fixed All-Chords.json, round-tripped it, added missing notes, removed extra beats, fully V2.  Note rootID is now an int in the file.  Not sure if this is correct,  the revive() has probably made it an int. Removed all the other All-Chords songs because this one works with DaCapo.
- f8cf3e0 **2026-03-30** wrong project
- 5bdbba3 **2026-03-30** Cleanup
- 3a5ba6b **2026-03-30** DaCapo still working, but the WInput flavor is jumping by too many half-steps.  Table layout and caption row css greatly cleaned up.  Added ./css/instrument.css to centralize all instrument layout and sizing.  Instrument hamburger gets things out of the way better now.  Beginings of a Plugin architecture being tested in ./plugins/  Some tweaks to command-line to allow JSON in input.default.
- a74fd64 **2026-03-29** prototyping "which" on transposeSong
- 547437a **2026-03-29** Added programmer's reference for maintaining menu.js
- 6bf35e6 **2026-03-29** menu documentation in place; All three types of notes in SectionNotes are handled, and DaCapo does the transposeSong correctly for NamedNotes only.  All songs are included, but they have not been processed by the updated conversion utility, therefore some are missing lots.  We will go back over the songs from a previous commit.  But also many will be obviated by DaCapo plugin.
- 0a0944d **2026-03-29** moved all sectionNotes -> sectionNotesDict, including in songfiles.  Many of the songs are broken and will have to be run through the fixed convert-v1-to-v2 utility again, after being pulled in from master or another branch.  Removed "Legacy" songfile handling--this is all V2 now.  Changing Key works, but Transpose is not working, it just moves the Key up.
- 865bb88 **2026-03-29** Observers, Listeners, and all SectionNotes types are working: namedNotes, playedNotes, recordedNotes all stored in SectionNotes.  This commit is before moving sectionNotes -> sectionNotesDict, it is just unfortunatly named sectionNotes, being a Dictionary of SectionNotes. Ugg.  Also, this commit is the last to have SectionV2 deal with "Legacy" objects.  All files have already been converted.
- 94979bc **2026-03-28** Everyting seems to be working, and removed sections from Object.assign(song, jsonObj) so now we don't get duplicate Sections.
- 5335125 **2026-03-28** typo in name
- 9ceeb21 **2026-03-28** Udated to exclude botched songs
- 9b2c0ed **2026-03-28** Botched songs bye-bye
- 308c060 **2026-03-28** Botched format files go away.
- e03d207 **2026-03-28** All songs converted to V2, replacing all songs.
- 54d59c4 **2026-03-28** Funky build.  revive() kinda works in that old file format can be loaded into V2.  Also, S6_AllTypes-V2.json, can be loaded.  But I want to kill revive() because it is called every time a Section object is accessed from the song.  This commit has all the V1 songs/ ; Also, this commit has the repaint and showBeats that use V2.  note clicked is a bit unfinished, but has table selector prepended.
- bbf4996 **2026-03-27** Migrating songs to V2 format in SectionV2::revive() seems to be working on loading a song file in song-api-SectionV2.test.js ; Also, new utility to dump songfile properties using jsonpath-plus paths to console.
- a25bec1 **2026-03-27** Claude refactor, step 2.
- eadba8d **2026-03-27** Prior to GP4 refactoring revive()
- 8d247fb **2026-03-26** Not a stable release, but working
- 0f9f476 **2026-03-26** Added 'e' to key shortcuts to toggle event wirings; set up some comments to help with locating song model access points for V2 file format; changed default Special Row colors to be less in-your-face; defaulted Cello to not showDiamonds because it has an empty array for diamonds, rather than simply not having diamonds, for some reason;  fixed a few comments and strings around wrapping rules.
- 7b96591 **2026-03-25** Final step to make listeners listen AND play their own notes; Added showDiamonds to tunings so you can easily turn them off with a checkbox in the myInstruments.
- 54b0f94 **2026-03-25** Added instrument section box with current index and relative if present; Handled WIRING_OPEN state;  Allow myTunings table to hide diamonds row;  TuningsLibrary now triggers EventBus 'InstrumentAdded';
- 078dfc2 **2026-03-25** ProTools-like wiring now in place for instruments to listen to another table, or do relativeSection to another table. Connected to the model's getSong().wirings, and that persists.  You don't relativeSection or anything to yourself.  Not wired into refactored replayTable() yet....

### 20260326

- Added 'e' to key shortcuts to toggle event wirings; set up some comments to help with locating song model access points for V2 file format; changed default Special Row colors to be less in-your-face; defaulted Cello to not showDiamonds because it has an empty array for diamonds, rather than simply not having diamonds, for some reason;  fixed a few comments and strings around wrapping rules.
- Final step to make listeners listen AND play their own notes; Added showDiamonds to tunings so you can easily turn them off with a checkbox in the myInstruments.
- Added instrument section box with current index and relative if present; Handled WIRING_OPEN state;  Allow myTunings table to hide diamonds row;  TuningsLibrary now triggers EventBus 'InstrumentAdded';
- ProTools-like wiring now in place for instruments to listen to another table, or do relativeSection to another table. Connected to the model's getSong().wirings, and that persists.  You don't relativeSection or anything to yourself.  Not wired into refactored replayTable() yet....
- Wirings in place with new Templating in ./templates/
- Cleaned up missing Constants so that TuningsLibrary table id was not getting through.
- Got Jest tests working again, moved constants into Constants.js and got rid of some "providers".
- Ready for GP4 refactor.
- Added changelog and instructions for 20260324

### 20260324

- Fixed display of View tab tables with better borders and backgrounds, and less table nesting, thus clearing up CSS bug introduced that cause *all* tables to have extra borders.  Added help for "Special Rows". Removed extra paragraph in "My Tunings" with useless title.  Fixed bug where Desktop wouldn't toggle back on to be visible.

- Initialize doSpecialRows in tunings.js for S8 and S6 so they are Special by default.


- Added Special Row, for Standard guitars, if you want to show the rows that are tuned different than P4 you can turn on SR in the Tuning, and it will use different colors, which you can also theme with Note White Key Special Color and Note Black Key Special Color.

- Migrated table-builder.js to TableBuilder.js, obviating the Facade class, and instead using an import * as...; Killed old song-old.js; Moved most of the Tunings table out of TableBuilder into TuningsLibrary.js; moved notetable.js to NoteTableController.js, since it is mostly a Controller, but still has View in it, which can now be refactored out.

- New song V1 to V2 converter installed.

- Added css and button and flex grid layout so .instrumentBackground now has a slot for wiring on the left side.  P caption row is still above all, but wiring is on the left of th
e instrument table.  This will be for Wiring what this table is listening to on the EventBus for new notes, deleted noted, midi notes, and external midi events.



### 20260320

- build version: `stable-20260320`

Added dual box-shadow to nut, since black I note was disapperaring: td.nut div.NoteActive .CenterCell

Added flexbox layout to View page, Themes page.  Broke long tables into flexbox cards.

Fixed bug where snake.json, which didn't have a .theme, was crashing the default Theme dropdown.

Added some Themes font colors.

Investigated why there are nested .CenterCell div in a NoteTable.  Don't remove them.  They are there for some height layout purpose.

### 20260319

`version` works in Jest tests via infinite-neck-headless.js.  infinite-neck.js does not import any Node.js modules.  

Added Diatonic-Scales-Piano.json which works great with 8x8+DJTrailmix.  

Added All-Keys-Maj7-Chords-Piano.json.  

And added these to the song-list.json for the library.



Added version info to the menu in /fv that simply returns a result which can be seen in the dropdown of menu command results, and /fV (that's a capital V) for a more verbose message that shows up in Show Messages. Added external help file link for README.md

Added the supporting version stuff which runs version-update.js as part of manual pushing of a version. Added version.json, and version-read.js, and a block of code in infinite-neck.js that exports getVersionString from the async call to fetch version.json.