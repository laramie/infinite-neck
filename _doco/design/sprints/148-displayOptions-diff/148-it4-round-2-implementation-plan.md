# Sprint 148 (displayOptions-diff), Iteration 4, Round 2: implementation plan for SaveDiff / SaveAll / gates

date: 20261018

Requested by [148-design.md](148-design.md), section "Iteration 4 Round 2".  Builds on [148-it2-analysis.md](148-it2-analysis.md) and [148-it4-round-1-analysis.md](148-it4-round-1-analysis.md) (read those for the reasoning; this plan only restates what it needs).  Iteration 3 is accepted and committed.  Sprint overview: [sprint-148.md](sprint-148.md).

No code was changed.  Claims come from reading the code.  The Matrix is not implemented in this Iteration; this plan builds the primitives it will sit on.

## 0. Summary

1. The work is one small pure "DisplayOptions model" (defaults and column metadata, gates, resolver, plan engine, undo) plus rewiring of the places that read and write `section.displayOptions`.  The pure part follows the Iteration 3 pattern: new modules under `templates/`, Jest only, no DOM, no top-level file touched (Phase 1).
2. The top-level files are touched in Phases 2 to 5.  Each one needs your explicit go-ahead; the list is in section 5.
3. Your answers remove three things from the Round 1 plan: the `null` tombstone on the write side, the AutoColor gate, and "re-encode on move/delete/clone".  They add one rule: **no session-level DisplayOptions** (Song open resets controls to the Song defaults).
4. The answers are consistent except in a few places, and one of them decides the core behavior: **what an absent, readable cell does at a Section boundary** (Q1).  The plan implements the three possible policies behind one constant, recommends one, and needs your decision before Phase 3.
5. Eleven questions in section 8 (conflicts and ambiguities only).  Everything else in your answers is taken as given, with the consequences listed in section 1.

## 1. Your answers and what they do to the plan

