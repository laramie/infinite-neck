## Browser acceptance recipes (26-30)

Use a Song with several Sections.  Open the Matrix (`/vpmo`).

26. **Copy and mirror.**  On Section 2 SaveAll.  Press Current to Song-DEFAULTS.  Expect: the Song-DEFAULTS row shows the same values as Section 2; Section 2's cells are unchanged (white, since they repeat the inherited value); the status line says `Song-DEFAULTS wrote ...`.  Go to Section 3, change one control, SaveDiff, press Current to Song-DEFAULTS again: the row now equals Section 3's cells only (stale keys gone).

- RESULT: 


27. **Cascade.**  Clear Section 1's cells.  Press Apply on Section 1, then go to Section 3 and back: Section 1's controls come from Song-DEFAULTS.  Change a control in Section 4 and SaveDiff: only cells that differ from Song-DEFAULTS are stored.  A Section cell that now repeats Song-DEFAULTS is removed by the next SaveDiff.

- RESULT: 


28. **Clear and reload.**  Press Clear Song-DEFAULTS: the row is blank, the button greys out, controls return to DEFAULTS after Apply.  Press Current to Song-DEFAULTS, save the Song, reload it: the row is restored, and the file contains `displayOptionsDefault` (and no such field after Clear).

- RESULT: 


29. **Blocks are ignored.**  Put a cell r on a cell in Section 2, a Key r on `noteFont`, and Section w on Section 2.  Press Current to Song-DEFAULTS: every stored cell of Section 2 is copied, and the status line ends with `gated (overridden): ...` naming them.  `noteFont` is not applied while its Key r is on (dormant), and applies when the Key r is removed.  Clear Song-DEFAULTS removes gated keys as well.  No block was added or removed by either button.

- RESULT: 


30. **Old Songs and Undo.**  Open an old Song that uses the Section-1 idiom: its Song-DEFAULTS row is blank and it behaves exactly as before.  Do a Clear Section, then press either new button: Undo still undoes the Clear Section.  The buttons also work in a floating Matrix and with Auto-apply on or off (hint `Controls not re-applied: press Apply, or navigate.` when off).
