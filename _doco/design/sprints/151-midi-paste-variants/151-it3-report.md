# Sprint 151 Iteration 3 report: User Log levels and verbose Dropped Notes

## Result

Implemented. Full Jest suite: 83 suites, 1161 tests, all passing.

Dropped Notes now reach the User Log as one verbose summary row per action, and the User Log has a level setting at `/fau`.

## What was built

### Levels

| Level | Key | Shows |
| --- | --- | --- |
| verbose | `v` | everything |
| info | `i` (default) | info and warnings |
| warnings only | `w` | warnings only |

- A `UserLog` event may carry `level` (`v`, `i`, `w`). A message with no level is a warning, so every existing message shows at every setting.
- The level is stored on each row (`dataset.level`). The setting only changes `row.style.display`, so switching to `v)erbose` shows rows that were written earlier.
- The setting is app-level and persists in `localStorage` under `UserLogLevel`.
- Menu: `/fau` is `u)ser log level [current]` under `/fa` (advanced), with children `v)erbose`, `i)nfo`, `w)arnings only`. The menu stays open after a choice.

### Summary rows

All at level `v`, one per action, and only when something was dropped:

- Clip revive: `Clip revive <label>: dropped N notes; MIDI Numbers dropped: {s7:[..],s8:[..]}`
- MIDI Paste of a clip: `MIDI Paste <label>: dropped N notes; MIDI Numbers dropped: {..}`, plus `; unmapped U notes (no map pair for their string); MIDI Numbers unmapped: {..}` when a map left strings unmapped.
- MIDI Paste of recorded notes: `MIDI Paste recorded <label>: ...` (same shape).
- Listener copy: `Listener copy <userKey>: ...` (same shape).
- Move: `Move apply #N: dropped D of C; reasons: <top 3 reasons xN>; MIDI Numbers dropped: {..}`.

The MIDI numbers are grouped by 1-based source string (the numbering a map spec uses): `{s7:[34,36],s8:[41]}`. Within a string they are distinct and ascending; at most 40 numbers are listed in all (lowest strings first), then `...more`: `{s7:[34,36,...],s8:[...],...more}`. A note with no usable string goes under `s?`.
The MIDI list is distinct, ascending, at most 40 numbers, then `...more`, e.g. `[34,36,41,50,54,...more]`. Interpolated labels are HTML-escaped because the User Log renders `innerHTML`.

### Follow-up: more detail for spelunking

The label in each row (for example `single-8-1618`) is the clip's name in the Graveyard. In `/fpc` the flat `[..]` list was replaced by the by-string grouping above, so the string is visible with each MIDI number. Detail added in this follow-up (all verbose, so the terse warnings are unchanged):

- `unmapped` now lists `MIDI Numbers unmapped: {..}`.
- Many-to-one collisions: `MIDI Paste <label>: map "<id>" N notes lost to the later pair; MIDI Numbers lost: {..}`.
- Skipped pairs: `MIDI Paste <label>: map "<id>" skipped pairs 3:3; source has S strings, target has T strings`.
- A map that does not fit the tunings: `MIDI Paste <label>: map "<id>" not applied: does not fit A to B; pasted by same string`.
- `/fpch` and the Move help end with a terse tip: `Tip: /fau then v)erbose writes ... to the User Log.` (Clip and Move are the only plugins with verbose-only output.)
- `applyStringMap` returns `unmappedNotes` and `collisionNotes` for this.
- Move rows group by the note's string the same way.
- The by-string form replaced the flat list also for dropped notes, so the earlier `[34,36,...]` form no longer appears.

Not changed: map add/delete/select messages and damaged-stored-map warnings (they have no notes to list).

Result lines (the status line text) are unchanged.

## Files

