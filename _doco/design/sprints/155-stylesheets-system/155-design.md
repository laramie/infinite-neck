# sprint-155-stylesheets-system

This sprint is to organize the system stylesheets in "folders" that are expandable in the existing list, and play well with the new sprint-150 features and flow, for example, User-selectable checkboxes for system stylesheets, rather than fixed inclusion.  In these new folders, we'll incorporate 1) a folder of new "print" stylesheets with grayscale-friendly backgrounds, 2) additions to new "NoteFunctions" category which contains existing "CycleOfColors" and some stylesheets used in demo/practice system Songs.

# Iteration 1

## Wishlist

Initial goals of this sprint: 
- reorganize the system stylesheets into "folders": expandable groups of stylesheets all present in the stylesheets list. Folders will be for system stylesheets only.  User stylesheets remain as a flat list at the bottom of the stylesheets list.
- retain "AllClear" as an un-expandable, never uncheckable built-in on top of the list. It is still a clickable link so Users can edit a copy.
- provide expanding folder-like outline view to system stylesheets
- allow for new folder of stylesheets for "NoteFunctions":
  - new "NoteFunctions" folder which will contain "CycleOfColors" and curated versions of "light", "light-minor" and "light-notes" etc. found in "demo/" and "practice/" Songs.
  - retain old names so existing Songs work.  So instead of "light" we'll actually install "MoodLight" and "MoodBlue" for example.  No legacy handling: we'll just require system songs to be updated if an id conflict is found, and make most features graceful for opening old songs, e.g. not renaming any system stylesheets.
- allow for new folder of stylesheets for print:
  - grayscale-friendly options such as gradient and half-tone cell backgrounds
  - full override of Roles, Fingerings, etc. so that one checkbox click makes the stylesheet grayscale-friendly. 
- redo how the names are built-up so that User names come before system names in the display string, e.g. `light-notes+Default` rather than `Default+light-notes`.
- reconsider how `Default` is used, whether existing Songs depend on it, and whether it is ditched or becomes a curated set of the system stylesheets that matches the built-in set today.
- allow checkboxes for system stylesheets, but not re-ordering, by User.
- make `Default` row behavior available for collapsed folders without extra run-time drag on recalculating built-up stylesheets.  In other words, it may be desireable to have "NoteFunctions" show a "Default" of its own when the "folder" is closed.  Thus there would be a full row shown for NoteFunctions that may just be "CycleOfColors" but "CycleOfColors" is no longer visible because "NoteFunctions" is closed up.  To consider whether this is visible or not, since showing "CycleOfColors" is probably required in the built-up name, e.g. "light+Fingerings+CycleOfColors" may be a valid set, and is referenced in the `/vdd` and DisplayOptionsMatrix views.  To consider: Since "AllClear" is always "checked" (has a checkmark glyph and not a checkbox), then it probably should not clutter up the built-up names.
- constrain length of table column display of stylesheet built-up names in `/vdd` and DisplayOptionsMatrix views so that column doesn't get too wide.  Possibly a mode of splitting on `+` characters so the grid views gain more row height as needed.  This is in view only, the storage would always be the full name, and at least a title/tool-tip should always show it to the User.  There may be a way to expand the width of the display in the palette>stylesheets view so there is no cropping there.
- Only User stylesheets get `.ssButtons` to move rows or delete rows.
- We envision that there may be a new left column for the open/closed glyph so that when closed, we see the glyph, the collapsed name, and the cells with colors follow; when open we see the glyph and the folder name, with no color cells, and below that the contained rows with checkbox, link, name, and color cells.  This is to be worked out.  When everything is closed, the checkboxes and links aren't shown, but the row is compact and only using one line.

## Initial system stylesheets list

We need to work on this list, but here is a first version: 

```
AllClear
> NoteFunctions
  - CycleOfColors
  - MoodLight
  - MoodDark
  - Forest
  - LaMer
> Print
  - Print
  - Halftone
  - Gradient
- Roles
- Fingerings
- Highlights
-> Default    
```

