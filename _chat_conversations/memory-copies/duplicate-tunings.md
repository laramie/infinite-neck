# Duplicate Tunings / Song Table Normalization Handoff (2026-03-14)

## Context
- Project: infinite-neck
- Focus: Song file normalization, duplicate table/tuning handling, visibleNoteTables and myTunings consistency
- Last user request: Ensure all tbl* referenced in visibleNoteTables or any section.noteTables are present in myTunings (no duplicates), and visibleNoteTables contains only unique IDs, all present in myTunings and marked visible.
- Recent patch: normalizeSongTuningIDs now called at end of openSong to ensure runtime model is normalized after all section and property assignments.

## Current State
- My Tunings and visibleNoteTables are now deduplicated and normalized after song load.
- All referenced tables (tbl*) are ensured present in myTunings and visible tables.
- No duplicate tables in My Tunings or visible tables.
- User confirmed both tables visible, but My Tunings was empty after first patch; fixed by normalizing after all assignments in openSong.

## Key Memory Files (copied from /memories/):
- /memories/repo/infinite-neck-jest.md:
  - Use ./run-jest.sh or npm test for Jest; plain npx jest misses the repo's ESM launcher and throws import parsing errors.
  - Current targeted validation set for NoteTable work: ./run-jest.sh _tests/jest/notetable-model.test.js _tests/jest/section-recorder.test.js _tests/jest/song-api-load.test.js
- /memories/testing-preferences.md:
  - Preferred full pre-checkin Jest command: node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
  - Reason: pure ES6/ESM compatibility has been reliable with this invocation in user environment.

## Next Steps / Handoff
- If further issues with table/tuning normalization or UI/registry sync, check:
  1. normalizeSongTuningIDs logic for edge cases (e.g., missing/extra tables, instance IDs)
  2. TableBuilder.showTuningsForTablesInFile and related UI sync logic
  3. Song file structure: ensure all tbl* are referenced as expected
- If new song file types or registry changes, update normalization logic accordingly.

## Status: Ready for next session. All normalization and deduplication logic is now in place and tested in UI.