| Answer | Consequence in this plan |
|---|---|
| Matrix layers need per-cell storage and per-Song storage | Gates are stored at two levels, separately (3.3).  The Section level also carries a whole-row entry (Q1b). |
| Iteration 2 Q6: handled by the Matrix primitives | Sparse apply is a resolver policy, not a hard rule (3.4, Q1). |
| Iteration 2 Q7: no special AutoColor gate, default `autoColor: true` | `autoColor`, `autoColorHighlight`, `currentColorDict` are ordinary default-open columns.  The special-case `setAutomaticColorUi(true)` in the palette startup block ([infinite-neck.js L4734](../../../../infinite-neck.js#L4734)) goes away; the value comes from the defaults.  **This supersedes Round 1 Q5**, which you also accepted (Q4). |
| Iteration 2 Q8 and Q13: no session-level values | On Song open, apply the Song defaults to the controls before the first Section syncs (3.7).  Only keys behind the two existing Song gates are exempt (sizes when Presentation Mode is off, theme when Theme Automation is off). |
| Iteration 2 Q9: copy Section values on deep clone; Song-level gates never written into a Section | **No rebasing or re-encoding anywhere.**  Move, delete, clone, import never rewrite blocks.  "Resolved state is truth" is dropped.  The Matrix is where odd results get fixed (3.6). |
| Iteration 2 Q10: gate toggles write nothing to a Section, so no dirty flag | Gate setters do not go through the dirty binding ([infinite-neck.js L4433](../../../../infinite-neck.js#L4433)) (3.10). |
| Q1a: Song column flag | `song.displayOptionGates` (3.3). |
| Q1b: one Section can block read or write for all keys | `section.displayOptionGates` with a whole-row entry `"*"` (3.3, Q2). |
| Q2: Song column wins, Section row wins over cell | Gates are deny-only, so "wins" reduces to "any deny blocks" (3.3, Q3). |
| Q3: read-blocked cell is transparent | Two resolver rules, R1 and R2 (3.4). |
| Q4: bulk operations need readable and writable | Plan engine write rule (3.5). |
| Q6: adapt `presentationMode` / `allowThemeAutomation` | A small adapter; no data change, macro API untouched (3.3). |
| Q7: Apply pushes resolved values to controls | `applyResolved` primitive (3.4); no Matrix button yet. |
| Q8: Clear honors AllowWrite; structural ops do not | 3.5 and 3.6. |
| Q9: rename by role | 3.8. |
| Q10: undo is a primitive only | 3.5; no visible button. |
| Q11: both clones copy cell gates | 3.6. |
| Q12: `group` in the metadata | 3.2. |

## 2. What the code does today (verified), and why it shapes the plan

1. **The cascade returns whole blocks.**  [Song.getStoredDisplayOptionsInEffect](../../../../Song.js#L1572) returns the nearest block, as the live object.  A sparse block would resolve to only its own keys.
2. **The live block is mutated.**  [NoteTableController.js L1221-L1226](../../../../NoteTableController.js#L1221) does `Object.assign(relSectionOptions, replayOptions)` on that object, which leaks `tablename`, `sectionIndex`, `rootKey` and others into saved Songs.  A resolver that returns a fresh object fixes it.
3. **Two different "completion" sources exist.**  The replay path completes missing keys from `controlsToDisplayOptions()` (live); the prewarm path [`buildRenderOptionsForSection`](../../../../infinite-neck.js#L1348) completes from a startup snapshot ([`ensureDefaultDisplayOptionsForNavigation`](../../../../infinite-neck.js#L694)).
4. **Startup applies the controls to themselves.**  `appInit` runs `displayOptionsToControls(controlsToDisplayOptions())`, then captures a snapshot, and the palette `.then` captures it again.  The snapshot depends on `applyScalingPrefs()` (browser localStorage).
5. **`displayOptionsToControls` is not sparse-safe** ([L3260](../../../../infinite-neck.js#L3260)): the selects, `showAllNoteNames`, `cellIsFunction`, the hide-flag branch and `getSong().namedNoteOpacity = ...` all run unconditionally.  It1 finding 3.2 listed these; none has been fixed yet.
6. **Save writes sizes regardless of the gate** ([`controlsToDisplayOptions`](../../../../infinite-neck.js#L3399)); `sectionTheme` only when `allowThemeAutomation`.
7. **`controlsToDisplayOptions()` has other callers that must not change**: the Tool-table Freeze button ([L3566](../../../../infinite-neck.js#L3566)), the dirty baseline, the read-only spans.  It stays as "read the live controls".
8. **`Section.clone(false)` deletes `displayOptions`** ([Section.js L326](../../../../Section.js#L326)) and nothing else relevant.  Sections keep unknown fields on load (`Object.assign(this, ..., obj)`, [SectionPersistence.js L35](../../../../SectionPersistence.js#L35)), and the Song schema allows additional Section properties ([bin/song-file-schema.js L192](../../../../bin/song-file-schema.js#L192)), so a new Section field survives load, save, Graveyard and append with no extra code.  Song-level fields need the explicit normalization pattern from Iteration 3 ([SongPersistence.js L328](../../../../SongPersistence.js#L328)).
9. **There is no UI to set a gate in this Iteration**, other than the two existing checkboxes.  That matters for how the Hide-macro case is solved (Q1, Q8).
10. **Entry points for Save**: the View button, the Section drawer button, command-menu action `saveViewDisplayOptions` ([menu.js L1668](../../../../menu.js#L1668), [key-handlers.js L1372](../../../../key-handlers.js#L1372)), and mocks in [key-handlers.test.js](../../../../_tests/jest/key-handlers.test.js#L249).

## 3. Design

### 3.1 New modules (all pure; no `$`, no `document`)

Under `templates/display-options/`, in the style of `templates/function-symbols/functionSymbolSets.js`:

| File | Holds |
|---|---|
| `displayOptionsMeta.js` | `DISPLAY_OPTIONS_DEFAULTS`, `DISPLAY_OPTION_META`, key list and order, `normalizeValue`, `valuesEqual` |
| `displayOptionsGates.js` | gate normalization, `isReadBlocked`, `isWriteBlocked`, setters (return new objects), the Song adapter |
| `displayOptionsResolver.js` | `resolveDisplayOptions`, `getAutomatedKeys`, provenance |
| `displayOptionsPlan.js` | `planDisplayOptionsOps`, `applyPlan`, undo snapshot and restore, the "keys written" report |

### 3.2 Defaults and column metadata

`DISPLAY_OPTIONS_DEFAULTS` holds one value per key that has a true default: the 4 hide flags, `showAllNoteNames`, `showCellNotes`, `showSubscriptFunctions`, `cellIsFunction`, `showMidiNum`, `useCenterForRightFunction`, `naturalFretWidths`, the 3 opacities, `functionSymbols: 'function'`, `naturalFontScaling`, the 4 piano keys, `showLooperLightBeats`, the font and tiny-note selects, **`autoColor: true`, `autoColorHighlight: false`**.

It excludes the three keys that have no constant default: `NoteDisplaySizes` (browser scaling prefs feed it), `currentColorDict` (undefined until a dictionary is chosen) and `sectionTheme` (follows `song.theme`).

`DISPLAY_OPTION_META[key]` = `{ group, order, kind: 'flag'|'text'|'atomic', gate: null|'presentationMode'|'allowThemeAutomation', hasDefault }`.  Groups: Hiding, Opacity, Color, Labels, Fonts, Layout, Piano, TinyNotes, Automation (final list agreed in review; it only matters to the Matrix).  `NoteDisplaySizes` compares as `{width, height, NoteFontSize}` (the `caption` is derived), all scalars compare after `String()`, flags strictly.

Transcription safety: Phase 1 includes a throwaway `bin/print-control-defaults.js` that reads the selected option and `checked` state of each control from [index.html](../../../../index.html) and prints a draft of the defaults, so the table is generated, not typed.  A Jest test pins `DISPLAY_OPTION_META` keys to the keys `controlsToDisplayOptions()` assigns (read from the source text with `fs`, the same technique [display-options.test.js](../../../../_tests/jest/display-options.test.js) already uses for CSS).

### 3.3 Gates: storage, evaluation

**Storage** (deny-only lists; an empty list is not written):

```json
Song:    "displayOptionGates": { "readBlocked": ["hideNamedNotes"], "writeBlocked": ["hideNamedNotes", "noteFont"] }
Section: "displayOptionGates": { "readBlocked": ["*"], "writeBlocked": ["tinyNoteWidth"] }
```

- Song level: a list of keys (the column flags).  `"*"` is not allowed here.
- Section level: a list of keys (the cell flags) and optionally `"*"` (the whole row, for the Tutorial use-case).
- They live next to `section.displayOptions`, never inside it, so an empty diff, CLEAR and compaction cannot delete them (Round 1 C1).
- Normalization on load, like `normalizeUserSets`: keep only known keys from `DISPLAY_OPTION_META` (plus `"*"` on Sections), drop duplicates and non-strings, drop empty lists.  Unknown keys are dropped with a console warning.
- Why lists and not `{key: false}` maps: only `false` is meaningful under "deny wins", so a list is shorter and cannot hold a contradictory value.  The Matrix reads either form the same (Q3).

**Evaluation** for a Section `s` and key `K`:

```
columnBlocked(K, mode) = K in song.displayOptionGates[mode+'Blocked']
                      || (meta[K].gate === 'presentationMode'     && !song.presentationMode)
                      || (meta[K].gate === 'allowThemeAutomation' && !song.allowThemeAutomation)
rowBlocked(s, mode)    = '*' in s.displayOptionGates[mode+'Blocked']
cellBlocked(s, K, mode)= K in s.displayOptionGates[mode+'Blocked']

isReadBlocked(s,K)  = columnBlocked(K,'read')  || rowBlocked(s,'read')  || cellBlocked(s,K,'read')
isWriteBlocked(s,K) = columnBlocked(K,'write') || rowBlocked(s,'write') || cellBlocked(s,K,'write')
```

The adapter lines are Q6: `presentationMode` and `allowThemeAutomation` stay the stored fields; the two checkboxes keep working as today.  The provenance returned to callers says which level blocked, so the Matrix can draw its view layers.

### 3.4 Resolver

```
resolveDisplayOptions(song, sectionIndex, { purpose, live, policy })
  -> { values: {K: v}, entries: {K: { value, source, fromSection, blockedBy }} }
```

Always returns fresh, deep-copied objects.

**Cascade rules** (Q3, transparent read-blocked cell):

- **R1.** For Sections `0..k`, a stored cell contributes to key `K` only if it is not read-blocked at its own Section.  Later cells overwrite earlier ones (a key-wise merge).
- **R2.** At Section `k`, if `isReadBlocked(k, K)`, the key is not applied at all (neither its own nor an inherited value); the control is left alone.

`purpose`:

| purpose | Returns | Used by |
|---|---|---|
| `apply` | the keys to push into controls, per the absent-cell policy below | `displayOptionsToControls`, Song open, Matrix Apply |
| `render` | `apply` completed from `live` (the live controls) for every other key | `buildRenderOptionsForSection`, the replay path, prewarm |
| `baseline` | the cascade over Sections `0..k-1` only, plus the fallback chain in 3.5 | the plan engine |

This replaces the startup-snapshot completion (finding 3) and fixes the mutation (finding 2).

**Absent-cell policy** (what `apply` returns for a key with no stored cell in the cascade at Section `k`), the constant `ABSENT_CELL_POLICY`:

- `'leave'` (A): the key is not returned; the control stays as it is.  Simple, and gives the Hide-macro behavior with no gate UI.  Leak: Section 3 stores `noteFont`, loop wraps to Section 1, and `noteFont` stays at Section 3's value.
- `'default'` (B): the key is returned as its default unless read-blocked.  Fully deterministic, but the Hide-macro case then **requires** a read-block on the Hide columns, which has no UI in this Iteration.
- `'defaultIfAutomated'` (C, **recommended**): a key is *automated* if at least one Section stores a readable cell for it (`getAutomatedKeys`).  For an automated key with no cascade value at `k`, return the default; for a never-stored key, leave the control alone.  Hide macros work whenever no Section stores Hide keys (as in `All-Chords-w-Modes-Piano.json`), the wrap-around leak is gone, and "Clear column" in the future Matrix has exactly your intended meaning (graying out a DisplayOption so it is not automated).  It matches today's behavior for Sections with no block, which already apply defaults.
- Keys with no default (`NoteDisplaySizes`, `currentColorDict`, `sectionTheme`) are never defaulted under any policy; they are left alone when absent.

All three are implemented and tested; switching is one constant (Q1).

`getAutomatedKeys(song)` is O(sections x keys) and is cached on the Song until a plan or a gate change invalidates it (a field in the runtime-only list of the persistence replacer).

### 3.5 Plan engine: SaveDiff, SaveAll, Clear, undo

`planDisplayOptionsOps(song, request)` is pure and returns `{ ops: [{ sectionIndex, key, op: 'set'|'delete'|'keep', value?, reason }] }`.  `applyPlan(song, plan)` writes it and returns an undo snapshot.

**Baseline for SaveDiff at Section `k`, key `K`** (first that exists):

1. the `baseline` cascade value over Sections `< k`, readable cells only;
2. `DISPLAY_OPTIONS_DEFAULTS[K]`;
3. for the three keys without a default: the live value captured at the last Section sync (the existing `captureDisplayOptionsDirtyBaseline` snapshot).

Rule 3 is what stops a stale size from being written into a Section where the User changed only a Hide flag (Case 3), and it needs no new state.

**Per-key write rule** (bulk operations; Q4):

| verb | cell blocked (read or write, any level) | otherwise |
|---|---|---|
| SaveDiff | `keep` (reason `gated`) | `set` if `live != baseline`; `delete` if the cell exists and `live == baseline`; else nothing |
| SaveAll | `keep` | `set` live value for every key in the metadata |
| Clear | `keep` | `delete` if present |

- Keys outside `DISPLAY_OPTION_META` are never written.
- After the plan, an empty block is deleted (answer 4) and gates are never touched.
- `NoteDisplaySizes` is blocked when Presentation Mode is off and `sectionTheme` when Theme Automation is off, via the adapter.  So Save no longer writes unused sizes (finding 6), and a stored value behind a closed gate is preserved (it2 2.2(b)).
- A single-cell explicit "Store" or "Clear" (the Matrix tools) is a plan with `mode: 'explicit'`, which follows only write-blocked.  It is implemented and tested in Iteration 4, with no UI.

**Report.**  After SaveDiff, SaveAll or Clear, Messages shows "N written, M removed, K kept (reason)" with the key names, replacing the raw JSON dump now sent to `THEME_INFO`.

**Undo.**  `applyPlan` and every gate setter store one snapshot on a runtime-only Song field: the affected Sections' `displayOptions` and `displayOptionGates`, plus the Song's `displayOptionGates`.  `undoLastDisplayOptionsOp(song)` restores it.  One level, not persisted, no button (Q10).  It covers gate edits too (Q11 in section 8).

### 3.6 Structural operations

- **Deep clone**: already copies everything, including `displayOptions` and `displayOptionGates`.  No change.
- **Shallow clone**: still drops `displayOptions` and now explicitly keeps `displayOptionGates` (Round 1 Q11).  One line plus a test.
- **Move, delete, Graveyard bury and revive, append/import**: no code.  The gates travel as Section fields; Song column gates do not (they are not Section properties, per your answer).  Because blocks are sparse, a moved Section inherits from its new predecessors; this is accepted and documented in help.
- Under Q8, there is nothing to "report if a protected cell had to change", since these operations never rewrite.

### 3.7 Startup and Song open

- New `applyDisplayOptionDefaults()` (in [infinite-neck.js](../../../../infinite-neck.js)): `displayOptionsToControls` with `DISPLAY_OPTIONS_DEFAULTS`, skipping blocked keys, with one repaint.
- It replaces the circular startup call, the snapshot capture (`captureDisplayOptionsNavigationDefault` and `ensureDefaultDisplayOptionsForNavigation` are deleted), and `setAutomaticColorUi(true)` / `setAutomaticColorHighlightUi(false)` in the palette block.  The palette `.then` calls it for the Color keys once the palette exists, because the palette loads asynchronously.
- `updateAfterOpenSong` calls it after `FunctionSymbolsBuilder.onSongOpened()` (so the default id `function` exists) and before `sectionChanged()`.
- Browser scaling prefs still apply to the size controls at startup.  Sizes are not in the defaults, so they are not reset on Song open; they are applied only when Presentation Mode is on and a stored value exists (today's behavior).

### 3.8 UI, names, wiring (Round 1 Q9)

| Today | New |
|---|---|
| `btnControlsToDisplayOptions_View` (SAVE) | `btnSaveDiff_View`: the normal button, carries the dirty highlight |
| `btnControlsToDisplayOptions_Section` | `btnSaveDiff_Section`: same handler, drawer has no SaveAll |
| (none) | `btnSaveAll_View`: small secondary button on the View page, asks for confirmation (Q7) |
| `handleBtnControlsToDisplayOptions` | `handleBtnSaveDiff`; new `handleBtnSaveAll` |
| `handleBtnDeleteDisplayOptions` | name kept (it is the Clear verb); now follows the Clear rule |
| menu action `saveViewDisplayOptions` | stays, now SaveDiff; new `saveViewDisplayOptionsAll` |

The renames touch the provider lists ([infinite-neck.js L364](../../../../infinite-neck.js#L364), [key-handlers.js L173](../../../../key-handlers.js#L173)), the Section drawer builder, [index.html](../../../../index.html#L919), [section-drawer.html](../../../../templates/section-drawer.html#L80), the menu and the test mocks.  The "SAVE ... forward" hint text under the buttons is updated to say "only what differs".

### 3.9 `/vdd` (DisplayOptionsTable)

Small, so the data is inspectable before the Matrix exists: take the column list from `DISPLAY_OPTION_META` (so a stored `sectionTheme` is always visible), keep the "one row per stored block" layout, compare "green = changed" against the **resolved cascade** (not the previous block), and mark cells and rows that are read- or write-blocked with CSS classes (no hatching yet).  A caption line lists the Song column gates.  Captions and values are escaped.

### 3.10 Events and dirty state

- Add `EventBus` event `DisplayOptionsModel:changed`, triggered after a plan is applied, a gate changes, a Section changes and a Song opens.  `showHideDisplayOptionsPresent`, `ThemesBuilder.renderThemeMatrix`, `FunctionSymbolsBuilder.refresh` and the read-only spans listen, replacing the calls that `handleBtnControlsToDisplayOptions` makes by hand today.
- The dirty highlight keeps comparing the live controls with the Section-sync baseline.  Gate changes are not wired to it (your answer).  Toggling `cbPresentationMode` / `cbAllowThemeAutomation` stays excluded, as today.

### 3.11 Compaction tool (optional, last)

`bin/compact-display-options.js`, same options as the Iteration 3 migration (`--write`, `--check`, paths, skips `songs/_trash`, and also `songs/tests` unless named): prunes each non-first block against the cascade of prior blocks (using the shared resolver), strips keys outside the metadata (this removes the replay-option pollution in `guitar-basic-blues-fwd-back-observers.json`), deletes empty blocks, reports counts per file.  First blocks are never pruned against the defaults.  Dry run only in this Iteration unless you say otherwise (Q9).

## 4. Phases

Each phase ends with the full Jest run (`node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`).

| Phase | Work | Top-level files? |
|---|---|---|
| 1 | The four pure modules, `bin/print-control-defaults.js`, Jest for each | no |
| 2 | Persistence and model: `Song.displayOptionGates`, `Section.displayOptionGates`, normalization, replacer, schema; `Song.getDisplayOptionsInEffect` / `getStoredDisplayOptionsInEffect` become thin wrappers over the resolver; `Section.clone` keeps gates; update the contracts in [display-options.test.js](../../../../_tests/jest/display-options.test.js) | yes: Song.js, Section.js, SongPersistence.js, bin/song-file-schema.js |
| 3 | Sparse apply: guard every unconditional line in `displayOptionsToControls`; `applyDisplayOptionDefaults()`; startup and Song-open wiring; delete the snapshot code; `buildRenderOptionsForSection` and the replay path use `render`; fix the mutation | yes: infinite-neck.js, NoteTableController.js, templates/palette.html (only if the markup needs a matching default) |
| 4 | SaveDiff, SaveAll, Clear on the plan engine; renames; confirmation; report; undo primitive; `DisplayOptionsModel:changed`; update mocks and tests | yes: infinite-neck.js, index.html, templates/section-drawer.html, templates/section-drawer.builder.js, menu.js, key-handlers.js |
| 5 | `/vdd` with static columns and gate marks; (Q8) the dev command for setting gates | yes: display-options.js, command-line.js |
| 6 | `bin/compact-display-options.js` dry run; [help.html](../../../../help.html) text; this sprint's docs | no (help.html is documentation) |

Phase 3 needs Q1 answered; Phase 4 needs Q7; Phase 5 needs Q8.

## 5. Approvals requested

### 5.1 Behavior changes to existing Songs (no data migration)

1. Blocks are merged key-wise instead of "nearest whole block wins".  Full blocks resolve identically.
2. Blocks that lack a key now inherit it from an earlier block (previously a missing key was left alone or defaulted per control).  This affects `All-Chords-w-Modes-Piano.json` Section 1 only if an earlier Section stores the key, which it does not.
3. Song open resets controls to the Song defaults, so `c`, `y` and the Hide toggles no longer carry across Songs.
4. Save no longer writes sizes when Presentation Mode is off, or `sectionTheme` when Theme Automation is off.
5. Existing stored `autoColor`, `autoColorHighlight` and `currentColorDict` keep applying exactly as now.  There is no AutoColor migration.

### 5.2 Top-level files that will be edited

[infinite-neck.js](../../../../infinite-neck.js), [Song.js](../../../../Song.js), [Section.js](../../../../Section.js), [SongPersistence.js](../../../../SongPersistence.js), [NoteTableController.js](../../../../NoteTableController.js), [index.html](../../../../index.html), [display-options.js](../../../../display-options.js), [menu.js](../../../../menu.js), [key-handlers.js](../../../../key-handlers.js), [command-line.js](../../../../command-line.js) (only if Q8 is yes), [bin/song-file-schema.js](../../../../bin/song-file-schema.js), [templates/section-drawer.html](../../../../templates/section-drawer.html), [templates/section-drawer.builder.js](../../../../templates/section-drawer.builder.js), [templates/palette.html](../../../../templates/palette.html) (only if needed), [help.html](../../../../help.html).

## 6. Test plan

New Jest files in `_tests/jest/`, all non-browser:

- **meta**: the key set is pinned to `controlsToDisplayOptions()`; defaults and `valuesEqual` normalization (`"1"` vs `1`, `NoteDisplaySizes` caption ignored).
- **gates**: normalization drops unknown, duplicate and empty entries; the adapter closes `NoteDisplaySizes` / `sectionTheme` with the two Song flags; read and write evaluation across column, row and cell; Song column wins over everything.
- **resolver**: key-wise merge over a three-Section Song; R1 and R2; fresh objects (mutating the result does not touch the Song, regression for finding 2); the three absent-cell policies, including the wrap-around leak under `'leave'` and its absence under `'defaultIfAutomated'`; keys without defaults are never defaulted; provenance values.
- **plan**: SaveDiff idempotence; un-doing a change prunes the key; a gated cell survives SaveDiff, SaveAll and Clear; empty result deletes the block but keeps the gates; sizes untouched when Presentation Mode is off; the baseline fallback chain (cascade, default, sync snapshot); report text; undo round trip including gate edits.
- **persistence**: Song and Section gates round trip; invalid entries dropped; empty lists not written; the Section survives Graveyard bury and revive, deep clone and shallow clone with gates; append carries Section gates but not Song gates.
- **fixtures**: every song in `songs/` (excluding `_trash`) resolves for each Section to the same values under the new resolver as under the old nearest-block rule, for every key the old rule set (the compatibility proof for 5.1 item 1).
- Updated: the `getDisplayOptionsInEffect` and `getStoredDisplayOptionsInEffect` contracts in [display-options.test.js](../../../../_tests/jest/display-options.test.js), the mocks in [key-handlers.test.js](../../../../_tests/jest/key-handlers.test.js).

## 7. Browser acceptance checklist (for you; I cannot run the app)

1. Startup: no console errors; AutoColor on, palette manual colors hidden; the controls look as before.
2. Open a Song, press `c` and toggle a Hide box, open another Song: both controls are back at the defaults.
3. In a Song with no stored Hide keys, toggle Hide via the macro anchors and loop across Section boundaries: the toggle survives.
4. Change only a Hide flag in Section 3 and press SAVE: the block holds only that key; Messages lists it; `/vdd` shows one cell.  Press SAVE again: nothing changes.
5. Un-check the same box and SAVE: the key (and the block, if empty) disappears.
6. Presentation Mode off: SAVE writes no sizes; a stored size is preserved.  Turn it on again: it applies.
7. SaveAll asks for confirmation and stores the allowed keys.
8. CLEAR removes everything except blocked cells (use the dev command, Q8, to block one).
9. Shallow and deep clone, move, delete, Graveyard revive, append: stored values and Section gates travel; nothing is rewritten.
10. Loop wrap: Section 3 stores `noteFont`, wrap to Section 1 applies the default (policy C) or keeps Section 3's value (policy A), as decided in Q1.
11. Undo (console call): restores the last plan and last gate edit.
12. Tool-table Freeze/Unfreeze and the Function Symbols panel (Iteration 3) behave as before.

## 8. Questions (conflicts and ambiguities only)

**Q1. What does an absent, readable cell do at a Section boundary?**  Your answers say "no session-level DisplayOptions" and "Matrix primitives handle sparse apply", which can be read three ways (3.4): (A) leave the control alone, (B) always apply the default unless read-blocked, (C) apply the default only for keys that some Section stores, leave never-stored keys alone.  Recommendation: **C**.  A is simpler but leaks values backward across a loop wrap; B needs gate UI that does not exist yet.  This decides the Hide-macro behavior and the browser checks 3, 8 and 10.

**Q1b / Q2. Where does "block this whole Section" live?**  You were unsure (Song-level or Section-level), and the Iteration 2 Q10 answer calls the row action "Song-level".  Recommendation: Section-level, as the entry `"*"` in `section.displayOptionGates`, because it travels with the Section on move, clone, bury and append (which a Song-level list keyed by Section index would not), and it is a property of that musical position.  It is a Section property, so it is copied on clone, as Q11 says for cell gates.  Please confirm.

**Q3. Gate value format.**  Round 1 said gates are booleans so a later `true` override would need no format change; your Q2 answer says deny always wins, which makes a stored `true` meaningless.  Recommendation: deny-only lists (3.3).  If you want per-Section "open" overrides later, that is a new field, not a migration.

**Q4. Conflict: Round 1 Q5 versus Iteration 2 Q7.**  Q5 (accepted) kept the opt-in keys default-closed and opened the AutoColor column for existing Songs.  Iteration 2 Q7 says AutoColor is no longer a special gate.  This plan follows Iteration 2 Q7: the three Color keys are default-open ordinary columns, and nothing is migrated.  The cost, from my last message: after `c`, a SaveDiff of something else writes `autoColor: false` into the block (reported, undoable).  Please confirm.

**Q5. Keys without a default.**  `NoteDisplaySizes`, `currentColorDict` and `sectionTheme` are not in the defaults, and their SaveDiff baseline is the live value at the last Section sync (3.5).  With Presentation Mode off, "not set" then means the browser scaling prefs apply.  Is that what "otherwise they should not" meant?  The alternative is a Song-level default size, which adds a stored field.

**Q6. CLEAR and read-blocked cells.**  Round 1 Q4 says bulk Clear skips a cell unless it is both readable and writable; Q8 says Clear honors AllowWrite.  The plan applies Q4's stricter rule, so a read-blocked but writable cell survives CLEAR until the read block is lifted (the single-cell Matrix Clear overrides).  Is that the intent?

**Q7. Button labels and SaveAll placement.**  Iteration 2 answer 5 said to keep the label "SAVE" and call the new button "Save Diff"; now SaveDiff is the normal button.  Assumed: primary button caption "SAVE Diff" (same position and style as today's SAVE), SaveAll as a small "Save All..." button on the View page only with a confirmation, no SaveAll in the Section drawer.  Confirm or change.

**Q8. A way to set gates in this Iteration.**  There is no UI, so the Hide-column case, CLEAR protection and the Tutorial row case cannot be exercised in the browser.  Recommendation: a small command-line command (for example `/gate read|write on|off <key|*> [section|song]`) plus the same call exported for macros, marked "temporary until the Matrix".  Without it, acceptance testing of gates is Jest only.

**Q9. Compaction.**  Run `bin/compact-display-options.js --write` on `songs/` in this Iteration, or deliver the tool with a dry-run report and decide after browser acceptance?  Recommendation: dry run only.  Writing changes how a few Songs behave (see 5.1) and the old blocks are harmless.

**Q10. Apply after a gate change on the current Section.**  If the User lifts a read block while the current Section holds a stored value, should the controls update immediately, or at the next boundary (or by Apply)?  Recommendation: not immediately, so live edits are never lost without a dirty prompt; the `applyResolved` primitive covers an explicit Apply.

**Q11. Undo and gate edits.**  Should the one-level undo also cover gate edits (as planned), or only block writes?  Recommendation: both, since a column click in the Matrix can be as destructive as a Clear.

## 9. Not verified

- The browser behavior of everything above (section 7).
- Whether `NoteTableRenderCache` keys depend on the resolved options object.  Moving the prewarm path from the startup snapshot to the live controls could change cache hits; I did not read the key function.
- The initial state of the palette markup versus the defaults (`#manualColors`, `btnAutoColor` classes) when `autoColor` is true; Phase 3 reads [templates/palette.html](../../../../templates/palette.html) and [presentation.js L377](../../../../presentation.js#L377) before changing either.
- Which free trigger letters exist in the View submenu of [menu.js](../../../../menu.js#L1668) for `saveViewDisplayOptionsAll`.
- Whether the Section drawer builder has other references to the old button ids beyond [section-drawer.builder.js L96](../../../../templates/section-drawer.builder.js#L96).
- The final group list in the metadata (3.2).
