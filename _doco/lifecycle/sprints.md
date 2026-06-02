# sprints

- [sprint-100-my-tunings](../design/myTunings/sprint-100-my-tunings.md)
  - Split tuning management into shared allTunings and user-specific myTunings with a dedicated My Tunings view.
  - planning notes captured 20260320

- [sprint-101-fill-plugin](../design/plugins/fill/sprint-101-fill-plugin.md)
  - Design and implement FillPlugin as a command-menu-driven note-filling plugin with section and song cleanup actions.
  - complete

- [sprint-102-transpose-plugin](../design/plugins/transpose/sprint-102-transpose-plugin.md)
  - Separate TransposePlugin reset behaviors into original-baseline and current-baseline actions.
  - implementation plan written 20260512

- [sprint-103-arpeggio-position](../design/plugins/arpeggio/sprint-103-arpeggio-position.md)
  - Add a position style to ArpeggioPlugin with per-section position arrays and loop-driven state.
  - design and implementation notes written through 20260521

- [sprint-104-file-info](../design/info/sprint-104-file-info.md)
  - Add a song Info page with rendered HTML, an Edit tab, and persisted open-on-load behavior.
  - design and implementation notes written through 20260521

- [sprint-105-map-spacebar](../design/transport/sprint-105-map-spacebar.md)
  - Add configurable spacebar mappings for transport and navigation actions with clarified reset semantics.
  - design and implementation notes written through 20260523

- [sprint-106-transport-controller](../design/transport/sprint-106-transport-controller.md)
  - Introduce TransportController to centralize transport verbs and lifecycle event ownership.
  - implementation plan written 20260520

- [sprint-107-move-plugin](../design/plugins/move/sprint-107-move-plugin.md)
  - Design MovePlugin for relocating played and recorded notes with user-selectable drop and octave rules.
  - design and implementation notes written through 20260522

- [sprint-108-fill-plugin-more-types](../design/plugins/fill/sprint-108-fill-plugin-more-types.md)
  - Extend FillPlugin planning beyond the initial release to cover additional note types and type-specific rules.
  - planning phase 20260523

- [sprint-109-clip-plugin](../design/plugins/clip/sprint-109-clip-plugin.md)
  - Design ClipPlugin for cut, copy, and paste of note sets through Graveyard-backed clips.
  - design cleanup complete and coding requested 20260523

- [sprint-110-tonal-data](../design/tonal/sprint-110-tonal-data.md)
  - Explore Tonal.js chord and mode recommendations and the widget data emitted from current section notes.
  - exploratory notes written 20260524

- [sprint-111-cleanup-plugins-menus](../design/sprints/111-cleanup-plugins-menus/sprint-111-cleanup-plugins-menus.md)

- [sprint-112-piano-skeuomorphic](../design/sprints/112-piano-skeuomorphic/112-implementation-plan.md)

- [sprint-113-transpose-plugin-single-notes](../design/sprints/113-transpose-plugin-single-notes/sprint-113-transpose-plugin-single-notes.md)  
  - teach TransposePlugin to use "algorithm":"string" from MovePlugin for SingleNotes transposed on one string.

- [sprint-114-show-note-names-refactor](../design/sprints/114-show-note-names-refactor/sprint-114-show-note-names-refactor.md)

- [sprint-115-move-fingering](../design/sprints/115-move-fingering/115-implementation-plan.md)

- [sprint-116-copy-fingering](../design/sprints/116-copy-fingering/116-implementation-plan.md)

- [sprint-117-chart-layout](../design/sprints/117-chart-layout/sprint-117.md)
  - Adds a Chart LeadSheet with edit controls in Chart tab pages, and command-line /cc and /co.

- [sprint-118-leadsheet-line](../design/sprints/118-leadsheet-line/sprint-118.md)

# Sprints prior to Version 2 rollout

119-cleanup
  
  - cleanup and bugfixes, scheduled
    - menu prompt stale sometimes
    - chart colors and shadows
    - plugin menu capitalizations on triggers inconsistent or unneeded in sub-menus
    - palete KEEP, etc. should get a highlight ring so that KEEP is not so unexpected
    - default SPACEBAR to looper is getting trapped so you must hit ESC to use it again.
    - /ch should also be fullscreen aware.  Weird that it affects fullscreen when not fullscreen, and doesn't hide non-fullscreen.


[120-plugin-feature-cleanup](../design/sprints/120-plugin-feature-cleanup/sprint-120.md)

  - "Iteration 1": Copy should be able to `L) Listened Notes` copy any note in current section not in Model.
    - COMPLETE

  - "Iteration 2": arpeggio should listen to singlenote and transform exiting ones to equivalent NamedNote and continue as usual
    - COMPLETE

  - "Iteration 3": menu changes for Fill/fpfo shows options but you have to go all the way down to actually accept them. Flow is weird.
    - COMPLETE: added menu options for All none and All roles, shows choices in higher menu.

  - fill and Fill page should normalize on Tonal's chord names (and on modes too)
    - COMPLETE: fixed the code by hand w/o Iteration.  Left some non-Tonal names in parens e.g. (Gypsy). 

  - Fill page should add Dom7No5 as option since so popular on guitar
    - COMPLETE:  w/o Iteration

  - "Iteration 4" fill should listen to Song.chartChord and Song.chartMode with an option, and should make NamedNotes or SingleNotes using the current options for position and string ranges.  It would ignore the chord and mode picks if chart versions are chosen.
    - COMPLETE

  - "Iteration 5"
    - Made modes limit to 6 then "n more..." is shown in the Tonal mode suggestions.  Picker still have full set.
    - COMPLETE

  - "Iteration 6"
    -  /ch and /cl to be fullscreen aware
    - COMPLETE

