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
- [Iteration 4 Round 2 implementation plan](148-it4-round-2-implementation-plan.md) (SaveDiff, SaveAll, gates)
- [Iteration 4 Round 3 implementation report and acceptance test plan](148-it4-round-3-implementation-report.md)
  - Status: implemented, Jest green (74 suites, 866 tests), awaiting browser acceptance.
- COMPLETE: [Iteration 4 Round 4 testing report 1](148-it4-round-4-testing-report.md) (bugs fixed and re-tested: PASS)
- COMPLETE: [Iteration 4 Round 4 testing report 2](148-it4-round-4-testing-report-2.md)
- [Iteration 4 Round 4 analysis](148-it4-round-4-analysis.md) (HIDE reveal by note type, gate test results, SaveDiff `currentColorDict`)
- [Iteration 4 Round 5 design (Design Team answers)](148-it4-round-5-design.md)
- [Iteration 4 Round 5 implementation report and test recipes 13-15](148-it4-round-5-implementation-report.md)
  - Status: implemented, Jest green (74 suites, 870 tests), browser acceptance steps 13, 14 and 15 PASS.
- [Iteration 5 design (DisplayOptionsMatrix)](148-it5-design.md)
- [Iteration 5 Round 1 implementation plan with questions](148-it5-round-1-implementation-plan.md)

- [Iteration 5 Round 2 implementation report and test recipes 16-25](148-it5-round-2-implementation-report.md)
  - Status: implemented, awaiting browser acceptance (see report for the not-verified list).
  - **INCOMPLETE**: [UA Recipes 16-25 : 148-it5-round-2-testing-report.md](148-it5-round-2-testing-report.md)

- [Iteration 6](148-it6-design.md) 
  - Add "Song-DEFAULTS" and editing buttons to copy Current Section DisplayOption settings to new Song-level defaults. 
- [Iteration 6 implementation plan with questions](148-it6-implementation-plan.md)
- [Iteration 6 Round 2 implementation report and test recipes 26-30](148-it6-round-2-implementation-report.md)
  - Status: implemented, Jest green (77 suites, 990 tests), awaiting browser acceptance.
  - INCOMPLETE: [UA Recipes 26-30 : 148-it6-round-2-testing-report.md](148-it6-round-2-testing-report.md)
    - NEED: Recipe 30 drill down.  See RESULTS in document.
  - TESTING PASSES, COMPLETE
    - Recipes 26-30 PASS with note on 30.
    - Recipes 30a-30e added.
    - Bugfixes applied.
    - Recipes 30a-30e PASS.  
- [Iteration 6 Round 4](148-it6-round-4-design.md) 
  - Install new precedence of NoteDisplaySizes so that Song-DEFAULTS can hold reasonable defaults that are used even if Presentation Mode is off.
- [Iteration 6 Round 4 Report](148-it6-round-4-report.md)
  - Copilot report on our plan, with implementation notes, and questions.
  - Contains UA testing recipes we should complete.
  - COMPLETE: [UA Recipes 31-36 : 148-it6-round-4-testing-report.md](148-it6-round-4-testing-report.md)   
