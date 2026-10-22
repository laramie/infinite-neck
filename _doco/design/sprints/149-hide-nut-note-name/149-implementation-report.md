# Sprint 149 implementation report: hide-nut-note-name

Design: [149-design.md](149-design.md). Plan: [149-copilot-plan.md](149-copilot-plan.md).

## Result

A new checkbox, **HIDE Nut Note Names** (`#cbHideNutNames`), hides the baseline open-string label shown in Nut cells. It is a CSS-only toggle (`body.HideNutNames`) modelled on Show All Note Names. It is not wired into the four HIDE checkboxes' shared handler, so it does not touch Palette::Keep, `#lblHideWarning`, `clearAll()` or `replay()`.

Per the design request, **Show All Note Names still reveals the Nut labels**. The `.universalNamedNote` lane is not touched by the new rule.

Placed Named notes keep their names: they carry `.NamedNoteActive`, which the rule excludes.

## Changes

| File | Change |
|---|---|
| [infinite-neck.css](../../../../infinite-neck.css) | New rule `body.HideNutNames td.nut .namedNote:not(.NamedNoteActive)` (and `td.nutR`) sets `color: transparent`. Placed right after the `.universalNamedNote` color rules. |
| [index.html](../../../../index.html) | New checkbox `#cbHideNutNames` after HIDE Fingering. Unchecked by default. |
| [infinite-neck.js](../../../../infinite-neck.js) | New exported `hideNutNames(hide)` (sets the checkbox and toggles the body class). `change` handler on `#cbHideNutNames`. `controlsToDisplayOptions()` writes `options.hideNutNames`. `displayOptionsToControls()` applies `hideNutNames` when the key is present (sparse-safe, like the other keys). |
| [templates/display-options/displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js) | `hideNutNames: false` in `DISPLAY_OPTIONS_DEFAULTS`; `META_ROWS` entry in group `Hide`, after `hideFingering`. |
| [bin/print-control-defaults.js](../../../../bin/print-control-defaults.js) | `hideNutNames: 'cbHideNutNames'` added to `CHECKBOXES`. `--check` reports no drift. |
| [_tests/jest/golden/vdd-table.golden.html](../../../../_tests/jest/golden/vdd-table.golden.html) | Regenerated with `UPDATE_VDD_GOLDEN=1` (one new matrix column). |

Because `hideNutNames` has a default of `false`, loading a song whose sections do not store the key resets the checkbox and the body class (the song-load path applies `DISPLAY_OPTIONS_DEFAULTS`). Older songs are unaffected.

## Songs updated

`"hideNutNames": true` was added next to `"hideNamedNotes": true` in every `displayOptions` block of:

- [songs/name-that-note/name-that-note.json](../../../../songs/name-that-note/name-that-note.json) (1 block)
- [songs/name-that-note/name-that-note-bass.json](../../../../songs/name-that-note/name-that-note-bass.json) (1 block)
- [songs/name-that-note/name-that-note-positions.json](../../../../songs/name-that-note/name-that-note-positions.json) (1 block)
- [songs/name-that-note/name-that-note-positions-by-section.json](../../../../songs/name-that-note/name-that-note-positions-by-section.json) (6 blocks)

Not changed, as requested: `songs/name-that-note/name-that-note-MIDI.json`.

Other songs that also have `"hideNamedNotes": true` were left alone because they are outside `songs/name-that-note/`: `songs/practice/All-Chords-flashcard.json`, `songs/practice/pentatonics-7-m-V7-in-6-keys-with-fill.json`, `songs/practice/All-Chords-w-Modes-Piano-MatrixTester.json`, and the files under `songs/_trash/`. Add the key to them if the same behaviour is wanted.

## Verification

- All five `songs/name-that-note/*.json` files parse as JSON.
- `node bin/validate-song-schema.js --file songs/name-that-note/name-that-note.json --strict`: passed.
- `node bin/print-control-defaults.js --check`: no drift.
- Full Jest run (`node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --runInBand`): 76 suites, 933 tests, all passed.
- The existing test "META keys match the keys controlsToDisplayOptions() assigns" covers the key registration.
- No new Jest tests were added, in line with the repo practice that browser behaviour (the CSS and checkbox) is validated by UI acceptance testing.

## UI acceptance checklist

1. Open `?song=name-that-note/name-that-note.json`: the Nut shows no note name, and the checkbox is checked.
2. Place a Named note on a Nut cell: its name shows.
3. Turn on Show All Note Names: the Nut labels show.
4. Uncheck HIDE Nut Note Names: the Nut labels show again.
5. Load a song that does not store the key (for example `songs/practice/All-Chords.json`): the checkbox is unchecked and the Nut labels show.
6. `name-that-note-MIDI.json` is unchanged: the Nut labels still show.
