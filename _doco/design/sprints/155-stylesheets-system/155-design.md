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

Note that there is no UI for editing system stylesheets or folders, they will be done in code using the existing patterns for stylesheets, and a new, simple, developer-maintainable data structure for folders.

## Iteration 1 request

Copilot, please analyse this wishlist and initial layout proposal, and come up with a rough implementation plan with questions and holes for the Design Team.  Let it be `155-it1-analysis.md`.