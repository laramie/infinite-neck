# Sprint 148 (displayOptions-diff), Iteration 3: Function Symbols panel, implementation plan

date: 20261016

Requested by [148-design.md](148-design.md), section "Iteration 3".  Layout and UX are defined in [148-it3-functions-panel.md](148-it3-functions-panel.md).  Builds on [148-it2-analysis.md](148-it2-analysis.md) (holes H1-H13).  Sprint overview: [sprint-148.md](sprint-148.md).

No code was changed.  Claims come from reading the code, or from scanning `songs/`.  SaveDiff is out of scope; where this plan touches DisplayOptions it does so only to keep Function Symbols working and to leave SaveDiff a clean, atomic key to diff.

## 0. Summary

1. The widget is straightforward to build from the template pattern used by [themes](../../../../templates/themes.html), [palette](../../../../templates/palette.html) and the others: `templates/function-symbols/` with `.html`, `.css`, `.builder.js`, plus a pure (DOM-free) module for names, ids, validation and the registry so Jest can cover the logic without JSDOM.
2. Four things in the code are not obvious from the panel design and shape the plan (section 2):
   - **Startup order.**  Templates load asynchronously, but `appInit` runs `displayOptionsToControls(controlsToDisplayOptions())` before any template exists, and today's apply code reads `$('#dropDownFunctionSymbols').val()`.  If the SELECT moves into a template, that line becomes `JSON.parse(undefined)` inside a `catch` and aborts startup.  The widget's model state must therefore live in JS, not in the SELECT.
   - **The SELECT's `value` is the JSON text, and stored Sections copy it.**  A real "ID" for a set (your `lblUserFunctionSymbolsID`) does not exist for the 11 built-ins.  The panel needs ids for built-ins, and the data model has to decide whether Sections store an id or keep copying text (Q1).
   - **User sets are not persisted anywhere today.**  `noteNamesFuncArr` is on the do-not-persist list.  The panel needs a new Song property, a schema entry and normalization.
   - **Everything inside `#divViewControls` feeds the View "Save" dirty highlight**, including `textarea` and every `input` ([infinite-neck.js L4476](../../../../infinite-neck.js#L4476)).  The CRUD inputs would light that button up.
3. The panel design has 12 gaps that need an answer before or during coding (section 4).  The three that matter most: what **Save** does for an existing User set (create-only, as written, leaves a used set uneditable), the **"U: " prefix nesting** (`U: U: Jazz`), and how the **ID** is derived (squeeze versus "prepend U- to the selected id").
4. Eight phases (section 6).  Phases 1-3 are new files plus pure Jest and touch no top-level file.  Phases 4-6 modify top-level files and need your explicit go-ahead (list in section 5.2).
5. 14 questions for the design team in section 8, each with a recommendation.  Defaults used in this plan are marked **(assumed)**.

## 1. What the design asks for (restated, with the Iteration 2 answers it implies)

`widgetFunctionSymbols` replaces the "Function Symbols" block of the View page ([index.html L446-L497](../../../../index.html#L446)): preview, SELECT, a "Customize" toggle, then a collapsible CRUD area.  Created from a `<template>` in `templates/function-symbols/`, one column, fits `.divViewCard`.

The panel design settles several Iteration 2 holes, which I treat as decided:

| Iteration 2 hole | Settled by the panel design |
|---|---|
| H1 (what the name box is) | `txtUserFunctionSymbolsCaption`, pre-filled with `U: <current caption>`; `lblUserFunctionSymbolsID` is a read-only derived label |
| H2 (Clear / deleting a referenced set) | Delete is disabled while the Song uses the set (`lblWarnUserFunctionSymbolsUsageCount`), so no orphaned Sections |
| H6 (textarea draft vs live) | The textarea is a draft; nothing is applied until Save |
| H7 (validation channel) | Inline warning labels, no `alert()` |
| H12 (Reset button) | Not in the panel, so `btnFunctionSymbolsReset` and `btnFunctionSymbolsChanged` go away |
| "Function (Default)" special case | Gone; `Function` is the first, selected-by-default option ([it3 panel, intro](148-it3-functions-panel.md)) |

Still open from Iteration 2 and needed here: H3 (id rules), H5 (how Sections refer to a set), H8 (HTML safety), H9 (Song open/append), H10 (dirty tracking), H11 (one resolver), H13 (missing id fallback).  They are folded into the plan below.

## 2. Findings from the code that shape the plan

### 2.1 Startup order (blocker if ignored)

- `appInit` ([infinite-neck.js L4700-L4870](../../../../infinite-neck.js#L4700)) runs synchronously: `controlsToDisplayOptions()` then `displayOptionsToControls()` (L4727), `sectionChanged()`, then fills the textarea (L4740).  Only afterwards does it call `loadTemplates(...)` for palette, themes, info, and so on.  Everything in the `promises` array resolves later; `loadSongFromUrlQueryParam()` runs in `Promise.all(...).then`.
- Today this is safe only because the SELECT is literal HTML in `index.html`.  Moving it into a template means in `displayOptionsToControls` the `try { JSON.parse(functionSymbolsValue ?? $('#dropDownFunctionSymbols').val()) }` throws on `undefined`, and its `catch` repeats the same `JSON.parse($('#dropDownFunctionSymbols').val())`, which throws again, uncaught ([L3336-L3343](../../../../infinite-neck.js#L3336)).
- The palette had the same shape and tolerates it because its keys are guarded by `'autoColor' in options`.  We should not rely on that kind of luck: **model state first, DOM second.**  `controlsToDisplayOptions()` and `displayOptionsToControls()` must read and write the current set through a module API (`FunctionSymbolsBuilder.getCurrentID()` / `applyFunctionSymbols(id)`) that works with no widget mounted, and the widget syncs from that state whenever it mounts or the Song changes.
- Alternative considered and rejected: block `appInit` until the template is fetched.  It makes the whole app's first paint wait on one fetch and diverges from every other template.

### 2.2 The SELECT's value is the data; Sections copy it

| Piece | Today |
|---|---|
| Option value | the JSON array text, with HTML such as `<small>` and entities such as `&tau;` ([index.html L458-L493](../../../../index.html#L458)) |
| Option text | an HTML caption (`Solf&#232;ge`) |
| Saved in a Section | `dropDownFunctionSymbols: { caption, value }` ([L3434](../../../../infinite-neck.js#L3434)) |
| Applied from a Section | `$('#dropDownFunctionSymbols').val(value)` (exact string match) |
| Prewarm | parses `options.dropDownFunctionSymbols.value` ([L1334](../../../../infinite-neck.js#L1334)) |
| Consumers of the runtime array | `song.noteNamesFuncArr` read by [NoteTableController.js L277](../../../../NoteTableController.js#L277), [SongWidgets.js L49](../../../../SongWidgets.js#L49), the render-cache key ([NoteTableRenderCache.js L124](../../../../NoteTableRenderCache.js#L124)) |

Scan: 46 JSON files in the repo contain `dropDownFunctionSymbols` (includes fixtures `songs/tests/display-options.json`, `songs/tests/Perfect4thsCalculatorTest.json`, `songs/tests/piano-listener-guitar-wite-out-fixture.json`, and possibly `_trash`); Iteration 2 measured 97 stored blocks in `songs/` excluding `_trash`, all matching a built-in value exactly, with stale captions (`Default` x88).  No Jest test references `dropDownFunctionSymbols` today.

### 2.3 Persistence and schema

- [SongPersistence.js](../../../../SongPersistence.js#L376) drops `noteNamesFuncArr` and `noteNamesFuncArrDEFAULT` when writing a Song.  User sets need their own persisted Song property.  Existing precedent for normalizing a new Song property: `normalizeMidiDevice`, `normalizeSongMacros` in the same file.
- [bin/song-file-schema.js](../../../../bin/song-file-schema.js#L450) enumerates the Song's top-level properties (`presentationMode`, `allowThemeAutomation`, ...), so a new Song property needs a schema entry.  `displayOptions` blocks are open objects, so a changed Section key does not need a schema change (to be confirmed when coding; the 146 plan hit a closed `sectionNotesSchema`, so check this one).

### 2.4 Dirty tracking catches the CRUD controls

[infinite-neck.js L4476](../../../../infinite-neck.js#L4476):

`bindDisplayOptionsDirtyEvent('change input', '#divViewControls input:not(#cbPresentationMode):not(#cbAllowThemeAutomation), #divViewControls select, #divViewControls textarea');`

Typing in `txtUserFunctionSymbolsCaption` or `textareaFunctionSymbols` would mark the View Save button "action required" although nothing saved to DisplayOptions changed.  Needed: exclude the widget's draft controls (for example via `:not(#widgetFunctionSymbols *)`), and keep only `dropDownFunctionSymbols` change as a legitimate dirty trigger.  Hotkeys are already safe in text inputs ([key-handlers.js L394, L464](../../../../key-handlers.js#L394)).

### 2.5 Preview colors can reuse existing lookup code

The preview wants "color for function k, respecting AutoColor and the current stylesheet".  `lookupClassForNote()` ([colorFunctions.js L845](../../../../colorFunctions.js#L845)) already maps note name plus root to `note1..note12` from `gUserColorDict.dict`.  Passing a lookup context with `rootID: 0` and `noteName: NOTE_NAMES_ARRAY[k]` (the array starts at A, index 0) gives function number k with no new color code.  [SongWidgets.js](../../../../SongWidgets.js#L26) `formatTransposedChordNotesFunctions` is the model: it builds a table the same way, always as though AutoColor were on.  The preview differs only in honoring the live AutoColor flag (`createLookupContext()` default reads `doingAutomaticColor()`), and falling back to `noteTransparent` over `noteWhiteKey` when it is off.

Preview refresh triggers: select change, AutoColor toggle, stylesheet/color dictionary change, Section change (AutoColor may be automated), Song open, theme change.  The existing choke point for these is `NoteTableController.fullRepaint()` ([L1668](../../../../NoteTableController.js#L1668)), which the palette handlers call; it returns early while `appInit_running()`, so the widget must also render once on mount.  Verify during coding that `chuseStylesheet()` ([colorFunctions.js L460](../../../../colorFunctions.js#L460)) reaches `fullRepaint()`; if it does not, add one event.

### 2.6 Other facts

- Template loading: `loadTemplates(url)` fetches the file and moves each `<template>` into `document.body`; the builder class clones it into a destination ([themes.builder.js L9](../../../../templates/themes.builder.js#L9) `addToDest`, singleton guard).  CSS is linked from `index.html` ([L28-L40](../../../../index.html#L28)).
- The collapsible-toggle precedent is [`ThemesBuilder.toggleThemeMatrix`](../../../../templates/themes.builder.js#L196) with `&#x25B6;` / `&#x25BC;` and a `display:none` wrapper.
- The move/remove buttons precedent is [infinite-neck.css L258-L285](../../../../infinite-neck.css#L258) (`btnMoveTuningUp/Down`, `btnRemoveTuning`) rendered by [TuningsLibrary.js L542](../../../../TuningsLibrary.js#L542).  The panel design says to copy these styles into the new stylesheet, not to reuse the global classes.
- `symbols` are rendered unescaped into table cells (built-ins use `<small>`, `<em>`, entities).  A User set typed in a textarea, or arriving in a Song file, is therefore HTML reaching the DOM (H8).  `sanitizeHtmlFragment()` in [html-sanitizer.js](../../../../html-sanitizer.js) returns its input unchanged when `document` is absent (Jest), so the validator must be a pure tokenizer.
- Tool tables ignore the Function Symbols key (sprint 141 intent, Iteration 2 section 1.1): nothing to do for frozen tables.
- The `WIDGET-EXAMPLE("TextAreaWButtonWidget", "FunctionSymbols")` markers in [index.html L447](../../../../index.html#L447) and `CODE-EXAMPLE` markers in [infinite-neck.js L4439](../../../../infinite-neck.js#L4439) are only comments; the BanjoNut example keeps the pattern documented.  Removing the FunctionSymbols pair is safe (no tool in the repo reads them).

## 3. Proposed model and architecture

### 3.1 Data model (assumed, see Q1)

- **Built-in sets**: a frozen constant in the new pure module: `[{ id, caption, symbols: [12 strings] }]`, in today's order.  Ids are authored, not computed: `function`, `extensions`, `extensions-only`, `jazz`, `jazz-extensions`, `function-numbers`, `function-offset`, `function-plus-offset`, `sounds-like`, `solfege`, `kanji-numerals`.  Captions are plain text (`Solfège`).  The SELECT is built from this data, so developers edit one place.
- **User sets**: new persisted Song property `functionSymbolSets: [{ id, caption, symbols }]`, array order is the SELECT order after the built-ins; zero entries is valid.  `symbols` is a real 12-element array (not JSON text inside JSON).
- **Option values are ids.**  The SELECT's `value` becomes the id; the JSON text lives only in the registry.
- **Sections store the id** (assumed, Q1): `displayOptions.functionSymbols: "jazz"` replaces `dropDownFunctionSymbols: { caption, value }`.  One atomic string, which is also what SaveDiff will want to compare.
- **Runtime**: `song.noteNamesFuncArr` stays the single runtime array the renderer reads.  It is assigned in one place only, `applyFunctionSymbols(id)`.  The current id is module state of the builder (not in the DOM, not persisted).

### 3.2 Id and caption rules (resolves panel gaps G2 and G3, Q4-Q6)

Proposed, so the panel text can be implemented unambiguously:

- Caption: trimmed, internal whitespace collapsed, 1-40 characters, none of `<` `>` `&` `"` `'` (they would be written into option text and report HTML).  Case-insensitive uniqueness against **all** captions (built-in and user).
- Id from caption: NFKD-normalize and strip combining marks, lowercase, each run of characters outside `a-z0-9` becomes one `-`, trim `-`.  `U: Jazz` gives `u-jazz`, which is the "U- prepended to the selected id" the panel describes, and it needs no special case.  If the result is empty (for example an all-Kanji caption), the caption warning says "needs at least one letter or digit".
- Id uniqueness: case-insensitive against built-in ids and user ids.  A collision shows `lblWarnUserFunctionSymbolsCaption` with the clashing caption; the User edits until it clears (as the panel specifies).  No silent `-2` suffix.
- Initial caption proposal: `U: ` + the selected set's caption, **after stripping one leading `U: `** so cloning a user set proposes `U: Jazz`, not `U: U: Jazz` (G2).  If that exists, nothing is auto-incremented; the warning shows.
- ID label shows the computed id on caption `blur`, as specified, and also when the proposal is set.

### 3.3 Module and file layout

New files (no top-level file touched):

| File | Purpose |
|---|---|
| `templates/function-symbols/function-symbols.html` | `<template id="function-symbols-template">` holding `#widgetFunctionSymbols` |
| `templates/function-symbols/function-symbols.css` | layout, 70% yellow warning labels, move/delete button styles copied from the tuning buttons, preview table, `.divViewCard` fit, phone widths |
| `templates/function-symbols/function-symbols.builder.js` | `FunctionSymbolsBuilder`: `addToDest`, `bindEvents`, `refreshPreview`, `rebuildSelect`, `applyFunctionSymbols`, `getCurrentID`, state/enable logic, `toggleCustomize` |
| `templates/function-symbols/functionSymbolSets.js` | pure module (like [midiColorMaps.js](../../../../templates/midi/midiColorMaps.js)): built-in constant, `proposeCaption`, `squeezeId`, `validateCaption`, `validateSymbols`, `resolveSet`, `findUsage`, `moveUserSet`, `buildPreviewGrid` |
| `_tests/jest/function-symbol-sets.test.js` | Jest for the pure module (no JSDOM/jQuery) |
| `bin/migrate-function-symbols.js` | one-time converter of stored `dropDownFunctionSymbols` to `functionSymbols` (Node tool in `bin/`) |

Pure-module surface (all take plain data, no `document`, no `getSong()`):

- `BUILTIN_SETS`, `getAllSets(userSets)`, `resolveSet(id, userSets)` (returns the set or `null`; the caller falls back to `function`).
- `proposeCaption(selectedCaption, allSets)`, `squeezeId(caption)`, `validateCaption(caption, allSets, { exceptId })`.
- `validateSymbols(text)` returns `{ ok, symbols, message }`: valid JSON, array of exactly 12 strings, each non-empty after trim, at most 40 characters, only whitelisted tags without attributes (`small em sub sup b i s span`, matching ALLOWED_TAGS in [html-sanitizer.js](../../../../html-sanitizer.js#L7)) and well-formed entities (`&name;` or `&#nnn;` / `&#xhh;`).  Messages name the problem ("11 entries, need 12", "entry 5 is empty", "entry 3: tag <script> not allowed").
- `findUsage(song-like { sections }, id)` returns the 1-based Section numbers whose stored block has `functionSymbols === id`.
- `buildPreviewGrid(symbols)` returns 3 rows by 5 columns, bottom row `1..5`, middle `6..10`, top `11, 12`, remaining cells `null`; the builder maps it to HTML (and the colors).
- `moveUserSet(userSets, id, delta)` returns a new array, never crossing the built-in boundary.

### 3.4 Data flow

```
select change / Section sync / Song open
        -> FunctionSymbolsBuilder.applyFunctionSymbols(id, { skipRepaint })
              resolveSet(id)  (fallback 'function' + warn)   [pure]
              song.noteNamesFuncArr = [...symbols]            [single writer]
              if widget mounted: select.val(id), textarea, From:, caption proposal, id label,
                                 warnings, button states, preview
              if !skipRepaint: fullRepaint()

controlsToDisplayOptions()  -> options.functionSymbols = FunctionSymbolsBuilder.getCurrentID()   [no DOM]
displayOptionsToControls()  -> if (options.functionSymbols != null) applyFunctionSymbols(options.functionSymbols, { skipRepaint: true })
```

The widget mounts via `addToDest('#divFunctionSymbols')` in the `promises` array and immediately calls `rebuildSelect()` and `applyFunctionSymbols(getCurrentID(), { skipRepaint: true })`, so it picks up whatever the model already holds.

## 4. Gaps and decisions in the panel design

| # | Gap | Recommendation |
|---|---|---|
| G1 | **What does Save do for an existing User set?**  As written, Save always creates a new set (it needs a unique caption), and Delete is blocked while a set is used.  A typo in a User set that is already used by a Section cannot be corrected: you cannot save over it, and you cannot delete it. | When a User set is selected and the caption box still holds that set's own caption, Save **updates** it (own caption/id are excluded from the uniqueness check; the id never changes).  If the caption differs from the set's own caption and is unique, Save creates a copy.  Built-in sets can only ever be cloned.  See Q2 for the alternative (create-only, literally as written). |
| G2 | `U: ` prefix nests when cloning a user set (`U: U: Jazz`). | Strip one leading `U: ` before prefixing (section 3.2).  Q3. |
| G3 | The id is described two ways: "calculated/squeezed from the Caption" and "`U-` prepended to the id of the option selected".  Built-ins have no ids. | Authored built-in ids plus the squeeze rule; both descriptions agree for `U: Jazz` -> `u-jazz`.  Q4. |
| G4 | **Validate is redundant if validation is automatic**, and unclear when it is not.  If the User must click Validate and then edits again, is the earlier validation stale? | Validate on every `input` (debounced about 250 ms) and keep the button as an explicit re-run and focus aid.  Any edit marks the draft "unvalidated" and Save stays disabled until it passes.  Q5. |
| G5 | **Preview of a draft** is not specified; the design says the preview shows selected built-ins and accepted User values. | Preview follows the SELECT only (as specified).  A draft never touches the Model or preview until Save.  |
| G6 | **Textarea editing for built-ins** is implied (you clone by editing) but nothing says it is editable. | Editable for all sets.  Save is what protects built-ins (it can only create). |
| G7 | **Usage count semantics** with the cascade: a Section with no block inherits the set from an earlier Section but stores nothing. | Count only stored references (`functionSymbols === id` in a Section's own block).  Message lists Section numbers.  The live selection is not "use".  Documented in the label's title.  Q7. |
| G8 | **Delete of the currently selected set** and Delete's recovery. | After Delete, select `function`, apply it, rebuild.  No Graveyard entry (Q8) since an unused set is cheap to recreate; confirm dialog not needed because Delete is only enabled when unused (matches your design). |
| G9 | **Move Up/Down and Section references**: order is cosmetic, ids are stable, so no impact on Sections.  The buttons need state after every select/move: disabled for built-ins, at the top/bottom of the user list. | As specified; enable logic lives in one `updateButtonStates()`. |
| G10 | **Limits**: maximum number of User sets and symbol length are unspecified. | 20 sets per Song, 40 characters per symbol and per caption (Q6). |
| G11 | **Missing/foreign id** in a Section (hand edit, partial import) must not blank the notes (H13). | `resolveSet` returns `null`; `applyFunctionSymbols` falls back to `function`, and the widget shows a one-line yellow note "Section refers to missing set 'u-foo'; showing Function". |
| G12 | **Append/import** of Sections from another Song (H9c): referenced User sets would be missing. | Copy referenced sets with id remap on collision, as a follow-on phase (7) or in a later sprint; until then the G11 fallback is safe.  Q9. |

## 5. Impact

### 5.1 New files

See section 3.3.

### 5.2 Existing files that will change (need your explicit go-ahead; all are in `./`)

| File | Change |
|---|---|
| [index.html](../../../../index.html) | add `<link ... function-symbols.css>`; replace the block L446-L497 with `<div id="divFunctionSymbols"></div>` inside the existing `.divViewCard`; remove the `WIDGET-EXAMPLE("FunctionSymbols")` comment pair |
| [infinite-neck.js](../../../../infinite-neck.js) | import the builder; add `loadTemplates('templates/function-symbols/function-symbols.html')` to the `promises` array; replace the `parseNoteNamesFuncArrForOptions`, `controlsToDisplayOptions`, `displayOptionsToControls` pieces (sections 2.2, 3.4); delete the three handlers L4416-L4463 and `bindDisplayOptionsDirtyEvent('click', '#btnFunctionSymbolsReset')`; narrow the dirty selector (2.4); delete the startup textarea fill L4740; call `rebuildSelect`/`applyFunctionSymbols` from `updateAfterOpenSong`; remove the `CODE-EXAMPLE("FunctionSymbols")` comment pair |
| [SongPersistence.js](../../../../SongPersistence.js) | default `functionSymbolSets: []`, `normalizeFunctionSymbolSets()` (drop invalid entries, cap at 20, dedupe ids, validate symbols with the pure validator) |
| [bin/song-file-schema.js](../../../../bin/song-file-schema.js) | add `functionSymbolSets` |
| [NoteTableController.js](../../../../NoteTableController.js) | optional: one call in `fullRepaint()` to `refreshPreview` through an EventBus event, so the preview follows AutoColor/stylesheet/theme changes (2.5) |
| [help.html](../../../../help.html#L1380) | rewrite "Function Symbols" section for the panel and the User sets |
| `songs/` and `songs/tests/` fixtures | run the migration (Q10) |

Not touched: `Song.js`, `Section.js`, `display-options.js` (the `/vdd` report prints stored keys generically; Section 7.4 checks that it displays the new `functionSymbols` string sensibly), `key-handlers.js`.

### 5.3 Behavior changes visible to Users

- Textarea edits no longer apply live; they apply on Save.  (Already true in effect today for saving; now consistent.)
- The ✓ and ↺ buttons disappear; Validate/Save replace them.
- User sets persist in the Song file and survive Section changes.
- `/vdd` shows set ids/captions from the registry rather than stale stored captions.

## 6. Implementation phases

Each phase ends with the Jest command from the repo instructions (`node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`, `INFINITE_NECK_VERBOSE=-1`) green.

### Phase 1: pure module and Jest (no top-level files)

- Create `functionSymbolSets.js` with the surface in 3.3.
- Port the 11 built-in arrays verbatim from [index.html L458-L493](../../../../index.html#L458) (decode captions to plain text).  A Jest test must assert the built-in order, ids, that every set has 12 non-empty strings, and that each passes `validateSymbols` (so built-ins and user validation share one rule).
- Jest: `squeezeId` (diacritics, `U: Jazz`, empty result, repeated separators), `proposeCaption` (strip one `U: `, existing collisions), `validateCaption` (empty, length, forbidden characters, case-insensitive duplicate, `exceptId`), `validateSymbols` (not JSON, not array, 11/13 entries, non-string, empty entry, too long, `<script>`, attributes, unclosed tag, bad entity, allowed `<small>`/`&flat;`), `resolveSet` (built-in, user, missing), `findUsage`, `moveUserSet` (top/bottom/boundary), `buildPreviewGrid` ordering.

### Phase 2: template files (no top-level files)

- `function-symbols.html`: `<template id="function-symbols-template">` with the control tree from the panel design.  Add `type="button"` on every button; give each id exactly as named in the design.  One element is added beyond the design: `lblNoteFunctionSymbolsMissing`, for the G11 "missing set" note (same small warning style).
- `function-symbols.css`: one column; `textarea` width 100% with `box-sizing: border-box`; warning labels `font-size: 70%; color: yellow` (on the `#f4f4f4` card yellow is low-contrast, see Q11); preview `table` fixed 5 columns with equal widths and `table-layout: fixed`, symbol overflow `overflow:hidden; text-overflow: clip`; move/delete row styles copied from `.btnMoveTuningUp/Down` and `.btnRemoveTuning`; phone rule so the card fills the width.
- Preview cell classes: color class from the lookup (2.5), `noteTransparent` plus a local `.fsPreviewWhiteKey` background (white) when AutoColor is off, because `td.note.noteWhiteKey` in [infinite-neck.css L1700](../../../../infinite-neck.css#L1700) styles a note cell with theme border images and should not be reused for a plain preview cell.

### Phase 3: builder skeleton (still no top-level edits beyond the import in phase 4)

- `FunctionSymbolsBuilder.addToDest`, singleton guard, `bindEvents()` (namespaced like [PaletteBuilder](../../../../templates/palette.builder.js#L12)).
- `rebuildSelect(song)`: built-ins then user sets; option `.text()` for captions (never `.html()`), `value` = id.
- `applyFunctionSymbols`, `getCurrentID`, `refreshPreview`, `updateButtonStates`, `toggleCustomize` (right/down triangles as in `toggleThemeMatrix`).
- Handlers: select change; textarea `input` (debounced validate); caption `input` (live uniqueness warning) and `blur` (update ID label); Validate; Save (create or update per G1); Delete; Move Up/Down; Customize.
- All state derived in one function `computeState(draft, selection, song)` returning `{ symbolsValid, symbolsMessage, captionMessage, canSave, usageCount, usageSections, canDelete, canMoveUp, canMoveDown }`, so the logic is testable as a pure function (add to the pure module) and the builder only paints it.

### Phase 4: wire into the app (top-level files)

1. `index.html`: link CSS; swap the block for `<div id="divFunctionSymbols"></div>`.
2. `infinite-neck.js`: import; add the template to `promises` (`FunctionSymbolsBuilder.addToDest('#divFunctionSymbols')` then sync from the model); remove the old handlers and startup fill; narrow the dirty selector.
3. Replace the DisplayOptions touch points (2.2) with the id-based API; delete the dead `noteNamesFuncArrDEFAULT` branches in the removed handlers.
4. `SongPersistence.js` and the schema.
5. `updateAfterOpenSong`: `FunctionSymbolsBuilder.rebuildSelect(song)` and `applyFunctionSymbols('function', { skipRepaint: true })` **before** `sectionChanged()`, which then re-applies the Section's id if one is stored.
6. Optional: `fullRepaint()` hook for the preview.

### Phase 5: migration of stored data

- `bin/migrate-function-symbols.js`: for each Song JSON, replace each Section's `displayOptions.dropDownFunctionSymbols` by `functionSymbols: <built-in id>` by matching `value` to the built-in symbol arrays (exact JSON equality after parse; the scan found 0 unmatched in `songs/`).  Report any unmatched value and leave it for a manual decision.  Idempotent; supports a `--check` mode for CI-style use and a dry-run default.
- Run on `songs/` and the three `songs/tests` fixtures (Q10), commit separately from code.  No runtime fallback to the old key (no-legacy policy).

### Phase 6: removal and cleanup

- Remove `btnFunctionSymbolsChanged`, `btnFunctionSymbolsReset`, `textareaFunctionSymbols`'s old handlers, `noteNamesFuncArrDEFAULT` references that were only used there (the entry in [bin/song-file-schema.js L455](../../../../bin/song-file-schema.js#L455) and the persistence replacer line, if nothing else uses them: verify with `knip` and grep before deleting).
- Remove the `FunctionSymbols` `WIDGET-EXAMPLE` / `CODE-EXAMPLE` comments.
- Update [help.html](../../../../help.html#L1380) text and screenshots note (images are not regenerated by this sprint; flag them stale in the report).

### Phase 7 (optional, can move to a later sprint): append/import and robustness

- On `openSong(..., append=true)` with Sections ([infinite-neck.js L2024](../../../../infinite-neck.js#L2024)): copy referenced user sets and remap id collisions, as `colorDicts` are copied for stylesheets (Q9).
- `/vdd` display of the set caption from the registry (Iteration 2 H11).

### Phase 8: acceptance (browser; Jest does not cover this per repo practice)

See section 7.2.

## 7. Verification

### 7.1 Jest (pure, no JSDOM/jQuery)

- Phase 1 list above.
- `SongPersistence` round trip: Song with 2 user sets saves and reloads with ids/captions/symbols/order intact; invalid entries (11 symbols, `<script>`, duplicate ids) are dropped on load; built-in ids are rejected as user ids; no more than 20 sets.
- Persist test: `noteNamesFuncArr` still not written; `functionSymbolSets` written only when non-empty.
- `computeState` truth table (built-in selected, user set clean/dirty, invalid draft, duplicate caption, used set, first/last user set).
- Migration script: fixture with each of the 11 values maps to the right id; unmatched value is reported and untouched; second run is a no-op.
- Existing tests that import `infinite-neck.js` helpers: run the full suite; none reference `dropDownFunctionSymbols`.

### 7.2 UI acceptance checklist (browser)

1. Fresh load: preview shows 1-12 in 3 rows (bottom row 1-5), Function selected, CRUD hidden; no console errors (this exercises 2.1).
2. Toggle Customize: triangle flips; fields show `From: Function`, textarea = JSON, caption `U: Function`, ID `u-function`.
3. Pick each built-in: preview, notes on every Instrument and the Chart/SongWidgets chord captions update.
4. AutoColor off (`c`): preview becomes transparent over white; on: colors; change stylesheet (Palette): preview follows.
5. Edit textarea to 11 entries: warning shows, Save disabled; fix: Save enabled; HTML in a symbol (`<script>`) is rejected.
6. Caption `Jazz` (duplicate): warning; `U: Jazz`: clears, Save enabled; Save: SELECT shows the new set at the end, parked on it, preview shows it, `From:` updated.
7. Select the new set, edit one symbol, Save with the caption unchanged: updates (G1), preview updates, id unchanged.
8. Save the View DisplayOptions in Section 2, move to Section 1 and back: set restored by id.  Usage label shows "Section 2"; Delete disabled.  Clear the Section's DisplayOptions and Save again: label disappears, Delete works, the SELECT falls back to Function.
9. Move Up/Down: disabled on built-ins and at list ends; order survives Save/Open of the Song.
10. Save Song, reopen it, open an older Song: select rebuilt per Song; a Section referring to a missing id falls back to Function with the note.
11. Typing in the caption box or textarea does **not** turn the View Save button "action required"; changing the SELECT does.
12. Phone-width layout: card fills width, textarea and preview do not overflow; keyboard shortcuts are not triggered while typing in the inputs.

### 7.3 Risks

| Risk | Mitigation |
|---|---|
| Startup ordering (2.1) | model API first, widget mounts later and syncs; acceptance step 1 |
| Missed consumer of the old JSON-valued SELECT | grep list in 2.2 is complete for `js/html/css`; Phase 6 re-greps `dropDownFunctionSymbols` and `textareaFunctionSymbols`; Jest + acceptance steps 3 and 8 |
| Stored Sections in songs not migrated | migration tool with `--check`; unknown/old key is ignored and the Section shows `Function` (safe) |
| HTML injection via a Song file | validate on Save and on Song load; captions only via `.text()` |
| Preview cost on every repaint | 12 cells; render only if the widget is mounted and visible |
| Duplicate ids when two Songs are merged | Phase 7 remap; until then lookups are per Song |

### 7.4 Not verified

- Whether `chuseStylesheet()` and theme changes reach `fullRepaint()` (affects the preview refresh hook).
- `/vdd` (`display-options.js`) prints the new `functionSymbols` string acceptably; it currently shows `option.caption` when present, otherwise the raw value.
- Whether the Song root schema or `sectionSchema` rejects unknown keys in `displayOptions`; to confirm with `bin/` schema validation when coding.
- jQuery option handling with ids containing `-`/digits (expected fine; selectors will use `.val()`, never attribute selectors built from ids).
- Fonts rendering in `option` text for non-Latin captions (Kanji Numerals) in the phone browser.

## 8. Questions for the design team

1. **Section reference shape (H5).**  Store `functionSymbols: "<id>"` and migrate the stored blocks (recommended, **assumed**), or keep `dropDownFunctionSymbols: { caption, value }` with the JSON text copied into the Section?  Keeping the shape needs no migration but leaves stale captions, makes the usage count compare long strings (two sets with identical text are indistinguishable), and makes Save-update (Q2) not reach Sections.
2. **Save semantics (G1).**  Update an existing User set in place when the caption box equals the set's own caption (recommended, **assumed**), or create-only as literally written (then a used set can never be fixed)?
3. **Prefix nesting (G2).**  Strip one leading `U: ` when proposing a caption (recommended, **assumed**)?
4. **Id rule (G3).**  Authored kebab-case ids for built-ins and the lowercase squeeze for user ids, so `U: Jazz` gives `u-jazz` (recommended, **assumed**).  Or keep the case (`U-Jazz`)?
5. **Validate (G4).**  Auto-validate on input with the button as a manual re-run (recommended, **assumed**), or validate only when the button is clicked?
6. **Limits.**  Up to 20 User sets per Song, 40 characters per caption and per symbol, allowed tags `small em sub sup b i s span` with no attributes (**assumed**).  Acceptable?  Should `strong`, `br`, or other tags be allowed?
7. **Usage count (G7).**  Count only Sections that store the id in their own block (**assumed**), or also Sections that inherit it by cascade?
8. **Delete.**  Immediate (since Delete is disabled while used) with no Graveyard entry (**assumed**), or bury the set in the Graveyard for recovery?
9. **Append/import (G12).**  Defer Phase 7 and rely on the fallback to `Function` (**assumed**), or include the remap-and-copy in this iteration?
10. **Fixtures.**  Migrate the three `songs/tests` fixtures too (recommended, so Jest and the app agree), or keep them in the old shape as "old format" samples (they would then fall back to `Function`)?
11. **Warning color.**  The design says `color: yellow`, but the card background is `#f4f4f4` and the tables use `lightyellow`; yellow text on those is nearly invisible.  Keep literal yellow (a dark label background?), or use a dark amber such as `#b36b00` (recommended)?
12. **Preview details.**  Should an empty cell in the top row (positions 13-15) be drawn as blank (no border), and should the preview show the root/function number captions or only the symbol (the design shows only symbols; **assumed**)?
13. **Where the widget sits.**  Replace the whole "Function Symbols" grey block inside the second View card, keeping the card's Show Right/Left Subscript controls above it (**assumed**), or give it its own `.divViewCard`?
14. **Top-level file scope.**  Please confirm go-ahead for the `./` files in 5.2, in particular [NoteTableController.js](../../../../NoteTableController.js) (optional repaint hook) and [SongPersistence.js](../../../../SongPersistence.js).

## 9. Hand-off to the SaveDiff iteration

- `DISPLAY_OPTIONS_DEFAULTS` gets `functionSymbols: "function"`, a plain string compare (Iteration 2 answer 1).
- `controlsToDisplayOptions()` and `displayOptionsToControls()` already go through `getCurrentID()` / `applyFunctionSymbols()`, so SaveDiff needs no DOM access for this key, and the sparse-apply rule (Iteration 2 correction (a)) is one `if (options.functionSymbols != null)`.
- `findUsage()` already scans stored blocks, so Section move/delete/compaction work in the next iterations can reuse it for the Delete guard.
