# Sprint 148 (displayOptions-diff), Iteration 6: implementation plan for Song-DEFAULTS

date: 20261025

Requested by [148-it6-design.md](148-it6-design.md).  Builds on [Iteration 5](148-it5-round-1-implementation-plan.md) (the Matrix) and [Iteration 4](148-it4-round-2-implementation-plan.md) (resolver, plans, gates).  Sprint overview: [sprint-148.md](sprint-148.md).

**No code was changed.**  Everything below comes from reading the code.

Vocabulary: **Song-DEFAULTS** = the new `song.displayOptionsDefault` block (sparse `{ key: value }`, same keys and value shapes as a Section's `displayOptions`).  **DEFAULTS** = `DISPLAY_OPTIONS_DEFAULTS` in [displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js).

## 0. Summary

1. **File format:** one new optional Song field, `displayOptionsDefault`.  Missing, `{}` and "no known keys" are all the same thing, so every existing Song (including the Section-1 idiom) loads and behaves exactly as before.  Omitted from the file when empty (like `displayOptionGates`).
2. **Cascade:** Song-DEFAULTS become a new tier between the Sections and DEFAULTS.  Only the resolver changes; every consumer (navigation, render, SaveDiff, `/vdd`, Matrix) already goes through it.
   `Section k cell` -> `earlier Sections' cells` -> **`Song-DEFAULTS`** -> `DEFAULTS` -> (control left alone / `syncLive`).
3. **Buttons:** two buttons, written as plans so the report text and `DisplayOptionsModel:changed` redraw come for free.  **Both override gates** (read, write, adapter; decision D1), so they have no skip logic of their own; they report which gated keys they touched.  They do not use the Undo slot (section 3.2).
4. **Matrix:** one new `Song-DEFAULTS` row between DEFAULTS and LIVE, always shown (blank cells when the block is empty).
5. Top-level files touched (please confirm, per our SOP): [Song.js](../../../../Song.js) (none, or one tiny helper), [SongPersistence.js](../../../../SongPersistence.js), [infinite-neck.js](../../../../infinite-neck.js).  Everything else is under `templates/display-options/` and `_tests/jest/`.

## 0.1 Decisions made in chat (round 1)

These came out of the discussion after the first draft of this plan and are no longer open.

| # | Decision | Reason |
|---|---|---|
| D1 | **The two buttons override all gates**: Current to Song-DEFAULTS and Clear Song-DEFAULTS ignore read-blocks, write-blocks and adapter blocks (Presentation Mode / Allow Theme Automation off), whether they are cell, row or column gates.  Write-blocks still protect Section cells from SaveDiff, SaveAll and Clear Section; they never protected the Song block because it did not exist. | Read-blocks are a development/testing aid.  The author can see the row being copied and assumes its value is copied.  Both buttons are explicit author actions. |
| D2 | **Clear overrides gates too.** | Otherwise Copy could write a column-write-blocked key that Clear then refuses to remove, and the only way out would be removing the gate first. |
| D3 | **The copy is a pure mirror (replace, was Q2):** after a press the block holds exactly the Current Section's stored cells, no leftovers from earlier presses. | Follows from D1 (nothing is skipped), and Clear exists for emptying. |
| D4 | **The report names the gated keys** that were copied or removed (for example `copied 12 cells; gated: noteFont (cell r), tinyNoteWidth (column w), NoteDisplaySizes (adapter)`). | The author can see what was overridden. |
| D5 | **Dormant values are legal.**  A Song-DEFAULTS value for a column-read-blocked key, or an adapter-blocked key (`NoteDisplaySizes`, `sectionTheme`), is stored but not applied (R2: the control is left alone) until the gate or flag is turned off.  No resolver change. | Matches how a Section cell behaves under the same gates. |
| D6 | **Copying a cell-read-blocked cell weakens that block's visible effect:** the Section then inherits the same value from Song-DEFAULTS unless an earlier Section stores the key.  The block itself is untouched. | The intended outcome of D1. |
| D7 | The old Q3 (gated cells) and Q9 (column write gate meaning) are **dropped** (answered by D1, D2). | |

## 1. Facts the plan relies on

| Area | Fact | Where |
|---|---|---|
| Resolver | `cascade()` walks Sections; absent keys then take `DISPLAY_OPTIONS_DEFAULTS` per policy (`defaultIfAutomated`: only if some Section stores the key).  `baseline` (SaveDiff) = cascade over earlier Sections, then DEFAULTS, then `syncLive` for keys with no default.  Column/row/adapter read gates delete the key at the end of `apply` (R2) | [displayOptionsResolver.js](../../../../templates/display-options/displayOptionsResolver.js) |
| Plans | `planSaveDiff/All/Clear/StoreCell/Gate` + `applyPlan` (ops `setCell`, `deleteCell`, `setGate`), `skipReason()` (adapter off, write-blocked, read-blocked), one-slot undo via `snapshot()` | [displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js) |
| Core hooks | `runDisplayOptionsPlan(plan, {quiet})` -> `finishDisplayOptionsModelChange` (UserLog, redraw event, keepDirty); `getDisplayOptionsMatrixContext()` | [infinite-neck.js](../../../../infinite-neck.js#L758) |
| Song open | `applyDisplayOptionDefaults()` puts DEFAULTS in the controls, then `sectionChanged()` applies the resolver's `apply` set.  So Song-DEFAULTS need no extra call at open if the resolver supplies them | [infinite-neck.js](../../../../infinite-neck.js#L707) |
| Persistence | Song fields are normalized in the constructor; unknown fields pass through `Object.assign`.  `displayOptionGates` is the precedent for an optional, omitted-when-empty Song block | [SongPersistence.js](../../../../SongPersistence.js#L329) |
| Matrix | thead = group row, key row, DEFAULTS, LIVE.  Sticky offsets are measured (`--dm-top-key/-defaults/-live`).  DEFAULTS/LIVE cells use zone `specialCell` with `data-key` | [displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js), [display-options.builder.js](../../../../templates/display-options/display-options.builder.js#L246), [display-options.css](../../../../templates/display-options/display-options.css#L116) |
| Top row | `Apply`, three `&nbsp;` lines, `Float`, `Close` | [display-options.html](../../../../templates/display-options/display-options.html#L16) |

## 2. Model and cascade (pure code, Jest-testable)

### 2.1 Normalization and persistence
- New `normalizeSongDisplayOptionsDefault(raw)` in [displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js) (or a sibling): keep only `isDisplayOptionKey` keys with a non-null value, deep-clone, return `undefined` when nothing is left.
- [SongPersistence.js](../../../../SongPersistence.js) constructor: same pattern as `displayOptionGates` (assign or `delete this.displayOptionsDefault`).  Nothing needed in `persistentSongFileReplacer` because the constructor and the plan already delete an empty block.
- Normalizing at load drops unknown keys (no "legacy" handling needed; the block is new).

### 2.2 Resolver ([displayOptionsResolver.js](../../../../templates/display-options/displayOptionsResolver.js))
- Add source `'songDefault'` to `entries`.
- `baseline`: after the earlier-Section cascade, for each key not yet set: Song-DEFAULTS value if present (source `songDefault`), else DEFAULTS (`default`), else `syncLive` (`sync`).  Consequence: **SaveDiff on any Section now diffs against Song-DEFAULTS**, so a Section that repeats a Song default stores nothing (the point of the iteration).
- `apply`: after the cascade, a key with a Song-DEFAULTS value and no stored cell takes it **unconditionally** (an explicit author statement, like a Section-1 cell; it does not depend on the `defaultIfAutomated` policy and works for keys with no DEFAULTS entry such as `sectionTheme`, `currentColorDict`, `NoteDisplaySizes`).  Then the existing DEFAULTS policy fills the rest, then the R2 region gates delete as today.
- Read gates: a column read-block, or an adapter block, on a key leaves that key's Song-DEFAULTS value dormant: it is not applied (R2, no new code; decision D5).  Cell/row gates cannot hit Song-DEFAULTS (no Section).  `baseline` keeps ignoring gates for default tiers, as it does for DEFAULTS today.
- Update the header comment and the `entries` doc line.

### 2.3 Consumers to adjust
- [displayOptionsMatrixTools.js](../../../../templates/display-options/displayOptionsMatrixTools.js) `describeCell`: Inspect on a key header / special cell adds `song default: <value or (none)>`; Section-cell Inspect already prints `inherited.source`, which will say `songDefault`.
- `getAutomatedKeys` needs no change (Song-DEFAULTS bypass it).
- [display-options.js](../../../../display-options.js) (`/vdd`): see Q5.

## 3. The two buttons

### 3.1 Plans ([displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js))
New ops `setSongDefault {key, value}` and `deleteSongDefault {key}` handled in `applyPlan` (assign, delete, drop the block when empty).  `describeOps` reports them (`Song-DEFAULTS: wrote ..., removed ...`).

**Gates are never consulted by these two plans (D1, D2).**  They do not call `skipReason()`, so `plan.skipped` stays empty; gates are consulted only to build the report (D4) via `describeBlocks()` from [displayOptionsGates.js](../../../../templates/display-options/displayOptionsGates.js).

- `planCurrentToSongDefaults(song, idx)` ("Current to Song-DEFAULTS"): source = the Section's **stored** `displayOptions` (not the live controls, per the design: do SaveAll first for a full copy).
  - Pure mirror (D3): `setSongDefault` for each stored key whose value differs from the block (clone the value), `deleteSongDefault` for existing block keys the Section does not store.  Keys that already match count as `unchanged`, so a repeat press reports "nothing to change".
  - Only keys that are known (`isDisplayOptionKey`) and not `undefined`/`null` are copied (the normalizer's rule), so a hand-edited Section block cannot put junk in the Song block.
  - Current Section stores nothing: `unchanged`, report "Section N stores nothing; Song-DEFAULTS unchanged" (it does not wipe; Clear does that).
  - Report (D4): the usual `wrote ... / removed ...` text, plus `gated: key (cell r), key (column w), key (adapter), key (row r) ...` listing every copied or removed key that had any block at the time.
- `planClearSongDefaults(song)`: `deleteSongDefault` for every key in the block, gated or not.  Empty/missing block: `unchanged`, "nothing to clear".  Leaves no empty block (missing == empty).  The report lists gated keys the same way.

### 3.2 Undo
Design says these need not use Undo.  Mark such plans `noUndo: true`; `applyPlan` then leaves `lastUndo` alone (so a stray button press never destroys the Undo of the last Save/Clear/gate).  Recommended (Q4).  With gates overridden, the author's recovery from a bad press is the design's own: press Clear, or SaveAll on a Section and Copy again.

### 3.3 Core wiring ([infinite-neck.js](../../../../infinite-neck.js))
- `handleBtnCurrentSectionToSongDisplayOptions(options)` and `handleBtnClearSongDisplayOptions(options)`: `runDisplayOptionsCommand(() => applyPlan(song, plan), { quiet, keepDirty: true })`, like `runDisplayOptionsPlan`.  Copies the model, so the controls and their dirty highlight are untouched.
- `getDisplayOptionsMatrixContext()` adds `hasSongDefaults` and `currentStoresCells` for button enabling.
- A change always affects what Apply would do for the Current Section (earlier Sections can only be affected by Song-DEFAULTS), so the Matrix always runs its "Apply / hint / dirty warning" path after a real change.

### 3.4 Matrix HTML and builder
- [display-options.html](../../../../templates/display-options/display-options.html): after `#btnApply_Matrix`, `&nbsp;` spacing, then `#btnCurrentSectionToSongDisplayOptions` ("Current to Song-DEFAULTS") and `#btnClearSongDisplayOptions` ("Clear Song-DEFAULTS"), then spacing, then Float.  Both `shadowButton` with `title` text saying "copies this Section's stored cells (not the live controls)".
- [display-options.builder.js](../../../../templates/display-options/display-options.builder.js): two `press(...)` handlers -> core function -> `setStatus([report], kind)`, using `afterEditThatChangesApply(ctx.dirty, lines)` when `out.changed`.  `updateButtons(ctx)` disables Clear when `!hasSongDefaults` and Current-to-Song when `!currentStoresCells`.  Add both ids to the id list in [display-options-matrix-ui.test.js](../../../../_tests/jest/display-options-matrix-ui.test.js#L373).

## 4. The Song-DEFAULTS row

- [displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js): `buildSongDefaultsRowHtml(song, {interactive, keys})`, class `dmSpecialRow dmSongDefaultsRow`, label `Song-DEFAULTS`, cells `td.dmSpecialCell` with zone `specialCell` + `data-key` (so Inspect and the Key r / Key w tools work from this row exactly as from DEFAULTS), blank for absent keys.  `buildMatrixHtml` emits DEFAULTS, **Song-DEFAULTS**, LIVE.
- The row is part of the full redraw (model changed event already triggers it); only LIVE is patched in place, so no change to the loop path.
- Gate look (Q11): recommended that the cells carry the column and adapter classes so a dormant value is visible.  Pure code: `describeBlocks(song, null, key)`, as the key header already does.
- [display-options.builder.js](../../../../templates/display-options/display-options.builder.js) `measureStickyOffsets`: add `--dm-top-songdefaults` = group + key + defaults, and shift `--dm-top-live` by the new row; add its height to `stuckHeaderHeight`.
- [display-options.css](../../../../templates/display-options/display-options.css#L121): one rule for the sticky offset, plus a look that tells it apart from DEFAULTS (tune in testing, per the design).
- Legend: one sentence under **Usage** explaining the row and the cascade order.  The Legend's synthetic Song gets no block (blank row).
- Existing tests that pin the row order ([display-options-matrix-ui.test.js](../../../../_tests/jest/display-options-matrix-ui.test.js#L420), `#L510`) are updated.

## 5. Tests (Jest only, no JSDOM/jQuery, per our pattern)

New `_tests/jest/display-options-song-defaults.test.js`; extend the existing matrix tests where noted.

1. Normalize/persist: missing, `{}`, unknown keys, null values -> `undefined`; round trip through `getPersistentSongFile()`; an old Song (no field) loads with no field.
2. Resolver `apply`: Song-DEFAULTS beat DEFAULTS; a Section cell beats Song-DEFAULTS; applied even when no Section automates the key; applied for no-DEFAULTS keys; column read-block leaves the key out (`blocked`); empty block == missing block (identical `values` to a Song without the field).
3. Resolver `baseline`: Song-DEFAULTS in the Section-1 baseline; `planSaveDiff` on Section 1 stores nothing when live == Song-DEFAULTS and deletes a now-redundant cell.
4. Plans: copy is a pure mirror (a second press with a different Section replaces, removes stale keys); **gates are ignored** (cell read, row read, cell/row write, column read/write, adapter off: every stored key is copied and `plan.skipped` is empty); the report lists the gated keys; Clear removes gated keys too; "stores nothing"; unchanged repeat; Clear on empty/missing block; no empty block left behind; `noUndo` leaves `lastUndo`; unknown/null keys in a hand-edited Section block are not copied.
4a. Dormant values: a copied column-read-blocked or adapter-blocked key is in the block but absent from the `apply` values; turning the gate off makes it apply.  A copied cell-read-blocked cell makes the same Section inherit the value (D6).
5. View: row order (group, key, DEFAULTS, Song-DEFAULTS, LIVE), values rendered, blank when empty, zones/data attributes; Inspect text.
6. `/vdd` golden unchanged (do not regenerate it unless Q5 says otherwise).
7. Full run: `cd ~/infinite-neck; export INFINITE_NECK_VERBOSE=-1; node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`.

Browser acceptance recipes (to write into the Round report): author a Song whose Section 1 has no cells, press SaveAll, Current to Song-DEFAULTS, Clear Section 1, reload: controls come from Song-DEFAULTS; SaveDiff on Section 3 diffs against them; Clear Song-DEFAULTS restores DEFAULTS; an old Song (Section-1 idiom) is unchanged and its Song-DEFAULTS row is blank.

## 6. Order of work

1. Normalizer + SongPersistence + tests (2.1).
2. Resolver tiers + tests (2.2), then `describeCell` (2.3).
3. Plan ops + two plans + `noUndo` + tests (3.1, 3.2).
4. Core functions and context (3.3).
5. View row, HTML buttons, builder, CSS, Legend line (3.4, 4) + updated UI tests.
6. Full Jest run; Round report with acceptance recipes; update [sprint-148.md](sprint-148.md).

## 7. Questions (answer before coding; the recommendation is used if you do not object)

Numbers are kept from the first draft so earlier chat references still work.  **Q2, Q3 and Q9 are decided (D1-D3, D7) and no longer open.**  Q11 and Q12 are new.

**Q1. What does a "copy" take from the Current Section?**  Its stored `displayOptions` cells only.  *Recommend:* yes, exactly that (as the design says).  The Section's own cells stay, so they show white ("repeats the inherited value") until the next SaveDiff or Clear Section removes them.  Alternative: the button also removes the now-redundant cells from the Section ("move" rather than "copy", the word the sprint overview uses).  Which?

**Q2. (decided: D3)** Replace, pure mirror.

**Q3. (decided: D1, D4, D6)** Gates are ignored by the copy; gated keys are named in the report.

**Q4. Undo.**  *Recommend:* these two buttons do not touch the one-level Undo slot (as the design implies).  Alternative: include the Song block in the snapshot so `/vpmu` and Undo cover it, at the cost of overwriting the last Undo.

**Q5. `/vdd`.**  The report is pinned by a golden file.  *Recommend:* leave `/vdd` as is for now (only the Matrix shows Song-DEFAULTS).  Alternative: a Song-DEFAULTS row only when the block is non-empty (golden unaffected for Songs without one).

**Q6. Apply after the buttons.**  A change always alters what Apply does.  *Recommend:* reuse the Matrix's existing behavior (hint "press Apply", or auto-apply when that box is checked and the controls are clean).  Is that right for a Song-level change, or should these always apply?

**Q7. Clicking Song-DEFAULTS cells.**  *Recommend:* same as DEFAULTS cells: Inspect and Key r / Key w work, the cell Tools (Clear Cell, Store Cell, Cell r/w) do nothing there; per-key editing of Song-DEFAULTS is out of scope (only the two buttons write).  OK?

**Q8. Command line.**  Add `/vpm` equivalents for the two buttons (they are cheap: same plans)?  *Recommend:* not in this iteration; add on request.

**Q9. (decided: D1, D2, D7)** The two buttons override column write-blocks (and every other gate).  The one rule is: "write-blocked cells are skipped by SaveDiff, SaveAll and Clear Section; the two Song-DEFAULTS buttons are explicit author actions and override all gates."

**Q10. Naming.**  The field is `displayOptionsDefault` (singular, as in the design text).  The UI says "Song-DEFAULTS".  Keep both?

**Q11. (new) Show dormant Song-DEFAULTS values?**  Because of D1/D5 the block can hold values that are not applied (column read-blocked key, adapter-blocked key).  The existing DEFAULTS and LIVE cells carry no gate classes, so by default the Song-DEFAULTS row would show such a value as an ordinary cell.  *Recommend:* Song-DEFAULTS cells carry the **column and adapter** classes (`dmColGateR/W`, `dmAdapterKey`) like Section cells do, so the existing View Column/Key Gates overlay shows a dormant value as blocked.  No row or cell gates apply to this row.  Alternative: plain cells, and Inspect explains it.

**Q12. (new) Confirmation when overriding gates?**  With D1 the buttons never stop on a gate.  *Recommend:* no confirmation dialog; the status report names the gated keys (D4), and Clear is the recovery (the design already says the buttons need not consume Undo).  Alternative: a one-line confirm only when gated keys are involved.
