# sprint-148 Iteration 6

Purpose of this Iteration is to add feature to save Song-DEFAULTS as a bridge between DEFAULTS and storing base options in Section 1.

# Discussion

After using SaveDiff for a while, we see that our original idea of just storing basic defaults for a Song in Section 1 leads to brittleness. We anticipate more problematic brittleness in the event we wish to change DEFAULTS.  Further, the DisplayOptionsMatrix makes it very easy to see and edit these settings, and to see and organize the cascade flow from DEFAULTS through LIVE to the Sections.  We'd like to stop making Section 1 have this special duty.  We would like to continue to allow this practice, and leave as-is the working songs that use this idiom.

But moving forward, new songs, and probably any song that gets edited and re-worked should follow a new idiom: save Song defaults for View options in a Song.displayOptionsDefault block in the Song JSON file.

# UI

We think the simplest UI would be two new buttons: 
- Placement: in the top row between `#btnApply_Matrix` and `# btnFloatSection_divDisplayOptionsMatrix` with simply some more `&nbsp;` spacing.
- Writing button: 
  - Caption: "Current to Song-DEFAULTS"
  - id: `#btnCurrentSectionToSongDisplayOptions`
  - action: Does a copy of the Current Section to the new "Song-DEFAULTS" display row between "DEFAULTS" and "LIVE".  If the author wants a full "SaveAll" then he simply does SaveAll on the Current Section first. Therefore, if he only does SaveDiff, then the Song.displayOptionsDefault block will be sparse.
- Clear button: 
  - Caption: "Clear Song-DEFAULTS"
  - id: `#btnClearSongDisplayOptions`
  - action: clears the block.  As long as the implementation treats empty block and missing block the same (must for old songs), then we don't care if Clear leaves a named, empty block--whatever makes more sense for the implementation is fine. 

At this time we feel that this pair are not Tool buttons, and don't apply to various rows the way a Tool button would.  The do, however, act on the "Current Section", which is under the control of the author.  In the event of a bad choice, he can immediately or at any time use the Clear button, so it need not consume the Undo stack. 

We will tweak the new captions, fonts, and spacing during testing, so don't worry if some of them seem overly wide.

# Request

Write a succinct implementation plan in `148-it6-implementation-plan.md` to add the two buttons, deal with missing/empty block, add the display row, and handle the new cascade.  Include any questions we need to answer before coding.