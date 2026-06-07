# Design

We need to lay out charts with a new feature: 
- keeping 'Chart Summary' just showing Sections listed vertically in a list
- add a new chart page tab called 'Chart', in addition to 'Chart Summary', 'Chart Notes', and 'Chart Details'
- in all the tabs, add a column called 'Layout' with a SELECT with values (default to 'BAR'):
  - 'INTRO'
  - 'HEAD'
  - 'LINE'
  - 'BAR'
  - 'OUTRO'
- this value needs to be persisted in Section, and added to the Section schema.
- Do not add special "legacy" handling of old songs.  Simply default if missing on Section construction to 'BAR'.  Put it in an Object.freeze in Constants.js unless there is a better storage strategy.
- when the dropdown is changed, the Section should be updated, and the other chart page tabs should get the news.
- the 'Chart' page will get more detailed, but for now, output just the following: 
  - a new row every time a Section with HEAD, LINE, INTRO, or OUTRO. Implement as a `div` with a `span` for the Section as the first span in the row.
  - no new row when BAR is encountered, just keep adding to the row.  Implement as a `span` that doesn't wrap, just makes the row get longer
- each span should contain just the Chord, Mode, Key, then the Section 1-based number as a link to the Section as it is in the other tab pages, each on a separate line: 

  ```
    	Em7#5
        E phrygian
        C
        1
  ``` 
- It would be nice if the ./templates/ strategy was used, e.g. `./templates/chart/` for builder style and css location, please advise on whether this is doable and whether it fits with how the other pages are output.  If all the other pages are done in section-printer, please advise on whether it would be better to do some other modular way to add the feature without breaking the other tab pages.  
- Let each span have a border (1px black) defined in the css file specifically for this feature, hopefully `./templates/chart/chart.css`. 
- Let each span have a generous padding of 2em;
- Updating the SELECT should also update the Chart.

# Request

Please analyze this feature, and with no coding yet, produce a report in `_doco/design/sprints/117-chart-layout/117-implementation-plan.md`

Please discuss the template strategy, and any holes in the design, or missing specifications, and the code files that need to be touched, as well as new files. 

# Iteration 2: Design Changes, Questions answered

## Design Changes, Iteration 2

We will refer to `Chart | Chart` as just Chart, the new 4th tab page in the `Chart` page.

`layout` is now called `chartPosition` and lives in `Section.chartPosition`.

Section gets a new property `Section.chartCaptionWidth`, described below.

As a clarification, we will call a BAR synonymously with a Section represented in a span.  An INTRO, HEAD, LINE, OUTRO Section is a type of BAR, it's just that they are guaranteed to start the line.  Further, these three types (INTRO, HEAD, OUTRO) also get a descriptive text line above, with the same text as the name, and with their own CSS style, e.g. `<div class='chartHEADTitle'>HEAD</div>` while the rows of BARs would be `class='chartHEAD'` and the spans for every BAR would be `chartBAR`.  Since a BAR is contained within a container with class for each row type, even the first Section on the line is css class `chartBAR`.  

A HEAD gets its own descriptive text if it exists, otherwise not.  An OUTRO gets its own or nothing in the same way.  A HEAD always gets "HEAD" descriptive text, and is the default if no OUTRO is present.  So even if the very first Section has "LINE" or "BAR", the descriptive text is "HEAD".  Subsequent LINEs in INTRO, HEAD, and OUTRO do not get descriptive texts.

Instead of every tab page getting new controls, we are now limiting the new controls to just the page `Chart | Chart Details`.  They will cause updates on the new, 4th tab page `Chart | Chart`.

The Chart will have no controls, and basically be printer-ready, except that no special CSS or media rules will be installed in this iteration.  Just keeping it all printable text, black and white, and simple-looking when rendered on the Chart page.

