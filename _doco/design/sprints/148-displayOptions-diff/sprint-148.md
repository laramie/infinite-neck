# sprint-148-displayOptions-diff

sprint number: 148

sprint shortname: displayOptions-diff

date: 20261014

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to:
- Introduce a new button to save the Diff of DisplayOptions only
  - Currently, hitting SAVE on DisplayOptions in View saves all the DisplayOptions every time, so if all you want to change is Hide NamedNotes, then you drag in automation of everything, leading to explosion of Section View automation you don't need, and extra maintenance in Songs. 

## Scope

This sprint ended up with a vastly increased scope, which solves many problems encountered while authoring Songs having to do with managing all the DisplayOptions.  These are now much more sparse when there are many Sections.  The cost is the complexity of the UI manager pages, which are now in place and resembling the Palette in complexity.  However, the features are powerful, are documented in the help file, and have in-App help, legends, tips, and hints.  Pluswhich the UI is fairly intuitive and fully graphical--much better than slogging through JSON or the command-line.  Many of the features have to do with developing the DisplayOptions for Songs, so most Users won't need them, but Song authors will use them to create feature-rich songs that work well with macro scripting, Song Widgets, and Info presets. Tutorials, Wizards, and practice songs that use Theme Automation, Presentation Mode, and changing DisplayOptions to customize the User experience and display per Section benefit from full GUI editing.

Features Added: 
- SAVE Display Options has now become two commands: SaveDiff and SaveALL.
  - SaveDiff just captures the difference from the App DEFAULTS, the author-writable Song-DEFAULTS, the LIVE controls, and the now-sparse storage of DisplayOptions in each Section as needed.  So defaults don't clobber later Sections and so on. For example, `All-Chords-w-Modes-Piano.json` has Song Widgets to switch between hiding NamedNotes for chords and TinyNotes for Modes.  Without the features in this sprint, it was not possible to automate the hiding safely without getting overwritten by changes to hiding at runtime.
  - SaveALL still takes a snapshot the way SAVE used to do.  This is useful for many situations, and is how many of the existing Songs are stored, so is still supported as a valid idiom.  SaveDiff is a less brittle idiom.
- Song-DEFAULTS is a new "Section-zero" idiom where authors can save base DisplayOptions per Song without requiring these be set in Section 1.  This is the primary simplification.  It also means that even without Presentation Mode, default width, height, and Note font-size can be saved as Song-DEFAULTS.  
- Display Options Matrix
  - A full UI grid of all Sections and all DisplayOptions.  It is effectively a fully live, interactive, editable `/vdd`.
  - read/write blocking of changes so authors can lock down changes while developing songs and playing with options.
  - Easy writing and clearing of automation of DisplayOptions across Sections
  - Live visual feedback on where DisplayOptions come from: DEFAULTS, Song-DEFAULTS, LIVE controls, Section storage, Browser storage, and Presentation Mode.
- command-line control (thus macro scripting) of essential features such as setting and clearing read-blocks and write-blocks, and Clearing, Saving DisplayOptions Diffs, and Saving ALL DisplayOptions (snapshot).
- command-line `/vdd` is still supported with new CSS display of read and write blocks.
- simplified "Display Options" View card
- Customizable "Function Symbols" and fixed the controls that really did not let Users create Function Symbols before.  Now Users can add many Function Symbols and manage them per Song.   

## Sprint document locations with TEST RESULTS / STATUS

- [design document](148-design.md) 
- [Iteration 1 analysis](148-it1-analysis.md)
- [Iteration 2 analysis](148-it2-analysis.md)
- [Iteration 3 Function Symbols chooser/editing panel](148-it3-functions-panel.md)
- [Iteration 3 implementation plan](148-it3-implementation-plan.md)
  - Status: implemented and accepted in the browser (pure module `templates/function-symbols/functionSymbolSets.js`, widget builder, persistence, `bin/migrate-function-symbols.js`, songs migrated).
- [Iteration 4 Round 1 analysis](148-it4-round-1-analysis.md) (effect of the DisplayOptionsMatrix on SaveDiff/SaveAll)
- [Iteration 4 Round 1 AutoColor clarification](148-it4-round-1-autocolor-clarification.md)
- [Iteration 4 Round 2 implementation plan](148-it4-round-2-implementation-plan.md) (SaveDiff, SaveAll, gates)
- [Iteration 4 Round 3 implementation report and acceptance test plan](148-it4-round-3-implementation-report.md) (recipes 1-12)
  - Status: implemented, Jest green (74 suites, 866 tests).  Browser acceptance is recorded in the two Round 4 testing reports below; step 8 (Gates) was replaced by recipe 15 in Round 5.
