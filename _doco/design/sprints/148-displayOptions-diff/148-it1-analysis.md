# Sprint 148 (displayOptions-diff), Iteration 1: feasibility and impact analysis

date: 20261014

Requested by [148-design.md](148-design.md), section "Iteration 1".  Sprint overview: [sprint-148.md](sprint-148.md).

No code under `./` was changed for this analysis.  Every claim below was read from the code or measured from `songs/` (excluding `songs/_trash/`).

## 1. Verdict

Feasible, and smaller than it looks, because the model already has most of the vocabulary:

- A missing key in `section.displayOptions` already means "not automated" for `autoColor`, `autoColorHighlight`, `currentColorDict` and `sectionTheme` (see section 3.4).  The problem is only the *writer*: `controlsToDisplayOptions()` emits every key every time.
- Existing songs keep working unchanged if the cascade changes from "nearest whole block wins" to "key-wise merge of all blocks up to this Section", because a full block overrides every key.
- Existing songs are very redundant: 3,423 saved keys shrink to 1,430 (-58%) and 50 of the 57 non-first blocks become empty if pruned against the cascade (section 5).

Three things are NOT as the design doc assumes and drive the design:

1. The cascade is not a merge today (3.1).  Without changing it, a diff block would silently lose every other setting.
2. `displayOptionsToControls()` is not safe for partial options (3.2).  The "delete a property and it just grays out" test only proves the checkbox half of the story.
3. "Default DisplayOptions" are a session-derived snapshot, not a constant (3.3).  Diffs relative to a floating default will drift.

Also found: a live bug that pollutes saved blocks (3.5), which the new resolver fixes as a side effect.

## 2. Current behavior (what exists today)

