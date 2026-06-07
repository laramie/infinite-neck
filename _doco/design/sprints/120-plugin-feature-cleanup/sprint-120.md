# sprint-120-plugin-feature-cleanup

sprint number: 120

sprint short name:plugin-feature-cleanup

date: 20260531

Index of all sprints for reference: [sprint planning index](_doco/lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- Finish plugins and make them consistent and complete for Version 2 rollout.

## Sprint document locations

- [sprint-120 design document](120-design.md) 

## Iterations


  - "Iteration 1": Copy should be able to `L) Listened Notes` copy any note in current section not in Model.
    - COMPLETE

  - "Iteration 2": arpeggio should listen to singlenote and transform exiting ones to equivalent NamedNote and continue as usual
    - COMPLETE

  - "Iteration 3": menu changes for Fill/fpfo shows options but you have to go all the way down to actually accept them. Flow is weird.
    - COMPLETE: added menu options for All none and All roles, shows choices in higher menu.

  - fill and Fill page should normalize on Tonal's chord names (and on modes too)
    - COMPLETE: fixed the code by hand w/o Iteration.  Left some non-Tonal names in parens e.g. (Gypsy). 

  - Fill page should add Dom7No5 as option since so popular on guitar
    - COMPLETE:  w/o Iteration

  - "Iteration 4" fill should listen to Song.chartChord and Song.chartMode with an option, and should make NamedNotes or SingleNotes using the current options for position and string ranges.  It would ignore the chord and mode picks if chart versions are chosen.
    - COMPLETE

  - "Iteration 5"
    - Made modes limit to 6 then "n more..." is shown in the Tonal mode suggestions.  Picker still have full set.
    - COMPLETE

  - "Iteration 6"
    -  /ch and /cl to be fullscreen aware
    - COMPLETE

