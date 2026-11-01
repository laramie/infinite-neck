# sprint 143 Iteration 2 Design

## Status after Phase 5

- We can now save per-table-per-Section Theme blocks.  
- They appear in the /vdf dump, they apply immediately from the Theme page.
- They do not roll over into the correct one while looping.
- Setting properties on the "default" theme correctly affects all Table+Section that have *no* storage.
- Setting the master Theme dropdown `#selThemesClass` sets all the Theme page controls based on the "default" Theme.
- Navigating to a Section then pulling up a Table from the `#selThemeTable` sets all the Theme page controls.
- Changing `#selThemeTable` then hitting `#btnTheme` correctly sets current values to that Table+Section.

## Iteration 2 Feature Requests

We now need to visualize the storage of Theme per Section per Table.  We request the following UI.

1. A button to hide/show this area of new controls on the Theme page similar to `#tutorialPromptSectionToggle` with a right/down arrow indicator pair.

2. A table showing all possible combinations, with labels or buttons in each cell as needed. Here is an example for three Sections in the song, showing just labels, no action buttons, with three Instruments: ["P46_1", "DADGAD_1", "MIDI_1"]. 

Value looks like "Autobahn+Autobahn" which is `theme.caption`. Here DADGAD_1 is "USER+USER" which is the default USER theme that has had a few bits twiddled, so the Theme button has created a customized default -- this is now the "default" Theme.

|Section Number|P46_1|DADGAD_1|MIDI_1|
|----|----|----|----|
|1| Autobahn+Autobahn    | USER+USER| DJ TrailMix+DJ TrailMix   |
|2|                      |          |                           |
|3|                      |          | Big in Japan+Big in Japan |

When you use a theme to customize a theme, its caption and ID are just re-used so we get these names like USER+USER.  This was designed to be flexible to grab the base Theme, then apply part of another Theme on top of it, hence the repeated named.  We can either leave this as it is, and add a qualifier showing which table and section, or, preferably, we can replace the second qualifier with table+section, e.g.

theme.caption: `USER+DADGAD_1:S1`, theme.id: `USER-DADGAD_1-S1`

theme.caption: `Autobahn+P46_1:S1`, theme.id: `Autobahn-P46_1-S1`

3. Navigation
- when the User clicks on a cell in this table, take them to that Section, with that Instrument selected in  `#selThemeTable`.  It will bring up the carry-forward Theme for this Instrument, though there may not be any storage associated with this cell yet.  That is good. Mashing on btnTheme now will write the Theme at this Instrument+Section.
- Let the current row clicked in this way be colored the same way we do Chart > Chart > Click on cell figures out current Section, navigates there, and adds blue class to current Section cell in Chart with `linkToSection`.
```
<span class="chartBAR chartBAR--short barClass-Box chartBAR--firstInLine chartBAR--currentSection" data-action="linkToSection" data-action-args="[0]"><div class="chartBARChord">&nbsp;</div><div class="chartBARMode">&nbsp;</div><div class="chartBARMeta"><a href="#" data-action="linkToSection" data-action-args="[0]">1</a> ⢴ C ⡦ <span class="leadSheetLineBARBeatCount">4</span></div></span>
```

3. A way to copy a Theme to another cell.

- We think a simple way to do this is to put a Section list dropdown and a "Copy to Section" button on the next row after `#btnDeleteTableTheme` and `#selThemeTable`.
- The new row is : 
    | selThemeSectionNumDest | btnCopyThemeToSection | 
    |----|----| 
- Changing selThemeSectionNumDest does *not* change any Section location or anything about the current settings.  It is just the destination Section.  
- With this mechanism is is possible to copy any written Theme block to any Table+Section, but not the "default". 
- Copying an empty Instrument+Section Theme is a silent no-op.  
- The new id/caption of the copied Theme needs to be worked out.  As a first pass, use the basename (the name before the `+` in the caption, or the name before the `-` in the theme.id), then add the destination Instrument and Section Num.  If it is cleaner to have the basename/baseid stored on the theme block along with `caption` and `id`, then let there be a new property on `theme.baseid`, and, uggg if necessary, `theme.basecaption`.

4. With these features, it is not currently necessary to have other buttons for delete, move, copy, show, etc.  To move, User does a copy followed by a clear.  To copy, the above mechanism is used.  Clear is already defined in the UI. Show is implied by navigating to the Section with clicking on a cell, because that will change the table dropdown `#selThemeTable`, which updates the Theme controls to the current.

5. When looping or navigating, actually update each Instrument appropriately.
