I’m tracing the song save/load path and the excluded fields so I can separate true persistence blockers from harmless runtime-only defaults.

Searched for regex `persistentSongFileReplacer|prepareForSave|JSON.stringify\(|visibleNoteTables|userColors|colorDicts|activeStylesheets|theme|tunings|myTunings|userInstrumentTuning|currentColorDict|noteNamesFuncArrDEFAULT|noteNamesFuncArr|gSongModelListener|isHeadless` (`**/*.js`), 200 results

Read [](file:///home/laramie/infinite-neck/SongPersistence.js)

Read [](file:///home/laramie/infinite-neck/Song.js#1-1), lines 1 to 260

I’ve confirmed the replacer is only one part of the story. Next I’m inspecting the actual shapes of tunings, theme data, and visible-table handling so we can judge persistence risk instead of just field names.

Read [](file:///home/laramie/infinite-neck/Song.js#930-930), lines 930 to 1010

Searched for regex `userColors|colorDicts|currentColorDict|activeStylesheets|theme|getThemes|buildUserColors|applyStylesheetsTo_gUserColorDict` (`**/*.js`), 200 results

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#1-1), lines 1 to 120

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#340-340), lines 340 to 430

Read [](file:///home/laramie/infinite-neck/graveyard.js)

I’ve found one likely naming trap already: the replacer excludes `tunings`, but the live song model stores custom tunings in `myTunings`. I’m verifying whether that means tunings already persist and the real sprint-122 issue is load/merge semantics rather than serialization.

Searched for regex `"myTunings"|myTunings\s*=|getMyTuningsStore\(|visibleNoteTables|showTuningsForTablesInFile` (`**/*.{json,js,md}`), 200 results

Read [](file:///home/laramie/infinite-neck/themeFunctions.js#1-1), lines 1 to 260

Read [](file:///home/laramie/infinite-neck/userColors.js#1-1), lines 1 to 220

Read [](file:///home/laramie/infinite-neck/colorFunctions.js#227-227), lines 227 to 460

I’ve confirmed `myTunings` already appears in real song files, while theme-related state is split across several different fields. I’m checking which of those are canonical versus derived so sprint-122 doesn’t persist duplicate or conflicting theme state.

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#850-850), lines 850 to 975

Read [](file:///home/laramie/infinite-neck/templates/themes.builder.js)

Read [](file:///home/laramie/infinite-neck/_doco/lifecycle/TODO.md#90-90), lines 90 to 110

Read [](file:///home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js#60-60), lines 60 to 230

Searched for regex `userTheme|activeStylesheets|theme\)|getThemes\(\)\["USER"\]|currentColorDict` (`**/*.js`), 46 results

Read [](file:///home/laramie/infinite-neck/bin/song-file-schema.js#230-230), lines 230 to 280

Read [](file:///home/laramie/infinite-neck/bin/song-file-schema.js#280-280), lines 280 to 336

I’ve separated serialization risk from ownership risk. The remaining piece is whether save/load mutates the song model in a way that would make `visibleNoteTables` or tuning persistence unsafe in headless or partial-view flows.

Searched for regex `removeUnusedTablesFromMemoryModel|markVisibleTablesForFileSave|getVisibleTablesSelect|showDefaultTunings|showTuningsForTablesInFile` (`**/Song.js|infinite-neck.js|TuningsLibrary.js`), no results

Read [](file:///home/laramie/infinite-neck/Song.js#380-380), lines 380 to 430

Read [](file:///home/laramie/infinite-neck/Song.js#900-900), lines 900 to 970

Searched for text `userTheme` (`**/*.js`), 2 results

Searched for text `removeUnusedTablesFromMemoryModel` (`**/Song.js`), 2 results

Read [](file:///home/laramie/infinite-neck/Song.js#888-888), lines 888 to 928

I’ve confirmed `visibleNoteTables` itself does not clobber note-table model data; the save path only strips empty section tables. I’m doing one last pass on whether any of the currently excluded theme/color fields are already present in real song files, which matters for sprint-122 migration scope.

Searched for regex `"userColors"|"colorDicts"|"userTheme"|"activeStylesheets"|"theme"` (`**/songs/**/*.json`), 85 results

Read [](file:///home/laramie/infinite-neck/songs/tests/persistence/All-Chords.json#1-1), lines 1 to 80

Read [](file:///home/laramie/infinite-neck/themes.js#1-1), lines 1 to 60

I have enough to separate the blockers from the noise. I’m doing one short check on the runtime-only excluded fields so I can explicitly call out which ones are harmless primitives and which ones are real pointer/cycle hazards.

Searched for regex `randomSectionHistory|gSongModelListener|gFirstBeatSeen|isHeadless|noteNamesFuncArrDEFAULT|noteNamesFuncArr|fretLengths` (`**/*.js`), 90 results

Read [](file:///home/laramie/infinite-neck/Constants.js#1-1), lines 1 to 80

Searched for regex `getSong\(\)\.userColors|song\.userColors|userColors\s*=|gUserColorDict\.dict` (`**/*.js`), 24 results

No code changes made.

**Summary**
The replacer exclusions do not all matter equally for sprint-122. The real design blockers are:

1. `colorDicts` vs `userColors` vs `theme`/`userTheme`: there is no single canonical persistence contract yet.
2. `tunings` is the wrong persistence target for V2; `myTunings` and `visibleNoteTables` are the real persisted model.
3. `visibleNoteTables` itself is structurally safe, but the current save path still derives it from the live DOM, which conflicts with your “allowed to persist without View” requirement.

Most of the other excluded fields are runtime-only noise, not blockers.

**Findings**

1. `tunings` should stay excluded; it is not the right V2 persistence field.
The schema explicitly forbids `tunings` and expects `myTunings` instead in song-file-schema.js. Real song files already persist `myTunings` and `visibleNoteTables`, for example no-arpeggio-first.json and no-arpeggio-first.json.

Why this matters:
- The replacer excluding `tunings` is not the main blocker for “tunings persists”.
- `myTunings` already persists because it is not excluded in SongPersistence.js.
- Internal docs already call `tunings` a denormalized snapshot of `visibleNoteTables`, not the real contract, in TODO.md.

Risk assessment:
- No obvious JSON cycle.
- But it is still bad persistence data because it is a live-reference/derived snapshot and can carry runtime state like `visible`.

Conclusion:
- Sprint-122 should treat `tunings` as legacy/derived and keep it filtered.
- If “tunings persists” means user/custom tunings, the design target is `myTunings`, not `tunings`.

2. `visibleNoteTables` is safe JSON, but the current save source is View-dependent.
`visibleNoteTables` is already part of the persisted song model and round-trips in tests in song-api-load-V2.test.js and song-api-load-V2.test.js. The model save path just assigns it in Song.js.

Why this matters:
- This field does not inherently clobber the note-table model.
- `prepareForSave()` only removes empty section tables via `removeUnusedTablesFromMemoryModel()` in Song.js, not hidden-but-populated tables.
- The actual problem is `updateMemoryModelPreFileSave()` scraping DOM visibility before save in infinite-neck.js.

Risk assessment:
- No cycle risk; it is an array of strings.
- The blocker is behavioral: in no-View/headless flows, DOM-derived visibility can overwrite the model with the wrong value.

Conclusion:
- This is a real sprint-122 design blocker, but not because of the replacer.
- The required rule is: no-View save must preserve model visibility state or accept explicit `visibleTableIds`; it must not infer visibility from the DOM.

3. `colorDicts` is a design blocker because it is derived/runtime-owned, not because it is structurally unsafe.
`colorDicts` is initialized empty in SongPersistence.js, excluded by the replacer in SongPersistence.js, and rebuilt at runtime via default installation and UI functions in infinite-neck.js and colorFunctions.js.

Why this matters:
- On open, the app recreates default color dictionaries and rebuilds color UI state in infinite-neck.js.
- `colorDicts` contains default/system entries plus checked/computed flags and current ordering logic in colorFunctions.js.
- That means persisting full `colorDicts` would duplicate a lot of state that is regenerated on load anyway.

Risk assessment:
- No obvious cycle risk; it is plain object data.
- The problem is “extra glop” and conflicting ownership:
  - system/default dictionaries are regenerated anyway
  - `checked` and active stylesheet state are partly derived
  - persisting everything would blur the line between user-authored theme data and runtime-expanded style stacks

Conclusion:
- `colorDicts` is a real blocker for sprint-122 design because you need a canonical contract first.
- If sprint-122 wants “color themes persist”, the design should probably not persist raw `colorDicts` wholesale.

4. `userColors` is also a design blocker, but for migration/hydration reasons.
The save path still writes `userColors` in Song.js, but the replacer filters it out in SongPersistence.js. Older and existing songs still contain `userColors`, such as three-chord-wonder.json and display-options.json.

Why this matters:
- `userColors` is plain JSON and historically persisted.
- But the current load path does not appear to hydrate song `userColors` back into the live `gUserColorDict.dict`; the runtime uses the global user-color object from userColors.js and rebuild helpers in colorFunctions.js.

Risk assessment:
- No cycle risk; it is plain nested JSON.
- The blocker is semantic:
  - old files may contain it
  - current runtime contract is global-first, not song-first
  - there is no clear import step on load

Conclusion:
- If sprint-122 wants persisted user color choices, `userColors` is a valid JSON candidate.
- But the design must define when and how it hydrates into the live global palette state.

5. `userTheme` already persists structurally, but load behavior is incomplete.
`userTheme` is not excluded by the replacer, the schema allows it in song-file-schema.js, real songs already contain it such as V2-tester.json, and the UI writes it in themes.builder.js.

Why this matters:
- Structurally, this part is close: it serializes as plain JSON.
- But the open-song flow only selects `song.theme` in infinite-neck.js and does not obviously hydrate `song.userTheme` back into `gThemes["USER"]` before selecting `"USER"`.

Risk assessment:
- No cycle risk; plain object.
- The blocker is load semantics, not serialization.

Conclusion:
- For “user Themes persist”, the blocker is not the replacer.
- The blocker is defining canonical hydration of `userTheme` during load.

## sprint-122 filters to keep

**Not Design Blockers**
These excluded fields are mostly runtime-only and can stay filtered unless sprint-122 explicitly wants them:

- `gSectionsCurrentIndex` in SongPersistence.js
  - Primitive runtime cursor.
  - No cycle risk.
  - Usually should not persist as canonical song content.

- `gFirstBeatSeen` in SongPersistence.js
  - Runtime flag.
  - No cycle risk.

- `randomSectionHistory` in Song.js
  - Just recent section indices.
  - No cycle risk.
  - Volatile session state, not durable content.

- `isHeadless` in SongPersistence.js
  - Runtime mode flag.
  - No cycle risk.

- `noteNamesFuncArr` and `noteNamesFuncArrDEFAULT` in SongPersistence.js
  - Arrays of strings from Constants.js.
  - No cycle risk.
  - Mostly defaults/runtime config, unless sprint-122 intentionally wants song-specific function labels.

- `fretLengths` in SongPersistence.js
  - Derived from constants in Constants.js.
  - No cycle risk.
  - Clear example of “extra glop defaulted from song load anyway”.

- `gSongModelListener` in SongPersistence.js
  - This is the one exclusion that is a genuine pointer hazard.
  - If ever non-null, it is exactly the kind of callback/reference field that should not be persisted.

**Direct Answer To Sprint-122**
The exclusions that materially block sprint-122 design are:

1. `colorDicts`
2. `userColors`
3. `tunings`, but only in the sense that it can mislead the design toward the wrong field
4. `visibleNoteTables`, not because it is excluded, but because its save semantics are still View-coupled
5. `userTheme`, not excluded, but it is part of the same unresolved persistence design

The exclusions that do not materially block sprint-122 are:

1. `fretLengths`
2. `noteNamesFuncArr`
3. `noteNamesFuncArrDEFAULT`
4. `gSectionsCurrentIndex`
5. `gFirstBeatSeen`
6. `randomSectionHistory`
7. `isHeadless`

**Bottom Line**
The sprint-122 persistence design should probably use this shape:

1. Persist `myTunings`
2. Persist `visibleNoteTables`
3. Persist `theme`
4. Persist `userTheme` with explicit load hydration
5. Decide whether `userColors` is the canonical persisted color customization payload
6. Keep `tunings` and likely `colorDicts` filtered as derived/runtime-expanded state

If useful, I can turn this into a short sprint-122 planning note in `_doco/design/sprints/122-persistence/` without changing runtime code.