121-songs
  - song test fixtures / song test list
  - song drills/games
  - song library User-facing list

122-persistence
  - tunings persists 
  - color themes persist
  - user Themes persist
  - everything filtered
  - visible tables doesn't clobber tables in Model--allowed to persist without View.

123-helpfile
  - finish plugin help file
  - move Themes to Themes gallery at end of helpfile

124-build-process
  - get tar deployment working
  - include version 
  - include README/CHANGELOG

# Future Sprints Unscheduled 

901-floating-windows

902-song-import
  - Notes/Sections
  - Color schemes
  - User Themes
  - Tunings
  - Be clear about which things in old and new song hang around

903-TonalPlugin
  - Hand-wavy Design request in [903-design](../design/sprints/903-tonal-plugin/903-design.md)
  - Design-sketch document by Copilot: [903-design-sketch](../design/sprints/903-tonal-plugin/903-design-sketch.md) 
  


# Sprint Planning Rules

## Rules getting ready for Version 2

Copilot: Do not change core files without a design document or a chat confirming that coding is CORE-APPROVED.  All other changes require APPROVED in a design document or chat.  For example, we might say: `Your recommendations in the implementation plan are APPROVED`.

### Files requiring `CORE-APPROVED`
```
infinite-neck.js
NoteTableController.js
Song.js
SongPersistence.js
Section.js
SectionPersistence.js
SectionNotes.js
SectionNotesPersistence.js
Note.js
looper.js
section-recorder.js
TableBuilder.js
transport-controller.js
```

## Rules Version 1

# ARCHIVED: What we did to generate this document

We'd like to fill out the `# sprints` section above with the sprints we already have documented, using the document organization we are moving to.

New document organization: 
- All sprints have a repository-unique number called the "sprint number", starting at 100.
- All sprints have a short-name.  For example, sprint-111-fill-plugin shown above has a short name "fill-plugin".
- For directories where we do not have a sprint-1.md, sprint-1.md split, assume each directory is one sprint.
- For directories where we do have a sprint-1.md or sprint-2.md, we need to update the filename to the new format sprint-{sprint-number}-{sprint-short-name}.md, and fix any references in .md files in that same directory.  For example: the sprint-number is 112, the sprint-short-name is "fill-plugin-more-types" so the full filename is "sprint-112-fill-plugin-more-types.md"
- We just made up the numbers 111 and 112 for the example sprints above.  They should be sequenced like the others and fixed.
- We need to cut a row in this document in the `# sprints` section for each file, and a bullet point under that that gives a short sentence about what this sprint was designing, implementing, or fixing. 
- We need to look through the following directories, and assign sprint numbers going back in time to refer to those sprints created before the numbering/naming system.  First step would be to look at the file dates, organized them by date, and assign numbers, generally from 100 up.
- Here are the directories that count as sprint-planning.  Other files and folders are not necessarily sprints, and should be skipped.
```
├── design
│   ├── info
│   ├── myTunings
│   ├── plugins
│   │   ├── arpeggio
│   │   ├── clip
│   │   ├── fill
│   │   ├── move
│   │   └── transpose
│   ├── tonal
│   └── transport
```
- build the dates of the sprints before editing any files to fix up links, as this will change file timestamps.

At the end, we need:
- one row in this document with a Markdown file link to each sprint planning document in its directory.  The title of the link includes the sprint-number and the sprint-short-name.  
- one bullet point under that row for a sprint description
- if the status and date can be determined from content, one bullet point for completion date or current status.  Acceptable to use file date of latest file in directory if no date is specified in a planning document.
- one or more `sprint-{sprint-number}-{sprint-short-name}.md` files per directory showing the sprint planning, as exemplified in the few sprint-1.md and sprint-2.md files that exist.  Most descriptions etc. will still be in design and implementation docs, so the sprint planning docs should be lean, and include just links and status and short descriptions.  For example, `_doco/design/transport/sprint-105-map-spacebar.md` should exist afterwards, and if possible, `_doco/design/transport/sprint-106-transport-controller.md` should exist as well, since work on `map-spacebar` was interrupted to specify and implement `transport-controller`.

This is not mission-critical editing.  If the documents remain in place, have minimal file-link correctness, have a sprint planning doc per directory, and have a working link from this file to the sprint planning doc, we'll declare victory for Copilot and hand-edit them from there.

Note: We'd like the Markdown links to work throughout this ./_doco/ filesystem in our infinite-neck repository.  This directory should be considered stable relative to our repository.

Preserve this `# TODO` section when done.
