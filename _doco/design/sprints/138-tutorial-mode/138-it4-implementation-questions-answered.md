# Design Team Answers

Iteration 4 questions posed in [Iteration 4 implementation plan](138-it4-implementation-plan.md) answered here, after some clarifying notes based on reading implementation plan.

## Clarifying gPresentation.tutorial.currentSectionIndex

Not sure why gPresentation.tutorial has currentSectionIndex.  Song should have this, and we always load first Section on song load, and tutorial has Bookmark in case User wants to jump, but we don't auto-jump.

## Clarifying layout of InstrumentCaption and LooperLight next to each other, rather than their internal layouts

Even though "one-row" is specified as one of the layouts of InstrumentCaption and LooperLight, the internal layouts of these two widgets stay as they are now: specifically, because LooperLight is vertical in left rail, it is a special vertical layout.  This stays the same.  Also, InstrumentCaption is vertical and uses vertical bottom-to-top text direction rendering to keep it taller than it is wide.  This also stays the same.

## CSS for songLibraryTutorialProgressBadge
Fix this: the implementation plan says to use these CSS classes because we asked for them:
```
<span class="songLibraryTutorialProgressBadge songLibraryInstrument instrumentObserver">
  <span class="songLibraryTutorialHighestDone">&sect;5</span>
  <span class="songLibraryTutorialDoneCount">(3/12)</span>
  <span class="songLibraryTutorialBookmark">&#x261E;7</span>
</span>
```
However, we just want the classes to be *reminiscent* of songLibraryInstrument and instrumentObserver, and not actually descending or cascading from them.  In fact, we should have specified it like this:
songLibraryTutorialProgressBadge should have a border, background and font with CSS rules like so:
```
.songLibraryTutorialProgressBadge {
		display: inline-block;
		margin: 0.1em 0.2em 0.1em 0;
		padding: 0.1em 0.35em;
		border-radius: 0.35em;
		font-family: "Kode Mono", "Courier New", monospace;
		font-size: 85%;
		font-weight: 700;
		white-space: nowrap;
    background-color: white;
    color: rgb(31, 0, 170);;
    border: 2px solid rgb(31, 0, 170);
}
```

## Getting Info for Song Library display of tutorial progress

Clarifying this: "Use path-based tutorial detection in Song Library unless Section count forces a richer metadata strategy.".

We want to show progress for songs within `songs/tutorials` in Song Library.  However, we don't want it to be because it was in a magic directory.  We'd prefer to alter the metadata available in song-list.json.  So we want any calculation of whether a song is a tutorial to be based on: 1) is it a tutorial because it has `Song.tutorial.level==strict`? 2) is it a tutorial because `songs/song-list.json` has an attribute on the song as `tutorial=strict`.  Since we want both of these to be true, and we don't want them out of sync, we want to add it to the build process.  The song author will update it in the song, and the build process will update song-list.json.  The right place for this is here: 
```
npm run update:song-list
> infinite-neck@1.0.0 update:song-list
> node bin/update-song-list.js
```
so just like `bin/update-song-list.js` updates the `instruments` property, it should update `song-list.json` with the properties `tutorial` and `SectionCount` when it finds a song with `Song.tutorial.level==strict`.   Its output will be of the form : 
```
{
  "href": "tutorials/C000-intro/L001-one-string-intro/L001-1.json",
  "description": "One-string Intro",
  "tutorial": "strict",
  "SectionCount": 4,
  "instruments": [
    {
      "fromBaseID": "S1",
      "wiring": "Main",
      "visible": true
    }
  ]
}
```

So the Song Library listing will be statically known at song load time.  But since we are in a song, and have read Browser local storage, we can present the Done status, the Bookmark status, and the SectionCount, of all the tutorial songs in the Song Library listing, all without having to read the song files of the listing.

## Song author sets tutorial level in song

The correct authoring step that makes a song a tutorial will be setting Song.tutorial.level at runtime with command-line `/vpts` and then saving the song file and installing it in the songs/ directory.


# Question Answered

## Questions to answer before coding approval

### 1. Empty IncludeInLooping behavior

If the user clears every LOOP checkbox and starts or continues Section Looping, what should happen?

Options:

1. Treat empty as all included. Recommended for safety.
2. Disable LOOP start until at least one Section is checked.
3. Let LOOP stop quietly.
4. Show a warning in the Prompt Area.

Need answer before coding the loop hook.

**ANSWER**: Use Option 1


### 2. Song Library section count source

The badge format needs total Section count, for example `(3/12)`. Where should the Song Library get `12`?

