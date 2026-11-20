# Implementation Report : Iteration 1

v1a and v1b are coded together as approved, but I have not run any of it in a browser. The full Jest suite passes (95 suites, 1425 tests, 22 of them new). Jest covers the model, the file format and the HTML rendering. It does not cover IndexedDB, the DOM controller or infinite-neck.js.

**What was built**
- **Model and file format** (Workbook.js): name rules, the Workbook file format with import validation, and the model.
- **Storage** (WorkbookStorage.js): an IndexedDB store and an in-memory store with the same interface. Every change is one transaction, so a failed write leaves the Workbook as it was.
- **File page UI** (WorkbookUI.js): the Workbook block with a "Save to Workbook..." form, and a Download Workbook / Open Workbook toolbar. It also has folder add, rename and delete, an editable comment per Song, a backup status line, and escaping of everything user-controlled. If IndexedDB is unavailable, the Workbook runs from memory and shows a notice.
- **Page and styles**: index.html has `#divWorkbook` beside `#divSongList` and the save form beside "Download Song". song-library.css reuses the Library classes.
- **App changes** in infinite-neck.js:
  - `gCurrentWorkbookPath` tracks the Workbook path of the current Song.
  - `openWorkbookSong()` opens a Workbook Song with the same "did you save?" confirm as the Library.
  - Tutorial progress for a Workbook Song is keyed `workbook/<path>`, even when it is a copy of a Library tutorial with its own storage key.
  - `openSong` now refuses a Workbook file with a message.
- **Help**: a new "Workbook" section in help.html covering setup, use, backup, and the Scaling Prefs caveat. The sprint index sprint-157.md is updated.

**Choices the design left open**
- Overwriting the Song's own Workbook path saves silently. Overwriting any other existing name asks first.
- "Remove" asks for confirmation every time, and "Delete folder" also asks (it only works on an empty folder).
- A rename that only changes the case of a Song or folder name is treated as a replace of the same entry, so it keeps its place in the list and its comment.

**Please check in a browser**
1. Open a Library Song, click "Save to Workbook..." (the default name drops the `practice/` folder), reload the page, and confirm the Song is still in the Workbook.
2. Make a folder with a space in its name and confirm it is refused with a one-click "Fix name".
3. Open a folder, check the first-row buttons, and check that Delete is disabled while it has Songs.
4. Type a comment, reload, and check it was kept.
5. Download the Workbook, open it from a different origin such as another port, and confirm the Songs come back.
6. Pick a Song file in Open Workbook, and a Workbook file in Open Song. Each should refuse with a message.
7. Open a tutorial Song from the Workbook, set a bookmark, and confirm the Library original is unaffected.

The "Open Workbook" confirm always appears when the stored Workbook is non-empty, with an extra warning when there are undownloaded changes. That follows the design, but you may want to judge it in use.

Made changes.