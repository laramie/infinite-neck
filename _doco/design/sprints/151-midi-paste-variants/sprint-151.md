# sprint-151-midi-paste-variants

sprint number: 151

sprint shortname: midi-paste-variants

date: 20261101

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- Map MIDI Paste so that instruments that don't share the same Tuning progeny can still work.  For example P46->P48 and vice-versa, or even P48 to and fro S6.

## Sprint document locations

- [design document](151-design.md) 
- [implementation plan](151-implementation-plan.md)

## Iterations

  - "Iteration 1": 
    - Define behavior and menu.

  - "Iteration 2": implemented.
    - Code: `plugins/clip/midiPasteMaps.js`, `plugins/clip/midiPasteMapBuiltins.js`, `plugins/clip/ClipPlugin.js`, `plugins/PluginProperty.js`.
    - Tests: `_tests/jest/midi-paste-maps.test.js`, `_tests/jest/clip-plugin-midi-paste-maps.test.js`.
    - Docs: `help-plugins.html` (MIDI Paste Maps).
    - Deviations from the plan: map endpoints also match an exact `baseID`; the menu cap is 34 keys because `n` is reserved for `n)one`; Bass built-ins use the library tuning layouts.

  - "Iteration 3": implemented. [151-it3-report.md](151-it3-report.md)
    - User Log levels (`/fau`: verbose, info, warnings only) and verbose Dropped Notes summaries with MIDI Numbers for Clip, MIDI Paste, Listener copy and Move.
    - Browser UA test: PASS.