Instead of just a SELECT for `chartPosition` (called `layout` in Iteration 1), there will also be a SELECT for how to deal with Section.caption in the Chart.  This additional SELECT is the View for model field `Section.chartCaptionWidth`.  
- the values and actions will be: 
  - `none` : no caption will be included for this Section in the Chart.
  - `short` : a short caption width will be allowed, and perhaps a trim(), defined in a later iteration.  For this iteration, the span of the Section in the BAR for the chart will be limited to some width in the CSS, either a percent of the page for less than 5 BARS, or width: 20em;  The page will have to be allowed to scroll overflow.  The chart will eventually be for printing, so overflow on a web page is acceptable. caption text wraps in the span
  - `medium` : a wider caption, fixed, not a page percentage, let it be 40em for this iteration, set in the CSS.  `caption` text wraps in the span.
  - `line` : all captions from the line of bars are accumulated in a div below the div for the line of bars.  Within that div, a div per caption is placed for each BAR in the line.  The Section number and a dot are placed before the Caption:
  ```
    1. The first Section caption
    2. The second Section caption
    3. The third Section caption
  ```
  Let the caption for each section be the full width of the page, and wrap before starting the next line.  Since the chart may overflow width, the section div can just follow that container.

  For `short` and `medium` the caption will be on a row after the Section number in the span.

  Instead of the Section number and the Section key in the span on two lines, it will have a one-line value in pseudo code of `${section-1-based-index}:${KEY}:${Section.beat-count}`  where KEY is the letter name of the key just like the other chart pages for KEY.

  The correct fields are chartChord and chartMode, not the finer-grained, per-table versions.

  Prefer SECTION_CHART_POSITION to what was previously refered to as SECTION_LAYOUT.

  Use `section-printer.css` for all CSS.  Ditch the idea of `./templates` entirely, and do not create a separate CSS file.

  In ditching the idea of using the `./templates` strategy, use your recommendation to make section-printer.js run the show and organize the changes as enhancements of that module.




## Questions from implementation plan, Iteration 1

Q: In the new Chart tab, should there also be an editable Layout control for each section, or is the requirement limited to Summary, Notes, and Details table columns?
A:  Per the Iteration 2 changes above, there will be just one location of the `chartPosition`-backed control, on the `Chart | Chart Details` tab, and similarly for the `chartCaptionWidth`-backed controls.   

Q: Where should the new Layout column be placed in Summary, Notes, and Details?
A: The column should be between Mode and Caption.  In fact, now that there is a control for whether to include the Section.caption, backed by Section.chartCaptionWidth, the order is now:
- `ID | beats | KEY | ♯/♭ | Chord | Mode | Position | Width | Caption` 

Q: Should layout be optional in bin/song-file-schema.js with runtime defaulting, or should schema validation require it and thereby reject older files?
A: Yes, Section.chartPosition and Section.chartCaptionWidth are optional in the schema requirement. 

Q: Should empty chartChord or chartMode lines render as blank lines in the new Chart spans, or should placeholders be shown?
A: They should consume the same line height, but not be visible.  Perhaps `&nbsp;` will work well. 

Q: Should the new Chart spans carry per-layout CSS classes now for future styling, even if all layout types look the same in this sprint?
A: ALL Sections in spans are BARs and should be styled as such.  HEAD, INTRO, and OUTRO are containers, so styling can cascade.  For this iteration, all are the same, except INTRO container should be font italic.  Except that the INTRO descriptive text should be the same as HEAD and OUTRO, just bold, larger font, and regular.

# Iteration 3 : Final answers before implementation

## Discussion

To be certain, HEAD row always gets HEAD.  A Song with one Section gets HEAD, and the BAR lives withing a LINE container which lives within a HEAD container.  This seems correctly specified in the implementation plan.

Here is an example Chart:

```
INTRO
  BAR1    BAR2

HEAD 
  BAR3    BAR4
  BAR5    BAR6  BAR7

OUTRO
  BAR8    BAR9
```
To make this layout, the Sections by number (i.e. Song.sections[0] = 'Section 1' and BAR1) would have these values of chartPosition: 

1) INTRO
2) BAR
3) HEAD
4) BAR
5) LINE
6) BAR
7) BAR
8) OUTRO
9) BAR

Thus, each BAR is a Section, and each LINE is a BAR that starts a line, and each HEAD is a BAR that starts a line and a container for all LINEs in the HEAD, and each OUTRO is a BAR that starts a LINE and a container for all remaining LINEs.
Additionally, INTRO and OUTRO are optional. HEAD is not required, and will be assumed on encoutering the first BAR with no INTRO.  However, if INTRO is present, the User must select HEAD for there ever to be a HEAD container and descriptive text.