New:
- [plugins/userLogLevels.js](../../../plugins/userLogLevels.js): pure level constants, `normalizeUserLogLevel`, `shouldShowUserLogMessage`, `formatMidiNumberList`.
- [plugins/emitUserLog.js](../../../plugins/emitUserLog.js): shared `emitUserLog(subSystem, message, level)`; kept separate from the pure module so `UserLog.js` never imports the EventBus.
- [_tests/jest/user-log-levels.test.js](../../../_tests/jest/user-log-levels.test.js)

Changed (top-level files, approved with this iteration):
- [UserLog.js](../../../UserLog.js): level get/set, per-row level, show/hide.
- [infinite-neck.js](../../../infinite-neck.js): the `UserLog` handler passes `data?.level`.
- [key-handlers.js](../../../key-handlers.js): `setUserLogLevel` action and `userLogLevel` value.
- [menu.js](../../../menu.js): `/fau`.

Changed (plugins):
- [plugins/clip/ClipPlugin.js](../../../plugins/clip/ClipPlugin.js): `emitDroppedNotesSummary`, `midiNumbersOfNotes`, dropped-MIDI tracking.
- [plugins/clip/midiPasteMaps.js](../../../plugins/clip/midiPasteMaps.js): `applyStringMap` also returns `droppedNotes`.
- [plugins/move/MovePlugin.js](../../../plugins/move/MovePlugin.js): `emitDroppedNotesSummary`.

Tests extended: `clip-plugin-midi-paste-maps.test.js`, `move-plugin.test.js`, `key-handlers.test.js`.

Docs: [help.html](../../../help.html) (`/fau` paragraph).

## Decisions I made (my open questions were not answered)

1. Only out-of-range and no-landing drops count as Dropped Notes. `unmapped` (a map has no pair for the string) is reported in the same row at `v`. Overwrite-off `skip` stays in the result line only.
2. Existing map warnings (skipped pairs, collisions, damaged stored maps) stay untagged, so they are warnings.
3. Listener copy now logs its drops at `v`. It logs once, in `copyListened`, not at the default-name preview (which would repeat). Its MIDI-only projection branch is not counted.
4. The default level is `i`.
5. `ArpeggioPlugin` and `PluginManager` are untouched: they emit untagged messages (= warnings), and `arpeggio-plugin.test.js` asserts the exact `{subSystem, message}` payload. Their duplicate `emitUserLogMessage` was not consolidated.
6. Move's in-memory `droppedNotes` array and `showDroppedNotes` action are unchanged.

## Caveats

- The User Log keeps at most 1000 rows. A large verbose session can push older rows out, and hidden rows count toward the cap.
- Hidden rows are only hidden. Switching to `w)arnings only` does not delete anything.

## Tests added

- Pure: level normalization, the v/i/w visibility matrix, untagged = warning, `formatMidiNumberList` (sorted, distinct, junk filtered, exactly 40, over 40 gives `...more`).
- EventBus spy: `emitUserLog` payloads (default `w`, repair of a bad level, empty message sends nothing).
- Menu: `/fau` shape, unique `/fa` triggers.
- `key-handlers`: `setUserLogLevel` result text, `preserveMenuStack`, `getValue('userLogLevel')`.
- Clip: unmapped verbose row; out-of-range row with `[82,84]` from three dropped notes; no row when nothing is dropped; recorded-notes row; map warnings stay `w`.
- Move: one `v` row with the count, reason and `MIDI Numbers dropped: {s5:[70]}`; result line unchanged.

Per the repo testing convention, no JSDom/browser expectations are in Jest; `UserLog` DOM behavior needs the UI check below.

## Browser check

1. Open `/fau` and choose `v)erbose`; the menu stays open and the caption shows `[verbose]`.
2. `/fpc`, copy a clip, then MIDI Paste into a tuning with a shorter range (or with `m)idi paste map` active). A `ClipPlugin` row with `MIDI Numbers dropped: {...}` appears.
3. Run a Move that drops notes (`drop` algorithm); a `MovePlugin` row appears.
4. Choose `i)nfo`: those rows hide. Choose `w)arnings only`: only warnings remain. Choose `v)erbose` again: the earlier rows return.
5. Reload; the level persists.
