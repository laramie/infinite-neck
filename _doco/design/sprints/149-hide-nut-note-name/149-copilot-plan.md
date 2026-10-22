Don't add it as a parallel to the four HIDE checkboxes. Model it on **Show All Note Names** instead, using a CSS-only toggle.

**Why the nut shows names**

- Every note cell contains a `.namedNote` lane holding the note text. Normal cells get `.noteWhiteKey` or `.noteBlackKey`, which set `color: transparent` (infinite-neck.css).
- The nut cells are deliberately excluded from those classes (NoteTableController.js), so their text stays visible as the open-string label.
- `replay()` also keeps that behaviour when `hideNamedNotes` is on: "Keep baseline lane text (especially nut labels) visible" (NoteTableController.js). `hideNamedNotes` therefore cannot hide the nut label without changing that branch.

**Why not a HIDE sibling**

The HIDE checkboxes share one `change` handler (infinite-neck.js). It calls `turnOnKeep()`, shows `#lblHideWarning`, and runs `clearAll()` and `replay()`.

They are also wired into several other places:
- the `hideKeys` list in infinite-neck.js
- `HIDE_KEY_FOR_NOTE_TYPE` in displayOptionsMeta.js
- presentation.js
- the unhide logic in key-handlers.js

A new sibling would either inherit the Keep and replay side effects or need exemptions from each of those places.

**Recommended approach**

1. Add a CSS rule that hides only the baseline label, leaving placed named notes visible:
   ```css
   body.HideNutNames td.nut .namedNote:not(.NamedNoteActive),
   body.HideNutNames td.nutR .namedNote:not(.NamedNoteActive) { color: transparent; }
   ```
   piano-skeuomorphic.css already uses this same `:not(.NamedNoteActive)` pattern. Placed named notes, SingleNotes and highlights keep their own colour classes, so they still show their names.
2. Add one checkbox that toggles `body.HideNutNames`. Copy the Show All Note Names pattern:
   - the checkbox in index.html
   - a click handler like infinite-neck.js, which only toggles the body class
   - read and apply in `controlsToDisplayOptions` (infinite-neck.js) and `applyDisplayOptions` (infinite-neck.js)
3. Register a new key, for example `hideNutNames`, so it is saved in each Section's `displayOptions`:
   - a default of `false` in displayOptionsMeta.js, plus a `META_ROWS` entry
   - print-control-defaults.js
   - the Jest golden file vdd-table.golden.html, which pins the matrix columns and will need regenerating

   Then the name-that-note songs set `"hideNutNames": true` next to `"hideNamedNotes": true` in their `displayOptions` blocks (for example name-that-note.json).

Because the effect is CSS-only, it needs no `replay()`, Keep or palette side effects. Older songs lack the key and fall back to `false`, so they are unaffected.

**Zero-code alternative:** set `"nut": false` on the song's tunings. Column 0 then becomes an ordinary cell with transparent text. The cost is losing the nut look and width, which is probably not what you want for a visual exercise.

If you want the nut labels to stay hidden even under Show All Note Names, add `.universalNamedNote` to the same CSS selector.