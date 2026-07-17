# Sprint 138 Iteration 4 Changes

Each section below has changes we'd like applied to the current design, in [Iteration 3 implementation plan](138-it3-implementation-plan.md).  This should prompt [Iteration 4 implementation plan](138-it4-implementation-plan.md) which Copilot should create.  We expect that upon answering final questions in this plan, that we can then approve this for coding.

# InstrumentCaption / LooperLight

Under the left rail SectionStatus/LooperLight there is an InstrumentCaption.  In the Instrument Caption Row, we have two buttons that toggle the visibility of these.  We want another button between buttons `C` and `S` that will be button `⥮` (U+296E) so the buttons lay out like this: 
`[C] [⥮] [S]`
When clicked, this new button toggles Instrument Caption to the left of the pair on one row, or to the bottom of the pair in one column: 
one row: 
`InstrumentCaption LooperLight`
one column: 
```
LooperLight
InstrumentCaption
```
We want to keep is simple and not have the button have state of its own, so it won't change icon or text, or disappear if the C or S buttons change the state of the LooperLight or InstrumentCaption.  If someone mashes on `⥮` while these are hidden, it is OK if they swap position as the normal action would be, even if that swap can't be seen.

The default state should be one-row on song load or app startup, and the default visibility is as it is now: both shown.

Since tutorialMode==strict won't allow access to these control buttons, these widgets will remain seen for tutorials, and will default to one-row, both of which are good.

# Simplified 'A' tag sanitizing

Implementation plan currently says: "Current sanitizer class-attribute handling must be inspected. If classes are stripped, pseudo-button styling can target .tutorialPromptHtmlRow a without requiring class preservation." ANSWER: this is fine.  We are OK having *all* hyperlinks be pseudo-buttons that behave like fragment links.  This fits the visual model of the Tutorial or Wizard asking the User to mash on a (pseudo-)button and having them expect action, rather than navigation away.  So we can default all `A` tags in Prompt Area html text to use that style.  Thus we avoid the `class=` attribute.  We will want installed a rule for links inside tables to be more like normal links, since we use these in `Info` today to present groups of superlinks.

# Updated format for progress badges

  New format is compact and adds new info: `[&sect;5 (3/12) &#x261E;7]`  where `[]` means the badge CSS styling, and where 5 is the highest "Done" Section 1-based number, 3 is the count of "Done" Sections, 12 is the count of Sections in the tutorial song, and 7 is the 1-based number of the Bookmarked Section.

# New Feature: Loop Marked Sections

We want a new div: divLessonSectionList which contains the LessonSectionList.  This is a table, with a few checkboxes in each row in certain columns, for every Section in a tutorial in strict mode.  One column is "LOOP" which is a checkbox per row that indicates if a Section is played during Section Looping.  

If song is a tutorial, yet there are missing Section.tutorial or Section.tutorial.caption entries, let the rows still be created with blanks for captions.  This will remind us to create them.

In strict mode only, if Sections are checked in LessonSectionList, then LOOP will only play these Sections.  Song loops normally, including any action on Song end, DaCapo events, etc.  But if a Section is not checked in this LOOP column, it doesn't play.  These do not persist in the song, or in the Browser Storage for the User.  They default to checked every time the song is loaded.  Clicking on "LOOP" in the header row for that column toggles all Sections unchecked/checked.  So if a User wants to loop Sections 2,3,4 only, they click on the header for LOOP column, clearing all checkmarks, then they click rows for Section 2, 3, and 4.  Then when they hit the tutorial strict mode LOOP button in the tutorial Prompt Area widget row, or 'l' to loop, the song loops normally, including starting from the current Section, but then only plays Sections 2,3,4. Thus, if they were sitting on Section 1, actual looping would start playing at Section 2.

LessonSectionList is also used for keeping track of "Done" Sections the User feels they have mastered.  These are persisted in Browser storage as described previously in the implementation plan.  Except that we want to clarify that the design is the array of "Done" Sections is persisted, so the checkboxes in the LessonSectionList in column "Done" are checked when the user checks them or the checkboxes in the widget row when on that Section.  The highest number of these is the 1-based Section number reported in the status badges in the Song Library runtime listing.  Even though only the highest number "Done" is reported there, the full array is stored in Browser Storage for that User, and is available when opening the song.  Note that "Done" is allowed to be a sparse array.

There is only one Bookmark, which is the destination of the goto button in the widget row.  

On song open, the tutorial song always starts at Section 1, like all songs.  If the User wants to pick up where they left off, they click the Bookmark goto button.  If they want to see their whole progress, the array of "Done", then they open the LessonSectionList, which will be opened/closed by a button ["Sections"] in the beginning of the breadcrumbs row.  It expands below that row, and above the Section tutorial captions row.

