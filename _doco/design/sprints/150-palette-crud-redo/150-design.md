# sprint-150 Design Document

# sprint-150 Iteration 1

In this sprint, we ask Copilot to produce a report of fixes and features as found in its recent walking of the code and generation of new help.html section `#paletteUsage`.

Goal for this sprint: 
- "Identify holes, pitfall, potential fixes, and potential feature upgrades to make the UX smooth and more like some of the other idioms now in use in the App.  Creating and mainting Stylesheets with CRUD operations should be easy to operate from the existing UI with minimal added buttons, tips, and Legends in the style of recent changes to DisplayOptionsMatrix and 'Theme Matrix', as well as fixing holes and quirky/unexpected behavior in the flow.  The existing code is a bit complicated, so should not be made less maintainable by the staff that created it, so vast refactorings are not sought."

Copilot, please produce `150-it1-report.md` with your findings, and include a leading section with your findings from our recent chat requesting the helpfile rewrite.  Include also section addressing the points of our Goal.

# sprint-150 Iteration 2

Notes:
- We actually want a folder for `palette*` just like `templates/display-options/`, `templates/function-symbols/` etc.  `palette*` was one of the first `templates/` sets before we had a sub-directory pattern, and we now prefer this directory-with-repeated-name pattern. So files should be moved/placed here in the very first round and we should test that everything works before the other changes: 
  - templates/palette/palette.builder.js
  - templates/palette/palette.css
  - templates/palette/palette.html
  - templates/palette/stylesheetPlan.js

- We now think the move-order-on-clicking-link idiom is confusing.  We'd prefer to change to up-down buttons like we have in the pairs `#btnMoveTuningDown` and `#btnMoveTuningDown`. Thus, we probably want to replace the delete glyph with a matching delete button like `#btnRemoveTuning` and have the set of three buttons look the same as they do in "Tunings in Song" tab.  We would retain the link for how the User "selects" the User stylesheet for editing and other operations.  We would retain the checkbox for its current use.  Turning on and off User stylesheets would then only be done with the checkboxes, and re-ordering would only be done with the up-down button pairs. The convenience of checking the checkbox in code on User clicking the link is probably retained, as mentioned below.

