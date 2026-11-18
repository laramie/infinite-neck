# Sprint 156, Iteration 1, Round 1: Report

Design: [156-it1-design.md](156-it1-design.md) | Sprint: [sprint-156.md](sprint-156.md)

Scope of this round: findings only.  No code under `./` was changed.

## 1. Summary

- Every generated pick-list except the MIDI Paste map lists (sprint 151) is capped at 9 entries, each with its own copy of `slice(0, 9)` and its own `${index + 1}` trigger code.
- The candidate list in the design (`/fmen /fmdn /fmm /fmrn /fpaI /fpcI`) is a subset.  The same code also drives `/fpfI`, `/fpmI`, `/fpoaI`, six `/fp?gr` graveyard-raise lists, `/seiI`, `/tsl`, `/thl` and the Tonal suggestion lists.  See section 3.
- **`i` must stay reserved wherever a list has an in-list `i)d` entry.**  Songs in `songs/` already use `/fpaIi "..."` (25 lines), `/fpfgri` (48), `/fpfIi` (3).  If `i` became a letter pick, `findMenuItemByMacroPath` would match the first `i` child and those songs would break.
- **`x` must never be a pick key.**  [command-line.js](../../../../command-line.js#L227) swallows `x` as the automatic eXit key before it looks at any child trigger.  Sprint 151's `MAP_CHOICE_TRIGGERS` includes `x`, so the 32nd map is unreachable interactively.  (Latent bug; also the "35" in sprint 151 is really 34.)
- A latent bug sits under the 9 cap: the Instrument `i)d` entry looks the baseID up in the **capped** option list ([PluginManager.js](../../../../plugins/PluginManager.js#L766-L778)).  With more than 9 eligible Instruments, `/fpaIi "Foo_10"` throws "Instrument baseID not found".  Raising the pick-list cap alone does not fix it; the option set must be decoupled from the menu keys (R3).
- Recommended layout: CSS grid, column-major (`grid-auto-flow: column`, `grid-template-rows: repeat(var(--pick-lines), auto)`), items as `<div>`s inside the existing `<td>`.  `/vml` sets `--pick-lines`; `/vmc` turns it off.  Keys never depend on layout, so macros are unaffected.

## 2. Current state

### 2.1 Rendering and key handling

| Concern | Where | Behavior |
|---|---|---|
| Menu row | [index.html](../../../../index.html#L1404) `TR#CmdMenuResults` | Filled by `$("#CmdMenuResults").html(buildChildMenuCaptionsRow(...))`. |
| Layout choice | [menu.js](../../../../menu.js#L2583) `buildChildMenuCaptionsRow` | `vert` is true when total caption length is 70 or more and there are more than 4 children, but `gMenuFile.tall` overrides it.  `tall` defaults to `true`, so lists are one `<td>` of captions joined with `<br />`.  In `short` mode each child is its own `<td>` in one row (33 children would overflow sideways).  In `one-line` mode the options table is hidden entirely. |
| Exit item | same function | `e<b>x</b>it` appended after the list. |
| Trigger match | [command-line.js](../../../../command-line.js#L246-L252) | `child.trigger == e.key`, exact and case sensitive.  `x` and `/` are intercepted first. |
| Macro match | [MacroExecutor.js](../../../../MacroExecutor.js#L211-L226) `findMenuItemByMacroPath` | `candidate.trigger === trigger`, one character per level, after `refreshRuntimeChildren`.  No display state is involved, so any trigger character works in a macro. |
| Menu prefs | [key-handlers.js](../../../../key-handlers.js#L1343) `setMenuPrefs` | `/vms` `/vmo` `/vmt` set `gMenuFile.tall` and `gCmdLineMenuMode`.  Session-only (nothing writes them to `localStorage`).  `/vml` and `/vmc` are free; `/vmb` is taken. |
| Runtime children | `runtimeChildren` on a menu node, resolved by [key-handlers.js](../../../../key-handlers.js#L332-L357) | Fresh children are built every time the menu is shown or walked. |

### 2.2 Why 9

All the generated lists use the same shape: `.slice(0, 9).map((x, index) => ({ trigger: `${index + 1}`, caption: `${index + 1}) ...` }))`.  The cap is a copy-paste constant, not a design limit.

## 3. Inventory of generated pick-lists

"id" column: **in-list** means an `i)d` child is appended to the same child array as the picks, so `i` is already taken inside that menu.  **sibling** means `i)d` is a separate item one level up, so the pick menu itself holds only the numbered picks.

| # | Path | What it picks | Built in | Cap now | id | In design list |
|---|---|---|---|---|---|---|
| 1 | `/fmen` | macro to edit | [MacroMenu.js](../../../../MacroMenu.js#L9) `getMacroNumberOptions` | 9 | sibling `/fmei` | yes |
| 2 | `/fmrn` | macro to run | same function | 9 | sibling `/fmri` | yes |
| 3 | `/fmdn` | macro to delete (then nested `Y`/`n`) | [MacroMenu.js](../../../../MacroMenu.js#L21) | 9 | sibling `/fmdi` | yes |
| 4 | `/fmm` | macro to move (then input "destination number") | [MacroMenu.js](../../../../MacroMenu.js#L45) | 9 | **none** (no id route exists) | yes |
| 5 | `/fpaI` | Arpeggio target Instrument | [ArpeggioPlugin.js](../../../../plugins/arpeggio/ArpeggioPlugin.js#L1171) | 9 (own const) | **in-list** `i` | yes |
| 6 | `/fpcI` | Clip target Instrument | [ClipPlugin.js](../../../../plugins/clip/ClipPlugin.js#L218) | 9 (from move-helpers) | **in-list** `i` | yes |
| 7 | `/fpfI` | Fill target Instrument | [FillPlugin.js](../../../../plugins/fill/FillPlugin.js#L1598) | 9 (own const) | **in-list** `i` | no |
| 8 | `/fpmI` | Move target Instrument | [move-helpers.js](../../../../move-helpers.js#L67) `buildTargetTableOptions` | 9 | **in-list** `i` | no |
| 9 | `/fpoaI` | Tonal target Instrument | [TonalPlugin.js](../../../../plugins/tonal/TonalPlugin.js#L218) | 9 (own const) | **in-list** `i` | no |
| 10 | `/fpagr` (also `/fpcgr /fpfgr /fpmgr /fpogr /fptgr`) | graveyard snapshot to raise, newest first | [PluginManager.js](../../../../plugins/PluginManager.js#L600-L630) `buildManagedGraveyardRaiseNode` | 9 | **in-list** `i` | `/fpagr` named as an `id` example |
| 11 | `/fpcmm` | MIDI Paste map | [ClipPlugin.js](../../../../plugins/clip/ClipPlugin.js#L423) | 34 (1-9, a-z minus `n`) | in-list `n)one`; no id | no (already done in sprint 151) |
| 12 | `/fpcmd` | user MIDI Paste map to delete (then `Y`/`n`) | [ClipPlugin.js](../../../../plugins/clip/ClipPlugin.js#L455) | 34 | none | no (same) |
| 13 | `/fpoac`, `/fpoam` | Tonal chord / mode suggestion | [TonalPlugin.js](../../../../plugins/tonal/TonalPlugin.js#L362) | 9 (`TONAL_SUGGESTION_LIMIT`, [tonalPicker-functions.js](../../../../tonalPicker-functions.js#L15)) | none; but `a` is already used for "accept 1" | no |
| 14 | `/seiI` | Instrument for section edit | [key-handlers.js](../../../../key-handlers.js#L243) | 9 | none (no id route) | no |
| 15 | `/tsl`, `/thl` | tuning to show / hide | [key-handlers.js](../../../../key-handlers.js#L314) | 9 | sibling `/tsi`, `/thi` | no |
| 16 | `/fpcV`, `/fpcM` | clip number (typed input with a printed list) | [ClipPlugin.js](../../../../plugins/clip/ClipPlugin.js#L496) `buildChoicePreviewNodes` | uncapped, display-only (`trigger: ''`) | n/a | no |

Notes on the table:

- Rows 5-9: the Instrument list is built once per plugin and also becomes the plugin property's allowed values (`PluginProperty.setValue` rejects anything not in `options`; `selectByBaseID` searches `options`).  So today an Instrument beyond the 9th cannot be chosen by number, by `i)d`, or by loading persisted state.  `ensureTargetTableSelection` will silently reset such a value to the default.
- Row 10: the list is newest-first, so a new burial shifts every pick.  Keys here are positional and unstable; macros should use `/fpfgri "key"` (which they already do).
- Row 14: `getSectionEditInstrumentOptions` also feeds `isSectionEditInstrumentStillAvailable`, so a chosen Instrument beyond the 9th is reported as "no Instrument chosen".  There is no `i)d` fallback.
- Row 16: not a key pick-list.  The user types a number and presses ENTER, so the 9 cap does not apply.  It would benefit from the column layout (item 6) but not from new triggers.
- Out of scope (curated, hand-assigned triggers): `/fpfoc` and the rest of the Fill options tree, `/vmb` opacity levels, `/fpt` include toggles, Fill family/role menus.  They never go through a generator.

### 3.1 Which menus carry `id` as a special item

- **Sibling (list stays pure picks):** `/fmen`, `/fmrn`, `/fmdn`, `/tsl`, `/thl`.
- **In the list (needs `i` reserved and kept last):** rows 5-10 (all Instrument selects and all graveyard-raise lists).
- **No id route at all:** `/fmm`, `/seiI`, Tonal suggestions, MIDI Paste map select and delete.  These need either a decision to leave them capped at the key limit, or a new `i)d`.

## 4. Recommendations

### R1. One trigger allocator

Add one pure module (suggested `pick-triggers.js`, no DOM) with:

```js
// '1'-'9', then 'a'-'z'.  'x' is always excluded (global exit).  Callers add more.
export function getPickTriggers(count, { reserved = [] } = {}) { ... }
```

- Base sequence: `123456789abcdefghijklmnopqrstuvwyz` (34 keys: `x` removed from the 35 symbols the design counts as 9 + 26).
- `reserved` removes keys per menu: `['i']` when the list has an in-list `i)d`; `['n']` for MIDI Paste map select.
- Result: 33 picks when one letter is reserved (`i` for the Instrument and graveyard lists, `n` for the map select), 34 otherwise.
- Position `k` always gets the same key for a given reserved set.  Keys 1-9 never change, so no existing macro or habit is disturbed.
- Replaces: `slice(0, 9)` in [MacroMenu.js](../../../../MacroMenu.js) (3), [key-handlers.js](../../../../key-handlers.js) (2), the four per-plugin `TARGET_TABLE_OPTION_LIMIT` copies plus [move-helpers.js](../../../../move-helpers.js#L5), `TONAL_SUGGESTION_LIMIT`, `getPluginGraveyardRecords(..., 9)`, and `MAP_CHOICE_TRIGGERS`.
- Fixes sprint 151's `x` collision.  `clip-plugin-midi-paste-maps.test.js` and `midi-paste-maps.test.js` assert the exact length and membership of `MAP_CHOICE_TRIGGERS` and will need to follow.

### R2. Macro and song safety

- Keys are a function of position and reserved set only.  Layout prefs (`/vml`, `/vmc`) must never feed into triggers.
- `i` stays out of the pick keys whenever the list has `i)d`, so `/fpaIi`, `/fpfIi`, `/fpfgri` keep working.  Verified against `songs/`: no song uses numeric picks (`/fpaI1`), so there is nothing to migrate.
- Macro lines can use letter picks (`/fmrnb`) because `findMenuItemByMacroPath` is trigger-only.  Excluding `x` keeps a macro line and an interactive keystroke equivalent.
- Document in the macro help: picks are positional.  Use the id form (`/fmri`, `/fpaIi`, `/fpfgri`, `/tsi`) in saved macros.  Numeric and letter picks are for interactive use.
- Plugin captions are bolded by `buildCaption(caption, trigger)`, which bolds the first case-insensitive match of the trigger.  `a) foo` and `1) foo` are safe because the trigger leads the caption.  Keep that convention.
- For `/fpcmm`, `n` is kept out of the picks because `n)one` is a sibling in the same list; that rule is just `reserved: ['n']`.

### R3. Decouple the option set from the pick keys

- Instrument `options` (the data, used for validation and `i)d`) should contain **all** eligible Instruments.  Only the visible key children are capped at the allocator's limit.
- That fixes the "10th Instrument cannot be chosen by id" bug and the `ensureTargetTableSelection` reset.
- The four duplicate `buildTargetTableOptions` implementations (Arpeggio, Clip, Fill, Tonal) can collapse into [move-helpers.js](../../../../move-helpers.js#L67), which Move already uses.
- Natural home for the key assignment: the `org.dynamide.Select` branch of [PluginProperty.js](../../../../plugins/PluginProperty.js#L186-L196), applied to options that carry no explicit trigger.  Properties with curated options (algorithm, motion, Fill modes) keep their authored triggers.
- When the list is longer than the key limit, add a non-pickable last line such as `... 6 more (use i)d)`.  Where no `i)d` exists (rows 4, 11-14), say so rather than silently dropping.

### R4. Where `id` goes

Recommend: **last**, in a footer below the pick grid, with a blank line above it.

- A leading `id` would sit at row 1 of column 1 and push `1)` to row 2, which breaks "1..9 in column 1".
- Last keeps the existing muscle memory (`/fpaIi`, `/fpfgri`), and the grid length can vary freely above it.
- Mechanism: mark generated pick children with `pick: true`.  The renderer puts `pick` children in the grid and everything else (the `i)d`, the "more" note, `n)one`) in a footer in original order.  No change to the order of `children`, so `findMenuItemByMacroPath` and the validator behave exactly as now.
- Gotcha: [PluginManager.js](../../../../plugins/PluginManager.js#L133-L152) `reconcileMenuNode` copies a fixed list of fields from the freshly built node onto the existing node.  A new `pick` field must be added there and to [MenuItemProxy.js](../../../../plugins/MenuItemProxy.js), or it is lost on the first refresh.
- Sibling-id menus (rows 1-3, 15) have nothing to separate.

### R5. Menu pick-list column layout options

All options below keep items in column-major order (1..9 down column 1, then `a..` down column 2), which is what the design asks for.

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. CSS grid, column flow (recommended)** | `<div class="CmdPickGrid" style="--pick-lines:9">` of `<div class="CmdPickItem">`.  CSS: `display:grid; grid-auto-flow:column; grid-template-rows:repeat(var(--pick-lines), auto); grid-auto-columns:max-content; column-gap:1.5em`. | Exact row count from `/vml`.  Columns appear on demand and size to their own widest caption.  Works inside the existing `<td>` (grid intrinsic sizing is reliable inside auto-width table cells).  Pure CSS plus one custom property. | Needs items wrapped in elements (small change to `buildChildMenuCaptionsRow`). |
| B. Flex column-wrap | `display:flex; flex-flow:column wrap; max-height:calc(var(--pick-lines) * 1.5em)`. | Same visual result; closest to the "let flex fit" idea in the design. | Needs a fixed `max-height` tied to line height.  A column-wrap flex box inside a shrink-to-fit table cell often reports the width of one column, so the `td` clips or wraps the extra columns.  Fragile. |
| C. CSS multi-column | `column-width:12em; column-fill:auto; height:calc(lines * 1.5em)`. | No per-item wrapper needed (can keep `<br />`). | Same intrinsic-width problem in a table cell.  Item split across columns unless `break-inside:avoid`.  Hard to get an exact row count. |
| D. Whitespace padding in `<pre>` | Pad captions to fixed width. | Zero CSS. | Captions contain HTML (`<b>`), variable-width ids, and escaped characters.  The design says "not preferred"; agreed. |
| E. Nested `<table>` | Build rows server-side, transposed. | Familiar. | Needs JS to compute the transpose; mixes with the existing `<td>` per child; no benefit over A. |

Behavior notes for A:

- **`/vml` (lines)**: integer, default 9.  `0` means unlimited (one column).  Stored in `gMenuFile`-style session state next to `tall`, set by a new `setMenuLines` action with an `input` of `datatype: "int"`.  As the existing `/vm` prefs are session-only, the same applies here unless you want `localStorage` (open question 3).  Items 1-9 render identically to today whenever the list has 9 or fewer entries, so no existing short menu changes.
- **`/vmc` (columns)**: toggle, default on.  Off sets `--pick-lines` to a very large number (one column) and keeps the `/vml` value for when it is switched back on.
- Applies in `tall` and `short` modes.  In `short` mode today every child becomes a `<td>`; pick children should still go into the grid.  In `one-line` mode the options table is hidden, so the grid is hidden with it (unchanged).
- Mobile: add `@media (max-width: 640px) { .CmdPickGrid { grid-auto-flow: row; grid-template-rows: none; } }` to fall back to a single column.  The design accepts poor mobile behavior; this is the cheapest fallback.
- Add `max-width: 100%; overflow-x: auto` on the grid so 4+ long columns scroll instead of spilling off the 90%-wide panel.
- Exit item: keep it after the grid and footer, as now.
- Existing CSS under `.CmdMenuResultsClass td` (font size, bold color) applies unchanged because the grid lives inside that `td`.
- The `!&nbsp;` bang prefix and `expandCaption()` output are unchanged; they simply sit in each item `<div>`.

## 5. Suggested scope for Round 2

1. `pick-triggers.js` plus Jest tests (pure, no JSDOM): sequence, reserved sets, `x` never present, deterministic positions.
2. Wire rows 1-4, 14, 15 (`key-handlers.js`, `MacroMenu.js`) first.  They have no plugin machinery.
3. Instrument selects (rows 5-9) via `PluginProperty` and `move-helpers`, including R3.
4. Graveyard raise (row 10).
5. Grid renderer plus `/vml` and `/vmc`.
6. Tonal suggestions and MIDI Paste maps (rows 11-13) last, since they have the `a` and `n` conflicts.

Jest coverage in the existing non-browser style: `findMenuItemByMacroPath` resolving `/fmrnb` with 12 macros; `/fpaIi "Inst_10"` with 12 Instruments; every list's generated children have unique triggers and never include `x`, and never include `i` when `i)d` is present; `buildChildMenuCaptionsRow` output for a 12-item pick list (string assertions only).  `bin/validate-command-menu.js` already checks duplicate sibling triggers for static menus ([line 286](../../../../bin/validate-command-menu.js#L286)); it does not see runtime children, so the Jest test above is what guards the generated ones.

## 6. Open questions

1. Rows 7-9 (`/fpfI`, `/fpmI`, `/fpoaI`) and 14-15 (`/seiI`, `/tsl`, `/thl`) were not on the design's candidate list but share the same cap.  Include them?  (Recommended: yes for 7-9, 15; yes for 14.)
2. `/fmm` and `/seiI` have no `i)d` route.  Leave them capped at the key limit, or add `i)d`?  (Recommended: leave; a Song with more than 33 macros or unwired Instruments is far past practical.)
3. Should `/vml` and `/vmc` persist (`localStorage`, like scaling prefs) or stay session-only like `/vms /vmo /vmt`?
4. Default for `/vml`: 9 (recommended; matches the design's example and leaves current lists unchanged) or an auto value from viewport height?
5. Tonal suggestions (row 13) use `a` for "accept 1" in the same list as `1`.  Letter picks would collide.  Move "accept 1" out of the pick range, or leave that list at 9?
6. Sprint 151's `x` collision: fold the fix into this sprint via R1 (recommended), or fix separately?
