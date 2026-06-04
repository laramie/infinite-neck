# sprint-119-cleanup Iteration 3: fix/complete the section-status widget

- Iteration 3: finish the coding of `section-status-vertical-widget` and friends, and sync with `.SongTitleLeadSheet` widget area, probably ditching the hand-coded LooperLight, and Key indicator. 

    - make the title and the looper light be in the same vertical column on the LHS of the Instrument.

    - ensure that the title in vertical mode in the instrument doesn't creep up above the table, leaving a space at the top.

    - Add optional beat counter to looper light. Add "Show LooperLight Beats" after "Piano Width Scale Factor". 

# Request

Before coding, we need to understand how the section-status widget is working today, why the vertical flavor works well, and the horizontal flavor doesn't, and how the horizontal flavor can be made to work by incorporating the working features of the hand-coded "LooperLight plus Keys" in the Song title area.

Working vertical mode:
  table/instrument ID: `tblP46_1`
  div with widget: `tblP46_1_caption_SectionStatus`
  class: `section-status-vertical-widget`
  generated widget markup:
  ```
  <span id="tblP46_1_caption_SectionStatus" class="section-status-vertical-widget" data-tablename="tblP46_1">
        <table class="section-status-vertical-table LooperLightTD">
           ...
  ```

Working horizontal hand-coded `SongTitleLeadSheet` version: 
```
<span class="SongTitleLeadSheet">
    <span class="lblSectionNumber LooperLight"><span class="lblSectionmark">§</span><span class="lblSectionsStatusSectionNo">2</span></span>
    <span class="lblRootID">C</span><span class="lblRootIDLead">&nbsp;</span>&nbsp;&nbsp;
    <span class="lblSectionChartChord"></span>
    <span class="lblSectionMode"></span>
    <span class="lblLeadSheetWidgets">  </span>

</span> 
``` 

Fixes: 
vertical mode needs to play better with the table/instrument label: to wit, we want the table label to appear below the vertical section-status widget, and neither should flow above the instrument table.

the horizontal mode widget is just broken.  The hand-coded horizontal display of this same info that was the inspiration for the section-widget still works well.

The LooperLight in the widget should contain an optional display of beats as the #transport does, with the beats appearing after the section as `SS:bb` where SS is the section number and bb is the beat number, but not the total of either, as the transport shows (§1/3    2/4).

In general, the section-status embarked on the new template strategy, and got left half-way done around the time we were evolving the template strategy.  It deserves a bit of reorganization and refactoring to preserve the parts we got right, fix the parts that we didn't, and maybe ditch some of the design that is not needed, while preserving the flexibility of the design, especially as a pattern to build other widgets.

# Iteration 3, round 2.

Thank you for clarifying the current design and sorting out what is happening today.

- We like the idea of three layouts instead of two.
- We like the idea of ditching unused events.  The LooperLight CSS broadcast is working well, but may not work for the beats, which we agree should be added later.  Consider beats to be out of scope until the widget settles down.
- We are open to seeing how template expansion can be done more robustly.

We need to clarify something about the scope of the widget.
- The section status widget is much more limited than the SongTitleLeadSheet line.  That line is visible at the top of the page in the app, and is not repeated when more Instruments are added. So central song information is displayed for the User, who may be looking at several Instruments. These are not useful within the Instrument display.  The Section-status information is also somewhat central (except the Instrument ID), but was designed to be close to the Instrument display more for ergonomics: while staring at the notes available, the User doesn't need to visually search around the screen for the Keys, Section index, or Looping status.  But the following are only designed to be curated at the top of the page, and work fine today sitting below the song caption and the section caption: 
```
<span class="lblSectionChartChord"></span>
<span class="lblSectionMode"></span>
<span class="lblLeadSheetWidgets">  </span>
```
These should be considered *not* part of section-status widget.  But rather, the section-status widget is a sibling of lblSectionChartChord, lblSectionMode, lblLeadSheetWidgets.

In other words, all three layouts of section-status should just contain the right flavors of: 
```
<span class="lblSectionNumber LooperLight"><span class="lblSectionmark">§</span><span class="lblSectionsStatusSectionNo">2</span></span>
    <span class="lblRootID">C</span><span class="lblRootIDLead">&nbsp;</span>
```

Additionally, the `fretTableLeftCaption` is just the Instrument ID, and should be laid out correctly near the section-status widget, but not be a part of it.

Please produce a draft implementation plan based on your report, and our refinements above.  This is not an implementation plan yet, but a document to help us understand the direction you would take, with clarifying concrete steps as helpful.

We have installed `rg` in /usr/bin/rg

We have stored your first report in `_doco/design/sprints/119-cleanup/119-it3-report.md`. Please produce your next revision in `_doco/design/sprints/119-cleanup/119-it3-implementation-plan-sketch.md`

# Iteration 3, round 3

Answers to questions: 

- Should leadSheetHorizontal reuse the existing SongTitleLeadSheet container exactly, or should it get a dedicated host span within that row?
- ANSWER: a new host span would keep things separate.

- Should loop-active state remain global-CSS-driven for this iteration, or should it move immediately into explicit widget rendering state?  ANSWER: Please sketch out what the code would look like to replace CSS broadcast, which is currently working well.

- Should the caption-row horizontal layout remain always visible, or should it still participate in existing show/hide display options?
- ANSWER: all the hide/show actions should work as they do today:
  - `a` hides/shows the SongTitleLeadSheet, so should hide any section-status widget there.
  - `SHIFT+a` hides/shows the Instrument/table caption row, so should hide the horizontal widget there.
  - `showLeftCaption subcaptionButton` shows/hides the Instrument ID.  This should happen per Instrument.
  - `showLeftSectionMark subcaptionButton` shows/hides the vertical widget.  This should continue to hide but per-instrument.
  - These two tiny buttons, with cation `C` and `S` themselves are hidden when the Instrument caption row is hidden.  That is fine.

Should the left-rail vertical widget and instrument id be one flex column inside a table cell, or should the table-side structure be reduced more aggressively?  ANSWER:  Not sure.  Main goal is to have Instrument ID and section-status widget in a vertical stack, controlled by the two tiny buttons.  Whichever strategy to make that happen is not as important.

With these answers, please proceed to making a concrete implementation plan.  Please include discussion about the merits of "Should the left-rail vertical widget and instrument id be one flex column inside a table cell, or should the table-side structure be reduced more aggressively? " .



