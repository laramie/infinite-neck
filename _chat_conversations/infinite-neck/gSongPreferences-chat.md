# Question

Hi,

- We are considering adding a feature, and would like to know if the Model layer leaks to the Controllers or Views.
infinite-neck.js has appInit() which sets up everything in the browser.  We are only talking about browser app instances here.
Currently, infinite-neck own gSong, a single reference to the only Song instance allowed.

- In the proposed feature, infinite-neck will also own gSongPreferences, a Song instance that is only used for config set by whomever saved that Song instance as a song file. infinite-neck would open that song file, stash the Song instance on gSongPreferences, and access structs and getters to get, for example colorDicts.

- It could also call methods on that Song, which is trickier.  The specific use case here would be: get the first Section in the Song, and call to get its displayOptions.  But we don't want it poluting the jQuery space: displayOptions was designed to return a struct of all named displayOptions but not actively call into jQuery.

- We would allow two types of access:

    a) load preferences into the current song programmatically, feature by feature, for example, carefully apply properties from gSongPreferences, then apply properties from Song back to itself.

    b) bulk setting on opening the Song that goes into gSong.  This would be through the persistence model, or through Object.assign.

- Please walk infinite-neck and see what polutions we need to track down and refactor so that simply looking at a Song instance does not affect the other Song model or the View state.  Remembering there are several levels of accessing: 

    1) just look at getters or properties
    
    2) access displayOptions in the first Section, meaning get the first Section.  gotoSection() may be called.

    3) accessing other objects, such as myTunings

Some other notes: 

- userInstrumentTuning could be accessed.

- wirings and graveyard would not be accessed, but we should understand if they are dangerous to access.

- visibleNoteTables would definitely not be accessed.

- No Sections would be added, deleted, or moved, and no SectionNotes would be accessed.

- No code changes are requested.

- Please output your report in: 
`_chat_conversations/infinite-neck/gSongPreferences-chat.md`




# Copilot Response

## Short answer

Yes: the current browser app can safely **inspect** a second `Song` instance for some data, but it is **not safe to treat that second `Song` as a normal browser-active song object**.

The current split is:

- Safe enough now: reading plain persisted data and plain section data.
- Not safe now: calling many `Song` methods on a secondary instance, because several methods either query the live DOM directly or emit `EventBus` notifications that the browser handles against global `gSong`.
- Definitely unsafe: bulk `Object.assign(gSong, gSongPreferences)` on whole `Song` objects, because it aliases nested arrays/objects and breaks ownership assumptions such as `graveyard.song`.

## Main conclusion

If `infinite-neck.js` owns both `gSong` and `gSongPreferences`, then `gSongPreferences` should currently be treated as a **read-mostly persistence object**.

That means these patterns are acceptable:

- Read `gSongPreferences.colorDicts`
- Read `gSongPreferences.userInstrumentTuning`
- Read `gSongPreferences.theme`, `songName`, `defaultBPM`, `presentationMode`
- Read `gSongPreferences.sections[0]?.displayOptions`
- Read `gSongPreferences.getSections()[0]?.displayOptions`
- Read `gSongPreferences.myTunings` directly as data

These patterns are not safe in the browser today:

- Calling navigation methods like `gotoSection()` on `gSongPreferences`
- Calling methods that emit `EventBus` events from `gSongPreferences`
- Calling methods that inspect visibility through jQuery
- Using `TuningsLibrary` APIs as a way to read `gSongPreferences.myTunings`
- Shallow-copying one whole `Song` object onto another with `Object.assign`

## Why the leakage exists

The important architectural fact is that browser-side listeners still assume there is exactly one active song: global `gSong` in [infinite-neck.js](infinite-neck.js).

So if a second `Song` instance emits an event, the listeners in [infinite-neck.js](infinite-neck.js) do not switch to that instance. They keep reading and repainting from `gSong`.

That gives you two kinds of leakage:

1. A method on `gSongPreferences` can mutate `gSongPreferences` and also trigger browser redraw/update work for `gSong`.
2. A shallow copy between songs can make the two songs share nested arrays/objects, so later mutations leak between models even without UI work.

## Safety by access type

### 1. Just looking at getters or properties

Mostly safe, with caveats.

Safe reads:

- `colorDicts`
- `theme`
- `songName`
- `defaultBPM`
- `presentationMode`
- `userInstrumentTuning`
- `sections`
- `sections[0].displayOptions`
- `myTunings` when treated as plain data
- `wirings` when treated as plain data

Mostly-safe getters in the model layer:

- `Song.getSections()`
- `Song.getCurrentSection()`
- `Song.getRootKey()`
- `Song.getRootKeyLead()`
- `Song.getRootNoteName()`
- `Song.getLeadNoteName()`
- `Song.getDefaultTableID()`
- `Song.getDisplayOptionsInEffect(currSection, defaultDisplayOptions)`
- `Section` getters like `getRootKey()`, `getRootKeyLead()`, `getRootNoteName()`, `getLeadNoteName()`, `noteIDToDisplayName()` in [Section.js](Section.js)

