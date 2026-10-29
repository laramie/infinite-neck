# sprint-148-displayOptions-diff

sprint number: 148

sprint shortname: displayOptions-diff

date: 20261014

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to:
- Introduce a new button to save the Diff of DisplayOptions only
  - Currently, hitting SAVE on DisplayOptions in View saves all the DisplayOptions every time, so if all you want to change is Hide NamedNotes, then you drag in automation of everything, leading to explosion of Section View automation you don't need, and extra maintenance in Songs. 

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