| Concern | Where | Behavior |
|---|---|---|
| Save (View) | [index.html](../../../../index.html#L962-L993), bound in [infinite-neck.js](../../../../infinite-neck.js#L4470) | `btnControlsToDisplayOptions_View` -> `handleBtnControlsToDisplayOptions()` |
| Save (Section drawer) | [templates/section-drawer.html](../../../../templates/section-drawer.html#L80-L91), [section-drawer.builder.js](../../../../templates/section-drawer.builder.js#L96-L101) | `btnControlsToDisplayOptions_Section` -> same handler |
| Save (command menu) | [menu.js](../../../../menu.js#L1668-L1684), [key-handlers.js](../../../../key-handlers.js#L1372-L1380) | action `saveViewDisplayOptions` -> same handler.  A third entry point the design doc does not list. |
| Writer | [infinite-neck.js `handleBtnControlsToDisplayOptions`](../../../../infinite-neck.js#L3665) | `getCurrentSection().displayOptions = controlsToDisplayOptions()` (whole snapshot, replaces the block) |
| Snapshot of controls | [`controlsToDisplayOptions`](../../../../infinite-neck.js#L3405) | ~37 keys; always includes `autoColor`, `autoColorHighlight`, `NoteDisplaySizes`, `currentColorDict`; `sectionTheme` only if `allowThemeAutomation` |
| Applier | [`displayOptionsToControls`](../../../../infinite-neck.js#L3257) | Pushes a block into the controls, then `fullRepaint()` unless `skipRepaint` |
| Cascade | [Song.js `getStoredDisplayOptionsInEffect`](../../../../Song.js#L1561-L1585) | Walks from the current Section back to index 0 and returns the **first** block found, whole |
| Section change | [`syncSectionUi`](../../../../infinite-neck.js#L763) | stored block, else the startup snapshot (minus `autoColor`/`autoColorHighlight`) -> `displayOptionsToControls()` |
| Rendering | [`buildRenderOptionsForSection`](../../../../infinite-neck.js#L1348), [NoteTableController.js](../../../../NoteTableController.js#L1221-L1226) | `getDisplayOptionsInEffect(section, defaults)` |
| Dirty highlight | [infinite-neck.js](../../../../infinite-neck.js#L704-L760) | Controls vs. a baseline captured at Section sync; toggles `riskyButtonActionRequired` on the View Save button only |
| Report | [display-options.js](../../../../display-options.js) (`/vdd`, "Show Display Options") | One row per block; missing keys are dark gray; green when different from the previous *block* |
| Clear | [`handleBtnDeleteDisplayOptions`](../../../../infinite-neck.js#L3674) | `delete section.displayOptions` |
| Clone | [Section.js `clone`](../../../../Section.js#L320-L328) | Shallow clone drops the block; deep clone copies it |

Readers of `section.displayOptions` that bypass the cascade (they will need the resolver): [`showHideDisplayOptionsPresent`](../../../../infinite-neck.js#L676), [`updateDisplayOptionsReadonlyValues`](../../../../infinite-neck.js#L708) (stored `sectionTheme`), [`getDisplayOptionsSaveState`/`getDisplayOptionsClearState`](../../../../infinite-neck.js#L748-L761), [themes.builder.js](../../../../templates/themes.builder.js#L180) (Theme Matrix "default" column), [display-options.js](../../../../display-options.js).

## 3. Findings that shape the design

### 3.1 The cascade is whole-block replacement, not a merge

`getStoredDisplayOptionsInEffect()` returns the first block found walking backward.  If Section 1 has a full block and Section 3 gets a diff block `{hideNamedNotes:true}`, then Section 3 today resolves to *only* `hideNamedNotes`; every other key is `undefined`.  The design doc's "cascade of options from the first Section through subsequent sections" is the desired behavior but not the current one.

Required: a key-wise merge, `defaults <- block[0] <- ... <- block[k]`, returning a **fresh object** each time.  Full blocks behave identically under the merge (they contain every key), so existing songs are unaffected apart from the cases in section 5.

### 3.2 `displayOptionsToControls()` is not safe for a partial object

The claim in the design doc ("deleting a property correctly grays out the cell and does not attempt to set the value") is true for the checkbox lines, which use `.prop('checked', undefined)` (a jQuery no-op), and for `autoColor`/`autoColorHighlight`/`currentColorDict`/sizes (explicit `if`/`in` guards).  It is not true elsewhere:

- `$('#selNoteFont').val(undefined)` (and the other ~14 `select` lines) coerces to `''` in jQuery, which clears the select (selectedIndex -1).  Only `pianoFingeringHPosition`, `pianoHeightScaleFactor`, `pianoWidthScaleFactor`, `pianoWhiteToBlackWidthRatio`, `showLooperLightBeats` have `??` fallbacks.
- `showAllNoteNames(options.showAllNoteNames)` and the `if (options.showAllNoteNames)` branch treat `undefined` as `false` and **uncheck** the box.
- `cellIsFunction` undefined forces the "Notename" radio.
- The hide-flag branch (`turnOnKeep()`/`turnOffKeep()`, `lblHideWarning`) and `getSong().namedNoteOpacity = options.namedNoteOpacity` read the values directly.

(jQuery behavior is from the jQuery 3.7 source; worth one confirmation in the browser.)  Existing data already hits this on a few blocks: `All-Chords-w-Modes-Piano.json` Section 1 has no `hideNamedNotes`; 4 blocks lack `pianoFingeringHPosition`; 1 lacks `pianoWhiteToBlackWidthRatio`/`tinyNote*` keys.

Required: always resolve (merge over defaults) **before** calling `displayOptionsToControls()`.  Then `displayOptionsToControls()` needs no change for diffs, except for the automation keys (section 4).

### 3.3 "Default DisplayOptions" are a session snapshot

`defaultDisplayOptionsForNavigation` ([infinite-neck.js](../../../../infinite-neck.js#L692-L701)) is `controlsToDisplayOptions()` captured at startup, then re-captured after the async palette load ([L4780-L4789](../../../../infinite-neck.js#L4780)).  It therefore depends on:

- the control defaults in [index.html](../../../../index.html) (stable);
- `applyScalingPrefs()` ([L4568](../../../../infinite-neck.js#L4568)), which applies **localStorage** width/height/NoteFontSize *before* the capture, so `NoteDisplaySizes` defaults are per-browser;
- timing (the first capture can precede the palette, so `autoColor` differs between captures).

It is not per-Song (not recaptured on song open) and not versioned.  A diff written against it is only portable if the default is a constant.  Full blocks are immune today because they pin every value; diff blocks would "float" if a future release changes a control default (for example `noteFont`).

Recommendation: a static `DISPLAY_OPTIONS_DEFAULTS` object (derived from the `index.html` control defaults, covered by a Jest test that fails when it changes) used as the baseline for diffs and for merge.  `NoteDisplaySizes`, `autoColor`, `autoColorHighlight`, `currentColorDict`, `sectionTheme` are *not* in the defaults (they are opt-in keys, 3.4).

### 3.4 The "opt-in" pattern already exists, in three different forms

| Key | Default today | Applied when | Gate that exists | Today's Save |
|---|---|---|---|---|
| `autoColor` | on (palette init) | `'autoColor' in options` ([L3359](../../../../infinite-neck.js#L3359)) | none; `syncSectionUi` omits it only when no block exists | always written (97/97 blocks: 35 true, 62 false) |
| `autoColorHighlight` | off | `'autoColorHighlight' in options` | none (same as above) | always written (only 10/97 blocks, older songs predate it) |
| `currentColorDict` | undefined (not set until a dict is chosen) | `if (currentColorDict)` | none; value `undefined` is dropped by JSON | written when set (19/97) |
| `sectionTheme` | n/a | `allowThemeAutomation && sectionTheme` | **Song-level** `cbAllowThemeAutomation` | only written when the gate is on (0 songs use it) |
| `NoteDisplaySizes` (`width`, `height`, `NoteFontSize`) | startup snapshot | `presentationMode` | **Song-level** `cbPresentationMode` | **always written** even when the gate is off: 29 of 97 blocks live in songs with `presentationMode` false and carry unused sizes |

Answer to the question in the design doc: yes, the same pattern applies to every high-level automation, and in the Section model it is already "key present = automated, key absent = left alone".  Two keys (`sectionTheme`, sizes) are gated by a Song-scope checkbox; two (`autoColor`, `autoColorHighlight`) and `currentColorDict` have no gate, which is exactly the bug the design doc describes.  So the fix is the same shape for all: SaveDiff and Save must write these keys only when their gate/opt-in says so.

### 3.5 Live bug: replay options are written into stored blocks

[NoteTableController.js L1221-L1226](../../../../NoteTableController.js#L1221-L1226): `getDisplayOptionsInEffect()` returns the *live* `section.displayOptions` object and then `Object.assign(relSectionOptions, replayOptions)` mutates it with `tablename`, `sectionIndex`, `listenToTablename`, `relativeSection`, `type`, `directionType`, `sharps`, `rootID`, `rootIDLead`, `rootKey`.  Those leak into the saved song: `songs/demo/guitar-basic-blues-fwd-back-observers.json` Section 1 has 46 keys including them.  A resolver that returns a fresh merged object fixes this; it needs a regression test.

### 3.6 Normalization needed before diffing

- `NoteDisplaySizes.caption` and `dropDownFunctionSymbols.caption` are derived text; `dropDownFunctionSymbols.caption` contains template whitespace (for example `"\n     Default"`).  Compare `NoteDisplaySizes` by `{width,height,NoteFontSize}` and `dropDownFunctionSymbols` by `.value` only.
- Values are mixed strings/numbers/booleans (`"1"`, `"140px"`, `22`).  Compare after `String()` coercion for scalar select values, strict for booleans.
- Compare at the top-level key granularity.  `NoteDisplaySizes` and `dropDownFunctionSymbols` are written atomically as a unit.  (Open question 3.)

### 3.7 Coverage gaps vs. "no states that can't be reached by automation"

- `textareaFunctionSymbols` (custom symbols) edits `song.noteNamesFuncArr` but `controlsToDisplayOptions()` only saves the *dropdown's* value, so custom symbol arrays cannot be automated.  Not a regression, but it is a hole.
- `controlsToDisplayOptions()` does not capture `selTinyNoteMaxWidth` yet `displayOptionsToControls()` reads `$('#selTinyNoteMaxWidth').val()` for a CSS var; the id does not exist on the View page (dead reference).
- UI font size and Presentation Mode / Allow Theme Automation are intentionally not per-Section.

## 4. Proposed design (input to Iteration 2)

### 4.1 Vocabulary

- **defaults**: static `DISPLAY_OPTIONS_DEFAULTS` (3.3).
- **blocks**: `section.displayOptions` objects, each now a *diff*.
- **resolved(k)**: `defaults <- block[0] <- ... <- block[k]`, a fresh object.  `null` values act as tombstones (below).
- **baseline(k)**: `resolved(k-1)` (blocks of strictly *prior* Sections only, or just `defaults` for Section 1).  Using strictly prior Sections makes SaveDiff idempotent: the controls already show `resolved(k)` including Section k's old block, and diffing against `baseline(k)` re-derives that block plus the user's edits.

### 4.2 SaveDiff algorithm (pure function, Jest-testable without DOM)

`computeDisplayOptionsDiff(controlsOptions, baseline, ctx)` in [display-options.js](../../../../display-options.js) (or a new helper module), where `ctx = { presentationMode, allowThemeAutomation, automate: { autoColor, autoColorHighlight, currentColorDict } }`.

1. Regular keys (everything except the opt-in keys): include `key` iff `normalized(controls[key]) !== normalized(baseline[key])`.  Un-checking a box that is on in the baseline is a diff; a box that is on in both is not.
2. `NoteDisplaySizes`: include only if `ctx.presentationMode` and it differs from the cascaded value (no cascade -> always include when presentationMode is on).
3. `sectionTheme`: include only if `ctx.allowThemeAutomation` and it differs from the cascaded value, or from `song.theme` when none exists (that is what the Section shows without automation).
4. `autoColor`, `autoColorHighlight`, `currentColorDict` (opt-in keys): include iff the Automate box for that key is checked **and** (no cascaded value exists **or** the value differs).  If the box is unchecked and a cascaded value exists, write a tombstone `null` (release the automation).  If unchecked and none exists, omit.
5. Never emit non-DisplayOption keys (defends against 3.5).

Then the handler `handleBtnControlsToDisplayOptionsDiff()`:

- `diff` empty -> `delete section.displayOptions` (equivalent, keeps CLEAR state honest).  Otherwise `section.displayOptions = diff`.
- Same follow-ups as today: `showHideDisplayOptionsPresent()`, `captureDisplayOptionsDirtyBaseline()`, `ThemesBuilder.renderThemeMatrix()`.
- Log the key list via `THEME_INFO` so the user can see what was saved; a tooltip showing "N changes: ..." on the button is a cheap extra.

### 4.3 The opt-in UI (answers the AutoColor question)

Add a small "Automate" checkbox beside each of `viewDisplayOptionAutoColorValue`, `viewDisplayOptionAutoColorHighlightValue` and `viewDisplayOptionCurrentColorDictValue` (keep the read-only values; they still tell you the stored state).

- It is a Save-time *intent* flag, not Song data.  On every Section sync it is initialized to "does `resolved(k)` carry this key (not `null`)".  That makes existing songs behave exactly as today (they carry `autoColor`, so Automate shows checked), while a fresh song starts unchecked, so pressing `c` is never automated away.
- Applies to both SaveDiff and the existing full Save (the design doc says full Save should not automate AutoColor either).  Full Save with Automate off simply omits the key.
- `sectionTheme` and sizes keep their existing Song-level gates (`cbAllowThemeAutomation`, `cbPresentationMode`), so there is no new checkbox for them; the Save and SaveDiff writers just honor the gates (finding 3.4).  This makes all five automations consistent: "written only when explicitly enabled".

Why not replace `viewDisplayOptionAutoColorValue` with the checkbox: that span doubles as a live read-out of the controls ([updateDisplayOptionsReadonlyValues](../../../../infinite-neck.js#L708)); a separate intent checkbox avoids conflating "what is on" with "do I want to save it".

### 4.4 Reading side (required changes)

- `Song.getStoredDisplayOptionsInEffect(section)`: return the merged keys of blocks 0..k (fresh object, tombstones removed) or `null` when no block exists.  `syncSectionUi`'s special "delete autoColor when no block" branch then disappears because absent keys are simply absent.
- `Song.getDisplayOptionsInEffect(section, defaults)`: `{...defaults, ...stored}`.
- Fix [NoteTableController.js L1221-L1226](../../../../NoteTableController.js#L1221-L1226) to resolve a copy (no mutation).
- Route the other readers in section 2 through the resolver so Theme Matrix, the Theme read-out and `/vdd` show cascaded values.
- [display-options.js](../../../../display-options.js) `/vdd`: show only the keys a block sets, mark inherited cells muted rather than dark gray, mark `null` as "released".  Today's "green = differs from previous block" logic stays but compares against the cascaded value.

### 4.5 UI placement

Per the design doc: `btnControlsToDisplayOptionsDiff_View` between `btnControlsToDisplayOptions_View` and `btnDeleteDisplayOptions_View` in [index.html L965-L971](../../../../index.html#L965); `btnControlsToDisplayOptionsDiff_Section` between the matching Section buttons in [section-drawer.html L83-L88](../../../../templates/section-drawer.html#L83).  Also needed (not in the doc): a command-menu entry next to [`saveViewDisplayOptions`](../../../../menu.js#L1668) and a `requireProvider` wrapper plus export, mirrored where `handleBtnControlsToDisplayOptions` is listed in [infinite-neck.js L362](../../../../infinite-neck.js#L362) and [key-handlers.js L173](../../../../key-handlers.js#L173), plus the mock in [key-handlers.test.js](../../../../_tests/jest/key-handlers.test.js).  Apply the same `riskyButtonActionRequired` highlight so SaveDiff lights up when the controls differ from the baseline.  Verify that U+2A39 renders in the app's UI fonts (it is in Supplemental Mathematical Operators and is often missing); keep a text fallback such as "Save diff" in the `title`.

## 5. Impact on existing songs (measured)

Scope: `songs/` excluding `_trash`; 65 songs, 438 Sections; 40 songs have at least one block, 97 blocks total; 68 of the blocks are in songs with `presentationMode: true`; no song uses `allowThemeAutomation` or `sectionTheme`.

| Measurement | Value |
|---|---|
| Keys per block | 30 to 46 (about 37 typical) |
| Keys across all blocks | 3,423 |
| Keys that remain after pruning each block against the cascade of prior blocks | 1,430 (-58%) |
| Non-first blocks | 57 |
| Non-first blocks that become empty after pruning | 50 |
| Keys in non-first blocks differing from the previous block (by raw JSON) | 11 of 2,004 |
| Largest case | `songs/practice/supersong-black-keys.json`: 46 blocks in 46 Sections |

Behavioral effect of switching the cascade to merge, for songs not touched at all:

- Full blocks render identically.
- Blocks missing keys (3.2) now inherit instead of blanking selects or unchecking boxes: strictly an improvement (affects `All-Chords-w-Modes-Piano.json` and a handful of blocks).
- The polluted block in `guitar-basic-blues-fwd-back-observers.json` (3.5) carries inert extra keys; the resolver should ignore keys not in the DisplayOptions schema.
- `autoColor` stays automated wherever it is saved (present key = automated), so no song changes behavior.  Whether the 62 blocks that store `autoColor: false` are intentional cannot be determined from the data; they are preserved as-is.

Recommended migration (per the no-legacy policy: no compatibility code, a one-time tool instead): `bin/compact-display-options.js` that prunes non-first blocks against the cascade of prior blocks (safe, independent of defaults), deletes empty blocks, strips non-schema keys, and optionally drops `NoteDisplaySizes` where `presentationMode` is false.  Do not run it on `songs/tests/` fixtures; keep those as full-block regression files (the "keep the old file formats around for testing" practice).  First blocks stay full until a static defaults object (3.3) exists, then can be pruned against it.

## 6. Risks

1. **Defaults drift**: diff blocks float with `DISPLAY_OPTIONS_DEFAULTS` (3.3).  Mitigated by a static, test-pinned defaults object.
2. **Cascade ripple**: editing Section 1 now changes later Sections that inherited, by design.  A redundant later diff can become a no-op, harmless.
3. **Reordering and deleting Sections**: [`moveSectionTo`](../../../../Song.js#L1549), [`moveSectionToEND`](../../../../Song.js#L1542) and [`deleteCurrentSection`](../../../../Song.js#L1514) change the cascade for every later Section.  The same hazard exists today but is worse with diffs (a Section's diff silently re-bases onto new predecessors).  Mitigation options: a "materialize" command that expands blocks to full (inverse of the compact tool), or merging a deleted Section's block into its successor.
4. **Deep clone** copies a diff that was relative to its old position (same cause as 3).
5. **Older app builds** would mis-render diff blocks (missing keys blank selects).  Acceptable under the no-legacy policy.
6. **Top-level files**: this work touches [infinite-neck.js](../../../../infinite-neck.js), [Song.js](../../../../Song.js), [index.html](../../../../index.html) and others in `./`; each needs the explicit go-ahead before Iteration 2 coding.

## 7. Open questions for the next design discussion

1. Baseline: static `DISPLAY_OPTIONS_DEFAULTS` (recommended) vs. keep the session snapshot (then at minimum capture it before `applyScalingPrefs()`)?
2. Release semantics: accept a `null` tombstone for the opt-in keys so a later Section can stop automating `autoColor` (recommended), or leave "once automated, always cascaded"?
3. `NoteDisplaySizes`: atomic unit (recommended, simple) or per-field (`width`, `height`, `NoteFontSize`) diffs?
4. Empty diff: delete the block (recommended) or store `{}`?
5. Should the existing full SAVE be kept?  Recommended: keep it (rename its label to "Save All" if the two read confusingly), and make it honor the same opt-in gates.
6. Automate checkbox for `currentColorDict` too, or only AutoColor and AutoColor Highlight?
7. Should a change to `cbPresentationMode` / `cbAllowThemeAutomation` mark the Save buttons dirty?  They are excluded from dirty tracking today ([L4476](../../../../infinite-neck.js#L4476)).
8. Section move/delete/deep-clone: is a "materialize/compact" pair of commands enough, or should these operations rebase blocks automatically?
9. Custom function symbols (3.7): in scope for this sprint or logged separately?
10. File name: this analysis was written as `137-it1-analysis.md` because that is the name in [148-design.md](148-design.md).  Given the 137 -> 147 typo correction, it may need to be `148-it1-analysis.md`.

## 8. Suggested iteration plan

- **Iteration 2 (no UI)**: static defaults, merge resolver in Song.js, `computeDisplayOptionsDiff()` and a schema-key filter, the NoteTableController mutation fix.  Jest only, following the existing non-browser patterns in [display-options.test.js](../../../../_tests/jest/display-options.test.js) (headless Song from fixtures, pure functions, no JSDOM/jQuery): merge across Sections, tombstones, un-check counts as a diff, default-equal checkbox is not a diff, normalization (captions, string/number), `presentationMode`/`allowThemeAutomation` gating, idempotent re-save, full-block songs resolve identically before and after, regression for 3.5.
- **Iteration 3 (UI)**: the two buttons, the Automate checkboxes, the command-menu entry, dirty highlight, `/vdd` and Theme Matrix read the cascade, `displayOptionsToControls()` fed only resolved objects.  Acceptance-tested in the browser.
- **Iteration 4 (songs and docs)**: `bin/compact-display-options.js`, run on `songs/` (not fixtures), update [help.html](../../../../help.html) (Display Options glossary and the `c` / `y` AutoColor entries) and the sprint report.

## 9. Not verified

- The keyboard binding for `c` / `y` was not located in the JS (only [help.html](../../../../help.html#L5291) and the button handler [`toggleAutoColorCheckbox`](../../../../infinite-neck.js#L3653) were found); confirm it routes through that handler before relying on "pressing `c` never writes to the model".
- jQuery `.val(undefined)` and `.prop(name, undefined)` behaviors (3.2) are from reading the 3.7 source, not from a browser run.
