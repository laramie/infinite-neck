# Sprint 148, Iteration 4, Round 3: implementation report and acceptance test plan

Implements the CORE-APPROVED design in [148-it4-round-2-implementation-plan.md](148-it4-round-2-implementation-plan.md) with the answers in [148-design.md](148-design.md), section "Iteration 4 Round 3 - Implementation".  Nothing here has been browser-tested; Jest passes (74 suites, 866 tests).

## What was built

| Area | Files |
| --- | --- |
| Pure modules (no DOM) | `templates/display-options/displayOptionsMeta.js`, `displayOptionsGates.js`, `displayOptionsResolver.js`, `displayOptionsPlan.js` |
| Model | `Song.js` (`getDisplayOptionsInEffect` = render resolve, `getStoredDisplayOptionsInEffect` = apply resolve, `resolveDisplayOptionsAt`), `SongPersistence.js` / `SectionPersistence.js` (gates normalized, omitted when empty), `bin/song-file-schema.js` |
| Runtime | `infinite-neck.js`: sparse-safe `displayOptionsToControls`, `applyDisplayOptionDefaults` (startup, after the palette loads, every Song open), `handleBtnSaveDiff`, `handleBtnSaveAll`, `handleBtnDeleteDisplayOptions`, `clearDisplayOptionsCell`, `setDisplayOptionsGate`, `undoDisplayOptionsOp`, `DisplayOptionsModel:changed` |
| UI | `index.html` (SAVE Diff, CLEAR, Save All...), `templates/section-drawer.*` (Save Diff only), `display-options.js` (`/vdd`), `infinite-neck.css` |
| Menu | `menu.js` `/vps` (SAVE Diff), `/vpa` (Save All, no confirmation), `/vpm` Matrix; `key-handlers.js` cases |
| Tools | `bin/compact-display-options.js` (dry run only), `bin/print-control-defaults.js` |
| Tests | `display-options-matrix`, `-gates-persistence`, `-table`, `-menu`, `-compact` tests; updated `display-options.test.js` and `key-handlers.test.js` |

## Rules as implemented

- A Section stores a sparse block (only cells it changes).  Value at Section k = last readable cell at Sections <= k.
- Absent-cell policy C (`defaultIfAutomated`): a key some Section stores readably gets its default before its first cell; a key never stored is left alone.  Keys with no default (`currentColorDict`, `NoteDisplaySizes`, `sectionTheme`) are never defaulted.
- Gates are deny-only lists: Song `{readBlocked, writeBlocked}` per key; Section the same, with `*` for the whole Section.  Adapter blocks: `NoteDisplaySizes` while Presentation Mode is off, `sectionTheme` while Allow Theme Automation is off.
- SAVE Diff and Save All skip read-blocked and write-blocked cells.  Clear skips only explicit write-blocked cells (Round 3 Q6).  Gates are never changed by Save/Clear.
- SAVE Diff also removes an existing cell that now equals what the Section inherits.
- Undo: one level, runtime only, covers cells and gates (`/vpmu`).
- Controls are not re-applied after a gate change (Q10); go to another Section and back, or use a Section navigation key.
- Every Song open and app start puts the controls at `DISPLAY_OPTIONS_DEFAULTS`, then the Song's cells are applied.

## Deliberate deviations and judgment calls

1. **Clear and read blocks** follow your Q6 answer, not my plan: a read block does not stop Clear.
2. **Clear and adapter blocks:** Clear removes a stored `NoteDisplaySizes` / `sectionTheme` cell even while the adapter is off (only explicit gates stop it).  SAVE Diff / Save All skip those cells while the adapter is off.
3. **Piano height default** is 5 (the markup), not 3 (the old fallback in code).
4. **AutoColor** default is on, set in code after the palette loads (the palette markup is unchecked; `bin/print-control-defaults.js` lists it as "differs on purpose").
5. **Menu (best effort)**: value vocabulary `read-blocked | write-blocked | blocked`; no value means both.  `/vpmgd` is a complementary delete menu with the same inputs.  Extras: `/vpa` and `/vpmu`.  Gate inputs are validated; a bad key or Section number reports in the command line and in Messages.
6. **Report:** every Save/Clear/gate/undo logs a line in the User Log and opens Messages.
7. **Not done / pushed to the Matrix sprint:** an explicit "Apply" primitive (use Section navigation), `/vdd` is a read-only audit rather than an editor, no menu command stores a single cell.