Caveats:

- `getBeat()` and `getBeats()` are read-like, but they normalize stored values and may write corrected values back into the section. That is local model mutation, not UI pollution.
- `getCurrentSection()` is safe only in the sense that it does not touch DOM or events. It still depends on the song's current index state.

Not safe as a read API:

- `Song.getVisibleTunings()` in [Song.js](Song.js) queries jQuery visibility from the live DOM.
- `Song.getVisibleTuningIDs()` in [Song.js](Song.js) also queries jQuery visibility from the live DOM.

Those two methods are direct model-to-view leakage and should not be used on `gSongPreferences`.

### 2. Accessing `displayOptions` in the first `Section`

This is safe **if you access the section directly**.

Safe patterns:

```js
const firstSection = gSongPreferences.sections[0];
const options = firstSection?.displayOptions;
```

or:

```js
const firstSection = gSongPreferences.getSections()[0];
const options = firstSection?.displayOptions;
```

This is not safe:

```js
gSongPreferences.gotoSection(0);
const options = gSongPreferences.getCurrentSection().displayOptions;
```

Why it is not safe:

- `Song.gotoSection()` in [Song.js](Song.js) mutates `gSectionsCurrentIndex`
- If the song is not headless, it calls `requestUiClearAndReplaySection()`
- It also calls `publish_SectionChanged()`
- Those emit browser `EventBus` activity
- The `EventBus` handlers in [infinite-neck.js](infinite-neck.js) operate against global `gSong`, not against the song instance that emitted the event

So `gotoSection()` on `gSongPreferences` can cause visible browser work for the main app song.

### 3. Accessing other objects such as `myTunings`

Reading `gSongPreferences.myTunings` directly is fine as long as you treat it as plain JSON-like data.

Unsafe pattern:

- Using [TuningsLibrary.js](TuningsLibrary.js) functions to interpret or manipulate `gSongPreferences.myTunings`

Reason:

- `TuningsLibrary` imports `getSong()` from [infinite-neck.js](infinite-neck.js)
- `getMyTuningsStore()` resolves through global `gSong`
- many `TuningsLibrary` functions also touch jQuery and installed tuning tables

So `TuningsLibrary` is not a neutral utility layer for an arbitrary `Song`; it is a browser controller/view helper bound to the active app song.

## Specific dangerous areas

### A. EventBus emission from `Song`

The following `Song` methods in [Song.js](Song.js) are browser-coupled because they emit UI or section events:

- `addWiring()`
- `removeWiring()`
- `publish_SectionChanged()`
- `publish_UpdateSectionStatus()`
- `publish_SectionMoved()`
- `requestUiClearAll()`
- `requestUiReplay()`
- `requestUiFullRepaint()`
- `requestUiClearHighlights()`
- `requestUiResetNoteNames()`
- `requestUiShowBeats()`
- `requestUiClearAndReplaySection()`

And many higher-level methods call those helpers:

- `addSection()`
- `addSectionAfterCurrent()`
- `moveBeatsLater()`
- `deleteBeat()`
- `prevNextBeat()`
- `firstSection()`
- `lastSection()`
- `prevSection()`
- `nextSection()`
- `gotoSection()`
- `gotoNextSection()`
- `gotoPrevSection()`
- `newSection()`
- `addCloneSection()`
- `deleteCurrentSection()`
- `moveSectionToEND()`
- `moveSectionTo()`

For a secondary browser-side song, those should all be considered unsafe unless they are explicitly refactored into pure model operations.

### B. `EventBus` listeners assume global `gSong`

The listeners are registered in [infinite-neck.js](infinite-neck.js), and the app-level helpers they call use `getSong()` from the same module.

That means event payloads are not enough to make the app operate on `gSongPreferences`. The listeners continue to read the active browser song.

This is the core reason a second `Song` instance is not isolated today.

### C. `graveyard` has a live back-reference

`SongPersistence` in [SongPersistence.js](SongPersistence.js) does this during construction:

- constructs `this.graveyard`
- calls `this.graveyard.setSong(this)`

So `graveyard` is not just passive persisted data. It holds a live reference back to its owning `Song`.

Implications:

- reading `graveyard.records` is fine
- calling `graveyard.getRecords()` and `graveyard.getRecordCount()` is fine
- calling `graveyard.buildGraveyardTable()` only builds HTML text, so it is relatively safe if all you want is a string
- calling `graveyard.raise()` is not safe: it mutates song state, may call `chuseStylesheet()`, emits `EventBus` messages, and requests repaint work

Also, if you shallow-copy a `Graveyard` from one song to another, its `.song` back-reference will still point at the old owner unless manually repaired.

### D. `Object.assign` between whole songs is unsafe

This is the biggest data-integrity risk in your proposed option `(b)`.

If you do something like:

```js
Object.assign(gSong, gSongPreferences);
```

you do **not** get an isolated copy. You get shared nested references for objects and arrays such as:

- `sections`
- `myTunings`
- `visibleNoteTables`
- `colorDicts`
- `userInstrumentTuning`
- `wirings`
- `graveyard`