Here, the character `>` means a row header with an open/close glyph like `#showHideCustomColorEditors`.  In the list above, they are open, but we still use `>` to mean the folder name, not the state of open/closed.

Again, `Default` may go away and there may be default presentations of each closed folder. However, there is value in seeing `Default` as the row directly above User stylesheets, so the User can see the full baseline before adding overrides.  Thus the fully closed view may be: 

```
AllClear
> Default
```

After a User adds two sheets, it may be: 

```
AllClear
> Default
User-1
User-2
```

Note that there is no UI for editing system stylesheets or folders, they will be done in code using the existing patterns for stylesheets, and a new, simple, developer-maintainable data structure for folders.

## Iteration 1 request

Copilot, please analyse this wishlist and initial layout proposal, and come up with a rough implementation plan with questions and holes for the Design Team.  Let it be `155-it1-analysis.md`.

# Iteration 2

## Design Simplifications

Below in "Design Team reports" you can see detailed responses to 155-it1-analysis.md.

Here we sketch the overarching design of sprint-155's UI, with simplifications that restate findings and override ideas from before.

Folders are view-only.  Their names are not Looks or stylesheets.

Folders, when closed, show their folder name, and the visual summary of stylesheets they fold, that is, they behave like the old "Default" row.  

Folders, when open, show only the folder name and a blank space for the rest of the row.  The folder name consumes the same space in the first column as stylesheet names.  The glyph for open/closed should be padded for in the stylesheet names so all the folder and stylesheet names line up vertically.

Folder rows never have a checkbox.

Some stylesheets will not be in folders: All-Clear, Fingerings, Roles.  These may get overrides in lower stylesheets that are in folders.  For example, the Moods folder will contain mood stylesheets that override both NoteFunctions and Roles.

The Moods folder will contain stylesheets that override NoteFunctions and Roles, so it can style notes when AutoColor is off and on.  These will be the "light", "blue", "LaMer", "Forest" and so on.  Copilot does not need to set these up or arrange them, since we will curate these after the sprint-155 plumbing is in place.  Similarly named stylesheets in songs can be left there in the songs.  We will use them in place to preview them and not require swatches to be built.

We just need one mood stylesheet, use "light" copied from a Song.  Put it in a "Moods" folder.  Put the coding for that in a separate module so we can maintain all the new system optional stylesheets in that module.  Put the coding for Folder names in a separate module so we can maintain them there.

Atop the stylesheets table, in the 0,0 corner cell, we want a checkbox styled like "MIDI on" and "Floaty" that has caption "All".  When checked, all rows will have their colors shown in cells in that table, whether they are checked or not.  When "All" is not checked, rows will only show their colors if their individual row is checked.  This requires a rule for handling of closed-up folder rows, to ensure that folder rows ignore the "All" checkbox. So if a folder row is closed, but all of its child stylesheets are unchecked, then the folder row is necessarily blank.  If some children are checked, then the closed up folder row should show the sum of its checked child rows, the way old "Default" does for all checked system rows.  Thus it does not follow the "All" checkbox and attempt to sum all possible children--it keeps its correct behavior: blank if no children checked, sum of checked children if children checked.

System rows and folders will be editable only by developers.  There is no UX for CRUD or ordering.

"Default" is gone.  "Result" is the bottom row and is accurate: it is the summarization, and includes the live User stylesheet choices of system and User sheets.  There is some summarization of the Folders in folder rows when closed, as described above.

## Design Team reports:

- sprint-150 UA checklist: ALL PASS on 20261108, recorded in `_doco/design/sprints/150-palette-crud-redo/sprint-150.md`
- We had specified `AllClear` as a typo.  Correct: use existing name `All-Clear`
- We absolutely agree that order matters, and should work as it does today: bottom of lists in page has highest precedence, applied last.

- We simplify the requirement to not use "All-Clear".  Insted, use it as any other Stylesheet name including in built-up lists.  That way there is no special handling.  For long names we have two strategies: 1) the breaking characters you proposed are accepted, and the `nobr` markup is to be removed; 2) "Look" can be used by Users to shorten names in the DisplayOptionsMatrix views and `/vdd` view. 