## Unverified (needs your browser run)

- The render-cache key: prewarm now completes options from the live controls instead of the old startup snapshot.
- The palette: `applyDisplayOptionDefaults()` after the palette loads (AutoColor on, Highlight off, then `fullRepaint()`).
- That no other file still uses the old ids `btnControlsToDisplayOptions_View` / `_Section` (a search found none).
- That `/vps`, `/vpa`, `/vpm...` trigger letters do not clash with plugin or runtime menu children added under `/vp`.

## Acceptance test plan (browser)

1. **Startup**: AutoColor is checked, Highlight unchecked, View controls at their markup values.  `/vdd` shows an empty table with the full column list.
2. **SAVE Diff basics**: on Section 1 change Note Font, click SAVE Diff.  Messages says `wrote noteFont`.  `/vdd` shows one row with only `noteFont` filled, the rest gray.
3. **Inheritance**: add Section 2; navigate 1 -> 2: Note Font stays.  On Section 2 change Show Left Subscript, SAVE Diff: row 2 holds only that cell.  Go back to Section 1: the subscript checkbox returns to its default (policy C).
4. **Revert**: on Section 2 set Show Left Subscript back to the default, SAVE Diff: the cell is removed (`removed showSubscriptFunctions`).
5. **Save All...**: click it; cancel keeps the model unchanged; OK writes every writable key.  `/vpa` writes without asking.
6. **Clear**: CLEAR on Section 2 removes its cells; Section 1 is untouched.
7. **AutoColor**: toggle it with `c`; move between Sections: it stays as you left it (no AutoColor cell is stored unless you SAVE Diff after changing it).
8. **Gates**
   - `/vpmgak` then `noteFont,read-blocked`: navigating no longer applies Note Font; `/vdd` header shows `col:r`.
   - `/vpmgdk` then `noteFont`: removes it.
   - `/vpmgac` then `2,showMidiNum,write-blocked`: on Section 2, SAVE Diff after toggling MIDI numbers reports `skipped showMidiNum (write-blocked)`; CLEAR leaves that cell.
   - `/vpmgas` then `2,read-blocked`: Section 2 applies nothing.
   - `/vpmc` then `2,noteFont`: clears one cell.
   - `/vpmu`: undoes the last change, including a gate.
9. **Presentation Mode**: with it off, SAVE Diff reports `skipped NoteDisplaySizes (presentationMode is off)`; turn it on and change cell width: SAVE Diff stores `NoteDisplaySizes`.
10. **Song round trip**: Save the Song, reload it: gates, sparse cells and the controls are as before.  The View > diagnostics "Song file format" item shows `displayOptionGates` only when set.
11. **Clone**: Clone copies cells and gates; Shallow clone keeps the Section's gates and drops its cells.
12. **Looping**: loop through 3 Sections with the View page open: controls follow the cascade; nothing flickers back to defaults at the loop wrap.

## Compaction dry run (reminder)

`bin/compact-display-options.js` NEVER writes.  It reports stored cells that repeat what their Section already inherits, per Song file.

```
node bin/compact-display-options.js                                   # every song under ./songs
node bin/compact-display-options.js songs/tests/display-options.json --verbose   # one file, list every redundant cell
node bin/compact-display-options.js songs/theory --include-trash                 # a folder, including _trash
```

`--write` is refused on purpose.  Current result on `./songs`: 3138 of 3413 stored cells are redundant (the old whole-snapshot SAVE).  After a real compaction a key that no Section stores any more stops being "automated", so navigation leaves its control alone instead of resetting it to the default.

`node bin/print-control-defaults.js [--check]` compares `DISPLAY_OPTIONS_DEFAULTS` with the markup; a Jest test runs the `--check`.
