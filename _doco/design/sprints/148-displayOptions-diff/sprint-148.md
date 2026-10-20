# sprint-148-displayOptions-diff

sprint number: 148

sprint shortname: displayOptions-diff

date: 20261014

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to:
- Introduce a new button to save the Diff of DisplayOptions only
  - Currently, hitting SAVE on DisplayOptions in View saves all the DisplayOptions every time, so if all you want to change is Hide NamedNotes, then you drag in automation of everything, leading to explosion of Section View automation you don't need, and extra maintenance in Songs. 

## Sprint document locations

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
- [Iteration 4 Round 4 testing report 1](148-it4-round-4-testing-report.md) (bugs fixed and re-tested: PASS)
- [Iteration 4 Round 4 testing report 2](148-it4-round-4-testing-report-2.md)
- [Iteration 4 Round 4 analysis](148-it4-round-4-analysis.md) (HIDE reveal by note type, gate test results, SaveDiff `currentColorDict`)
- [Iteration 4 Round 5 design (Design Team answers)](148-it4-round-5-design.md)
- [Iteration 4 Round 5 implementation report and test recipes 13-15](148-it4-round-5-implementation-report.md)
  - Status: implemented, Jest green (74 suites, 870 tests), browser acceptance steps 13, 14 and 15 PASS.