## Answers to questions in Iteration 2 implementation plan

Given the discussion from this Iteration, here are the concrete answers to questions from Iteration 2 implementation plan.

1. Should new Sections default chartCaptionWidth to none, short, medium, or line? ANSWER: default to 'none'.

Is that sentence intended to say INTRO gets its own descriptive text if it exists, otherwise not?  ANSWER:  Good catch!  Yes, we meant INTRO.

ANSWER: Should that first row container also use class chartHEAD, or should it keep its literal row class and only show a HEAD title?  Think of HEAD as BODY in a report that also may have HEADER and FOOTER, where in this case HEADER would be INTRO and FOOTER would be OUTRO.  You should have a BODY, so in a Chart, you should have a HEAD, or main area.  If INTRO and OUTRO are specified but no HEAD, then you can't force one--it means the User wants an INTRO and and OUTRO with no HEAD, which is legal. Other than cases like that, if the User doesn't supply HEAD and just starts with LINE or BAR, supply a HEAD container, a HEAD descriptive text and LINE containers. Obviously, once they supply INTRO, they must supply HEAD to get one.  In musical terms HEAD means the start of the song on repeats, so technically Song restarts go to HEAD every loop, not INTRO, but infinite-neck doesn't follow that rule.  DaCapo always loops to Section 1.  But for printouts, Users know what to do when reading the Chart.  

Should LINE have its own container class, e.g. chartLINE, even if it has no title block? ANSWER: Yes, even though HEAD and the other blocks may have multiple LINES, each LINE should be a container with a CSS class for styling purposes.

In a mixed row, should only the line Sections contribute entries to the caption block below the row, while short and medium still render their captions inside their own bars? ANSWER:  We didn't catch this.  We were expecting all to behave the same.  However, the recommendation is better: so attempt to have each span follow the Section.chartCaptionWidth, thus accumulating only Sections with 'line' below.  Users will be able to adjust all Sections to their liking and to be of the same values if the layouts get weird.

Should the Chart tab use raw section.beats or the normalized section.getBeats() behavior? ANSWER: Yes, use 1-based beats as `Chart | Chart Notes | Rec` column does.

Should Summary and Notes remain exactly as they are now, with no new Position or Width columns at all? ANSWER: Yes, no changes to these tabs.

# Iteration 4 : adjusting 

## Chart Options

The Chart is working very well!
We would now like a new tab page `Chart Options` between tabs `Chart Details` and `Chart`.
It should have checkboxes for boolean options, then a SELECT for the class options.  The options should be presented in a column of controls similar to how `divViewCard` is on the `#divViewControls` page is for `Option & Keystroke`, but without all the glop that surrounds the card, in other words, keep it minimal. Construct simple User-facing labels.

These should be persisted in a new, schema-named but schema-optional property of Song: `Song.chartOptions` shown with defaults:

Song.chartOptions {
    modes: true,
    detailLine: true,
    barClass: "Box"
}

barClass :: [ "Box" | "LeadSheet"] are the names in the Select, default to "Box".

"Box" points to class "barClass-Box"
"LeadSheet" points to class "barClass-LeadSheet.

In the CSS, barClass-Box is what BAR is now.  barClass-LeadSheet would be no border on the span, everything else like BAR, but a separate class, not descended, so we can easily tweak it without disturbing or consulting barClass-Box.

`modes` when not checked/persisted would prevent section-printer from emitting that line at all, so the display of BAR gets shorter.  `detailLine` would prevent emission of the line with Section num, Key, and beats, similarly reclaiming space.

These are song-wide and would affect the whole `Chart`.

Song.chartOptions would be optional on opening a song, and would be persisted on saving a song.

