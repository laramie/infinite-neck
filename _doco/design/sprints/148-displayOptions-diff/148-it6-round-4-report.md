# Sprint 148 (displayOptions-diff), Iteration 6, Round 4: report on NoteDisplaySizes precedence

date: 20261026

Answers [148-it6-round-4-design.md](148-it6-round-4-design.md).  Sprint overview: [sprint-148.md](sprint-148.md).  Background: [148-it6-round-2-implementation-report.md](148-it6-round-2-implementation-report.md).

**Status:** analysis only.  No code was changed.  All statements below come from reading the code; nothing was run in a browser.

"NoteDisplaySizes" here means the three things the key carries: `#dropDownCellWidth`, `#dropDownCellHeight` and the Note font size (`getNoteFontSize()` / `setNoteFontSize()`, module state in [key-handlers.js](../../../../key-handlers.js#L2071), not a DOM control).

## 1. Summary

1. Your requested order is sound, and it maps almost one-to-one onto a **"last writer wins at Song open"** model.  Read that way it needs very little code (section 5).
2. Two of your steps do not behave as the list assumes: step 1 (markup) runs only at page load, and step 2 (DEFAULTS) is a no-op for sizes because `NoteDisplaySizes` has no DEFAULTS entry.  Details in section 2.
3. **The Song-DEFAULTS value for sizes is currently dead code when Presentation Mode is off**, blocked in two places (the adapter gate in the resolver, and a second `presentationMode` test in `displayOptionsToControls`).
4. The biggest hole is **when** a Song-DEFAULTS size is applied: at Song open only, or at every Section navigation like every other key.  It decides whether Browser Scaling Prefs can sit above it (H2).
5. Browser Scaling Prefs are **not** re-applied when a Song is opened today (H3).  The requested order needs that new step.

## 2. Answer to your clarifying question (steps 1 and 2)

> Do `1.` and `2.` happen on loading a song from Library, File Open, or Song link, after having loaded a blank song on startup?

All three routes (File Open [infinite-neck.js](../../../../infinite-neck.js#L1972), Library and `?song=` via [`loadSong()`](../../../../infinite-neck.js#L2310)) funnel into [`openSong()`](../../../../infinite-neck.js#L2048), which calls [`updateAfterOpenSong()`](../../../../infinite-neck.js#L2126).

| Your step | Runs at page startup (blank Song) | Runs at Song open | Effect on sizes at Song open |
|---|---|---|---|
| 1. Markup (`<option selected>`: width 100px, height 30px; Note font size is the `DEFAULT_NOTE_FONT_SIZE` constant) | Yes, it is the page as parsed | **No.**  Nothing resets controls to the markup | None.  The controls keep whatever they hold (LIVE) |
| 2. DEFAULTS (`applyDisplayOptionDefaults()`, [L708](../../../../infinite-neck.js#L708)) | Yes (`appInit`) | **Yes**, early in `updateAfterOpenSong()` | **None.**  `NoteDisplaySizes` has no entry in `DISPLAY_OPTIONS_DEFAULTS` ([displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js#L20)), so the key is skipped |
| 4. Browser Scaling Prefs (`applyScalingPrefs(true)`, [L4893](../../../../infinite-neck.js#L4893)) | Yes, once, after the first `sectionChanged()` | **No** | None |

For a `?song=` link, `loadSongFromUrlQueryParam()` runs after `appInit`'s `Promise.all` ([L2250](../../../../infinite-neck.js#L2250)), so the blank-Song startup (steps 1, 2, 4) has already completed when the Song opens.  The blank Song is empty, so no "did you save?" prompt interrupts.

So after a blank Song and some fiddling, opening a Song today leaves the sizes exactly as the fiddling left them (unless Presentation Mode is on).  That matches your belief that LIVE wins when nothing stored applies.

## 3. How LIVE fits

LIVE is **not a tier**.  It is the set of controls themselves (`controlsToDisplayOptions()`, shown as the Matrix LIVE row).  Every stored tier is a *writer into* LIVE, and writes only at sync moments (Song open, Section navigation, Apply).  So "LIVE wins" always means one of two things:

- no tier wrote that key at the last sync (the key is absent from the `apply` result, or the resolver dropped it by R2), or
- the user edited the control after the last sync.

For sizes today the writers are: the Section cascade (only while Presentation Mode is on), `applyScalingPrefs()` (startup, mobile preset, the `#btnApplyScaling` button), and the user (dropdowns and the `moveSelectByClampedStep` key handlers).  Navigation never touches sizes when Presentation Mode is off, so a manual change sticks.

## 4. Precedence tables

Both tables are for the size controls and read **lowest to highest** (a later row overwrites an earlier one).

### Table 1: How it is now

| # | Source | When it writes | Condition | Notes |
|---|---|---|---|---|
| 1 | Page markup (`selected`) | Page load only | always | Never re-run on Song open |
| 2 | DEFAULTS | startup and every Song open | `NoteDisplaySizes` has no entry | **No-op for sizes** |
| 3 | Browser Scaling Prefs | startup (`appInit`), mobile preset ([L3970](../../../../infinite-neck.js#L3970)), `#btnApplyScaling` | prefs exist in localStorage | **Not** on Song open or navigation.  Also sets UI font size.  Fires `change` on both dropdowns (full repaint each) |
| 4 | LIVE edits by the user | any time | n/a | Sticks across navigation and Song open |
| 5 | Section cascade: last readable Section cell at or before the current Section | Song open, navigation, Apply | **`song.presentationMode` must be on** | Adapter gate in [displayOptionsGates.js](../../../../templates/display-options/displayOptionsGates.js#L14) makes the cell unreadable otherwise; `displayOptionsToControls` ([L3327](../../../../infinite-neck.js#L3327)) tests `presentationMode` again |
| 6 | Song-DEFAULTS cell (resolver tier under the Sections) | same events as 5 | same as 5 | **Dormant while Presentation Mode is off**: the resolver's R2 pass removes the key because the adapter blocks it.  While on, it applies like any other key (unconditionally, below Section cells) |

Rows 5 and 6 are one cascade (Section cell, else Song-DEFAULTS) listed separately only to show where Song-DEFAULTS sits.  Because row 5/6 writes last and only when Presentation Mode is on, **Presentation Mode already beats Scaling Prefs today, but only on the next sync**.  Prefs applied later by `#btnApplyScaling` beat it until then.

### Table 2: What we are proposing

For a Song open (File Open, Library, `?song=`), after any prior session state:

| # | Source | Condition | Notes |
|---|---|---|---|
| 0 | LIVE, carried over | always | Itself the result of page load (markup, then DEFAULTS no-op, then startup prefs) plus anything the user did.  Wins if nothing below writes |
| 1 | Song-DEFAULTS `NoteDisplaySizes` | block has the key, **regardless of Presentation Mode** | New.  Beats LIVE so the author's defaults are not defeated by leftovers |
| 2 | Browser Scaling Prefs | prefs exist | Beats Song-DEFAULTS; the author cannot override a user's stored preferences |
| 3 | Presentation Mode cascade: Section cells, then Song-DEFAULTS | `song.presentationMode` on **and** a value resolves | Beats Prefs.  If Presentation Mode is on but neither a Section cell nor Song-DEFAULTS stores sizes, nothing is written and row 2 or 0 stands |

Your "5." flow (DEFAULTS, then Song-DEFAULTS, then Sections) is row 3 and is already how the resolver works for every key.

What this means in plain terms:

- Presentation off, nothing stored anywhere: LIVE (unchanged from today).
- Presentation off, Song-DEFAULTS has sizes, no Prefs: Song-DEFAULTS (new).
- Presentation off, Song-DEFAULTS has sizes, Prefs exist: Prefs (new, see H3).
- Presentation on, any Section or Song-DEFAULTS size stored: that stored value, over Prefs.

## 5. Holes and decisions

### H1. The adapter gate must stop applying to the Song-DEFAULTS tier (needed, decide scope)

Song-DEFAULTS sizes are dead while Presentation Mode is off, in two places: the resolver's R2 pass (it deletes any adapter-blocked key from the `apply` result, including a `songDefault` entry) and the `if (getSong().presentationMode)` test in `displayOptionsToControls`.  Note that a Song can **already** hold a dormant Song-DEFAULTS `NoteDisplaySizes` today (Current-to-Song-DEFAULTS copies a stored Section cell and overrides every gate, adapter included, per D1).  Making it live needs no legacy handling, per the "no-legacy" policy.

Also affected, whatever the answer to H2: the Matrix Legend sentence and Inspect text for this key say it is off because Presentation Mode is off ([displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js#L312)).  These must say Song-DEFAULTS sizes are used at Song open regardless.

Decision: apply the exemption to **`NoteDisplaySizes` only**, not `sectionTheme` (which has the same adapter shape and a Song-level `theme` already).  *Recommend: NoteDisplaySizes only.*

### H2. Open-time only, or every navigation? (the main decision)

The resolver is a cascade: a tier writes at every sync, not only at open.  Your list says "on opening a song", but if Song-DEFAULTS sizes become an ordinary tier (as noteFont etc. are), then:

- Every Section change re-writes the Song-DEFAULTS sizes into LIVE.
- That **overwrites the user's Browser Scaling Prefs** applied at open (row 2 would lose on the first navigation) and the user's manual size changes (the `moveSelectByClampedStep` keys, `#btnApplyScaling`).  Today these stick when Presentation Mode is off.
- To keep "Prefs beat Song-DEFAULTS" you would then have to re-apply Prefs at every sync, and the user could no longer adjust sizes at all (any change reverts on the next Section).

| Option | Behavior | Cost |
|---|---|---|
| **A. Cascade tier** | Song-DEFAULTS sizes apply on every sync like other keys; Prefs re-applied after every sync; resolver learns about Prefs, or `syncSectionUi` does | Manual size changes revert on navigation whenever a Song-DEFAULTS or Prefs value exists; Prefs become a lock; repaint cost on every navigation |
| **B. Open-time initial value (recommended)** | One step in `updateAfterOpenSong()`, before the existing `sectionChanged()`: write Song-DEFAULTS sizes, then Prefs.  The existing `sectionChanged()` that follows applies the Presentation cascade last, which gives the Table 2 order by simple sequencing.  Navigation and Apply are unchanged | Sizes are the one key whose Song-DEFAULTS value is not re-applied by navigation or Apply while Presentation Mode is off; the Matrix must say so (Inspect: "applied when the Song opens") |

*Recommend B.*  It is exactly your "read and apply to UI on opening a song", needs **no change to the resolver or `displayOptionsToControls`** (when Presentation Mode is on, the existing cascade already includes Song-DEFAULTS), and keeps manual adjustments.  It changes nothing for Songs without sizes in Song-DEFAULTS.

### H3. Scaling Prefs are not re-applied on Song open (new step needed)

Table 2 row 2 requires a call on every Song open.  `applyScalingPrefs()` cannot simply be reused:

- It also sets the **UI font size** (not a Song property, so no tier conflict, but a reopened Song would reset a UI font the user changed in the blank session).  The `#btnApplyScaling` button does the same, so consistency favours applying the whole blob.
- It sets values then fires `change` on both dropdowns, each a `fullRepaint()` ([L4503](../../../../infinite-neck.js#L4503)).  At Song open, a silent write (value only, no `change`) is better, since `sectionChanged()` repaints right after; the same reason `displayOptionsToControls` takes `skipRepaint`.
- It reports to `#divScalingPrefs` unless `noSnark`.

Behavior change to accept: a user with saved Prefs who fiddles with sizes and then opens a Song loses the fiddling to the Prefs.  Today LIVE is kept.  This follows from your rule (LIVE wins only when nothing is stored in Song-DEFAULTS, Browser storage or Presentation Mode).

Decision: whole Prefs blob (UI font, Note font, width, height) *(recommended, same as the button)*, or only the three Song-visible sizes.

### H4. The two blobs are different shapes

- Song-DEFAULTS `NoteDisplaySizes` is one cell, `{width, height, NoteFontSize, caption}`.  It is all-or-nothing, so an author cannot set only the width.  `caption` is ignored when applying.
- Prefs hold `UIFontSize, NoteFontSize, CellWidth, CellHeight`.
- "Wins" is therefore per whole blob: Prefs replace all three sizes, never a mix.  (Same for the existing Section cells.)

Decision: accept whole-blob replacement.  *Recommend yes.*

### H5. Presentation Mode on but no stored value

"Presentation Mode always wins when true" holds only when a Section cell or Song-DEFAULTS size resolves.  If neither does, nothing is written and Prefs (or LIVE) remain.  Table 2 row 3 states this.  *Recommend leaving it so*; forcing Prefs out would make the Mode destructive for Songs that do not automate sizes.

Also unchanged and worth knowing: ticking `#cbPresentationMode` mid-session only sets the flag ([L4306](../../../../infinite-neck.js#L4306)); the sizes are applied on the next sync, not at the click.

### H6. A Song-DEFAULTS size that is not an option in the dropdown

`.val(String(width))` with a value not in the `<select>` leaves it with no selection (blank).  Today only hand-edited Sections can trigger this.  A hand-edited Song-DEFAULTS can too.  *Recommend:* skip a width or height that is not an option, and say so in the status line.

### H7. SaveDiff, `/vdd` and the Matrix

- `baseline` for SaveDiff already includes Song-DEFAULTS regardless of the adapter gate, and `NoteDisplaySizes` stays write-blocked by the adapter when Presentation Mode is off, so no Prefs value can leak into a Section while it is off.  With Presentation Mode on, Prefs lose to the cascade at open, so LIVE equals the stored value and SaveDiff stores nothing new.  No change needed.
- With Prefs winning over Song-DEFAULTS (Presentation off), the Matrix LIVE cell will differ from the Song-DEFAULTS cell.  That is correct, but Inspect should name the reason.  The resolver stays pure (it cannot see localStorage), so this would be a one-line note in the context supplied by `getDisplayOptionsMatrixContext()`, or just a Legend sentence.  *Recommend the Legend sentence.*
- `/vdd` is pinned by a golden file and does not show Song-DEFAULTS; unchanged.

### H8. Appending a Song

`updateAfterAppendSong()` takes Sections only; it never reads the appended Song's Song-DEFAULTS or Prefs.  Not affected.

## 6. Suggested implementation, if B is accepted

Top-level files that would change: [infinite-neck.js](../../../../infinite-neck.js) only (one new step in `updateAfterOpenSong()` plus a silent variant of the Prefs apply).  Not [Song.js](../../../../Song.js) or the resolver.  Pure helper candidates for Jest in `_tests/jest/`, following the non-browser pattern:

1. A pure function `pickOpenTimeSizes(songDefaultSizes, prefs, options)` returning `{width, height, NoteFontSize}` or `null`, covering the Table 2 rows 1 and 2 and the H6 option check.
2. Matrix Legend/Inspect wording for `NoteDisplaySizes` (text only).

Browser-only parts (not Jest): the sequence relative to `sectionChanged()`, the silent writes, the repaint, and recipes below.

## 7. Proposed browser recipes (if implemented)

31. Blank Song, set width 140, open a Song with Song-DEFAULTS sizes, Presentation off, no Prefs: sizes become the Song-DEFAULTS.  Navigate: they stay (B).
32. Same, with Prefs saved: Prefs win.  Clear Prefs, reopen: Song-DEFAULTS win.
33. Presentation on, Section 1 stores sizes: Section 1's value wins over Prefs and Song-DEFAULTS.  Navigate to a Section without a cell: the previous Section's value (cascade).
34. Presentation on, nothing stored: Prefs (or LIVE) remain.
35. Song without sizes in Song-DEFAULTS, Presentation off, no Prefs: LIVE kept across the open.
36. Open via File Open, Library and `?song=`: same result for each.

## 8. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| H1 | Exempt only `NoteDisplaySizes` from the adapter gate for the Song-DEFAULTS tier? | Yes, only that key |
| H2 | Open-time only (B) or cascade (A)? | B |
| H3 | Re-apply the whole Prefs blob on Song open, silently? | Yes |
| H4 | Whole-blob replacement for sizes? | Yes |
| H5 | Presentation on with no stored value leaves Prefs or LIVE alone? | Yes |
| H6 | Skip a size that is not a dropdown option? | Yes, with a status line |
| H7 | Legend sentence rather than new Inspect provenance for "overridden by Prefs"? | Yes |