- In testing the current implementation, we find that the name reported in `.ActiveStylesheets` is inconsistent/confusing and not really what is used when recording `currentColorDict` in the DisplayOptionsMatrix.  Pluswhich, that stored value becomes funny when changes are made back in the palette, which is addressed in your report.  We need to become clear as to the difference between storing a single stylesheet in `currentColorDict` and storing the built-up/merged stylesheet that may have a long name (e.g. `All-Clear+CycleOfColors+Roles+Fingerings+CycleOfColors-user2+Fingerings-user` was shown in Result but when we store in DisplayOptionsMatrix with `Store Cell` we see `CycleOfColors-user` which doesn't seem right at all.  A previously stored Section that still held `CycleOfColors-user2` referenced in that long name was the only Section that worked with the live, current values from the palette Stylesheets editor.  `CycleOfColors-user` was gone by that point since we had deleted it from Stylesheets, but `CycleOfColors-user2` was different than the whole set implied by the long name.  We stopped testing since we could see from your report that a few things were happening on top of each other that are scheduled to be fixed.).  It seems that the mental model is that "Result" reported in `#colorDictRow&rArr;&nbsp;Result` (which is probably not a valid identifier and should be fixed) is the thing that constitues something that is "automated" by `DisplayOptionsMatrix::currentColorDict`.  If you have a recommendation about how to simplify this and store the right thing with the right name, please add it to the implementation plan requested below.

- We like the idiom of clicking the link for a User Stylesheet as the way to set the current thing to edit, rename, and the rest of CRUD.

- We like the feature of seeing the active colors and hatches for the current Stylesheet being edited, and have the others be missing.  So that means we like having the picker "none" wide buttons cause the preview to go missing, so the User knows he has removed that from the set, e.g. getting rid of the color and hatch for `note9`.  It seems the row should be there, but the third TD in `UserColorsEditorDest` should simply be empty somehow.

- Thus we also like the idea of a control/button to remove color and hatch together next to them somewhere.

- Rather than Copy and Rename buttons in each row, we'd prefer to work out the flow with these buttons appearing once alongside the buttons `#btnRecordUserColors` and `#btnRecordUserColorsFromSection`.  It seems this could work if the flow were: click the link, which populates the edit box with `Fingerings-user` if `Fingerings` built-in is clicked, but with `Foo` if User Stylesheet `Foo` is clicked.  Copy then makes `Fingerings-user2` and `Foo2`. Obviously, on the first click of `Fingerings`, there is no `Fingerings-user` so the User would not need to click Copy because he is already working on a new User-version.  To create the first `Foo` we think he can enter Foo into the edit box and he is now creating Foo.  That flow may be weird, so he may have to click "Create" first to create a blank Stylesheet with all sample TD cells blank, depending on how your other recommendations are worked out. To that end, we'd be fine with that button row becoming where most action buttons live, except for the move-up, move-down, and delete buttons per link row.

- Because it did nothing, we fixed a small vestige in the code. Bogus hidden style attribute is gone: `<div id="UserColorsEditorDest" FFFstyle="display:none">` is now just `<div id="UserColorsEditorDest">` in palette.html.

## Questions Answered

From `150-it1-report.md` we have the following answers.  A few depend on the above discussion.  

## 150-it1-report.md section 5. Questions :: Answered 

1. **Exclusive or stacking?**  When a Section applies its `currentColorDict`, or you click a user sheet link, should user sheets be **exclusive** (only that user sheet on; checkboxes remain the deliberate way to stack), or keep today's accumulate rule?  *Recommend exclusive for the Section-apply path at least, since stacking makes a Section's look depend on history.  The link click could stay as is.*  This touches one call site in [infinite-neck.js](../../../../infinite-neck.js#L3480).

- ANSWER: We discussed above the idea of keeping the link behavior except removing the action of reordering.  So keep the idea of link selecting this as the current selection, but ditch the moving.  The action of checking the checkbox on clicking the link is probably still correct.  And the action of separately clicking the checkbox to turn this sheet on and off is also correct.  Moving the sheet would be with the move buttons discussed above.  Thus it becomes clear what the set of active sheets is by checkboxes, without the history of order of clicks clouding the issue.


2. **What does a new name start as?**  Today it is empty (sparse overlay) unless a hidden base is set.  *Recommend: sparse overlay by default; a base is set only when you click a built-in, and it is shown on screen with a clear.*  An alternative is to drop the base idea entirely and rely on `⧉` Copy.

- ANSWER:  I think we are moving in the direction of not having a base.  We are a little unclear on the implications.  However, the idea of clicking links to populate the edit box with safe/existing/new names and dealing with them via more buttons such as Create, Save, etc. seems correct.  We may have to see it in action.  But please deduce which buttons would be needed for the implementation plan as best as you can. 


3. **Overwriting an existing user sheet:** silent merge today.  *Recommend no confirm, but bury the previous version in the Graveyard and say so in the hint.*  Or add a confirm.

- ANSWER: No confirm, bury and say so.


4. **Copy and Rename as row glyphs (`⧉`, `✎`)?**  *Recommend Copy yes, Rename yes only if you want Sections repointed automatically; otherwise it is Copy then Delete.*

- ANSWER:  See above discussion and answers about buttons in main CRUD row. 


5. **`none` in the picker:** today it records nothing.  *Recommend: when updating an existing user sheet, `none` removes that role from the sheet.*  Do you want a different word, since `noteTransparent` also exists as a color?

- ANSWER: `none` is good, and wiring it to the recommended action is good.


6. **Baseline for the live dict (B3).**  If B3 is confirmed, the fix is to rebuild the live dict from Default each time, then layer checked sheets.  Is "Default unchecked" ever meant to leave previous colors in place, or may we always start from Default (and All-Clear as a sheet that overrides it)?  Also, should built-in `checked` flags reset to a known state when a Song opens?  *Recommend yes to both.*

- ANSWER: As designed, we thought there was a use-case for the following sequence: 
  - click Roles
  - check added stylesheet CycleOfColors-user
- Thus the result is an Active Stylesheet that contains everything up to Roles, and adding the things the User wanted in CycleOfColors-user.  That may be a bad example, since it is so easy to just redefine note1, note2, ... note12 and leave CycleOfColors in place, but it seems if we are going to allow them to start from All-Clear and add their own values, that we should respect that.  (Otherwise the idea of turning off built-ins is useless.)  In this case, it means the User wants Fingerings to be All-Clear, which is a valid choice.  Combined with the above answers about fixing the ordering and checking of User stylesheets, this should yield a consistent stylesheet.
- But we should fix the bug of any of these choices being carried through to the next Song.
- and Yes: built-in `checked` flags should reset to a known state when a Song opens.


7. **B11 (unsanitized names):** fix now, in Iteration 2, including cleaning names on open/append.  Names in existing Song files that do not survive cleaning would be renamed.  *Recommend yes; we do not support legacy, and a security fix should not wait.*

- ANSWER: Yes.


8. **Old help text:** retire it in Iteration 5, replacing the old `#palette` block with `#paletteUsage`?

- ANSWER: No.  We have pared down the old help text as an Overview section that leads into `#paletteUsage`, and have removed conflicting and stale text.  Please leave `#palette` as the section header; please leave `#paletteOverview` as authored; and please continue to maintain and own `#paletteUsage` as the implementation changes. 


9. **DisplayOptions Matrix:** should a Section's `currentColorDict` that names a missing sheet show struck through in the Color column?  That edits the Matrix view code.  *Recommend yes, small.*

- ANSWER: Yes.


10. **Rename `Record Stylesheet` to `Save Stylesheet`?**  It matches the hint wording, but changes a name that appears in help and probably in your muscle memory.  *Recommend keep `Record`.*

- ANSWER: Go with "Save Stylesheet" as there should be other buttons joining it such as Create, etc.


11. **Browser pass:** should I start Iteration 2 with the probe plus a short browser checklist for B3, B4 and B10, and stop for your results before writing fixes?  *Recommend yes.*

- ANSWER: Yes.


12. **Pure module name and place:** `templates/stylesheetPlan.js`, next to `themeMatrixPreview.js`.  OK?

- ANSWER: Sort of.  Please use that name, but in location `templates/palette/stylesheetPlan.js` as discussed above.  We will want this directory created, and the `palette*` files moved, and a baseline test and baseline browser UA test we will perform before the rest of the implementation.  Since we are migrating the template files to these named subdirectories, now seems likes the best time to perform this migration for `palette`.  The other older template files (section-drawer, themes, etc.) will be migrated in another sprint.

## Iteration 2 Request

(Iteration numbers suggested in your report may have to be bumped up to accommodate this Iteration.  They can be left as-is in your existing report, and renumbered in the requested implementation plan).

Next Steps (adjust order if needed):
- Please apply the migration for files to `templates/palette/` first. This should change no functionality.
- Then test in Jest.
- Then perform the testing and create prompts for us you proposed as the start of Iteration 2 in Question 11.
- Then produce an implementation plan.  Include final questions raised by our changes here.
- Then we will do a baseline UA test.
- Then we will answer questions, settle on CRUD button design, and approve the implementation of the plan.