That creates at least four problems:

1. Mutating one song can mutate the other through shared references.
2. `graveyard.song` can still point at the wrong owner.
3. `sections` and contained section objects become shared live model objects.
4. later UI/controller code may unknowingly operate on aliased state.

So whole-object `Object.assign` should be treated as unsafe for `Song` instances.

Whitelisted copy of selected fields is fine. Whole-song shallow assignment is not.

### E. `displayOptions` itself is passive, but applying it is not

The `displayOptions` struct stored on a `Section` is passive data.

The polluting part is not the data; it is the browser-side apply path in [infinite-neck.js](infinite-neck.js):

- `displayOptionsToControls(options)` writes many jQuery controls, updates CSS vars, mutates some `Song` fields, and calls repaint work
- `controlsToDisplayOptions()` reads browser controls to manufacture a struct
- `sectionChanged()` reads `getCurrentSection().displayOptions` and pushes it into the controls/UI

So:

- reading `firstSection.displayOptions` from `gSongPreferences` is safe
- feeding that struct into `displayOptionsToControls()` is intentionally a UI operation, not a model read

### F. `userInstrumentTuning` is safe to read, unsafe to apply blindly

Reading `gSongPreferences.userInstrumentTuning` is safe.

The active apply path in [infinite-neck.js](infinite-neck.js) does more than just inspect it:

- `updateAfterOpenSong()` finds the live runtime `USER` tuning
- hides tunings in the UI
- `Object.assign`s the persisted tuning onto the live runtime tuning object

That is app state mutation, which is fine for normal song open, but it is not a neutral read path for a preferences-only secondary song.

### G. `wirings` are passive as data, but not as methods

The `Wiring` class in [Wiring.js](Wiring.js) is plain data.

Reading `song.wirings` is safe.

Calling `song.addWiring()` or `song.removeWiring()` is not safe in the browser because those methods emit `EventBus` notifications.

## Headless mode helps, but it is not a full isolation boundary

`Song.setHeadless(true)` in [Song.js](Song.js) is useful, but it is not a complete safety guarantee.

It suppresses some UI/event behavior, especially in methods that explicitly check `isHeadless`, such as `gotoSection()` and `publish_UpdateSectionStatus()`.

But it does not make the whole class pure:

- `getVisibleTunings()` and `getVisibleTuningIDs()` still use jQuery
- `requestUi*` helpers do not themselves check `isHeadless`
- `publish_SectionMoved()` has no `isHeadless` guard
- `addWiring()` and `removeWiring()` do not check `isHeadless`
- `graveyard.raise()` is outside `Song` and still emits events

So headless mode is useful as a mitigation, not as a proof of safety.

## Practical answer for your proposed feature

### Safe today

You can load a second persisted song into `gSongPreferences` and safely use it as a data source for:

- colors
- theme-related persisted values
- `userInstrumentTuning` data
- first-section `displayOptions`
- other section-owned plain data

Provided that you follow these rules:

1. Read section data by indexing into `sections` or `getSections()`. Do not navigate with `gotoSection()`.
2. Read `myTunings` directly from the song object. Do not go through `TuningsLibrary`.
3. Treat `graveyard` and `wirings` as data only. Do not call active methods on them.
4. Do not call DOM-bound methods like `getVisibleTunings()`.
5. Do not whole-object `Object.assign` one `Song` onto another.

### Not safe today

These are not currently isolated enough for `gSongPreferences` in the browser:

- using `Song` navigation methods as part of preference lookup
- using controller/helper modules that resolve through global `gSong`
- assuming headless mode makes every model API safe
- shallow-copying nested song state into `gSong`

## Refactors to track down if you want true two-song safety

If the goal is that “simply looking at a `Song` instance does not affect the other `Song` model or the View state,” these are the key refactors to track:

1. Split pure query APIs from browser-active APIs in [Song.js](Song.js).
2. Remove jQuery from `Song.getVisibleTunings()` and `Song.getVisibleTuningIDs()`.
3. Stop using global `gSong` inside utility/controller modules when the operation should target an arbitrary song.
4. Change `EventBus` payloads and listeners so they carry and honor the source song, or move UI emission fully out of the model.
5. Treat `graveyard` as either pure data or a controller-owned helper, not a model object with a back-reference.
6. Replace whole-song shallow assignment with whitelisted, deep-cloned field transfer.

## Bottom line

For the exact use case you described, the feature is viable **if `gSongPreferences` is treated as a persistence/read model, not as a second active browser song**.

The safest current pattern is:

- load `gSongPreferences = new Song(json)`
- optionally set it headless as a defensive measure
- read plain properties and section structs directly
- copy only selected values into `gSong`
- deep-clone copied nested structs where needed
- never drive browser helpers or navigation methods from `gSongPreferences`

So the answer is not “the model is cleanly isolated already.”

The answer is: **plain data reads are mostly safe, but the browser-facing `Song` API is still mixed with UI/event concerns, and those mixed methods must be avoided or refactored before a second live `Song` can be considered isolated.**