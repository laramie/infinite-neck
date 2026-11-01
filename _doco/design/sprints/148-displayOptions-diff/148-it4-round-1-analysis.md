# Sprint 148 (displayOptions-diff), Iteration 4, Round 1: effect of the DisplayOptionsMatrix on SaveDiff / SaveAll

date: 20261017

Requested by [148-design.md](148-design.md), section "Iteration 4", sub-section "Iteration 4 Round 1 Request".  Baseline plan: [148-it2-analysis.md](148-it2-analysis.md) (which builds on [148-it1-analysis.md](148-it1-analysis.md)).  Iteration 3 is committed and accepted.  Sprint overview: [sprint-148.md](sprint-148.md).

No code was changed.  This report lists only what changes in the Iteration 2 plan, and the new questions.  Anything not mentioned stays as Iteration 2 said (section 1 lists it).

Vocabulary used here: **cell** = one DisplayOption key in one Section.  **SaveDiff** = the normal Save.  **SaveAll** = the heavy full Save (today's button).  **DisplayOptionsTable** = `/vdd`.  **Matrix** = the future interactive table.

## 0. Summary

1. The Matrix does not break the Iteration 2 plan, but it changes what the primitives must look like.  If we build SaveDiff exactly as Iteration 2 described (a function that returns a new block), the Matrix would need a second, parallel implementation of every rule.  Build instead one small engine that all of them share (section 3, C3).
2. The big change: **gates are per cell and per column, not per Song-level checkbox**.  AllowRead and AllowWrite are the generalization of `cbPresentationMode`, `cbAllowThemeAutomation` and the proposed "Allow AutoColor Automation".  They must be stored **beside** the value blocks, not inside them (C1), otherwise empty-diff deletion, CLEAR, compaction and `/vdd` all destroy them.
3. The resolver must report **where each value came from** and apply the read gates (C2).  This also corrects one line of Iteration 2: keys that are absent or read-blocked must be completed from the **live controls**, not from `DISPLAY_OPTIONS_DEFAULTS`, or the current Section and its prewarm disagree with what is on screen.
4. SaveDiff and SaveAll become "plans" over a cell selection (C3).  Row-Clear, column-Clear, Apply and the single-cell "Store" tool are the same engine with a different selection.  That is the only way the Matrix stays cheap.
5. The `null` tombstone is no longer needed in Iteration 4; AllowRead covers the loop-wrap case that motivated it (C4).
6. The Matrix proposal is sound.  Concerns worth settling now: how four hatch layers compose in CSS, the ambiguous meaning of "hatched", and the Apply column (section 2).
7. Thirteen new questions (section 6).  Most have a recommendation; Q1, Q2, Q4 and Q8 change stored data and should be answered before the implementation plan.

## 1. What does NOT change from Iteration 2

- Static `DISPLAY_OPTIONS_DEFAULTS`, used to initialize controls (answer 1).
- `NoteDisplaySizes` compared and written as one unit; `functionSymbols` is one id string.
- An empty result deletes the block (answer 4), now with the caveat in C1 that gates are not in the block.
- The cascade is a key-wise merge of blocks 0..k, and the apply side is **sparse** (it2 2.2(a)): only keys that are present are pushed to the controls.
- `c` and `y` click the real checkboxes and write nothing to the Model.
- Compaction tool (`bin/`), `songs/tests/` fixtures stay as full-block regression files.
- "DELETE the Section automation, set the changes, hit SaveDiff" remains the supported workflow.  The Matrix is a convenience on top of the same Model, as you said.

## 2. Evaluation of the proposed Matrix

### 2.1 What works well

- Rows = Sections, columns = DisplayOptions is the shape the Model already has.  DEFAULT and LIVE rows are cheap: DEFAULT is the static object; LIVE is `controlsToDisplayOptions()` ([infinite-neck.js](../../../../infinite-neck.js#L3399)), which already is the "source of truth for not-yet-saved options".  LIVE can refresh from two existing hook points: the end of `syncSectionUi()` and `refreshDisplayOptionsSaveActionRequired()`.
- There is a working precedent for the widget: the Theme Matrix ([themes.builder.js](../../../../templates/themes.builder.js#L276-L295)) uses delegated `td` clicks with `data-section-index` attributes, re-renders on the `SectionChanged` event, and navigates when the Section cell is clicked.  So "navigate by clicking the Section number" is not squirrelly: it is the same call as pressing next Section, which already re-applies stored values over live edits (and the existing dirty highlight already warns about that).
- Tool radio buttons as a safety are a good fit.  See 2.3 for a way to make them simpler.
- The Matrix gives a natural home for "SaveAll", as you suggested.

### 2.2 Concerns

**a. Four hatch layers on one `td`.**  AllowRead column (blue up), AllowRead cell (blue down), AllowWrite column (orange up), AllowWrite cell (orange down), plus the background colors (green, gray, current Section).  Plain CSS classes that each set `background-image` override one another.  A composable approach: one base rule `background-image: var(--hRC, none), var(--hRW, none), var(--hWC, none), var(--hWW, none);` where each class sets only its own variable (`repeating-linear-gradient(45deg, ...)` with a different period or offset per layer, as you described).  Note: a `var()` without a fallback makes the whole declaration invalid, so each variable needs a transparent-gradient fallback.  Not tested in a browser (section 8).

**b. "Hatched" is ambiguous.**  The text says the hatch shows "AllowRead is in effect, implying these cells will be allowed to be read", while the Hide\* example says "setting `AllowRead:false`" to protect them.  Same picture, opposite polarity.  Q1.

**c. Column click: bulk-set or a stored flag?**  "Applied to all cells in this column" reads as a bulk-set, but then the up-slope and down-slope hatches could not be told apart after the fact, and a Section added later would not be covered.  A Song-level **column flag** plus per-cell flags fits both the picture and the use-cases (Q1).

**d. Special rows consume space.**  Header (vertical labels) plus DEFAULT, LIVE, AllowRead, AllowWrite, Clear is six rows before the first Section, over about 37 columns; the biggest song in `songs/` has 46 Sections with blocks.  Make the header and special rows sticky, and consider column **groups** (Hiding x4, Opacity x3, Fonts, Piano, Tiny notes, Automation).  Your Hide\* use-case then becomes one click on a group header instead of four.  Cheap if the static column metadata carries `group` from day one (C6).

**e. Apply is ambiguous.**  "Applies this row's Section DisplayOptions to the Current Section" could mean: (1) push that Section's resolved values into the live controls (non-destructive; then the User presses SaveDiff), or (2) copy that Section's block into the current Section's block (a write, subject to AllowWrite).  Q7.

**f. Keep the table and the Matrix one codebase.**  `/vdd` should not drift from the Matrix.  Build a pure **cell view-model** (`{sectionIdx, key, text, state: 'stored'|'inherited'|'absent'|'changed', readGate, writeGate, columnGate}`) and let both renderers consume it.  It is testable in Jest without a DOM, which is our preference.  Today `/vdd` colors "differs from previous block"; the view-model compares against the resolved cascade instead.

### 2.3 One simplification to consider

Your three control levels (single cell, special row cell, row/column special cells) can be one rule: **the Tool is the verb, the clicked zone is the scope.**

| Verb (Tool) | cell | Section row (special col) | column (special row) | group header |
|---|---|---|---|---|
| Inspect (default, no change) | show details | navigate | show details | - |
| Read gate | toggle cell flag | all keys in the Section | toggle Song column flag | toggle all columns in group |
| Write gate | toggle cell flag | all keys in the Section | toggle Song column flag | same |
| Store | write live value | - | - | - |
| Clear | clear one cell | clear the Section's cells | clear the column in all Sections | same |
| Apply | - | push to live controls | - | - |

A default "Inspect" tool means opening the Matrix can never change data by accident.  Each verb x scope is a **selection of cells** handed to one engine (C3), so the Matrix needs no new Model code beyond what SaveDiff already needs.

## 3. Changes to the plan

Each item: what Iteration 2 said, what it should say now, and why.

### C1. Gates are per cell and per column, stored beside the blocks (supersedes it2 2.2(b) and 2.2(c))

- **It2:** three Song-scope checkboxes (Presentation Mode, Allow Theme Automation, a new Allow AutoColor Automation) gate whole keys; SaveDiff preserves stored keys behind a closed gate.
- **Now:** one general mechanism, two levels.
  - **Column gate** (Song level, applies to every Section, including Sections added later): `song.displayOptionGates = { read: { <key>: false }, write: { <key>: false } }`.
  - **Cell gate** (one Section x one key): `section.displayOptionGates = { read: {...}, write: {...} }`.
  - Both are sparse; an absent entry means "the key's default" (C6).  Values are booleans, so a later `true` override (Q2) needs no format change.
- **Why not inside `section.displayOptions`:**
  1. An empty diff deletes the block, which would delete the gates.
  2. `btnDeleteDisplayOptions` does `delete section.displayOptions` ([infinite-neck.js](../../../../infinite-neck.js#L3666)); gates are protection against exactly this.
  3. The `bin/` compaction strips keys that are not DisplayOptions (it1 section 5); gates would be stripped.
  4. A read gate on a cell with no stored value is meaningful (it blocks an inherited value), so the gate cannot live only where a value exists.
  5. The block stays atomic and terse, which you liked about `functionSymbols`.
- **Existing checkboxes become views of column gates:** `cbPresentationMode` is the column gate for `NoteDisplaySizes`, `cbAllowThemeAutomation` for `sectionTheme`, and the proposed AutoColor checkbox for `autoColor`, `autoColorHighlight` and `currentColorDict`.  Recommendation: keep `song.presentationMode` and `song.allowThemeAutomation` as the stored fields and let the gate functions read them through a small adapter (Q6), so Iteration 4 does not need a data migration or touch the API `setPresentationMode` ([infinite-neck.js](../../../../infinite-neck.js#L457)).
- Persistence follows the Iteration 3 precedent: normalize on load in [SongPersistence.js](../../../../SongPersistence.js) (drop unknown keys and non-booleans), omit when empty, add to [bin/song-file-schema.js](../../../../bin/song-file-schema.js).
- Existing Songs have no gates, so nothing changes for them except what Iteration 2 already decided for AutoColor (Q5).

### C2. One resolver, with provenance and purpose (changes it1 4.4 and corrects it2 2.2(a))

- **It1/It2:** return a fresh merged object, `defaults <- block[0] <- ... <- block[k]`; DEFAULTS also complete render options.
- **Now:** `resolveDisplayOptions(song, sectionIdx, { purpose })` returns, per key, `{ value, source: 'section'|'default'|'live', fromSection, readable }`, plus `.toOptions()` for callers that want a flat object.
  - `purpose: 'apply'`: only readable keys that have a value.  Feeds the sparse `displayOptionsToControls()`.
  - `purpose: 'render'`: readable stored values; everything else from the **live controls**.
  - `purpose: 'baseline'`: what SaveDiff compares against (blocks 0..k-1, readable cells only).
- **Why it matters (correction to it2 2.2(a)):** today two completion sources already disagree.  [NoteTableController.js](../../../../NoteTableController.js#L1221) completes with the live controls; the prewarm path [`buildRenderOptionsForSection`](../../../../infinite-neck.js#L1348) completes with a startup snapshot.  With sparse apply, a key that is absent (or read-blocked) leaves the live control alone, so a macro that hid NamedNotes shows hidden on screen while a DEFAULTS-completed render says "visible".  Completing from LIVE keeps render, prewarm and screen consistent, and a mismatch in prewarm costs only a render-cache miss.  DEFAULTS stays for initializing controls at startup and Song open.
- The provenance is also exactly what the Matrix needs for "green = changed in the cascade" and "gray = absent".

### C3. SaveDiff, SaveAll, Clear and Apply are plans over a cell selection (changes it1 4.2)

- **It1:** `computeDisplayOptionsDiff()` returns the new block and the handler assigns it.
- **Now:** a pure `planDisplayOptionsOps(model, selection, verb, liveOptions)` returns a list of `{ sectionIdx, key, op: 'set'|'delete'|'keep', reason }`.  A second function applies the plan and records an undo snapshot (C8).  Reasons (`gated-write`, `gated-read`, `equals-baseline`, `changed`, `released`) feed the Messages output ("keys written", it2 3.1) and later a Matrix "preview".
- Selections: `{current} x all keys` is SaveDiff/SaveAll/Clear-current; `{j} x all keys` is row operations; `all x {K}` is column operations; `{j} x {K}` is the single-cell tool.
- Verbs: `store-if-differs` (SaveDiff), `store` (SaveAll and the Matrix "Store" tool), `clear`.  Apply is the only verb that is not a write (it pushes to controls).
- **Write rule for bulk operations** (SaveDiff, SaveAll, Clear row/column/current): a cell is touched only if `writeAllowed` and `readAllowed`; otherwise the plan says `keep` and the existing value is preserved untouched.  Explicit single-cell "Store" and "Clear" follow only `writeAllowed`.  Reason for requiring read: a value that cannot be read is not automation, and writing it plants a value that springs to life when the gate is later reopened, which is the bug this sprint is meant to remove.  Q4.
- SaveDiff for a writable cell: `store` if the live value differs from the baseline, `delete` the cell value if it equals the baseline (so un-doing a change prunes the key), otherwise `keep`.
- SaveAll: `store` every writable, readable key (so it still honors the opt-in gates, as it2 answer 5 asked).
- The block is empty after the plan and has no preserved keys: delete the block, never the gates.

### C4. The `null` tombstone is dropped from the write side (changes it2 answer 2)

- The tombstone existed to release AutoColor from Section 5 onward.  It did not cover the loop wrap (it2 Case 2), which is why we added the Song gate.  AllowRead now covers both cases: a column flag for the whole Song, cell flags for a few Sections.
- Iteration 4: SaveDiff and SaveAll never write `null`.  The resolver treats a stored `null` as "stop inheriting here" (two lines), reserving the format for the future "Allow Inherit Cascade" Matrix tool.
- This removes the third cell state (absent / `null` / value) from the Iteration 4 test matrix.  Your open point "how Clear interacts with empty/null/tombstone": Clear removes the cell value (absent).  It is not the same as a read gate: Clear is destructive and permanent; AllowRead is non-destructive and reversible.  Both end with "not automated", which is the HideNamedNotes case.

### C5. SaveDiff is the normal button, SaveAll the special one (changes it1 4.5 and it2 answer 5)

- Iteration 1 placed a new `...Diff_View` button next to the old one.  If SaveDiff is the normal action, the *old ids and names* (`btnControlsToDisplayOptions_View`/`_Section`, `handleBtnControlsToDisplayOptions`, menu action `saveViewDisplayOptions`, the dirty highlight at [infinite-neck.js](../../../../infinite-neck.js#L707)) would point at the heavy one.  Under the "fix everything" policy: rename by role in one pass (Q9).
- The dirty highlight (`riskyButtonActionRequired`) belongs on SaveDiff only.
- SaveAll leaves the Section drawer (its buttons are one letter) and stays on the View page as a small secondary button with a confirmation, plus a command-menu entry, until the Matrix can host it.  You said it may later live only in the Matrix; the engine in C3 means moving it costs nothing.
- The existing CLEAR (`btnDeleteDisplayOptions_*`, `handleBtnDeleteDisplayOptions`) becomes the `clear` verb over `{current} x all keys`, so it preserves write-protected cells.  This also answers it2 3.1 gap 3 (the CLEAR-then-SaveDiff trap) with a rule instead of a warning.

### C6. Static column metadata replaces "keys of the live controls" (new)

- [display-options.js](../../../../display-options.js#L21) takes its column list from `controlsToDisplayOptions()`.  That function emits `sectionTheme` only while `allowThemeAutomation` is on ([infinite-neck.js](../../../../infinite-neck.js#L3449)), so `/vdd` silently hides a stored (suspended) theme column.  The Matrix needs every column all the time.
- Add `DISPLAY_OPTION_META` next to `DISPLAY_OPTIONS_DEFAULTS`: per key `{ default, group, order, atomic, readDefault, writeDefault, normalize }`.  For ordinary keys `readDefault = writeDefault = true`; for the opt-in keys (`autoColor`, `autoColorHighlight`, `currentColorDict`, `NoteDisplaySizes`, `sectionTheme`) both default to false, which is exactly the "written only when explicitly enabled" rule from it1 3.4.
- A Jest test pins the metadata against `controlsToDisplayOptions()` keys so they cannot drift.
- This also supplies the string-versus-number normalization of it1 3.6 and the group list for 2.2(d).

### C7. LIVE and the render path are separate from the Save snapshot (small, new)

- `controlsToDisplayOptions()` stays the single live reader.  Add `readLiveDisplayOptions()` as the documented name if we want to stop overloading "controls to display options" for both Save and display; otherwise leave it.  Not required.
- Add an `EventBus` event, for example `DisplayOptionsModel:changed`, triggered after every plan application, gate change, Section change and Song open.  The Matrix, `showHideDisplayOptionsPresent()`, the Theme Matrix refresh and the read-only value spans listen to it instead of each call site refreshing its own copy (today `handleBtnControlsToDisplayOptions` calls several by hand).

### C8. Undo snapshot is now required, not optional (changes it2 3.1 mitigation, Q10)

- Column-Clear and row-Clear are destructive across many Sections, and SaveAll can rewrite a Section.  Before each applied plan, store one snapshot `{ blocks: [section.displayOptions ...], gates }` (plain JSON; the Song-level and Section-level gates together).  Restoring is a pure function, easily tested.
- A visible Undo button can wait for the Matrix; the primitive cannot.

### C9. Structural operations and gates (adds to it2 3.4 and Q9)

- Move, delete, deep clone and import change which blocks precede a Section.  Iteration 2 proposed "resolved state is truth, blocks are the encoding".  Gates add two rules:
  1. Cell gates travel with their Section on move; column gates stay on the Song.
  2. Re-encoding after a structural change is **not** a Save: it must be allowed to rewrite write-protected cells, since otherwise the structural operation cannot preserve the resolved state.  Alternative: refuse to move or delete when a write-protected cell would have to change.  Q8.
- Deep clone copies cell gates.  Shallow clone drops the block (inherits) and, recommended, still copies gates; the gates express intent about that musical position, and a clone is usually adjacent.  Minor; Q11.

## 4. Primitives to build in Iteration 4 (and who uses them)

| Primitive | SaveDiff / SaveAll / Clear | Matrix later |
|---|---|---|
| `DISPLAY_OPTIONS_DEFAULTS`, `DISPLAY_OPTION_META` (C6) | baseline, gate defaults, compare | columns, groups, DEFAULT row |
| `isReadAllowed(song, idx, key)`, `isWriteAllowed(...)` (adapter for presentationMode / allowThemeAutomation) | filter | hatch rendering |
| `setColumnGate`, `setCellGate` | AutoColor checkbox, existing two checkboxes | special rows, cell tools |
| `resolveDisplayOptions(song, idx, {purpose})` with provenance (C2) | apply, baseline, render | green/gray/inherited |
| `planDisplayOptionsOps(...)`, `applyPlan(...)` (C3) | all three buttons | every tool |
| Undo snapshot and restore (C8) | before each plan | Undo button |
| `DisplayOptionsModel:changed` event (C7) | readouts | re-render, LIVE row |
| Cell view-model (2.2f) | `/vdd` | the grid |

Everything above is a pure function over a headless `Song`, so Jest covers it with the existing non-browser pattern ([display-options.test.js](../../../../_tests/jest/display-options.test.js)): read-blocked cell is transparent, write-blocked cell survives SaveDiff/SaveAll/Clear, column gate with a later-added Section, idempotent SaveDiff, empty plan deletes the block but not the gates, undo round trip.

## 5. Impact on SaveDiff / SaveAll design, in one table

| Topic | Iteration 2 | Iteration 4 round 1 |
|---|---|---|
| Gate granularity | Song-level checkbox per automation | Song column flag + Section cell flag, per key |
| Gate storage | Song fields | `song.displayOptionGates`, `section.displayOptionGates`, with an adapter for the two existing Song fields |
| Closed-gate behavior on save | key preserved | cell `keep`; same rule extends to AllowWrite |
| Release of automation | `null` tombstone | AllowRead (column or cell); tombstone reserved, not written |
| Cascade return value | merged object | per-key provenance + `.toOptions()` |
| Completion of absent keys when rendering | DEFAULTS | live controls (DEFAULTS only to initialize) |
| Writer | returns a block | returns a plan; applied with an undo snapshot |
| Buttons | Save (kept) + Save Diff (new) | SaveDiff normal; SaveAll secondary with confirm; Drawer has SaveDiff only |
| CLEAR | deletes block | `clear` verb; keeps write-protected cells |
| Report columns | keys of live controls | static metadata (shows suspended `sectionTheme`) |

## 6. New questions

**Q1. What does "hatched" mean, and is the column click a stored flag?**  Recommendation: hatch = "this gate has been explicitly set to the non-default (denied)" for both read and write.  The special-row click sets a **Song-level column flag** (also covers Sections added later); a Section-cell click sets a cell flag; the two use the up and down slopes as you described.

**Q2. How do column and cell gates combine?**  Recommendation: store booleans at both levels, evaluate **deny wins** (read allowed = column not `false` and cell not `false`).  Limitation to accept: for a default-closed key such as `autoColor` you cannot open it for one Section only.  If you want that ("AutoColor automated in Section 3 only"), evaluation becomes "cell value overrides column"; the stored format already allows it, so this is a rule change, not a migration.

**Q3. What does a read-blocked cell do for later Sections?**  Recommendation: it is transparent: at that Section the key is not applied (neither its own nor inherited value), and later Sections inherit as if the cell were absent.  Alternative: a barrier that also stops inheritance forward (that is the tombstone, C4).

**Q4. Does "read-blocked" imply "not written by bulk Save"?**  Your Hide\* example says "set AllowRead false and optionally AllowWrite false".  Recommendation: bulk operations (SaveDiff, SaveAll, Clear row/column) skip a cell unless it is both readable and writable (C3), so "optionally" becomes "never needed for that case", and AllowWrite:false is reserved for "apply the stored value, but protect it from re-saving" (a hand-authored size in Section 1).  The explicit single-cell Store tool is the intentional override.  If you prefer fully independent flags, the engine changes by one condition but the macro-capture hazard (it2 3.1 gap 1) returns.

**Q5. Gate defaults for existing Songs.**  Carried from it2 Q7 (unanswered).  Recommendation: default-closed for the opt-in keys in new Songs; for existing Songs, the compaction/migration tool opens the AutoColor column for Songs that store `autoColor`, `autoColorHighlight` or `currentColorDict` and reports them, as it2 proposed.

**Q6. Migrate `presentationMode` and `allowThemeAutomation` into the gate structure, or adapt?**  Recommendation: adapt in Iteration 4 (no data change, API untouched), and unify in a clean-up sprint.  Migrating now touches the macro API and about a dozen call sites for no user-visible gain.

**Q7. Meaning of the Matrix Apply column.**  Recommendation: push that Section's resolved values to the live controls (verb "Apply", non-destructive), then SaveDiff commits if wanted.  Writing the block copy is already doable with Store on a row.

**Q8. Do Clear and structural operations honor AllowWrite?**  Recommendation: Clear (cell, row, column, and the existing CLEAR button) honors it; move, delete, clone and import do not (they re-encode, C9), and report if a protected cell had to change.

**Q9. Names.**  Recommendation: one-time rename by role, for example `btnSaveDiff_View` / `btnSaveDiff_Section` / `btnSaveAll_View`, handlers `handleBtnSaveDiff` / `handleBtnSaveAll`, menu actions `saveViewDisplayOptions` (SaveDiff) and `saveViewDisplayOptionsAll`.  The affected sites were listed in it1 4.5 (including the `key-handlers` mock in the Jest tests).  Alternative: keep the old ids for SaveDiff and name only SaveAll anew, which is less churn but makes the ids lie about history.

**Q10. Undo (C8).**  Primitive only in Iteration 4, or also a visible button?

**Q11. Section clone and gates.**  Recommendation: both clones copy cell gates; the shallow clone still drops the value block.

**Q12. Group header cells in the Matrix.**  Worth reserving `group` in the metadata now (C6) even if the Matrix ships later.  Confirm or drop.

**Q13. Unanswered questions carried from Iteration 2 section 4.**  Iteration 4 text did not answer them.  Unless you object I will assume: 6 (sparse apply) accepted; 7 superseded by C1 and Q5; 8 (reset non-automated controls to DEFAULTS on Song open) **still needed**, because sparse apply would otherwise leak live toggles between Songs; recommendation: reset everything except `autoColor` and `autoColorHighlight` (a per-session preference); 9 (resolved state is truth) accepted with the two rules in C9; 10 answered by C3 (keys-written report) and C8 (undo).

## 7. Suggested scope for the implementation plan (Round 2)

In scope: metadata and defaults, gate storage and persistence, resolver, plan engine, undo snapshot, SaveDiff and SaveAll buttons with renames, the three Song-level checkboxes (two existing, one new) as column-gate views, `/vdd` with static columns and gate marks, compaction/migration tool, `help.html`, Jest.  Not in scope: the Matrix itself and its tools, group headers, a visible Undo.  Top-level files that will need the explicit go-ahead: [infinite-neck.js](../../../../infinite-neck.js), [Song.js](../../../../Song.js), [Section.js](../../../../Section.js), [SongPersistence.js](../../../../SongPersistence.js), [NoteTableController.js](../../../../NoteTableController.js), [index.html](../../../../index.html), [display-options.js](../../../../display-options.js), [menu.js](../../../../menu.js), [key-handlers.js](../../../../key-handlers.js), [templates/section-drawer.html](../../../../templates/section-drawer.html).

## 8. Not verified

- The CSS composition of four hatch layers (2.2a) is from CSS rules, not a browser run.
- I did not count the largest number of Sections in any Song; the only figure used is 46 Sections with blocks (from it1).
- I did not check how many call sites would need the renames in Q9 beyond the list in it1 4.5.
- Whether the `NoteTableController` relative replay should resolve for the current Section or the relative Section: it passes `getCurrentSection()` today ([L1223](../../../../NoteTableController.js#L1223)); I left it unchanged.
