# Sprint 148 Iteration 8: Song-DEFAULTS are startup values (fix)

## The question

The driving use case of Song-DEFAULTS was missed in Iterations 6 and 7.

1. Open a new Song, add Sections with notes, and loop.
2. Set View > "Note Font" > "UnifrakturCook".  The font stays for all Sections while looping.
3. On Section 1: SaveDiff, then press the button `&sect;1 -> Song-DEFAULTS`.  Song-DEFAULTS now holds only `noteFont`.
4. Press View > CLEAR.  Section 1 stores nothing; LIVE still shows "UnifrakturCook".
5. Loop and change LIVE to "Dosis".  On every Section change the font went back to "UnifrakturCook".

Same thing with the practice Song [All-Chords.json](../../../../songs/practice/All-Chords.json): its Song-DEFAULTS hold `autoColor: false` and no Section stores any DisplayOptions.  A User who pressed `c` to turn AutoColor on saw it reset to OFF on every Section change.

The intent: when no Section automates a key, Song-DEFAULTS set the control at startup/open, and from then on the LIVE control holds its value.  The control only loses it if the Song author automated that key in some Section.

## Cause

The resolver ([displayOptionsResolver.js](../../../../templates/display-options/displayOptionsResolver.js)) pushed every Song-DEFAULTS key on every `apply` (navigation and Apply from Model), "unconditionally, like a Section-1 cell".  The `defaultIfAutomated` rule ("Keep Policy C", Iteration 4) had only been specified for the app DEFAULTS tier.  Iteration 6 added the Song-DEFAULTS tier above it and specified its precedence, but not its timing.

## Clarified design

The Model is the Section cells.  Song-DEFAULTS and DEFAULTS are startup values and fallbacks for keys the Song automates.

| Moment | Song-DEFAULTS | DEFAULTS |
|---|---|---|
| Song open | every key is pushed once (after DEFAULTS), then Section cells are laid over it | pushed (unchanged) |
| Navigation, looping, **Apply from Model** | pushed only for a key some Section stores readably | pushed only for a key some Section stores readably (unchanged) |
| Key no Section stores | the control keeps its LIVE value | the control keeps its LIVE value |
| SaveDiff baseline | cascade, then Song-DEFAULTS, then DEFAULTS (unchanged) | |

- Apply from Model is `sectionChanged()`, the same path as navigation, so it follows the same rule.  The Design Team confirmed this ("the Model has empty values for both"; Apply from Model should not step in with Song-DEFAULTS).
- "Automated" means a Section stores the key in a cell that is not blocked by a column or adapter read-block (existing `getAutomatedKeys()`).
- When the Song does automate a key, Song-DEFAULTS remain the fallback for Sections before the first cell.
- SaveDiff: change LIVE to "Dosis" on a Section with no `noteFont` cell and SaveDiff writes `noteFont: Dosis` there (it differs from the Song-DEFAULTS baseline).  The Song then automates `noteFont`.  Confirmed by the Design Team.
- NoteDisplaySizes: unchanged intent (open-time only, Scaling Prefs beat Song-DEFAULTS).  With Presentation Mode on, the open push applies Song-DEFAULTS sizes after the open-time step, as the cascade used to at the first `sectionChanged()`; with it off the adapter gate drops them and `applyOpenTimeSizes()` stands.

## Changes

- [templates/display-options/displayOptionsResolver.js](../../../../templates/display-options/displayOptionsResolver.js)
  - `apply` and `render`: a Song-DEFAULTS key is used only if automated (under policy `default`: always).
  - New purpose `open`: the Song-DEFAULTS tier alone, every key, minus column/adapter read-blocks (R2, dormant).
  - `baseline` unchanged.
- [infinite-neck.js](../../../../infinite-neck.js): `applySongDefaultsAtOpen()`, called in `updateAfterOpenSong()` just before `replay(); sectionChanged();`, pushes the `open` values silently with `displayOptionsToControls(values, true)`.
- Jest: [display-options-song-defaults.test.js](../../../../_tests/jest/display-options-song-defaults.test.js) and [display-options-open-sizes.test.js](../../../../_tests/jest/display-options-open-sizes.test.js) updated and extended (non-automated key not pushed, fallback when automated, render shows LIVE, `open` purpose and its gates).  Jest: 78 suites, 1016 tests.
- Docs: [help.html](../../../../help.html) ("Where a Section's values come from", "When Song-DEFAULTS are applied", recipes 12 and 13) and the Matrix Legend text.

## UA recipes (browser-unverified)

Recipe 43, the driving loop.  New empty Song with 3 Sections of notes.
1. View > Note Font > UnifrakturCook.  Section 1: SaveDiff, then `&sect;1 -> Song-DEFAULTS`, then View > CLEAR.  Song-DEFAULTS has only `noteFont`; Section 1 is empty in the Matrix.
2. Save the Song and reload it.  Expect UnifrakturCook at open.
3. Loop.  Change Note Font to Dosis.  Expect Dosis on every Section change.
4. Press **Apply from Model**.  Expect Dosis (not reset).
5. On Section 2 press SaveDiff.  Expect `noteFont: Dosis` stored in Section 2 (and the Song now automates it): Sections 1 and 3 then follow Song-DEFAULTS and Section 2's cell as usual.

Recipe 44, the All-Chords case.  Open `?song=practice/All-Chords.json`.
1. AutoColor is OFF at open (authored colors visible).
2. Loop and press `c`.  AutoColor turns on and stays on across Section changes.
3. Reload the Song: AutoColor is OFF again (startup value).

Recipe 45, an automated key keeps its fallback.  In a Song with Song-DEFAULTS `noteFont` and a `noteFont` cell only in Section 3: Sections 1-2 show the Song-DEFAULTS font on navigation, Section 3 its own.

Recipe 46, the old help recipes 10, 12 and 13 still hold for keys that a Section stores (a key no Section stores now keeps its LIVE value after Clear Song-DEFAULTS and Apply).
