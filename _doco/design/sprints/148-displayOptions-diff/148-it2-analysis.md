# Sprint 148 (displayOptions-diff), Iteration 2: Function Symbols UX, answers review, use-case coverage

date: 20261014

Requested by [148-design.md](148-design.md), section "Iteration 2".  Builds on [148-it1-analysis.md](148-it1-analysis.md).  Sprint overview: [sprint-148.md](sprint-148.md).

No code was changed.  Claims come from reading the code or from scanning `songs/` (excluding `_trash`).

## 0. Summary

1. The Function Symbols UX is sound in outline.  There are 13 holes (section 1.3); the ones that need a decision before coding are: the dual role of `txtFunctionSymbolsName` (H1), what `btnClearCurrentUserFunctionSymbols` does and what happens to Sections that reference a deleted set (H2), how DisplayOptions refer to a set (H5), and HTML safety of user-supplied symbols (H8).
2. Today nothing mutates the built-in `<option>` values.  The real problems are different: a textarea edit never reaches a saved Song (the array is dropped by the persistence replacer and DisplayOptions save the dropdown's value, not the textarea), and 88 of 97 stored captions are stale ("Default").  So "don't mutate built-ins" is satisfied by moving the built-ins into an immutable JS constant.
3. Your answers hold up, with **three corrections to my Iteration 1 analysis** that your use-cases exposed (section 2.2):
   - Boundary application must be **sparse** (apply only keys that are stored), not "merge over defaults".  Merge-over-defaults would re-break Case 1 and Case 2 at every Section boundary.
   - SaveDiff and Save must **preserve** stored keys whose Song-level gate is currently off (Presentation Mode, Allow Theme Automation).  My Iteration 1 algorithm and today's Save both wipe them, which contradicts your answer to question 7.
   - For AutoColor, a per-Save "Automate" checkbox does not cover Case 2 (loop wrap-around).  A **Song-level gate**, in the same family as Presentation Mode and Allow Theme Automation, does.
4. Case 1 and Case 3 are covered once those corrections are made and existing songs are compacted.  Case 2 is covered only with the Song-level gate.  Details and remaining gaps in section 3.

## 1. Function Symbols UX

### 1.1 What exists today (verified)

| Piece | Where | Behavior |
|---|---|---|
| Controls | [index.html](../../../../index.html#L447-L497) | `textareaFunctionSymbols`, `btnFunctionSymbolsChanged` (check mark), `btnFunctionSymbolsReset`, `dropDownFunctionSymbols` with 11 built-in options whose `value` is the JSON array text and whose text is an HTML caption (`Solf&#232;ge`) |
| `btnFunctionSymbolsChanged` | no handler anywhere | Already inert.  Only the textarea's `change` (blur) event does anything.  Safe to remove. |
| Select change | [infinite-neck.js](../../../../infinite-neck.js#L4459) | `song.noteNamesFuncArr = JSON.parse(option value)`, copies to the textarea, `fullRepaint()` |
| Textarea change | [infinite-neck.js](../../../../infinite-neck.js#L4416) | Parses and **assigns to `song.noteNamesFuncArr` before validating**; validates only that the array is non-empty and `[0]` and `[11]` are truthy; on error `alert()` and falls back to the selected option's array |
| Reset | [infinite-neck.js](../../../../infinite-neck.js#L4440) | Puts the selected option's array back (the `noteNamesFuncArrDEFAULT` branch is dead: no such Song property is ever set) |
| Save into a Section | [`controlsToDisplayOptions`](../../../../infinite-neck.js#L3434) | `{caption: option text, value: option value}` of the **dropdown**, never the textarea |
| Apply from a Section | [`displayOptionsToControls`](../../../../infinite-neck.js#L3331) | `$('#dropDownFunctionSymbols').val(value)` (exact string match), then `JSON.parse` into `song.noteNamesFuncArr` |
| Prewarm render options | [`parseNoteNamesFuncArrForOptions`](../../../../infinite-neck.js#L1334) | Parses `options.dropDownFunctionSymbols.value` from the cascaded block |
| Persistence | [SongPersistence.js](../../../../SongPersistence.js#L376) | `noteNamesFuncArr` is on the **do-not-persist** list; it is runtime state |
| Consumers of the runtime array | [NoteTableController.js `cellBuilder`](../../../../NoteTableController.js#L277), [SongWidgets.js](../../../../SongWidgets.js#L49) (sprint 147 chord caption), [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js#L124) key | All read `song.noteNamesFuncArr` (the render-cache key includes the array contents, so edits invalidate correctly) |
| Startup | [infinite-neck.js L4740](../../../../infinite-neck.js#L4740) | Fills the textarea once at init; opening a Song does not refresh it unless a Section's stored block carries a value |

Consequences:

- Custom text typed in the textarea is live only, is lost on the next Section change (the stored dropdown value is re-applied), is never saved to the Song, and is never in a Section's DisplayOptions.
- In stored data, the dropdown value is the identity.  All 97 stored blocks match a built-in value exactly (0 unmatched), but captions are unreliable: `Default` 88, `Function (Default)` 5, `Extensions` 1, `Extensions (only)` 1, `Jazz` 1, `Jazz Extensions` 1.  `/vdd` therefore shows stale captions.
- Symbol strings are inserted into cell HTML unescaped by `cellBuilder`.  That is intentional for built-ins (`<small>`, `<em>`, entities), and it means any user-defined symbol that arrives in a Song file is HTML that reaches the DOM (H8).
- Frozen Tool tables copy `dropDownFunctionSymbols` into `ToolDisplayOptions`, but the render path reads `options.noteNamesFuncArr` / the Song's runtime array, so the frozen value is inert today.  That matches the sprint 141 intent (Tool tables follow the live Section for symbols), so freeze should simply not capture it.

### 1.2 The proposal, as I understand it, plus the data model I recommend

Your proposal: `textareaFunctionSymbols`, `dropDownFunctionSymbols`, `btnCreateUserFunctionSymbols`, `txtFunctionSymbolsName`, `btnClearCurrentUserFunctionSymbols`, `btnSaveCurrentUserFunctionSymbols`; Create clones the selected set immediately into the Model under a proposed name and parks the SELECT on it; Save is enabled by a change to the textarea or the name; built-ins can never be saved over; names have a caption plus an auto-squeezed id.

Recommended model (this makes most holes disappear):

- **Built-in sets** become an immutable constant, for example `FUNCTION_SYMBOL_SETS_BUILTIN` (frozen), each `{ id, caption, symbols: [12 strings] }`, with plain-Unicode captions (`Solfège`, not an HTML entity).  The `<select>` is built from it instead of hand-written `<option>` markup, so developers edit one place with ordinary tools, as you asked.  Proposed ids: `default`, `extensions`, `extensions-only`, `jazz`, `jazz-extensions`, `function-numbers`, `function-offset`, `function-plus-offset`, `sounds-like`, `solfege`, `kanji-numerals`.
- **User sets** are a new Song-scope, persisted array: `functionSymbolSets: [{ id, caption, symbols: [12 strings] }]` (creation order is `<select>` order; zero entries is valid; symbols are a real JSON array, not a JSON string).  User ids are prefixed, for example `user-extensions-only-2`, so they can never collide with a built-in added in a later release.
- **Sections refer to a set by id.**  A DisplayOptions block carries one atomic key (for example `functionSymbols: "jazz"`) instead of `dropDownFunctionSymbols: {caption, value}`.  Captions and symbols are looked up from the registry, so renames and edits of a user set show up everywhere and `/vdd` never shows stale captions.  For the SaveDiff comparison this is a plain string compare.
- `song.noteNamesFuncArr` stays as the single runtime "current" array that the cell renderer, the render cache and the sprint 147 widget already read, but it is assigned only by one function, `applyFunctionSymbols(id)`, called from select change, Create, Save, Delete, Section sync and Song open.
- Pure logic (name proposal, id squeeze, validation, registry lookup, id-to-symbols resolve) goes in a DOM-free module so Jest can cover it without JSDOM or jQuery, matching the repo's test preference.

Migration (per the no-legacy policy, one-time tool plus fixtures): `bin/` script maps each stored `dropDownFunctionSymbols.value` to a built-in id.  The scan found 0 stored values that match no built-in, so the mapping is mechanical for all 97 blocks.  The runtime does not keep a by-value fallback.

### 1.3 Holes in the proposed UX

**H1. `txtFunctionSymbolsName` has two jobs (needs a decision).**  You describe it as "populated by the current name when the SELECT changes, and ` n` added" (a proposal for the next Create), and also as the place the User renames a set before Save.  When a user set is selected it must show that set's own name or Save-as-rename cannot work; when a built-in is selected it can only be a proposal.  Recommended: the box always shows the **selected set's own caption**; it is read-only for built-ins, where the proposed Create name is shown as the placeholder (for example `Jazz 2`).  Create then makes the clone with the proposed name, selects it, and the box (now editable) shows that name, which matches your Create flow exactly.

**H2. `btnClearCurrentUserFunctionSymbols` is not defined, and deleting a referenced set orphans Sections.**  I read "Clear" as "delete the selected user set" (disabled for built-ins).  Open points: (a) Sections whose DisplayOptions reference the id; (b) what is selected afterwards; (c) recoverability.  Recommended: confirm with the list of referencing Section numbers; after delete select `default` and re-apply; a Section that still references a missing id resolves to `default` and `/vdd` marks it `(missing: user-...)`; bury the set in the Graveyard (precedent: `deleteCurrentSection` buries the Section) so it is recoverable.  Not deleting by default if referenced is the safer alternative.

**H3. Ids must be immutable, unique and survivable.**  If the id is recalculated when the name changes, every Section reference breaks.  Fix the id at Create; rename changes only the caption.  Squeeze rules must also handle: collisions (two captions squeezing to one id), and captions that squeeze to empty (a Kanji or musical-symbol-only name).  Recommended: lowercase, NFKD-strip diacritics, non-alphanumerics to `-`, collapse and trim, prefix `user-`; if empty use `user-set`; append `-2`, `-3` until unique across built-ins and user sets.

**H4. The name-proposal rule needs a defined behavior for sets that already end in a number.**  From `Function (Default)` you get `Function 2`, then from `Function 2` the naive rule gives `Function 2 2`.  Recommended: strip a trailing ` (Default)` and a trailing ` <digits>`, then use the smallest n >= 2 that is free.  `Extensions (only)` gives `Extensions (only) 2`, as you want.  Uniqueness is checked case-insensitively against **all** captions and ids.  Also trim, collapse internal whitespace, cap the length (about 40 characters) and reject `<`, `>`, `&` and quotes in the caption; renaming to an existing caption or to `Function (Default)` is rejected inline.

**H5. How a Section refers to a set (decision).**  Inline copy (`{caption, value}` as today) versus id reference.  Inline copies would not follow "coming back and hitting Save updates that user set" (Sections would keep the old array), would keep stale captions, and make SaveDiff compare long strings.  Recommended: id reference plus the migration in 1.2.  Consequence to accept: editing a user set changes every Section that uses it (this is what a named set means).

**H6. Textarea semantics: draft versus live, and built-ins.**  Today a blur applies the text immediately, even for built-ins, and the Section save silently ignores it.  Recommended: for built-ins the textarea is read-only (title: "Create a User set to edit"); for user sets the textarea is a **draft**, Save commits it (updates the registry, `applyFunctionSymbols(id)`, `fullRepaint()`), a Section change or select change discards an uncommitted draft.  Live preview of a draft is possible but means the displayed symbols diverge from the Model; I would not do it, since Create already puts a clone in the Model and Save is one click.  Open question 3.

**H7. Validation is too weak, and `alert()` is the wrong channel.**  Today only non-empty, `[0]` and `[11]` are checked.  Required: valid JSON, an array of exactly 12 strings, each non-empty after trim and at most about 40 characters, no duplicates requirement.  Show the error inline beside the textarea and disable Save (never `alert()`, never assign the invalid result to `song.noteNamesFuncArr`).  Error text should name the problem ("11 entries, need 12", "entry 5 is empty").  Hand-typing JSON with quotes is error-prone for end users; a later 12-cell editor could replace the textarea, but that is not needed now.

**H8. HTML safety of user symbols and captions (security).**  Symbols are rendered as HTML by `cellBuilder`, and captions are written into HTML by `/vdd` ([display-options.js](../../../../display-options.js)) without escaping.  Once symbols come from a Song file or a shared file, that is an injection path.  Required: validate symbols against the existing tag whitelist (`small`, `em`, `sub`, `sup`, `b`, `i`, `s`, `span`; see ALLOWED_TAGS in [html-sanitizer.js](../../../../html-sanitizer.js#L7)) with no attributes, and a safe-entity pattern, at Create/Save **and** when loading a Song (in `SongPersistence` normalization, like `normalizeMidiDevice`).  Note `sanitizeHtmlFragment()` falls back to returning the input unchanged when `document` does not exist (Jest), so the validator must be a pure regex/tokenizer, not the DOM sanitizer.  Captions are plain text: build `<option>` text with `.text()`, and escape in `/vdd`.  The current "this one is safe--comes from our built SELECT" comment at [L4461](../../../../infinite-neck.js#L4461) stops being true once options are data-driven.

**H9. Song lifecycle and the single runtime array.**  (a) Opening a Song must rebuild the `<select>` from that Song's `functionSymbolSets` and re-select/refresh the textarea and name (today only startup fills the textarea).  (b) New Song: zero user sets.  (c) Append/import of Sections ([infinite-neck.js L1976](../../../../infinite-neck.js#L1976) already copies `colorDicts` as a precedent) must carry the referenced user sets and remap ids on collision.  (d) Sets are Song-scope, so a favorite set has to be re-created in each Song; an "import sets from another Song" or a browser-level library is a possible later feature, not required.

**H10. Dirty tracking and key handling.**  `#divViewControls textarea` and every `input` there are wired to the DisplayOptions "action required" highlight ([L4476](../../../../infinite-neck.js#L4476)), so typing in the new name box or the textarea would light up the View Save button even though nothing DisplayOptions-related changed.  Exclude `txtFunctionSymbolsName`, the textarea and the new buttons from that selector (the select change legitimately stays, since it is a DisplayOption).  Hotkeys are already safe: `document_keypress` and `isTextEditingTarget` skip `input`/`textarea` targets ([key-handlers.js L394](../../../../key-handlers.js#L394), [L464](../../../../key-handlers.js#L464)).  Commit on Enter in the name box using the existing `commitFieldOnEnter` pattern.

**H11. Every consumer must go through one resolver.**  Sites that parse `dropDownFunctionSymbols.value` today: `parseNoteNamesFuncArrForOptions` (prewarm), `displayOptionsToControls`, `controlsToDisplayOptions`, the select/textarea/reset handlers, the startup fill, `display-options.js`, and the SaveDiff comparator.  A prewarm that resolves by id keeps the render-cache key (array contents) identical to the live path.  Freeze (`setToolDisplayOptions`) should drop the key (finding 1.1).

**H12. `btnFunctionSymbolsReset` is missing from your list.**  Recommended: keep it as "Revert" (restores the textarea and name from the registry), enabled only when the draft is dirty; remove `btnFunctionSymbolsChanged`.

**H13. Behavior around absent or invalid ids.**  A Song may reference an id that is neither built-in nor present (hand edit, partial import).  Today `.val(unknownValue)` clears the `<select>`, `.val()` then returns null, and `JSON.parse(null)` yields `null`, so `song.noteNamesFuncArr` becomes `null`.  The id-based resolver must fall back to `default` explicitly and surface it (H2).

Not holes, confirmed fine: render-cache invalidation on edit (key hashes the array); a `<select>` with `<optgroup label="Built-in">` and `<optgroup label="This Song">` is compatible with `.val(id)` and gives zero-user-set Songs a clean look (your "append at the end" wording is satisfied either way); built-in order is preserved.

### 1.4 Recommended control states

| Selected | textarea | name box | Create | Save | Clear |
|---|---|---|---|---|---|
| built-in | read-only | read-only, placeholder = next proposed name | enabled | disabled | disabled |
| user set, clean | editable | editable | enabled | disabled | enabled |
| user set, dirty, invalid | editable, inline error | editable | enabled | disabled | enabled |
| user set, dirty, valid | editable | editable | enabled | enabled | enabled |

Create always: clone selected set, name per H4, id per H3, append to `functionSymbolSets`, rebuild select, select it, `applyFunctionSymbols(id)`, fill the name box, leave Save disabled until a change (the set is already in the Model, as you said).

### 1.5 Code touch-list (for the approval of this Iteration)

Top-level files, need explicit go-ahead: [index.html](../../../../index.html) (controls, select built from data), [infinite-neck.js](../../../../infinite-neck.js) (handlers, `controlsToDisplayOptions`, `displayOptionsToControls`, `parseNoteNamesFuncArrForOptions`, the dirty selector, Song open refresh), [SongPersistence.js](../../../../SongPersistence.js) (default `[]`, normalization, validation), [Constants.js](../../../../Constants.js) or a new module for the built-in constant and pure helpers, [display-options.js](../../../../display-options.js) (caption lookup, escaping).  Also [bin/song-file-schema.js](../../../../bin/song-file-schema.js) (`functionSymbolSets` schema), a `bin/` migration script, [help.html](../../../../help.html#L1380) ("a way for you to define your own" section), and Jest in `_tests/jest/` (name proposal, id squeeze and uniqueness, 12-entry/HTML validation, registry resolve with missing id, persistence round trip, `songs/` migration mapping).  Pure functions only, per the non-browser test pattern.

## 2. Analysis of your answers

### 2.1 Answer by answer

| # | Your answer | Assessment |
|---|---|---|
| 1 | Static `DISPLAY_OPTIONS_DEFAULTS`, one place | Agreed.  Make it more than a diff baseline: use it to **initialize the controls** at startup and Song open.  Today startup runs `displayOptionsToControls(controlsToDisplayOptions())` ([L4727](../../../../infinite-neck.js#L4727)), which is circular (it re-applies what the HTML already says).  Include `functionSymbols: "default"`.  `NoteDisplaySizes`, `sectionTheme`, `autoColor`, `autoColorHighlight`, `currentColorDict` remain outside it (opt-in keys). |
| 2 | `null` tombstone, subject to use-cases | Works for "stop automating from this Section forward" but does **not** cover loop wrap-around; see Case 2.  Define a tombstone as "leave the live control alone from here on", not "reset to default". |
| 3 | `NoteDisplaySizes` atomic | Agreed.  Compare on `{width, height, NoteFontSize}`; `caption` (`160x60:22`) is derived and excluded from comparison. |
| 4 | Empty diff deletes the block | Agreed.  It also keeps `btnDeleteDisplayOptions_*` and the save-state menu text truthful. |
| 5 | Keep Save, new button "Save Diff", no glyph | Agreed.  Two cautions: full Save stays a footgun for Case 3 (it re-pins everything), so it should at least honor the same gates; and the Section drawer buttons are one letter plus `<small>` (`S`, `C`), so "Save Diff" needs a short drawer caption, for example `D<small>iff</small>`, with the full name in the `title`. |
| 6 | Automate checkbox for `currentColorDict` too | Agreed in principle; see 2.2(c) for the form it should take. |
| 7 | Keep dirty behavior; gates are Song-level; suspend must not wipe | Mostly **already true**: `presentationMode` and `allowThemeAutomation` are persisted per Song ([SongPersistence.js L263](../../../../SongPersistence.js#L263)) and restored on open ([infinite-neck.js L2118](../../../../infinite-neck.js#L2118)), and toggling them touches no stored data.  But **writers violate the "suspend, not wipe" promise**; see 2.2(b). |
| 8 | Discuss with use-cases | See 3.4 for a concrete proposal. |
| 9 | Function Symbols in scope | Done in section 1. |
| 10 | Rename to `148-it1-analysis.md` | Noted; the 137 mention in 7.10 stays as history. |

### 2.2 Corrections to Iteration 1 prompted by your use-cases

**(a) Apply sparsely; do not merge over defaults at boundaries.**  Iteration 1 (finding 3.2) said to merge over defaults before calling `displayOptionsToControls()` so no control is blanked by a missing key.  That fixes blanking but defeats Cases 1 and 2: if the resolved set includes `hideNamedNotes: false` from DEFAULTS, every Section boundary unchecks a box the User (or a macro, via `hideNamedNotes`/`showNamedNotes` in [key-handlers.js L1566](../../../../key-handlers.js#L1566)) just set.  Correct design:

- `displayOptionsToControls()` applies **only the keys present** in the stored cascade (blocks 0..k merged; no defaults) and leaves every other control untouched.  This is the pattern the code already uses for `autoColor`/`autoColorHighlight` (`'key' in options`) and `sectionTheme`/sizes (gated); the work is guarding the remaining unconditional lines (all the `.val(options.x)` selects, `showAllNoteNames`, the `cellIsFunction` radio, the hide-flag branch with `turnOnKeep`/`turnOffKeep`, and `getSong().namedNoteOpacity = options.namedNoteOpacity`, which assigns `undefined` today).
- DEFAULTS are used (i) to initialize controls on startup and Song open, (ii) as the SaveDiff baseline when no earlier block sets a key, (iii) to complete render options where a full object is needed (`buildRenderOptionsForSection`).
- A deliberate return to the default value after an earlier Section changed it is written explicitly as a diff (value differs from the cascade), so it stays expressible.
- Corollary: "tombstone `null`" means "stop applying", and a Section can only restore the default by writing the default value.

**(b) Gated keys are preserved while the gate is off.**  Iteration 1's SaveDiff replaces the block (`section.displayOptions = diff`) and says gated keys are included only if the gate is on, so saving with Presentation Mode off would delete a Section's stored `NoteDisplaySizes`, and saving with Allow Theme Automation off would delete `sectionTheme` (full Save does this to `sectionTheme` today, and writes sizes regardless of the gate).  That contradicts "clearing the checkbox doesn't wipe out stored things, so the User can reinstate it".  Rule: when a gate is closed, SaveDiff and Save copy that key unchanged from the Section's existing block; they neither recompute nor drop it.  Cheap to implement (the existing block is in hand) and testable as a pure function.

**(c) AutoColor: Song-level gate instead of a per-Save "Automate" checkbox.**  See Case 2 for why.  Proposal: a third Song-scope checkbox beside the two existing ones, for example "Allow AutoColor Automation", persisted on the Song, covering `autoColor` and `autoColorHighlight` (and, if you agree, `currentColorDict`).  Gate closed: stored keys are not applied and are preserved on save (rule (b)); gate open: they apply at boundaries and are written like any other key by SaveDiff (only when they differ from the baseline).  New Songs start closed, which gives you "AutoColor generally should not be automated" without any per-Save checkbox.  Existing Songs: the migration tool sets the gate open for Songs that already store `autoColor` where the author should decide (62 of the 97 stored blocks say `autoColor: false`, 35 say `true`; the data cannot tell which were intentional), and reports them.

## 3. Coverage of your use-cases

### 3.1 Case: Macro drives Hiding

Verdict: **covered**, given (a) sparse apply, (b) SaveDiff writing a key only when it differs from the baseline, (c) compaction of existing songs.

- Macros and menu actions set the real checkboxes ([key-handlers.js L1566-L1684](../../../../key-handlers.js#L1566)), so nothing but the Section boundary can undo them.  With sparse apply, a Section with no stored hide keys leaves them alone, including across loop wrap-around.
- `All-Chords-w-Modes-Piano.json` Section 1, which you hand-edited to drop `hideNamedNotes`, is exactly the shape SaveDiff produces when the boxes are unchecked.
- Compaction (Iteration 1, section 5) against DEFAULTS removes the `hide*: false` keys that every one of the 97 saved blocks carries today, so existing songs stop pinning the hide flags.
- Removing a stored value is natural: the baseline for SaveDiff is the cascade of **earlier** Sections, so setting the control back to the inherited/default value and pressing SaveDiff drops the key from this Section's block.

Remaining gaps:

1. SaveDiff reads live controls, so a macro toggle left on at the moment of saving is captured as a diff ("Save Diff after a macro hid NamedNotes").  Mitigation: after SaveDiff, list the keys written (Messages and the button tooltip) and keep one level of undo (the previous block is a single object).
2. A key that is in a block (for example `hideNamedNotes: true` in Section 1) cannot be "un-automated but left as is": the only way is to set the control to the baseline, SaveDiff, then set it again.  Acceptable for the use-cases; flagged in case you want a general per-key release later.
3. The suggested workflow "DELETE the current Section automation, set the changes, hit Save or Save Diff" works for removing a block, with one trap: CLEAR followed by SaveDiff re-derives the block from the live controls, which is what you want, but any opt-in key behind a gate must still be preserved (rule 2.2(b)) and CLEAR discards the stored value of gated keys in that Section.  CLEAR should warn when the block holds gated keys that are currently suspended.

### 3.2 Case: Suspend AutoColor

Verdict: **covered only with the Song-level gate (2.2(c))**.

- `c` and `y` click the real checkboxes ([key-handlers.js L496-L501](../../../../key-handlers.js#L496), as you quoted), which fire the palette `change` handler and a repaint; they write nothing to the Model.  Good, and unchanged.
- The loop-wrap problem: if `autoColor` is stored in Section 1 and the User releases it in Section 5 (Iteration 1's tombstone, or an "Automate" checkbox plus SaveDiff in Section 5), Sections 1-4 still re-apply it when the loop wraps, which is the hiccup you would see on every pass, not once.  A per-Save checkbox cannot fix that without also editing earlier Sections' blocks.
- The Song-level gate matches your described flow exactly (stop looping, open View, click one checkbox, close View): no navigation, no data deleted, reversible, and a Song that automates AutoColor keeps its stored keys for the next presentation, in line with your answer to question 7.
- With diff-against-DEFAULTS, a Song whose AutoColor stays at its default (on) is never written, which already removes the "start with AutoColor true, press Save, it is automated" case.  The gate additionally covers "pressed `c`, then SaveDiff for something else, AutoColor off got written".

### 3.3 Case: Clobbering other DisplayOptions

Verdict: **covered for new saves; existing songs need compaction; full Save remains a way to re-clobber**.

- SaveDiff in Section 3 writes only the opacity change, so a stale size from Section 1 cannot be re-pinned, and later edits to Section 1's size flow through the merge to Section 3.
- Gap: a Section whose existing block holds a **redundant copy** of an old inherited value (a full Save made earlier) overrides a later change in Section 1, which is the surprise you described.  Compaction fixes this if it runs before the edit; after the edit the stale copy looks like an intentional different value.  Recommended: when SaveDiff changes key K in Section k, report in Messages "Sections 3, 7 also set sizes and will override" (cheap, informational), plus the compaction command being available in-app as well as in `bin/`.
- Full Save should honor the gates and the same preview of keys written, and be labeled so it reads as the heavy option.

### 3.4 Question 8 (move, delete, deep clone) for the walk-through

All these operations change which blocks precede a Section.  One uniform approach, which I suggest we discuss: treat each Section's **resolved state as the truth** and the blocks as a minimal encoding of it: before the operation record `resolved(j)` for every Section, apply the operation, then re-encode so that `resolved(j)` is unchanged (block j = keys whose value differs from `resolved(j-1)`, with a tombstone where a key goes from present to absent).  That one function also gives: delete (the deleted Section's block merges into its successor), move, deep clone, import of Sections from another Song (expand with the source Song's cascade, re-encode against the target), and the `bin/` compaction.  It needs no special cases and is Jest-testable without a DOM.  Shallow clone already drops the block and inherits correctly ([Section.js L326](../../../../Section.js#L326)).

### 3.5 Additional use-cases worth adding to the list

- **Song open must reset non-automated state.**  With sparse apply, live toggles would leak from the previous Song.  Song open should apply DEFAULTS to the controls before Section 1 syncs.  Question: should `autoColor` and `autoColorHighlight` also reset on Song open (a per-session preference) or persist across Songs?
- **Presentation in class** (your question 7 scenario): toggling Presentation Mode mid-lesson must not lose or rewrite stored sizes (rule 2.2(b)).
- **Looping a Song with TransposePlugin**: keys change per Section while display state should not; sparse apply keeps non-automated controls steady across wraps.
- **Tool tables frozen with "Fr"**: unaffected by function-symbol sets (they follow the live Section).
- **Appending Sections from another Song** that reference its user function sets or use diff blocks relative to its cascade (3.4, H9).

## 4. Open questions

1. H1: always show the selected set's own caption (read-only for built-ins, proposal as placeholder), as recommended?
2. H2: Clear on a referenced set: confirm-then-delete with fallback to `default` (recommended) or refuse while referenced?  Bury in the Graveyard?
3. H6: textarea as draft committed only by Save (recommended), or live preview of the draft?
4. H5: Section reference by id with a one-time migration of the 97 blocks (recommended), using a plain key such as `functionSymbols` (or keep the key name `dropDownFunctionSymbols` and change its shape)?
5. H3: user-id prefix `user-` acceptable?  Maximum number of user sets and maximum caption length (suggested about 20 and about 40)?
6. 2.2(a): confirm sparse apply (the control is left alone when no stored key exists) and DEFAULTS used only for init, baseline and render completion.
7. 2.2(c): Song-level "Allow AutoColor Automation" gate instead of per-Save Automate checkboxes; does it also gate `currentColorDict`?  Default closed for new Songs and open (with a report) for existing Songs that store `autoColor`?
8. 3.5: should `autoColor`/`autoColorHighlight` reset to default on Song open?
9. 3.4: adopt "resolved state is truth, blocks are the encoding" for move/delete/deep-clone/import and compaction?
10. 3.1: is "keys written" Messages output plus one level of undo enough for the "macro toggle captured by SaveDiff" gap?

## 5. Not verified

- jQuery behavior of `.val()` with `<optgroup>` and with unmatched values is from the jQuery 3.7 source, not a browser run.
- I did not check whether the app tracks an "unsaved Song" state that Create/Save/Delete of a user set should flip.
- The exact mechanism by which the `/vdd` report should show a missing set id is a design suggestion, not checked against its CSS.
