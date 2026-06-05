# Persistence Matrix

This matrix is the central planning reference for sprint-122. It distinguishes between:

- library defaults shipped with the app
- runtime or expanded state built after load
- User-authored data that belongs in the songfile

The matrix is intended to answer five questions for each area:

1. What is the default source?
2. What object is canonical in memory today?
3. What, if anything, is already persisted in songfiles?
4. Is the current persistence shape correct, incorrect, or incomplete?
5. What design or coding is needed in this sprint?

| Area | Library or default source | Canonical runtime owner today | Songfile fields seen today | Status | Main risk or mismatch | Needed |
|----|----|----|----|----|----|----|
| User tunings | `tunings.js` system library plus `USER` concept | `Song.myTunings` plus runtime library lookups | `myTunings`, sometimes legacy confusion around `tunings` | Partly correct | `tunings` is a misleading denormalized snapshot; must not become the V2 contract | Keep `myTunings` canonical. Keep `tunings` filtered. Define `USER` tuning import/export and fallback behavior. |
| Visible tables | no real library object; currently derived from displayed instruments | `Song.visibleNoteTables`, but save path still scrapes DOM visibility | `visibleNoteTables` | Structurally correct, behaviorally incomplete | Current save flow depends on View/DOM, which blocks no-View persistence and can overwrite model truth | Make visibility persistence model-owned or explicitly caller-provided. Do not infer from DOM in headless/no-View flows. |
| Theme selection | `themes.js` library | selected theme id in runtime UI, plus `Song.theme` | `theme` | Mostly correct | Theme id alone is insufficient when `theme === "USER"` unless the actual user theme payload is also hydrated | Keep `theme` as persisted selector. Define fallback when named library theme is absent. |
| User theme payload | `themes.js` defaults, plus UI-created `USER` theme | runtime `gThemes["USER"]`, with `Song.userTheme` written by UI | `userTheme` in many files | Incomplete | Saved payload exists, but load path does not clearly hydrate `Song.userTheme` back into runtime `USER` theme before selection | Define `userTheme` as canonical songfile payload for custom themes and add explicit load hydration. |
| User colors base palette | built from `userColors.js` defaults and runtime merges | global `gUserColorDict.dict` | legacy/current `userColors` in many songs, but filtered by replacer now | Inconsistent | Save path writes it, replacer removes it, load path does not clearly import it back into runtime palette | Decide whether `userColors` is the canonical persisted user color payload. If yes, define save + hydration path. |
| Stylesheet/color scheme collection | default and recorded schemes expanded into `Song.colorDicts` | `Song.colorDicts` | intentionally filtered today | Derived/runtime-owned | Contains system sheets, checked flags, ordering, and other expanded state that duplicates library/runtime behavior | Do not persist wholesale until canonical subset is defined. Prefer smaller User-owned payloads over full runtime-expanded dicts. |
| Active stylesheet summary | calculated from checked schemes | `Song.activeStylesheets` | `activeStylesheets` appears in many files | Likely derived noise | It is rebuilt from stylesheet state and can drift from canonical persisted inputs | Either stop persisting or clearly mark as derived compatibility field. Not a primary sprint target. |
| Current chosen stylesheet | runtime selection among color schemes | `Song.currentColorDict` | appears inside DisplayOptions, not obviously song-level canonical state | Ambiguous | Mixed between section display-options behavior and song-level color customization | Clarify whether this is section-scoped display state, song-scoped preference, or derived UI convenience. |
| USER instrument tuning snapshot | runtime `USER` entry in tunings library | runtime library object plus `Song.userInstrumentTuning` persistence snapshot | `userInstrumentTuning` | Mostly useful, needs clearer role | Open path copies song snapshot into runtime USER tuning; ownership is split between library and song | Define it as a persistence transport object only, not a second canonical tuning store. |
| Runtime cursor and session flags | none | `gSectionsCurrentIndex`, `gFirstBeatSeen`, `randomSectionHistory`, `isHeadless` | schema allows some, replacer filters them | Runtime-only | They are transient session state, not durable song content | Keep filtered. No sprint-122 design work needed beyond documenting non-persistence. |
| Listener/pointer fields | none | `gSongModelListener` and similar callback refs | filtered | Runtime-only, hazardous | Real pointer/callback risk if serialized | Keep filtered permanently. |
| Derived defaults | `Constants`, computed helpers | `fretLengths`, `noteNamesFuncArrDEFAULT`, often `noteNamesFuncArr` | filtered | Mostly harmless glop | They are recomputable or defaultable and do not belong in the songfile by default | Keep filtered unless a future sprint intentionally supports song-specific function labels. |

# Design Notes

The system should provide rich defaults from installed libraries while storing only the User-authored delta needed for a song to round-trip and remain meaningful on another host.

That means the songfile should not try to copy whole libraries into itself. Instead, each persistence area should have one canonical song-owned object at the right granularity:

- `myTunings` for User-owned tunings in the song
- `visibleNoteTables` for visibility state
- `theme` plus `userTheme` for theme selection and custom theme payload
- a still-to-be-defined canonical payload for User color/style customization

The matrix also makes clear that some existing fields are compatibility leftovers or derived snapshots. Those should not silently become the long-term contract just because they already appear in files.

## Needed Design and Coding by Area

### 1. User colors and stylesheets

- Decide whether `userColors` is the canonical saved User palette object.
- Define how that payload hydrates into runtime `gUserColorDict.dict`.
- Decide whether any ordered stylesheet selection also belongs in the songfile, or whether runtime `colorDicts` remains derived.

### 2. myTunings and USER tuning

- Keep `myTunings` as the canonical persisted tuning list.
- Treat `userInstrumentTuning` as a bridge object for the special runtime `USER` tuning, not as a competing tuning store.
- Keep `tunings` filtered because it is derived and historically confusing.

### 3. User themes

- Keep `theme` as the selected theme id.
- Keep or formalize `userTheme` as the saved payload for custom themes.
- Add explicit load hydration so `theme === "USER"` works predictably.

### 4. Visible tables

- Stop requiring DOM visibility to compute the persisted value.
- Make the model or the save caller authoritative.
- Preserve visible-table persistence without disturbing section note-table data.

### 5. Fallback behavior across hosts

- Missing library theme: fall back to installed default or nearest compatible theme, but preserve `userTheme` when available.
- Missing library tuning: rely on `myTunings` and `userInstrumentTuning` payloads rather than on installed library presence.
- Missing old stylesheet names: fall back to installed role coverage rather than exact name matching.

## Not In Scope For This Sprint

- Persisting runtime cursors or playback history.
- Persisting callback/pointer fields.
- Solving every future import/export problem for library packs.
- Large schema redesign beyond what is needed to stabilize current songfile persistence.