- We like the idea of the simple glyph in the existing cell, rather than adding a TD. e.g. Accept 5.1 cheaper alternative.

- `user2+user1+Default` is accepted: show reality in order of precedence in the built-up names with last-applied-first.

- `B. Live system composite` is the choice. `Default` as the "Shipping Set".  Presume this means if we were to change the Shipping Set from including "CycleOfColors" to future sheet "CycleOfColors2027" that opening a Song would automatically get the change.  A User who wanted to lock in "CycleOfColors" would then need to select a subset of the Shipping Set somehow?  To discuss.


- _We will clean old songs e.g. "mojo"_

- We will curate sheets such as "light" into system optional sheets. At that time we will curate the lists MoodBlue, MoodLight, LaMer and Forest correctly.

- _We would like to simplify "Default".  Make "Default" the shipping set, and make it a Look that is in the list. Ideal would be if it were read-only to the User.  It starts off as first, and since we have no re-order feature, would stay as first in the list.  So it is no longer a stylesheet, or a fake stylesheet row or preview row.  We leave the bottom "Result" row for that duty.


## Answers for: 155-it1-analysis.md :: 8. Questions and holes for the Design Team

Your list is repeated verbatim with new whitespace and "ANSWER" answers.  Bullet point 19 is out of sequence and is left like that.

**Model**
1. Confirm built-in *levels* are replaced by independent checkboxes (a click on `Roles` no longer ticks everything under it). *Yes.*

- ANSWER: YES


2. Folder mode: `exclusive` (one ticked at most) or free multi-select? *Exclusive for Print; NoteFunctions exclusive too, with "none ticked" allowed (then `note1` to `note12` show AllClear white). Revisit after UA.*

- ANSWER: YES


3. List order vs precedence: one order (bottom wins), or an explicit `layer`? *One order: AllClear, NoteFunctions, Roles, Fingerings, Highlights, Print, Default.*

- ANSWER: Accept "One order". "Print" is now "PrintPress"


4. Do the curated `Mood*` sheets color `noteRoot`? If yes NoteFunctions must outrank Roles. *No: keep them to `note1` to `note12` and let Roles keep `noteRoot`, unless a look really needs it.*

- ANSWER: No. We will fix existing Songs. We need to work out how Piano, Guitar, and MIDI use different noteRoot styles, and if this is solved at a Song or system level.


5. What is the `Default` row (3.1, A or B) and what does the token `Default` mean? *B for the row, token = shipping set alias.*

- ANSWER: See above.  We want Default not to be a row, but a Look.


6. How is "only AllClear" written, and is `Default` written when the set equals the shipping set? *`AllClear` literal only when alone; yes write `Default` for the shipping set.*

- ANSWER: The Default for the shipping set should now be a look, and we want to loosen the restriction against showing "All-Clear".  We want to simplify and use "All-Clear" wherever it makes sense like any other name. 


7. User-before-system: store it that way or only display it? Do user sheets also reverse (highest first)? *Store it; reverse users too so left always means "wins".*

- ANSWER: Accept proposal.


8. System tick state persistence. Today it lives only in the recipe stored by Sections/Song-DEFAULTS (not in the Song file), so unticking Roles without a SAVE Diff is lost on reopen, while user ticks persist. Acceptable, or persist (for example apply `song.activeStylesheets` at open)? *Accept; document in help; it is the same rule as every other Display Option.*


- ANSWER: On testing, we see that saving user stylesheets, and checking them and then SaveDiff saves their state.  Unticking both system stylesheets and user stylesheets without another SaveDiff then saving song loses both tick states on reopening song.  This is fine behavior.  Desired tick state is store in stylesheet or Look.




**UI**



9. Folder open/closed state: session only (module `Set`), localStorage, or in the Song? *Session only, default closed.*

- ANSWER: Accept recommendation.


10. What does a closed folder row show: only its composite and name, or also the ticked member names (`NoteFunctions (CycleOfColors)`)? *Name plus composite; member names in the tooltip.*

- ANSWER: Seems like we will have room for the member names in the row display: ` > Folder : Child1+Child2 `


