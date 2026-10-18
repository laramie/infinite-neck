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
