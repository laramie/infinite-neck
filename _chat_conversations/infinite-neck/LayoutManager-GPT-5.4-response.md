User: Please read the request in _chat_conversations/infinite-neck/LayoutManager.md and produce a design review and recommendations.

GitHub Copilot: I’m reviewing the repository structure around Song, Section, NoteTableController, tunings, and dockable state so I can ground the design review in the existing code rather than the attachment alone.

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#1-1), lines 1 to 320

Read [](file:///home/laramie/infinite-neck/README.md)

Read [](file:///home/laramie/infinite-neck/Section.js)

I’ve confirmed the core model file is lowercased as song.js, and Section currently has no layout-related state yet. Next I’m tracing how tables are created, shown, floated, and section navigation currently works.

Read [](file:///home/laramie/infinite-neck/dockable.js)

Read [](file:///home/laramie/infinite-neck/song.js#1-1), lines 1 to 320

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#1-1), lines 1 to 360

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#1-1), lines 1 to 320

The current system is still using tuning checkbox visibility and direct DOM show/hide, while floating state is stored in window._dockableFloatState. I’m tracing the exact reinsertion and section-change paths so I can identify where duplicates and layout loss come from.

Searched for regex `requestReinstallAllTuningsTables|showHideTuning|btnFloatSection_|makeDivDockable|dockDivInPage|sectionChanged|nextSection|gotoSection` (`**/*.js`), 133 results

Read [](file:///home/laramie/infinite-neck/Constants.js)

Read [](file:///home/laramie/infinite-neck/templates)

Read memory infinite-neck-jest.md

The install path confirms a core issue: myTunings changes trigger table reconstruction, and float/dock uses inline handlers plus window globals. I’m reading the table install/build code and the section persistence pattern next so I can propose a clean replacement boundary.

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#500-500), lines 500 to 727

Read [](file:///home/laramie/infinite-neck/song.js#600-600), lines 600 to 900

Searched for regex `displayOptions|constructSection|normalizeSection|addSection|SectionV2|revive` (`**/song.js`), 37 results

Read [](file:///home/laramie/infinite-neck/TableBuilder.js#1-1), lines 1 to 280

Read [](file:///home/laramie/infinite-neck/song.js#440-440), lines 440 to 560

Searched for regex `ReinstallAllTuningsTables|install.*Tunings|append\(|#tabledest|tabledest|buildNoteTable` (`**/infinite-neck.js`), 20 results

Searched for regex `btnSaveLayout|editLayout|layout` (`**/*.{js,html,css}`), 4 results

Read [](file:///home/laramie/infinite-neck/SectionV2.js#1-1), lines 1 to 280

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#960-960), lines 960 to 1045

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#1680-1680), lines 1680 to 1815

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#2370-2370), lines 2370 to 2434

Searched for regex `updateMemoryModelPreFileSave|download|save.*song|JSON.stringify\(getSong|dump\(` (`**/infinite-neck.js`), 19 results

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#730-730), lines 730 to 815

Searched for regex `displayOptionsToControls|controlsToDisplayOptions|viewOptions|btnDeleteDisplayOptions` (`**/infinite-neck.js`), 15 results

Searched for regex `clearAll\(|fullRepaint\(|resetNoteNames\(|showBeats\(` (`**/NoteTableController.js`), 10 results

Searched for regex `WiringBuilder|templates.html|templates.css` (`**/templates/*`), no results

I have the persistence and rebuild path now: save currently snapshots visible tables from the live DOM, and section changes do not carry any dedicated layout state. I’m pulling in the existing template-based panel pattern next so the review can cover how a LayoutController should fit the repo’s newer UI style.

Searched for regex `prepareForSave\(|visibleNoteTables|myTunings|userInstrumentTuning|theme|defaultBPM` (`**/song.js`), 18 results

Read [](file:///home/laramie/infinite-neck/templates/WiringBuilder.js)

Read [](file:///home/laramie/infinite-neck/templates/templates.html)

Read [](file:///home/laramie/infinite-neck/templates/templates.css)

Read [](file:///home/laramie/infinite-neck/song.js#896-896), lines 896 to 940

Searched for regex `setupOpenFile|FileReader|JSON.parse|new Song\(|addSections\(|prepareForSave` (`**/infinite-neck.js`), 17 results

Searched for regex `myTuningsTable|dropDownSectionOrder|txtCaption|btnNewSection|Section menu|Tunings` (`**/infinite-neck.html`), no results

Read [](file:///home/laramie/infinite-neck/infinite-neck.html)

Read [](file:///home/laramie/infinite-neck/infinite-neck.html)

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#812-812), lines 812 to 890

Searched for regex `<select|btnSave|editLayout|dropDownSectionOrder|txtCaption|btnNewSection|myTuningsTable|tabledest` (`**/infinite-neck.html`), no results

Searched for regex `<template|templates.html|Wiring-template` (`**/infinite-neck.html`), no results

The song load path is important here: openSong assigns raw JSON onto gSong first, then reconstructs sections, so any new layout objects need an explicit revive path rather than relying on plain assignment. I’m locating the real app HTML and section controls now so I can cover where the new layout UI should actually live.

Searched for regex `tabledest|dropDownSectionOrder|txtCaption|myTuningsTable|btnSaveLayout|editLayout|fileInput` (`**/*.html`), 9 results

Searched for regex `tabledest|dropDownSectionOrder|txtCaption|myTuningsTable|btnSaveLayout|editLayout|fileInput` (`**/*.js`), 23 results

Read [](file:///home/laramie/infinite-neck)

Read [](file:///home/laramie/infinite-neck/index.html#1-1), lines 1 to 420

I have enough of the runtime path. I’m reading the section controls in the real page so I can map the layout selector, save button, and layout visibility editor onto the existing UI without hand-waving.

Read [](file:///home/laramie/infinite-neck/index.html#530-530), lines 530 to 635

Read [](file:///home/laramie/infinite-neck/index.html#2086-2086), lines 2086 to 2102

Searched for regex `btnHamburger|showWiringButton|floatDockableButton|moveyButton` (`**/instrument.css`), 8 results

Read [](file:///home/laramie/infinite-neck/instrument.css)

No code changes made. This is design review only.

**Findings**
1. The current rebuild-all table flow is fundamentally incompatible with persistent layouts.
The root of the duplicate/orphan problem is that the app still treats instruments as disposable DOM. infinite-neck.js builds note tables into #tabledest, and infinite-neck.js clears that container and rebuilds everything. The visibility checkbox path in TuningsLibrary.js triggers that reinstall flow, while the float button emitted by TableBuilder.js moves an existing div into dockable.js. Those two models conflict. If one path rebuilds while the other path detaches, duplicates are inevitable.

2. dockable.js is storing runtime state at the wrong boundary.
dockable.js and dockable.js manage floating windows as a pure DOM concern, but the persisted state lives on window._dockableFloatState and the module re-exports functions onto window at the bottom of the file. That works for ad hoc floating, but it cannot be the source of truth for song layouts. Layout state belongs in Song and Section. dockable.js should only be a transport layer that can apply or report a float rectangle.

3. The proposed main plus floating shape is not expressive enough for the actual UX.
A layout needs to represent at least four states for each instrument:
visible and docked,
visible and floating,
hidden but available in this song,
not applicable or removed.
The proposed model with main plus floating cannot represent hidden but still available instruments cleanly. It also cannot represent future non-instrument windows very well, like your tblS6_observer example. I would not use main plus floating as the primary persisted shape.

4. The section semantics are still underspecified, and that is where layout loss will happen.
Right now section changes restore section-level controls and display options in infinite-neck.js, but there is no section-owned layout selection or apply step. Save currently snapshots visible tables from the live DOM in infinite-neck.js and stores them as song-level visibleNoteTables in song.js. That is too weak for the behavior you want. You need explicit rules for:
what a section stores,
what “carry over to next section” means,
what happens when a section references no layout,
what happens when a layout is renamed or deleted,
whether editing a layout mutates a shared named layout or only the current section’s working copy.

5. Song load will need explicit revive logic for layouts.
The load path in infinite-neck.js does a broad Object.assign onto the Song instance and then separately reconstructs sections. Song currently revives sections in song.js and song.js, but nothing similar exists for layouts. If Layout and LayoutManager are added without a revive path, they will come back as plain objects and you will get inconsistent behavior after open-song.

6. You should normalize on table IDs, not div IDs, as the canonical layout key.
Your spec already uses tblS6_1, tblBass_1, and that is the right choice because section note data is also keyed that way. The current float path works off div IDs such as divS6_1. That is okay as a derived DOM detail, but it should never be the persisted key. Persist table IDs only. Derive div IDs with Constants.TABLEDIV_ID_PREFIX when needed.

7. I would not put HTML rendering on the model.
You proposed LayoutManager.getLayoutSelect(). Given the newer template-controller direction, I would keep the model data-only and let LayoutManagerController render the select. WiringBuilder.js is already moving in that direction. A convenience HTML method is possible, but it is the wrong long-term boundary.

**Recommended Model**
I would use three layers, not two.

Persisted model layer:
LayoutEntry
Fields:
tableID
visible
placement with values docked or floating
floatRect with left, top, width, height or null
kind with values instrument, observer, panel if you want future-proofing
Methods:
clone
revive
setDocked
setFloating
setVisible

Layout
Fields:
id
entries as an object keyed by tableID
Methods:
revive
ensureEntry(tableID, defaults)
getEntry(tableID)
getVisibleDockedTableIDs(myTuningsOrder)
getVisibleFloatingEntries()
renameTable(oldTableID, newTableID)
removeTable(tableID)

LayoutManager
Fields:
layouts keyed by layout ID
defaultLayoutID
Methods:
revive
getLayoutIDs
getLayout(id)
ensureLayout(id)
saveLayout(id, snapshot)
renameLayout(oldID, newID)
deleteLayout(id, fallbackID)
renameTableAcrossLayouts(oldTableID, newTableID)
removeTableAcrossLayouts(tableID)

Section
Add:
activeLayoutID
I would keep only the selected layout reference on Section, not a full copied layout object.

Song
Add:
layoutManager
Possibly:
lastResolvedLayoutID if you want a session fallback for sections that do not yet have an explicit choice

Runtime-only layer:
InstrumentRegistry or LayoutRuntime
This should not be persisted. It owns the single live DOM instance per instrument and knows how to:
build an instrument once,
find its table div,
dock it into #tabledest,
float it through dockable.js,
hide it without destroying it,
snapshot current runtime state into a Layout,
apply a Layout to the DOM.

dockable.js helper layer:
Keep it small. It should manage a floating host for a known element and be able to:
float one element with an optional rectangle,
dock one element back to a known parent,
read the current float rectangle,
apply a saved float rectangle.
It should not be the owner of layout truth.

**Concrete Recommendation On The Data Shape**
I would change your proposed Layout shape from this:
main array
floating object

to this:
entries keyed by table ID

Reason:
one object per table ID is the only shape that cleanly supports visible, hidden, docked, floating, future panels, rename, and migration.

If you strongly want to preserve the human-readable split for saved JSON, you can derive main and floating for export or debugging, but I would not make that the authoritative internal model.

**Recommended User Flows**
1. App start or open song
Song revives layoutManager.
Each section revives activeLayoutID.
InstrumentRegistry ensures one DOM instance exists for each myTunings entry.
Current section’s resolved layout is applied by moving existing DOM, not rebuilding.

2. Clone or add tuning
The new tuning is cloned into myTunings as today.
InstrumentRegistry builds its note table once.
The current active layout gets a new entry with visible true and placement docked.
Other layouts do not need to auto-include it unless you explicitly want that behavior.
My recommendation is current layout only.

3. Float an instrument
The existing DOM node moves into dockable.js.
The active layout entry for that table ID becomes visible true, placement floating, with floatRect updated.
No rebuild happens.

4. Dock an instrument
The existing DOM node moves back into #tabledest in myTunings order.
The active layout entry becomes visible true, placement docked.
No rebuild happens.

5. Hide an instrument from the current layout
Do not destroy the note table.
Mark the active layout entry visible false.
Registry hides or detaches that existing DOM node.
The instrument remains available in the layout editor for later re-enable.

6. Choose a layout in the Section page
Changing the select updates currentSection.activeLayoutID immediately.
Then the chosen layout is applied to the live DOM.
That choice persists on the section.

7. Move to next or previous section
If the destination section has activeLayoutID, apply it.
If it does not, inherit the currently resolved layout ID and persist that onto the destination section on first visit.
That gives you the “carry over” behavior without inventing hidden global state.

8. Save Layout
The button should act as Save As snapshot of the current live arrangement.
It captures the runtime arrangement into a named Layout in the manager.
Then currentSection.activeLayoutID becomes that new or overwritten layout ID.

**Specification Holes I Recommend Resolving Now**
1. Shared named layouts versus per-section copies
My recommendation: named layouts are shared objects. Sections store only activeLayoutID. Editing the live layout mutates that named layout. That matches the meaning of named presets like FullBand, Chorus, Verse, Guitars.

2. What happens if the Save Layout name already exists
My recommendation: overwrite only with explicit confirmation. Otherwise require a new name.

3. What happens if a section references a missing layout
My recommendation: fall back to layoutManager.defaultLayoutID. If that is missing, synthesize Default on load.

4. What happens when a layout is deleted
My recommendation: either block deletion while referenced, or require a fallback target and rewrite referencing sections.

5. What happens when a tuning ID is renamed
My recommendation: rename the table key everywhere:
section note data,
layout entries,
wiring references if needed,
any visible-table legacy fields during migration.
You already do part of this in song.js, but layout entries will need to join that path.

6. Whether non-instrument floating panels are first-class layout participants
My recommendation: yes, but not in the first implementation unless you need it immediately. Leave room for a kind field so you do not paint yourself into a corner.

7. Whether unsaved live edits should survive navigation without an explicit Save Layout
My recommendation: yes, by mutating the selected named layout live. If you do not want that, you need a separate scratch-layout concept, which is a real complexity increase.

**Controller Split I Would Use**
LayoutController
Owns the UI for one layout editor view:
list of available instruments,
visible toggle,
dock or float status,
maybe a button to focus the floating window.

LayoutManagerController
Owns:
the section-page layout select,
the Save Layout name field,
the Save Layout button,
rename or delete actions,
coordination with Section change events.

One naming note: I would keep all files spelled LayoutManager, not LayoutManger. The typo will become expensive once imports and search patterns spread.

**How This Fits The Existing Repo**
This direction aligns with the newer template/controller pattern shown in WiringBuilder.js, while avoiding model-generated HTML. It also respects the current song and section ownership model in song.js and song.js, but adds the missing revive path for layouts.

The most important architectural shift is this:
instrument DOM must become singleton-per-table-ID runtime state.
Once that is true, detach and attach works, floating works, section changes work, and duplicate tables stop appearing.

**Suggested Implementation Order**
1. Add LayoutEntry, Layout, LayoutManager, and revive support.
2. Add Section.activeLayoutID and load or save migration rules.
3. Introduce InstrumentRegistry as the single owner of live instrument DOM.
4. Refactor dockable.js into a pure helper with snapshot and apply APIs, no window state except what is strictly required by the browser.
5. Replace reinstall-all behavior for visibility and float or dock changes with targeted registry operations.
6. Add the section-page layout selector and Save Layout flow.
7. Replace the myTunings visibility checkbox semantics with layout editor semantics.

**Recommended Tests For The Next Iteration**
1. Song load revives LayoutManager and Section.activeLayoutID correctly.
2. Float then dock does not create duplicate DOM nodes.
3. Hide then re-show uses the same instrument instance.
4. Changing sections applies the correct layout and preserves singleton DOM.
5. Renaming a tuning ID updates layout entries.
6. Deleting or renaming a layout rewrites section references safely.

If you want, the next iteration can be a tighter design pass on just the model shape and the section-navigation rules before writing code.