Options:

1. Add/manual-maintain Section count in `song-list.json` for tutorials.
2. Lazily load tutorial song JSON for tutorial entries only.
3. Cache Section count after the song has been opened once and show partial badge before then.
4. Extend existing song-list update tooling to write Section count without extracting captions.

Recommendation: lazily load tutorial JSON only for tutorial entries, unless this creates visible delay.

**ANSWER**: Option 1 as described above in section `# Getting Info for Song Library display of tutorial progress`
 
### 3. Version-1 progress migration

If browser storage contains old `completedSectionIndex`, should it be migrated?

Options:

1. No migration; reset progress for sprint-development tutorial data.
2. Convert `completedSectionIndex = 4` to `[0, 1, 2, 3, 4]`.
3. Convert `completedSectionIndex = 4` to `[4]`.

Recommendation: no migration unless real users already have progress data.

**ANSWER**: We have only used browser local storage for preferred tuning, and some display sizing found on the Desktop menu page.  So there should be none to migrate.  Therefore, no migration.
 
### 4. Bookmark visual in LessonSectionList

Should the bookmarked row be bold like the design example, or should only the Section number/goto token be bold/styled?

Recommendation: style only the Section number or add a bookmark glyph/class, preserving row readability.

**ANSWER**: The text in just columns `Section` and `Section.tutorial.caption` get bold for the current Section row.
 
### 5. LOOP header toggle semantics

When the LOOP header is clicked and the current state is mixed, should it check all or uncheck all?

Recommendation: if any unchecked, check all; if all checked, uncheck all.

**ANSWER**: Accept Recommendation.
 
### 6. IncludeInLooping and direct row navigation while looping

If the user clicks a Section number row that is unchecked while LOOP is active, should the app briefly navigate there and then skip on next loop decision, or should it immediately jump to next included Section?

Recommendation: navigate directly, then the next loop decision applies the filter.

**ANSWER**: Accept Recommendation.
 
### 7. IncludeInLooping with First/Last buttons while looping

If First/Last are pressed while LOOP is active and the target is unchecked, should the first/last navigation happen literally or be filtered immediately?

Recommendation: First/Last remain literal transport navigation; the loop's next decision applies filtering.

**ANSWER**: Accept Recommendation.
 
### 8. Instrument Caption / LooperLight layout persistence

Should row/column layout remain runtime-only and reset on each song load, as specified, or should it persist in session presentation state?

Recommendation: reset on app startup and song load per design.

**ANSWER**: Accept Recommendation.  We will need to revisit the presentation storage and per-Instrument behavior in a later sprint.  For this sprint, keep these run-time only, with resets.
 
### 9. Prompt table link styling scope

Should the table-link override apply to all tables inside Prompt Area or only tables with a specific class?

Recommendation: all tables inside Prompt Area, because prompt HTML will not depend on class preservation.

**ANSWER**: Accept Recommendation.
 
### 10. Example tutorial song fixture strategy

Should Jest tests copy the live example tutorial files into fixtures, or is it acceptable for tests to read the live example files directly?

Recommendation: copy fixtures into [_tests/jest/fixtures/](_tests/jest/fixtures/) to avoid test fragility while content is being authored.

**ANSWER**: Accept Recommendation.
 
### 11. Strict LessonSectionList visibility with missing tutorial metadata

Should a tutorial song with `song.tutorial.level = strict` but no Section tutorial metadata still show LessonSectionList rows for all Sections?

Recommendation: yes, as specified, with blank captions.

**ANSWER**: Accept Recommendation.
 
### 12. Badge display with only Bookmark and no Done

Should Song Library show `[(0/12) ☞7]`, `[☞7]`, or no badge?

Recommendation: show `[(0/12) ☞7]` because it communicates both progress and lesson size.

**ANSWER**: Accept Recommendation.
 
### 13. LOOP button caption when empty IncludeInLooping is treated as all

If all LOOP boxes are unchecked but empty is treated as all included, should active caption show `[LOOPING]`, `[LOOPING all]`, or `[LOOPING none=>all]`?

Recommendation: `[LOOPING]` to avoid exposing implementation fallback.

**ANSWER**: Accept Recommendation.
 
### 14. Hook location for future chart navigation algorithms

Should the sprint 138 hook be named generically enough for future DaCapo/Coda navigation algorithms?

Recommendation: yes, use a neutral name like `SongNavigationHooks` or `SectionNavigationPolicy`, with Tutorial as the first policy provider.

**ANSWER**: Accept Recommendation, with `SongNavigationHooks`.
 