## Font tweaks
Looks great.
Now we need two more controls on the Chart Options page.
Stored in Song.chartOptions.lineCaptionFontsize
Song.chartOptions.boxCaptionFontsize
lineCaptionFontsize should apply to any captions, mode, or detail line in a BAR.
boxCaptionFontsize should apply just to all captions that get 'line' handling.
The values visible to the User in the two new SELECT controls should be 50%, 60%, 70%, 80%, 90%, 100%, 110%, 120%, 140% 160%, 180%, 200%.  These should be applied as font-size values to the pertinent classes.  Not sure of the mechanism, but we don't want to use the DisplayOptions to come to and from the Theme or anything fancy like that.  Just the simplest way to apply it when read from the song file, and when changed in the control. 

## All captions off
Looking good.  One more tweak: a checkbox to turn off all caption display in the Chart, both in the BAR and in the lines below.

# Iteration 5 : LeadSheet bars/sections

For Iteration 5 of the sprint, we have the main goal of turning the 'LeadSheet' class in the SELECT into more features found in a standard LeadSheet.

infinite-neck has the concept of Sections, whereas LeadSheets have a solid concept of "Bars".  Bars have a fixed number of beats.  Sections have a variable number of beats Section to Section.  We'd like to reconcile these by having a new Section property, beatsPerBar.  It is per Section, so each Section can contain a different number of bars.  Of course Bars and Sections can truly have changeable number of beats and BMP tempos throughout a real song and a real LeadSheet. But we'll set out some rules that will give Users the counts of each that they need to make good LeadSheets.

Section has a number of beats.

Section has a number of beats per BAR.

Therefore, the Section can calculate the number of BARs it is followed by.  In the case where a User has chosen a number of beats for the Section that doesn't divide nicely, the last BAR gets the remaining beats.  Each BAR should display its number of beats in a subtle way, similar to the detail line, which should just be `beats:${beats}`, aligned right in the span, and in a font the same size as the detail line.  The actual chord symbol, and the mode, section number, and key are not displayed.

Nothing else about the Section changes through the BARs: key, namedNotes, counting of beats, #transport -- all these stay the same as they are today.  But what will be different is a Chart display of BAR spans.  Since the chords and modes and section number don't change, the display is a music standard: instead of chords and modes, the BAR just displays a `%` in the same large font and style of the Section chord.  And the BAR gets the width that was previously calculated for a Section.  In this sense, a subsequent BAR after the first BAR in a Section is a "repeat" mark.

Also, for all BARs the width should be the same for the whole Chart.  This is different than how it is laid out now at this point in the sprint.  So any BARs in the INTRO, HEAD, and OUTRO should all be the same width.  And a "repeat" BAR with just the symbol `%` should be the same width. 

To allow the User to enter the beatsPerBar, there should be an edit box before the 'Position' column in `Chart | Chart Details` tab page.  If empty, then the value is unset in the Section.beatsPerBar storage, and the Section is the only BAR.  If the value is present (should only be allowed positive and greater than zero and numeric else rejected and message shown in showMessages) then the "repeat" BARs are calculated and placed and the value persisted in the Section.beatsPerBar.  Section.beatsPerBar is not initialized during construction, may be absent, and if absent, results in an empty edit box.

Another adjustment to "LeadSheet" class: let there be an initial `border-left: 2px solid black;` on the first BAR span in the row.  Then for every BAR span in the row, there is a `border-right: 2px solid black;`  So the BARs all have a vertical line between them, and the line has vertical lines starting and ending.  The current CSS definition of "LeadSheet" is moved to class "barClass-Bare" and "barClass-LeadSheet" is modified to have these vertical line span separating borders.

