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

Our strategy is to first analyze the feasibility of doing this, and predicting the impact on the code and existing songs. That is the goal of Iteration 1.  Please provide this analysis in `137-it1-analysis.md`.