
Iteration 2 is implemented, and the full Jest suite passes (95 suites, 1439 tests). I haven't run any of it in a browser, so the UA checks below are still to do.

**What changed**
- **Sort row:** Default, Date and A-Z buttons sit after New Folder. Sorting is for this visit only. A second click on Date or A-Z reverses, and Default never reverses. Sorting doesn't open or close folders, and it resets when you launch or open a Workbook.
- **Up/down/remove:** Songs and folders have up/down buttons, and Remove and Delete Folder are now ⌫ glyph buttons. The new order is saved. "Add current Song here" is gone, and Save to Workbook opens the destination folder.
- **Practice state:** For Workbook Songs, Include in Looping, Bookmark and Done are saved in the Workbook and its downloaded file, not in browser storage. When you save a Library or disk Song into the Workbook, its current Bookmark and Done come with it. Include in Looping has no effect in Tutorial Mode `none`.
- **Docs:** help.html and sprint-157.md are updated.

**Choices I made where the design was open**
- The up/down buttons are disabled while Date or A-Z is active, because they change the saved order. The button tooltip says to switch to Default first.
- A folder's Date is the newest of the folder itself and its Songs.
- Editing a comment updates a Song's date. Changing Bookmark, Done or Include in Looping does not.
- Each Song's date is saved in the Workbook file, so the Date sort still works after a download and re-open.
- Saving over an existing Workbook Song replaces its Bookmark, Done and Include in Looping with the current ones.
- If you remove an open Song from the Workbook, later toggles go to browser storage instead.

I did not add the dialog for Open Workbook when you pick a Song file. The refusal is still red text only.

**UA checks**
1. Sort without changing which folders are open. Default restores your order.
2. Up/down moves survive a reload and a download/open.
3. Save to Workbook opens the destination folder.
4. Bookmark, Done and Include in Looping persist per Workbook Song, including after download/open.
5. A Library Song saved into the Workbook keeps its existing Bookmark and Done.
6. Include in Looping is ignored in Tutorial Mode `none`.

Made changes.