11. A folder-level checkbox (tick all / none)? *No. It fights `exclusive`.*

- ANSWER: NO.


12. Click on a system link: load the editor only, or also tick? *Load only; the checkbox ticks. User links keep tick + load.*

- ANSWER: Load only.


19. Glyph in the name cell or a new left column (5.1)? *In the name cell for this sprint.*

- ANSWER: Accept recommendation.



**Names and content**

13. Folder id must differ from its member id (`Print` folder vs `Print` sheet vs table Theme `Print`). *Folder `Print`, sheet `PrintGray`; all ids reserved.*

- ANSWER: 
  - `Print` stays as an ID of a Theme.
  - `PrintPress` is the ID of the Stylesheet folder
  - We agree that "PrintPress" flavors need to be complete and need to be later so they win.
  - Initial list of "PrintPress" flavors unique names:
    - "PrintPress">"Letterpress" :: will be just a copy of "All-Clear" since this works today as a black+white scheme.
    - "PrintPress">"Gradient" :: copy of "All-Clear" that we will copy printable gradients into based on our hatch sets in the Hatch pickers.
    - "PrintPress">"Halftone" :: copy of "All-Clear" that we will create printable halftones like found in `#dropDownBorderImageWhiteKey`


14. Which Mood set, and which `light-minor` survives (6)? *Decide from the swatch tool.*

- ANSWER: 


15. Update system Songs to the new ids now, or later? *Later iteration; nothing conflicts today.*

- ANSWER: 


16. Print sheets: which keys, `captionClass`, and whether the new classes go into the pickers. *All roles including `note1` to `note12`; yes captionClass; not in the pickers yet.*

- ANSWER: 


17. Should entering the Print screen (Sprint 154) auto-tick a Print sheet? Not in the wishlist. *Out of scope; note it for 156.*

- ANSWER: Out of scope.  We want the User to manually select this.


18. Width: `<wbr>` wrap vs abbreviation, and which surfaces get it (Matrix, `/vdd`, `.ActiveStylesheets`, Result label)? *`<wbr>` on all four; full string always in `title`.*

- ANSWER: Accept recommendation.


20. Looks store recipes; Looks saved under the old level grammar are unaffected (none shipped). Any Looks to pre-install with the system sheets? *No.*

- ANSWER: No.


21. `defaultOn` per sheet (Print and Mood sheets off). *Yes, replaces "tick everything" at open.*

- ANSWER: Yes.


22. Keep the id `All-Clear` or rename to `AllClear` as in the wishlist? *Keep `All-Clear`: no shipped Song stores it, but code, tests, help and the Graveyard use it and the gain is cosmetic.*

- ANSWER: Keep.



**Holes and risks found**

- **Sprint 150 it3 may not be browser-verified** (UA checklist C in its report). Sprint 155 builds on that code; I recommend closing that UA first or fixing the two together.

- ANSWER: sprint-150 UA checklist: ALL PASS on 20261108, recorded in `_doco/design/sprints/150-palette-crud-redo/sprint-150.md`
  


- `Default` is used as both a token and a computed row (3.1); the Result row label uses it too.

- Every `Default` expectation in tests ([stylesheet-plan.test.js](../../../../_tests/jest/stylesheet-plan.test.js), [stylesheet-open-and-matrix.test.js](../../../../_tests/jest/stylesheet-open-and-matrix.test.js)) assumes level semantics and must be rewritten, not patched.

- [SongPersistence.js](../../../../SongPersistence.js#L262) defaults `activeStylesheets` to `"Default"`; keep working with the alias.

- The `mojo` value in `pentatonics-7-m-V7-in-6-keys-with-fill.json` has no sheet; it only works because of the "unknown first token means Default" rule. Keep that rule (3.3).

- ANSWER: Keep rule. _We'll fix the song._


- Because the system sheets are module singletons, `checked` flags are shared; the reset at open (Sprint 150) must stay and use `defaultOn`.



- Matrix/`/vdd` "missing sheet" detection must treat an unknown system token like a missing user sheet (3.3).




