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








