# Purpose of sprint-148-displayOptions-diff

Purpose of this sprint is to:
- Introduce a new button to save the Diff of DisplayOptions only
  - Currently, hitting SAVE on DisplayOptions in View saves all the DisplayOptions every time, so if all you want to change is Hide NamedNotes, then you drag in automation of everything, leading to explosion of Section View automation you don't need, and extra maintenance in Songs. 

# Iteration 1  

In Iteration 1, we'd like to understand the scope of work and impact on the codebase and existing Songs.

## UI 

We'd like a new button, "Save ⨹", where that glyph is `U+2A39`, in between `btnControlsToDisplayOptions_View` and `btnDeleteDisplayOptions_View`.  Let it be called `btnControlsToDisplayOptionsDiff_View`.  Internally in this document, let it be called "SaveDiff".


We'd like a matching button, "Save ⨹",  where that glyph is `U+2A39`, in between `btnControlsToDisplayOptions_Section` and `btnDeleteDisplayOptions_Section`. Let it be called `btnControlsToDisplayOptionsDiff_Section`.  Internally, it is functionally the same as "SaveDiff".

## Behavior

The behavior of this button is to save the diffs only in displayOptions.  We have tested and found that if we go into the JSON of a Song, and delete a DisplayOption property, that the current code correctly emits a grayed out cell for `table.tblDisplayOptions` and does not attempt to set this value when doing `displayOptionsToControls()`.  This is the behavior we'd like to extend.

The DisplayOptions are calculated somehow at Song startup, call this the default DisplayOptions.  Only when there are saved DisplayOptions are these defaults overwritten as we change into each Section, using the cascade of options from the first Section through subsequent sections, up to the current Section.

We'd like to have the new SaveDiff button calculate the difference between the default DisplayOtions or the cascaded current values, and the View controls and the other things that are saved (currentColorDict, sectionTheme, autoColorHighlight, autoColor, Presentation Mode values).  We'd then like to minimally write DisplayOptions as saved in each Section in the Model to just contain differences.

If a checkbox on the View page is checked because of default DisplayOptions, then when calculating the diff, it should not be counted as different because it is in the checked state.  Actually, when the User *un-checks* that box, it would count as different.  We are hoping this covers all the various states of controls on the View page, so that there are no cases that automate illogically or have states that can't be reached by automation.

A particular bugaboo has been AutoColor, which generally should not be automated, but should certainly be allowed to be automated with a more intentional UI action.  Semantically, btnControlsToDisplayOptions_View should not automate AutoColor, since like width and height when Presentation Mode is false, the User should be able to flip this state with keyboard shortcut `c` and not have it automated away from this state.  Currently, if the session starts with AutoColor true (it should), hitting btnControlsToDisplayOptions_View saves this into automation.  While clearing its checkbox on `#palette` then hitting btnControlsToDisplayOptions_View would automate it to false.  This may require having a separate checkbox near or replacing `viewDisplayOptionAutoColorValue` to indicate this semantically that we want to save a certain state.

Probably, adding a checkbox for the semantic meaning "I want to automate AutoColor" would handle this case.  We'd like to understand if this pattern will also be true for the other high-level automations in the set (currentColorDict, sectionTheme, autoColorHighlight, autoColor, Presentation Mode values).

## Strategy and Request

Our strategy is to first analyze the feasibility of doing this, and predicting the impact on the code and existing songs. That is the goal of Iteration 1.  Please provide this analysis in `148-it1-analysis.md`.

# Iteration 2

## Goals

For this Iteration we have these goals: 
1) Answer questions from 148-it1-analysis.md
2) Fix Function Symbols UX/behavior so that it allows 0 to many User sets, and doesn't mutate the built-in sets.
3) Define use-cases for the SaveDiff behavior to ensure the proposed design covers them.

## Analysis Questions Answered

Answers to numbered question in `148-it1-analysis.md` section 7:
1. Baseline: static `DISPLAY_OPTIONS_DEFAULTS` (recommended) vs. keep the session snapshot (then at minimum capture it before `applyScalingPrefs()`)?
  - ANSWER: Yes, create `DISPLAY_OPTIONS_DEFAULTS` so it is easy to maintain and edit in one place. 
  
2. Release semantics: accept a `null` tombstone for the opt-in keys so a later Section can stop automating `autoColor` (recommended), or leave "once automated, always cascaded"?
  - ANSWER: Yes, sounds great. Subject to review when we get analysis of the use-cases in this Iteration.
  
