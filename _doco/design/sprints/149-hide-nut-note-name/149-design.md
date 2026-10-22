# sprint-149-hide-nut-note-name

## Goal

We asked Copilot to analyze this question: 

- What is the simplest way to implement a checkbox that will hide display of note names in the Nut?  Songs like this: `songs/name-that-note/name-that-note.json` will still want to place named notes and show that note name, but the default special note name display of note name should be possible to turn off with this checkbox precisely so it is not revealed prematurely in this exercise song.  Is adding a checkbox as a parallel to the other HIDE checkboxes the right way to go?  Or is there another place that would be simpler and not interfere with the special behaviors of these others.

- The request is informational only.  No code changes, and no Jest tests are to be run.

Copilot responded with [Copilot Plan](149-copilot-plan.md)

## Request

Please implement the "Recommended approach".

We do *NOT* want the option "If you want the nut labels to stay hidden even under Show All Note Names...".  So the desired behavior is that nut labels will show under action "Show All Note Names".

Please update the songs except for `songs/name-that-note/name-that-note-MIDI.json`

Please produce your implementation report in empty file `149-implementation-report.md`.
