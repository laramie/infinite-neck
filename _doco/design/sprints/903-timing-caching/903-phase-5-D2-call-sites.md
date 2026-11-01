# Sprint 903 timing-caching — Phase 5 prep: `innerHTML`/`.html()` call-site inventory for Step D2

date: 20260831

## Purpose

[903-implementation-notes-ph4-6.md](903-implementation-notes-ph4-6.md) isolated the real dominant cost
on a NoteTable render-cache **hit** to the browser's `ParseHTML` work triggered by
[buildCellsFromSelector()](../../../../NoteTableController.js#L426)'s per-`<td>`
`obj.innerHTML = ...` assignment — one parse per matched cell, ~200+ times per table rebuild.

Before discussing **Step D2** (batch each table's markup into one write instead of one per cell), this
note catalogs *every* call site in the codebase that assigns HTML content into the DOM anywhere in the
NoteTable build/replay/playback code paths — not just the one hot-path call already identified — so we can
see the whole shape of the problem in one place and "stare at it" before deciding how much of Step D2's
scope is worth tackling at once.

No code was changed for this note. This is a research/inventory document only.

## Call-site inventory

Sorted by how often each one fires, hottest first. "Per rebuild" means once per `buildCellsForTable()`
invocation (which itself fires roughly 2-4 times per Section transition today, or once per `transpose()`/
`cycleThruKeys()` step).

| # | Call site | Frequency | Fires from |
|---|---|---|---|
| 1 | [NoteTableController.js:439](../../../../NoteTableController.js#L439) `obj.innerHTML = cachedHtml \|\| cellBuilder(...)` | **HOT.** Once per matched `<td>` per note-class spec (12 specs/table) — i.e. once per note cell in the table, every rebuild. ~200+ calls/table/rebuild for a typical multi-fret tuning. | [buildCellsFromSelector()](../../../../NoteTableController.js#L426), called from [buildCellsForTable()](../../../../infinite-neck.js#L1177) |
| 2 | [NoteTableController.js:990](../../../../NoteTableController.js#L990) `textdiv.html(finger)` | Once per note click, only when the active highlight style is `Fingering` (`STYLENUM_FINGERING`). Bounded by user clicks, not cell count. | [colorNoteInner()](../../../../NoteTableController.js#L514), called from `td.note` click handler |
| 3 | [NoteTableController.js:1243](../../../../NoteTableController.js#L1243) `textdiv.html(script.finger)` | Once per **previously-played/recorded fingered note** in the section being replayed — bounded by the section's recorded-note count, not total cells. Fires once per rebuild (inside the `tablearr.forEach` loop). | [replayTable()](../../../../NoteTableController.js#L1119), called from `replay()` |
| 4 | [NoteTableController.js:1538](../../../../NoteTableController.js#L1538) `.html(note.finger)` | Once per recorded fingered note **for the current beat only** — fires on every beat tick during playback, but the per-call count is bounded by however many fingered notes are recorded on that specific beat (usually 0-2). | [showHighlightsForBeatForOptions()](../../../../NoteTableController.js#L1452), the per-beat playback highlight path |
| 5 | [NoteTableController.js:510](../../../../NoteTableController.js#L510) `$('#'+res.tableID+'_captionRowTonalInfo').html(tonalPickerSet)` | Once per note click (rebuilds the tonal-picker caption row for the clicked table only). | [colorNote()](../../../../NoteTableController.js#L477) |
| 6 | [NoteTableController.js:1130](../../../../NoteTableController.js#L1130) `$('#'+...+'_captionRowTonalInfo').html(tonalPickerSet)` | Once per `replay()` call, but only for `ReplayOptions.Type.SELF` tables (not RELATIVE/observer tables). One call, not per-cell. | [replayTable()](../../../../NoteTableController.js#L1119) |
| 7 | [NoteTableController.js:1139](../../../../NoteTableController.js#L1139), [1140](../../../../NoteTableController.js#L1140) `$('#relSec1_'+...).html(...)`, `$('#relSec2_'+...).html(...)` | Two calls per `replay()` per table (both fire unconditionally, regardless of replay type) — small, single-element writes (a section-number badge), not per-cell. | [replayTable()](../../../../NoteTableController.js#L1119) |
| 8 | [TableBuilder.js:113](../../../../TableBuilder.js#L113) `cell.html("" + noteName)` | Once per cell, but only during **initial table structure construction** — i.e. when a table/instrument is first built or its visibility changes, not on every Section/key/transpose rebuild. Out of scope for the hot loop, but technically the same "innerHTML per cell" pattern. | `buildFretTable()`/table structural builder |
| 9 | [TableBuilder.js:127](../../../../TableBuilder.js#L127) `colorArea.html(noteName)` | Once per column, only for tables with a piano-skeuomorphic names row (`doNamesRow`), only at structural build time. | same as #8 |
| 10 | [TableBuilder.js:182](../../../../TableBuilder.js#L182) `divWiring.html("Wiring for ...")`, [TableBuilder.js:206](../../../../TableBuilder.js#L206) `fretTableLeftCaption.html(options.baseID)` | Once per table, structural build time only (static placeholder/caption text). | same as #8 |

**Not table-related** (found by the same search, listed for completeness / to rule out): the many
`.html(...)` calls in [infinite-neck.js](../../../../infinite-neck.js) around lines 226, 714, 793-846,
931-983 are all small-scale-widget/label updates (BPM display, dropdown labels, section caption, key name
labels) — single-element writes, not part of the per-cell NoteTable rebuild loop. Same for
[themeFunctions.js](../../../../themeFunctions.js), [Messages.js](../../../../Messages.js), and
[UserLog.js](../../../../UserLog.js) — unrelated subsystems (theming, message log, user-action log).

## What the hot-path (#1) content actually looks like

`cellBuilder()`'s output — the string assigned into every `<td>`'s `innerHTML` on a rebuild — was captured
directly (pure function, no browser needed) for a representative cell:

```js
cellBuilder('C', '&nbsp;', 3, {
  rootID: 0, rootIDLead: -1, showCellNotes: true, cellIsFunction: false,
  showSubscriptFunctions: true, useCenterForRightFunction: false, showMidiNum: true
}, '60')
```

produces (778 characters):

```html
<div class='NoteDisplay'><div class='universalNamedNote'><span class='midinumDisplayNamedNote'>60</span><div class='CenterCell'><div class='tinyscriptR'><span class='enharmonicName'>C<small>&nbsp;</small></span></div><span class='tinyscriptL'>C</span></div></div><div class='tinyNote'>C</div><div class='singleNote'><span class='midinumDisplay'>60</span><div class='CenterCell'><div class='tinyscriptR'><span class='enharmonicName'>C<small>&nbsp;</small></span></div><span class='tinyscriptL'>C</span></div></div><div class='Fingering'>1</div><div class='namedNote'><span class='midinumDisplayNamedNote'>60</span><div class='CenterCell'><div class='tinyscriptR'><span class='enharmonicName'>C<small>&nbsp;</small></span></div><span class='tinyscriptL'>C</span></div></div></div>
```

With `showMidiNum: false` (the cached `__default` variant), the string is the same shape minus the two
`midinumDisplay*` span contents (772 characters — essentially identical size). **Every cell's HTML is this
same ~770-800 character nested-`<div>`/`<span>` fragment**, differing only in the text content of a handful
of leaf nodes (`C`, `&nbsp;`, the midi number, the fingering digit). This is consistent with the ~119µs
average `ParseHTML` cost measured per call in the phase 4-6 trace — the browser is re-parsing this same
~800-byte fragment shape independently, once per cell, every rebuild.

## Instrumentation gap: no call site currently logs the actual HTML string

`dumpNoteTableTiming()` ([infinite-neck.js:1273](../../../../infinite-neck.js#L1273)) logs
`durationMs`/`cacheState`/`renderCacheKeyHash`/etc. — never the HTML content itself — and it logs once per
**table** per rebuild, not once per **cell**. There is currently no way to see, from an existing console
capture, the literal string fed into any individual `obj.innerHTML = ...` call. The samples above were
generated directly from `cellBuilder()` in isolation (via `node -e "import('./NoteTableController.js')..."`)
rather than pulled from a live capture, since no log statement currently exists at that call site.

If real per-call log lines (not just synthetic samples) are wanted for pattern-recognition/sorting across
many different cells/keys/tunings in one session, that would require adding a temporary `console.debug`
(or similar) at [NoteTableController.js:439](../../../../NoteTableController.js#L439) logging
`{tableID: obj.getAttribute('celltable'), cellcol, midinum, htmlLength: cachedHtml/builtHtml.length}` (and
optionally the string itself, though that would be extremely verbose at ~200 lines per table per rebuild) —
not added here since it wasn't explicitly requested and would need to be removed again before checkin.

## Observations for further staring

- Every hot-path write (#1) produces content of essentially uniform *shape* and *size* regardless of which
  specific note/key is being rendered — only a handful of leaf-text values change per cell. This is exactly
  the kind of repetitive structure a single batched-string build (Step D2's proposal) would collapse into
  one `ParseHTML` call instead of N.
- Items #2-4 and #6-7 are already naturally bounded (per-click, per-recorded-note, per-beat) and are not
  contributing to the "hiccup" this sprint has been chasing — they don't need to be in scope for Step D2.
- Items #8-10 (TableBuilder.js) are a *different* per-cell `innerHTML`/`.html()` pattern than #1, but they
  only run once per table's structural lifetime (creation/visibility change), not per Section/key change —
  almost certainly not worth touching as part of this sprint's "repeated rebuild" performance goal, but
  worth knowing they exist since they look superficially similar in a code search.