- COMPLETE: [Iteration 4 Round 4 testing report 1](148-it4-round-4-testing-report.md) (bugs fixed and re-tested: PASS)
- COMPLETE: [Iteration 4 Round 4 testing report 2](148-it4-round-4-testing-report-2.md) (recipes 1-12: PASS except step 8, see below)
  - Step 8 (Gates) had a FAIL (8.4) and an ambiguous 8.1.  The Design Team asked for re-worded recipes under new numbers, so step 8 is superseded by recipe 15 in Round 5 (PASS).
  - The `defaultIfAutomated` rule explained in that report was accepted as is ("Keep Policy C").
  - The "OPEN" presentation.js request (clear HIDE only for the chosen note type) was done in Round 5 as recipe 13 (PASS).
- [Iteration 4 Round 4 analysis](148-it4-round-4-analysis.md) (HIDE reveal by note type, gate test results, SaveDiff `currentColorDict`)
- [Iteration 4 Round 5 design (Design Team answers)](148-it4-round-5-design.md)
- [Iteration 4 Round 5 implementation report and test recipes 13-15](148-it4-round-5-implementation-report.md)
  - Status: implemented, Jest green (74 suites, 870 tests), browser acceptance steps 13, 14 and 15 PASS (recorded in the Round 5 design document, "Round 5 Testing Report").
- [Iteration 5 design (DisplayOptionsMatrix)](148-it5-design.md)
- [Iteration 5 Round 1 implementation plan with questions](148-it5-round-1-implementation-plan.md)
- [Iteration 5 Round 2 implementation report and test recipes 16-25](148-it5-round-2-implementation-report.md)
  - Status: implemented, Jest 76 suites, 927 tests.  Browser acceptance is complete, see the testing report.
  - COMPLETE: [UA Recipes 16-25 : 148-it5-round-2-testing-report.md](148-it5-round-2-testing-report.md)
    - All recipes PASS, with these accepted notes:
      - 19.2 Clear Section keeps its Tool selected (changed after the recipe was written; accepted).
      - 19.3 Store Cell PARTIAL PASS: a Cell read-block stopped Store Cell.  FIXED in [Iteration 7](148-it7-implementation-report.md) (read-blocks no longer stop writes).
      - 20.3 reported FAIL because `#dmStatus` gets new text on every action; the Design Team judged that correct (accepted).
      - 20.5 mentions an Apply indicator that no longer exists (the button is now "Apply from Model"); current behavior accepted.
      - 21.2 `Save All...` no longer asks first (obviated by a design change).
      - 23.4 Opening a new Song closes View and the Matrix, and it comes back docked (differs from the recipe; accepted).
    - The help file sections `#displayOptionsMatrixTopic` and Display Options Matrix Examples were written from these recipes (committed).
- [Iteration 6](148-it6-design.md) 
  - Add "Song-DEFAULTS" and editing buttons to copy Current Section DisplayOption settings to new Song-level defaults. 
- [Iteration 6 implementation plan with questions](148-it6-implementation-plan.md)
- [Iteration 6 Round 2 implementation report and test recipes 26-30](148-it6-round-2-implementation-report.md)
  - Status: implemented, Jest green (77 suites, 990 tests).  Browser acceptance is complete, see the testing report.
  - COMPLETE: [UA Recipes 26-30 : 148-it6-round-2-testing-report.md](148-it6-round-2-testing-report.md)
    - SEE: Recipe 30 drill down.  See RESULTS in document.
  - TESTING PASSES, COMPLETE
    - Recipes 26-30 PASS with note on 30.
    - Recipes 30a-30e added.
    - Bugfixes applied (Store Cell clears the SAVE Diff magenta when the model matches the controls; the button is captioned "Apply from Model").
    - Recipes 30a-30e PASS.  
- [Iteration 6 Round 3 design](148-it6-round-3-design.md) (caption `&sect;N -> Song-DEFAULTS` on `#btnCurrentSectionToSongDisplayOptions`; implemented)
- [Iteration 6 Round 4](148-it6-round-4-design.md) 
  - Install new precedence of NoteDisplaySizes so that Song-DEFAULTS can hold reasonable defaults that are used even if Presentation Mode is off.
- [Iteration 6 Round 4 Report](148-it6-round-4-report.md)
  - Copilot report on our plan, with implementation notes, and questions.
  - Contains UA testing recipes we should complete.
  - COMPLETE: [UA Recipes 31-36 : 148-it6-round-4-testing-report.md](148-it6-round-4-testing-report.md) (all PASS)
- [Iteration 7 Status update and Request](148-it7-design.md) 
  - reports that UA testing is complete
  - requests a few bugfixes and features found. 
- [Iteration 7 implementation report](148-it7-implementation-report.md)
  - Status: implemented, Jest green (78 suites, 1011 tests).  All three Design Team questions answered (Show Messages starts unchecked; dormant-cell rule accepted; no right-hand scrollbar space needed).
  - COMPLETE: [UA Recipes 37-42 : 148-it7-testing-report.md](148-it7-testing-report.md) (all PASS)
    - 39.1 note: when the Matrix is floated the horizontal scrollbar was not visible (two-finger scrolling worked; docked is fine).  A CSS layout fix (the table scroller fills the floating window) was applied after the test; re-check by floating the Matrix.  If the scrollbar still hides, leave it: docking fixes it.
    - Fix did nothing, so rolling back to reduce complexity.
