# sprint-132-plugin-order

sprint number: 132

sprint plugin-order:

date: 20260000

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to:
  - Fix vagaries when combining looping with transpose, fill, and arpeggio. 

## Iterations

  - "Iteration 1": 
    - [plugin ordering](132-design.md)
    - [implementation plan](132-implementation-plan.md)

  - "Iteration 2": arpeggio position looping redo
    - [arpeggio-position-loops](132-it2-arpeggio-position-loops-chat.md)
    - NOTE: it is possible to have 2 Sections one with a big position values array: 
```
values this section [[[0,3],[3,6],[6,9],[9,12]]]
song loops per position [3]
```
    - and then another Section with a simple positions value array: 
```
values this section [[[0,4]]]
song loops per position [3]
```
    - `song loops per position` is song-level and not Section level, which is fine because it persists properly, and just means that variable is available down here in the menu.
    - This split between positions per Section actually works: the looping keeps the second section at position 0,4 but advances the more complicated one.  It is possible that with some configurations things might get wonky, e.g. an odd number of song loops versus transposition chroma steps versus arpeggio positions.  But that is on the Song designer, because this setup works.