3. `NoteDisplaySizes`: atomic unit (recommended, simple) or per-field (`width`, `height`, `NoteFontSize`) diffs?
  - ANSWER: Yes, atomic unit.  They have been working well in the form `160x60:22`. 
  
4. Empty diff: delete the block (recommended) or store `{}`?
  - ANSWER: Accept the recommended proposal. 
  
5. Should the existing full SAVE be kept?  Recommended: keep it (rename its label to "Save All" if the two read confusingly), and make it honor the same opt-in gates.
  - ANSWER: Accept the recommended proposal.  Keep the label, and use "Save Diff" for the new button, don't use the glyph yet because of danger of it being missing from the font set. 
  
6. Automate checkbox for `currentColorDict` too, or only AutoColor and AutoColor Highlight?
  - ANSWER: Yes, subject to review of use-cases. 
  
7. Should a change to `cbPresentationMode` / `cbAllowThemeAutomation` mark the Save buttons dirty?  They are excluded from dirty tracking today ([L4476](../../../../infinite-neck.js#L4476)).
  - ANSWER:  Keep current behavior.  These are a level up above per-Section-automation in concept.  However, they should be persisted per-Song.  Presumably, clearing the checkbox doesn't wipe out stored things being automated, so the User can globally suspend the choice, then later reinstate it and previous automations are turned on again.  In short, Presentation Mode is annoying when looping and editing or presenting in front of a group of students where we are going Section by Section and we want to demonstrate some functional note difference between, say, Section 3 and Section 4, because the widths and heights jump around; yet if those changes are needed for an automated song where the exact purpose of a Section may be to cram more of the neck into display, or more Instruments into a range of Sections, they need to be available for that kind of hands-off presentation, where we run through the whole Song.
  
8. Section move/delete/deep-clone: is a "materialize/compact" pair of commands enough, or should these operations rebase blocks automatically?
  - ANSWER: Let's discuss again when we walk through the use-cases. 
  
9. Custom function symbols (3.7): in scope for this sprint or logged separately?
  - ANSWER: In scope in this Iteration, as we view it as a blocker.  It was supposed to be fixed soon, and we now prefer to fix it and extend the UX to handle the intended and desired behavior for this group of controls. 

10. File name: this analysis was written as `137-it1-analysis.md` because that is the name in [148-design.md](148-design.md).  Given the 137 -> 147 typo correction, it may need to be `148-it1-analysis.md`.
  - ANSWER: The 137 was a typo again!  Yes, we have renamed the document `148-it1-analysis.md` and fixed references.  It remains in your comment in 7.10 for documentation.


## Function Symbols UX

The current behavior worked well as we were developing the sets in the SELECT.  Now that they are stabilized, we'd prefer to change the flow through this group of controls to support end Users, and let internal developers use traditional editing tools to alter these sets as needed.

The end Users have these basic needs: 
- Select a Function Symbol set, for the whole song, or for just one Section if automated.
- Clone a Function Sybmol set and change an annoying note or two to match personal preferrence or musical school of thought.  This replaces the current `btnFunctionSymbolsChanged` use, which is now deprecated.
- Create a new Function Symbol set which satisfies some school of thought we have not provided for.

For cloning+editing and for creation, we need to allow the User to name the new set.  This is a pair of names: one identifier suitable for Song persistence and the id of the OPTION in the SELECT if needed, and one display caption suitable for viewing in the OPTION display value and in the `table.tblDisplayOptions` report.

We would like something like this: 
```
textareaFunctionSymbols
dropDownFunctionSymbols
btnCreateUserFunctionSymbols
txtFunctionSymbolsName  btnClearCurrentUserFunctionSymbols btnSaveCurrentUserFunctionSymbols

```
txtFunctionSymbols name is populated by the current name when the SELECT changes, and an ` n` is added where n starts off at 2, e.g. `Function 2` `Function 3` and so on.  The "(Default)" should be stripped from `Function (Default)` as a special case so `(Default)` doesn't get exploded into the list.  And caption names should not have leading or trailing spaces.  However if the User wanted a subtle edit of `Extensions (only)` then `Extensions (only) 2` would be the first proposed edit.  The id should be calculated/squeezed without guidance from the User.

These new names would be added at the end of the SELECT, preserving the built-in order.  The Select would be parked at the new OPTION, the textarea would be populated with the clone, and clicking the save button would save that clone into the new User Function set, even if the User has not edited the set at all.  Coming back to edit the text area when the User set is chosen and hitting save would update that *User set*.  Updating the built-in sets is not allowed.  We'd prefer to gray out the save button for built-in sets rather than some fancy automatic creation of a new clone.  So the btnCreateUserFunctionSymbols would do the clone, populate the txtFunctionSymbolsName, move the SELECT to the new User set clone, and enable the btnSaveCurrentUserFunctionSymbols.  Even without hitting btnSaveCurrentUserFunctionSymbols, the User has already cause the new set to be in the Model, and this is correct.  the save button is there for when they have changed the name or the set, so probably should be grayed until either the set is changed in the textarea or the name is changed.


## Use-cases

We'd like to mention that one of the solutions to this sprint has been proposed as an interactive version of `table.tblDisplayOptions` report, where the cells are clickable, and clicking a cell removes automation and grays the cell.  This solution is still open to us.  We intuit that this is a potentially clunky UX, both error-prone and overly detailed, while being one step removed from the View page.  It may be a need for a power-user, but our intuition is that if we get the UX right for the use-cases, then they don't need it.  It would be sufficient to say: "DELETE the current Section automation, set the changes you want, and hit either 'Save' or 'Save Diff'". This would have the advantage of being completely visual using the current display of DisplayOptions in the View page UI.  If a particularly tricky set of View DisplayOptions is built-up, the User always has the option of cloning a Section and working on one of the clones, which has the advantage that the User can advance back and forth between Sections to see the effect in the View page and in the Instrument displays.  Therefore, it is more important to get the behavior in the current proposals correct and intuitive for the use-cases.

### Case: Macro drives Hiding

The driving case is the one you saw in `All-Chords-w-Modes-Piano.json` : Section 1 has no `hideNamedNotes`.  The reason this was manually edited in the Song on the back end was to allow the two macros to toggle between showing NamedNotes for Chords, and TinyNotes for Modes, and have the Song start out as showing both.  Automating the hiding meant the clickable toggles that use macro anchor tags in SongWidgets only worked until the next Section boundary during looping.  

Even without macros, a User could legitimately want to manually fiddle with the Hiding checkboxes during looping.  Thus he would want to unset the automation for these and use the UI or command-line to set them as desired during practice/looping.

### Case: Suspend AutoColor automation

A song may be set up to use AutoColor, especially with custom stylesheets.  However, if a User would like to lower the visual noise level and focus on just the pattern of notes and not worry about their functions, he would like to globally suspend AutoColor.  That is the function of `c` as a keyboard shortcut.

Since there was some question about where `c` the shortcut lives, here is the code that governs it: 
`key-handlers.js:500` :
```
			case "c": //"_C_olor"  see also: case "y" where we do #cbAutomaticColorHighlight
				$("#cbAutomaticColor").trigger('click');
                break;
			case "y": //"yellowpen: toggle auto color for highlights."
				$("#cbAutomaticColorHighlight").trigger('click');
                break;
```

When he is done looking at the simplified view, he may want to resume AutoColor automation.  We are fine with there being a hiccup at the next Section boundary where the User has hit `c` to turn off AutoColor, and then in the next Section AutoColor suddenly re-appears.  At this point, if he cares, he would go to the View page and suspend automation of this parameter.  That is what we do today, but it is more annoying: we go to the first Section, turn off AutoColor, and hit "Save".  But if we are in the middle of a complicated loop with TransposePlugin enabled, this is problematic, in that we've potentially lost our place in the flow.  Stopping looping, going to the View page, clicking a checkbox, and closing the View page would be preferrable since we haven't done any navigation.

### Case: Clobbering other DisplayOptions

If a User wants partial opacity of different Note types for Sections 1 and 2, but afterwards wants the opacity at 100%, he should go into Section 3 and set the desired opacity to 100%.  However, this tends to write all display options in effect into that block.  If he has set width or font size in Section 1, and he goes back to reset them in Section 1, he is surprised when upon crossing into Section 3 that his stale size choice reappears during looping.

We can define more use-cases to clarify this, but this is the next biggest driver of this sprint: to allow granular changes that don't persist all the DisplayOptions from previous Sections.

## Request

Please provide `148-it2-analysis.md` and therein tell us if there are any holes in the proposed Function Symbols UX.

Also provide a separate section analyzing our answers, and also whether the answers plus your proposed solution covers our use-cases.  

No coding is requested for this sprint work yet.  After reading your analysis we will approve work on the Function Symbols UX as an Iteration so that that work is complete before we finish the sprint analysis around "Save Diff".