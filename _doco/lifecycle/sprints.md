# Sprints overview: rollout of App Version 2

Many of the following sprints are in preparation of the rollout of App version 2.

Songfile persistence version V2 refers to the work on the persistence side, and was complete before these sprints began.  Also complete prior to songfile/persistence V2 was the move to port the entire app to ES6 modules. 

But Version 2 of the app includes much more: 
- Plugins
  - plugins started as a way to avoid repeating Sections in Songs just to cover drills and exercises, such as All-Chords in All-Keys, or name-that-note flashcards in All-Keys.  They have evolved to handle these use-cases well through transposition, fill, and arpeggios while using the DaCapo system of demarking song looping points.
  - but plugins have also filled large gaps in useability, such as copy-paste, move, dexterous transpositions, better fill, easier use of Tonal.js.
  - Because plugins are not in the core, they have created a way to extend the system rapidly for other uses without causing instability or regression.
- Support for floating windows and panels
- Info page
- Section Drawer
- Tonal.js chord and mode detection
- Chart
- MyTunings
- Reorganized View Cards and Themes Cards
- Listeners and Observers
- Revamped helpfile.

We want to make sure all these are working together, and are bug-free.  We want the command-line menu to smoothly drive the existing Version 1 features, as well as the new features, and especially the command-line-driven Plugins.  The plugins have had many sprints dedicated to completing their features, and ensuring consistency between them.

The sprints toward this effort are documented here, as well as sprints planned but not started or complete.

# Sprints with App Version 2 features

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

## Sprints prior to Version 2 rollout: prep, cleanup, fixes

- [119-cleanup](../design/sprints/119-cleanup/sprint-119.md)
  - Big list, not started.
  

- [120-plugin-feature-cleanup](../design/sprints/120-plugin-feature-cleanup/sprint-120.md)
  - see sprint file for Iterations 1-6 
  - **COMPLETE**

- 121-songs
  - song test fixtures / song test list
  - song drills/games
  - song library User-facing list
  - added songs/sprint-121 as a work area for new songs, so they don't collide or get lost in the old files, which should be removed in this sprint.
  - added songs/tests/chart-test-fixture.js which was there but not in test-song-list.json
  - added songs/tests/piano-listener-guitar-wite-out-fixture.json

- [122-persistence](../design/sprints/122-persistence/sprint-122.md)
  - [Iteration 1: persistence matrix](../design/sprints/122-persistence/sprint-122.md#iteration-1-define-scope-and-persistence-matrix) : DONE
  - [Iteration 2: stylesheets/color themes](../design/sprints/122-persistence/sprint-122.md#iteration-2-fix-user-colors-and-stylesheets) : DONE
  - [Iteration 3: tunings](../design/sprints/122-persistence/sprint-122.md#iteration-3-fix-mytunings-and-ensure-user-tuning-works) : DONE
  - [Iteration 4: USER Theme](../design/sprints/122-persistence/sprint-122.md#iteration-4-fix-user-themes) :  DONE
  - [Iteration 5: visibleTables](../design/sprints/122-persistence/sprint-122.md#iteration-5-fix-visible-tables) : Ensure visible tables doesn't clobber tables in Model--allowed to persist without View. : DONE
  - [sprint-122-report-1: filters to keep](../design/sprints/122-persistence/122-report-1.md#sprint-122-filters-to-keep) : everything filtered : DONE

  - **SPRINT COMPLETE**

- 123-helpfile
  - finish plugin help file
  - move Themes to Themes gallery at end of helpfile - DONE

- 124-build-process
  - get tar deployment working
  - include version 
  - include README/CHANGELOG

- [125-tonal-plugin](../design/sprints/125-tonal-plugin/sprint-125.md)
  - promoted from sprint-903 on 20260602
  - Hand-wavy Design request in [125-design](../design/sprints/125-tonal-plugin/125-design.md)
  - Design-sketch document by Copilot: [903-design-sketch](../design/sprints/125-tonal-plugin/125-design-sketch.md) 
  - **COMPLETE**

- [126-piano-listener](../design/sprints/126-piano-listener/sprint-126.md)
  - Piano needs to ignore col,row when Listening to multi-string instruments.  Notes are placed by MIDI num and algorithm.
  - Bonus: this works for all kinds of Notes, including Highlights, and Notes with **"owner"** which are temporary from plugins, so ArpeggioPlugin highlights get passed to the Listener.
  - Notes with **"owner"** are printed in bold, magenta in Chart > Notes
  - Setting **Instrument** in ArpeggioPlugin and FillPlugin now resets **strings** range.
  - **COMPLETE** 

# Future Sprints Unscheduled 

- 901-floating-windows

- 902-song-import
  - Notes/Sections
  - Color schemes
  - User Themes
  - Tunings
  - Be clear about which things in old and new song hang around
    

# Sprint Planning Rules

## Rules getting ready for Version 2

Copilot: Do not change core files without a design document or a chat confirming that coding is CORE-APPROVED.  All other changes require APPROVED in a design document or chat.  For example, we might say: **"Your recommendations in the implementation plan are APPROVED"**.

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

New document organization: 
- All sprints have a repository-unique number called the *"sprint-number"*, starting at 100.
- All sprints have a short-name.  For example, **sprint-111-fill-plugin** shown above has a *short-name* **fill-plugin**, and a *sprint-number* **111**.
- All sprints have the basic structure: 
  - listed in [sprints.md](../lifecycle/sprints.md)
  - have a directory in [**sprints directory:** _doco/design/sprints/](../../_doco/design/sprints/)
  - name of that directory is **\${sprint-number}-${short-name}/**
  - within that directory, something like these should exist, possibly with extra version numbers in the filenames: 
    - **sprint-${sprint-number}.md**   
      - *highly recommended, has stati, list of files included, and bullet points for Iterations, Rounds, and Features*
      - Use template [../design/sprints/sprint-NNN-TEMPLATE.md](../design/sprints/sprint-NNN-TEMPLATE.md)
    - **${sprint-number}-design.md**  
      - *Design team wish-list and product requirements, plus preliminary findings looking at the code and UI*
    - **${sprint-number}-implementation-plan.md**  
      - *Copilot-produced report sufficient to begin coding.  May have several versions for complicated sprints*
    - optional files: 
      - **${sprint-number}-report.md**  
        - *Copilot preliminary reports when implementation plan cannot be produced until structure is hashed out and existing code is walked*
      - **${sprint-number}-sketch.md**
        - *Copilot preliminary sketch to play role of Design team and hint at implementation plan*
      - any other files as needed, listed in **sprint-${sprint-number}.md**
      - Useful songfile test fixtures should be installed in [songs/tests/](../../songs/tests/) 


## Sprints prior to this structure

- Here are the directories that count as sprint-planning prior to putting new sprints in `_doco/design/sprints`
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