We saw in the implementation plan some discussion that seemed to say the Breadcrumbs might not be present in strict mode.  We do still want the Breadcrumbs in strict mode.

Here is the layout of the Prompt Area (`divTutorialPrompt`), now, with the LessonSectionList:

LessonSectionList closed:

```
<Widget-Row>
<Breadcrumbs>
<[ &#x1F782; Sections ] Tutorial-Caption>
<Section.tutorial.caption>
<Prompt-Lines>
```

LessonSectionList open (where [] means button): 

```
<Widget-Row>
<Breadcrumbs>
| [ &#x1F783; Sections ] Tutorial-Caption | 

| Section  | Done | LOOP| Section.tutorial.caption |
| -------- | ---- | --- | ------------------------ |
| 1        |  x   |     | Section 1: getting started |
| <b>2</b> |  x   |  x  | <b>Section 2: playing the first chord</b> |
| 3        |      |  x  | Section 3: playing the second chord |
| 4        |      |     | Section 4: playing the difficult third chord |

<Section.tutorial.caption>
<Prompt-Lines>
```

Each row should be highlighted in `background-color: #a1fde9;` when it corresponds to CurrentSection, and clicking on a row number in column 1 should take the User to that Section, with an underlined hyperlink for the Section number, similar to how the ID column behaves in `Chart > Notes`.  The highlighting of rows should be live during looping.  The LessonSectionList does not auto-close on looping or changing Section. The User should close it with the `[ &#x1F783; Sections ]` button.

Here, the User has decided to LOOP only Sections 2 and 3, and has decided they are Done with Sections 1 and 2, and they have Bookmarked Section 2, shown as bold.  This means they may skip Lesson Sections when LOOPing, which is OK, as long as when they are not Looping, the Next and Prev buttons still go sequentially through all the Sections normally.  Call this Set IncludeInLooping.  The caption is "LOOP" but the meaning is IncludeInLooping.

The LOOP button for the Prompt Area widget row should have extra caption to reflect this as well.  If Sections are omitted the button should report the first and last Sections included, and put elipses in between, even if the sparse list is more complicated.  So in the above example, the buttons would read `[LOOPING 2..3]`.  If the LOOP column actually reflected that LessonSectionList were [2,3,4,7,8,9] then the button would read `[LOOPING 2..9]`.  It need not present that info when not looping, but rather always read `[LOOP]`.

Changing LessonSectionList when looping should be live, but should not restart looping.  The LOOPING caption should change, and on the next logical inclusion/go-around the newly checked or unchecked Section should be included/excluded.

Since LessonSectionList is not available in `none` or `wizard` mode, this kind of filtering by IncludeInLooping is also not available in `none` or `wizard` mode.

When Looping normally in a song, hitting the Next button takes you to the next Section and looping continues.  In this setup, we'd keep that behavior, which would mean when the Song and the Looper decide which Section to play next they would look at the Section just "Next" button'ed to, and see that it was or wasn't in the list of "IncludeInLooping" Sections and move forward to the next playable Section according to the LessonSectionList IncludeInLooping set.  This is purely a function of strict tutorial mode, and should not bleed over into normal behavior.  In the future, we will need to implement an algorithm to deal with Charts that have jumps to HEAD and INTRO, and do OUTRO Sections differently on different loop count (and other refinements to DaCapo such as D.C. al Fine, D.C. al Coda, Dal Segno al Coda, and so on), so a hook location in Song is acceptable, as a future module will have to hook Song to do these complicated Chart navigations, which will probably be implemented as a pluggable algorithm that reports the next Section to play given a current Section (and probably loop history).    It is also acceptable to have that hook be hooked singly by Tutorial.js with the current rule, (without regard to loop history, which should not be included in the API at this time).  

As stated, this list of "IncludeInLooping" will not be persisted, and is reset on opening a song, so we won't have the issue of someone opening a song and missing Sections.  This is strictly for Users who want to focus on certain sections while practicing the lesson in LOOP mode.  

IncludeInLooping does not apply to BEAT LOOPING.

# Example Tutorial Song in place

We have added `songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html` and a tutorial song in `songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json` and added the song to `songs/song-list.json`, as well as putting the proposed courses in directories under `songs/tutorials/`.  These should comport with the previously specified course and song layouts.  We can test this song's .prompts.html to test the authoring and build process.

# Request

Copilot, please include these changes and produce Iteration 4 implementation plan at the document location specified at the top of this document.  Include a section of questions we need to answer to be able to proceed to coding after plan review.