Please produce a new implementation plan for this Iteration 5 `117-it5-implementation-plan.md` , since the first set of Iterations is succesful and the implementation plan `117-implementation-plan.md' is implemented and closed.

To reiterate, this is mostly controls on `Chart | Chart Details` and `Chart | Chart Options`, with one additional, nullable, optional field on Section.  Then the main change is View-only on `Chart | Chart` when `Bar Style` is `LeadSheet` and doesn't affect any other Views in infinite-neck.

(Later, we'll have a widget available above the Instruments on the main table area that produces two lines of BARS: the current line with the current section highlighted, and the next line in the chart. But that will be a different sprint.)

## Request 

Please evaluate this Iteration 5 design and ask any clarifying questions.

## Iteration 5 Comments and Answers

117-it5-implementation-plan.md is APPROVED.  Questions and Discussion follow. 

### Comments

should Bare also become a user-selectable value, or should the prior borderless behavior simply stop being user-accessible? ANSWER: Yes.  Visible text in SELECT is "Bare".

Note: all barClass options should now follow the rule that each BAR span on a Chart should be identical widths.  For non-LeadSheet classes, if any BAR caption in the Chart is set to 'medium' width then that dictates the value for widths for all spans which then get the wider width, e.g. 'short' gets 20em and if any caption is set to 'medim', then all get 40em.  For LeadSheet class, we like your recommendation to ditch chartCaptionWidth and attempt a uniform layout.  But in any event, for all classes of 'Bar Style', all BARs, with chord display or "repeat" display of `%` will have the same width for any given Chart.

APPROVED: Recommended interpretation for this sprint:
- keep caption behavior controlled by chartCaptionWidth and showCaptions
- but do not let caption width drive bar width in LeadSheet mode
- line captions still collect below the line
- short and medium captions may still render within a fixed-width LeadSheet bar

APPROVED: "Block and line grouping" as specified in the it5 implementation plan.

APPROVED: "first-in-line class" for CSS styling of BARs.

Validation: only positive, non-zero, numeric integers for beatsPerBar

NOTE: when beats is less than beatsPerBar, simply render the Section as one BAR. In LeadSheet, the small beats display should be used--the Section-num-link:key:beats line is omitted.

In LeadSheet, the first BAR of the Section gets chartChord, the subsequent BARs get `%` displayed in the chartChord font/class/style.

Do not worry about "legacy" songs for this change.  Unset values are specified, and songs produced since sprint-117 are temporary test files only.


### Answers

Clarifying Questions answered: 

1. In `LeadSheet` mode, should the first BAR of a multi-bar Section show the actual Section chord, or should every rendered BAR show `%`? The design text currently says both that the actual chord is not displayed and that a subsequent BAR is a repeat mark, which point in different directions.
ANSWER: First BAR shows chartChord.  Subsequent BARs show `%` styled as a chord.

2. Should `Bare` become a third user-selectable `Bar Style` value in `Chart Options`, or is it only an internal CSS class with no UI/persistence option?
ANSWER: Yes, available as a first-class valid User choice.

3. Should `chartCaptionWidth` and `showCaptions` continue to affect `LeadSheet` bars, or should captions be suppressed entirely when `Bar Style` is `LeadSheet`?  Yes, captions remain in LeadSheet bars, with the discussion above about having LeadSheet span widths calculated reasonably and probably with a different, more consistent, simple rule for LeadSheets.

4. Should `beatsPerBar` be limited to positive integers only? This plan recommends yes, even though the design text says numeric. ANSWER: Sorry, by numeric, we should have said "Validation: only positive, non-zero, integers for beatsPerBar". 

5. What should happen if `beatsPerBar >= section.beats`? This plan assumes that still renders exactly one BAR with `beats:${section.beats}`. 
ANSWER: Always one BAR, even beats less than beatsPerBar.

6. What should the new Details column header be: `Beats/Bar`, `Bars`, or something else? This plan recommends `Beats/Bar` because that is the stored concept. ANSWER: to save space, since the number will likely be a number like 2, 4, 5, 6, 8, or 9, and may legally include two-digit integers, we'd like a small edit box, and just the caption "Beats".

Please proceed to coding.

# Iteration 6: LeadSheet tweaks

1) since there is no Section link in LeadSheet, make it so that clicking anywhere in a BAR jumps to that section in the same way a link would do.  Make a simple css :hover so that (without javascript) the entire BAR hovered over is set to .LeadSheetActive which should simply be `background-color: lightblue;`.

2) move 'beats:n` display of beats to the bottom row of any display in a BAR, so it is below caption.

3) allow 'show mode line' to be operable in LeadSheet

4) map 'show section detail line' to showing/hiding the 'beats:n' line in LeadSheet.  The normal section detail line remains hidden always in LeadSheet.

5) In LeadSheet, chord and the special "repeat" mark, `%` should be centered horizontally in the span.











