# sprint-140-tool-notesource — Independent Design Analysis

This is an independent analysis of [140-design-alt.md](140-design-alt.md), written without consulting [140-design-cody.md](140-design-cody.md) or [140-design-cody-analysis.md](140-design-cody-analysis.md), per the instructions in the design doc. It is based on reading the current codebase (no code was changed to produce this document).

## 1. What the codebase already does today

A few facts about the existing architecture materially change the shape of this problem, so I'll establish them first.

### 1.1 A Tool table is just a tuning row with a flag

`tuning.Tool` is a boolean set from MyTunings ([TuningsLibrary.js](../../../../TuningsLibrary.js#L843)). A Tool tuning is otherwise a completely normal entry in `song.myTunings` / `song.noteTablesLayout`, with a normal `tableID` (`tbl<baseID>`) and a normal `sectionNotesByTable[tableID]` slot on every `Section`. `checkOptionsForToolTables()` in [infinite-neck.js](../../../../infinite-neck.js#L1128-L1133) only changes which *DisplayOptions* are merged in (from `entry.ToolDisplayOptions` in `noteTablesLayout`), not how the table stores or receives notes.

**Consequence:** nothing today stops a Tool tuning from being selected as a normal FillPlugin target — it already shows up in `FillPlugin.buildTargetTableOptions()` unless it's filtered out by the wiring check described below. The "Perfect4thsCalculator" use case is already *partially* achievable with zero code changes, with one important limitation described in 1.2.

### 1.2 FillPlugin is a singleton, single-target, *imperative writer*

[FillPlugin.js](../../../../plugins/fill/FillPlugin.js) is registered once in [registerPlugins.js](../../../../plugins/registerPlugins.js#L12) (`pluginManager.register(new FillPlugin())`), keyed by a hard-coded `this.id = 'fill'` ([FillPlugin.js](../../../../plugins/fill/FillPlugin.js#L160)). All of its properties — `targetTable` ("Instrument", a single `Select`, [properties.json](../../../../plugins/fill/properties.json#L1-L11)), `chordFormula`, `scaleFormula`, per-family/per-role mode+color, fret/string ranges, positions — are **one shared set of values for whatever single instrument is currently selected** (`getSelectedTargetTuning()`, [FillPlugin.js](../../../../plugins/fill/FillPlugin.js#L1606-L1608)).

More importantly, `apply()` / `applyToSection()` / the `DaCapo:OnSectionBegin` handler ([FillPlugin.js](../../../../plugins/fill/FillPlugin.js#L1103-L1109)) **write real `Note` objects with `owner: 'FillPlugin'` into `section.sectionNotesByTable[tableID]`** — the same persisted structure a human fingers notes into. `commitNotes` / `clear` / `clearSong` exist specifically because this is a committed, stateful write, not a transient overlay. This is why the design doc's problem statement calls out "without breaking any behavior of current FillPlugin" — FillPlugin's entire contract (one target, one settings set, mutate real song data, driven by transport events) is oriented around "auto-finger my practice instrument while the song plays," not "always show me every fourth in this key."

### 1.3 There is already a second, unrelated, *live/read-time* notesource mechanism: wiring

Independent of FillPlugin, `song.wirings` (`WIRING_MAIN` / `WIRING_LISTENER` / `WIRING_OBSERVER` in [InstrumentRoleBadges.js](../../../../InstrumentRoleBadges.js#L5-L37)) already lets one table's *rendering* pull from another table's *stored* notes without duplicating data. In [NoteTableController.js](../../../../NoteTableController.js#L1000-L1030) `getReplayOptionsArray()` builds a `LISTENER` replay entry whose `listenToTablename` points at a different table, and `replayTable()` ([NoteTableController.js](../../../../NoteTableController.js#L1084-L1149)) reads `currSection.sectionNotesByTable[listenToTablename]` and paints it onto `tablename`'s cells, recoloring through that table's own `lookupUserColorClass`/`createNotetableLookupContext`. This is evaluated fresh on every `replay()`, is not gated on playback, and does not write anything back into the song. `FillPlugin.getEligibleTargetTunings()` and `TonalPlugin`'s equivalent already exclude any tuning that's `wiredDisplayTables` (i.e. is a Listener target) from being a Fill target ([FillPlugin.js](../../../../plugins/fill/FillPlugin.js#L1598-L1603)) — because a wired table's cell contents are computed at render time, not owned by Fill.

**This is the important prior art the design doc doesn't mention.** The codebase already has exactly the shape of thing a Tool table needs — a render-time, non-destructive, non-playback-gated source of notes for one table drawn from something else — it's just currently restricted to "something else" meaning "another real table's played notes," not "an algorithm."

### 1.4 The note-selection math is already factored out of FillPlugin

[fill/fill-role-engine.js](../../../../fill/fill-role-engine.js) (`computeRoleNoteSets`, `resolveRoleDecision`, `buildNamedRolePlan`) is a **pure module**: given `{ rootID, chordSource, modeSource, useSectionChart }` it returns `{ root, chord, scale }` note-name sets. It imports nothing from `FillPlugin.js`, `getSong()`, or the DOM. `FillPlugin.js` imports *from* it, not the other way around. So "the set of every NamedNote colored/functioned correctly for the Section's key" — the Perfect4thsCalculator's actual requirement — is already computable without FillPlugin existing at all.

## 2. Restating the problem, given the above

Given 1.1–1.4, the real question is narrower than "how does FillPlugin support Tool tables?" It's:

> Tool tables need a per-table, render-time (not playback/event-time), non-mutating (no persisted `Note` objects, no `owner: 'FillPlugin'` writes, nothing to `commitNotes`/`clear`), possibly-many-simultaneous-instances source of note names + colors, computed from each Section's `rootID`/key and a small per-Tool config. FillPlugin is a persisted-write, single-target, event-driven *editing tool*. These are different enough contracts that reusing FillPlugin's *engine* (fill-role-engine.js) is easy and safe; reusing FillPlugin's *plugin/menu/event machinery* is the part that "smells exactly like FillPlugin" and risks the regressions the design doc worries about.

## 3. Analysis of the two proposed options

### Option 1 — FillPlugin gains an "Instruments" menu (multi-target FillPlugin)

Coding shape: replace the single `targetTable` Select with a list-valued property (an array of `{ tableID, settings }`), add a menu level under "Instruments" that lets you pick an instrument and then drop into "the FillPlugin menu" scoped to that instrument's settings sub-object. `getSelectedTargetTuning()` becomes "the instrument currently being edited in the menu," while `applyToSection()` on `DaCapo:OnSectionBegin` would need to loop over *all* configured instruments instead of one.

Pros:
- Solves the stated secondary goal ("allowing FillPlugin to fill multiple instruments") directly and for free.
- Single mental model for users who already understand FillPlugin.

Cons:
- Every method in `FillPlugin.js` that currently does `this.getSelectedTargetTuning(song)` implicitly (dozens of call sites: `normalizeRangeValues`, `toStoredRowIndex`, `isStandaloneTinyActive`, positions helpers, string-limit defaults, etc.) has to become instrument-scoped. That's a large, invasive refactor of a plugin that is clearly under active, careful development (see the legacy-migration code around `normalizeLegacyPersistedProperties`), with real regression risk to the "practice fill" behavior that already has dedicated tests (`fill-plugin.test.js`, `fill-role-engine.test.js`, per repo memory).
- It still doesn't fix the fundamental *contract* mismatch: this remains a **persisted write on playback events**. Tool tables want notes that are always present (song not even playing), never "committed," never subject to `clearSong`. Making FillPlugin also do a non-destructive, always-on render mode alongside its destructive committed-write mode roughly doubles the state machine inside one class.
- Multi-instrument fill changes the meaning of `DaCapo:OnSectionBegin` handling, `positions` (which are keyed per-section already, `pluginData.fill`), and the graveyard/import-export snapshot format simultaneously for every existing FillPlugin user, even those who only ever use one target — this is the "note breaking any behavior of current FillPlugin" risk the design doc explicitly flags.

Verdict: technically feasible, but it conflates two independent problems (multi-instrument practice-fill, and non-destructive Tool display) into one refactor of the highest-risk file in this subsystem.

### Option 2 — New `Notesource` plugin that owns a list of tunings × settings

Coding shape: a new `plugins/notesource/NotesourcePlugin.js`, registered like the others, holding `{ tableID -> { algorithm: 'fillLike'|other, properties: {...} } }`, presumably reusing `PluginProperty`/`MenuItemProxy` the same way FillPlugin does, and reusing `fill-role-engine.js` for the actual note-set math.

Pros:
- Leaves `FillPlugin.js` completely untouched — zero regression risk to today's practice-fill behavior. This directly satisfies the design doc's stated hard constraint.
- A dedicated plugin gets its own menu tree, its own persistence/graveyard key, its own `invokeAction` surface — no per-call-site instrument-scoping refactor needed, because it's built multi-instrument from day one instead of retrofitted.
- Multiple algorithms (not just "fill formula") can share one home, e.g. "every named note" (Perfect4ths), "chart chord anchored to noteRoot," future ones — this matches the design doc's second use case (chart chord on a one-string tuning) directly.

Cons:
- As the design doc itself observes, this "starts to smell exactly like FillPlugin": you end up re-implementing `targetTable` selection, per-instrument fret/row ranges, family/role mode+color pickers, menu plumbing — i.e., duplicating most of `PluginProperty`/`MenuItemProxy` scaffolding that FillPlugin already has, just multi-instanced. That's a lot of new surface area (new menu, new persistence format, new tests) for something that is conceptually "FillPlugin's math, wired to N tables instead of 1."
- It's still built as a **plugin** — i.e., it participates in `pluginManager`'s enable/disable, event subscription (`DaCapo:OnSectionBegin`, `Looper:OnResetSong`), and graveyard/import-export lifecycle. Tool tables plausibly want to be populated even when *no* plugin is enabled and nothing is playing (e.g., viewing a static chart). A plugin-shaped solution inherits "plugins can be disabled" and "plugins react to transport events" as accidental constraints that don't apply to "always show me the fourths."
- Does this plugin write real `Note`s into `sectionNotesByTable[toolTableID]` (repeating FillPlugin's committed-write model, just for N tables), or render live? The design doc doesn't say, and this is the crux decision — if it writes real notes, you now need N-times the commit/clear semantics and N section-shaped copies of `pluginData`; if it renders live, it needs its own rendering hook into `NoteTableController.replay()`, which doesn't exist yet for anything other than the `wirings`-based SELF/RELATIVE/LISTENER cases.

Verdict: safer than Option 1 for FillPlugin itself, but only "smells like FillPlugin" as a criticism if it's built as a full second plugin UI. It's the right shape *if* trimmed down to just: a config store + the render hook, not a parallel plugin with its own menu tree.

## 4. A third option: treat Notesource as a fourth `ReplayOptions.Type`, not a plugin

Given 1.3 and 1.4, I think there's a smaller, more targeted design that gets the Perfect4ths / one-string-chord use cases without a new plugin and without touching `FillPlugin.js`:

1. **Config lives where the design doc already says it should:** `entry.ToolDisplayOptions.notesource` in `song.noteTablesLayout`, e.g. `{ algorithm: 'everyNamedNote', chordSource: '', modeSource: '', useSectionChart: true }` or `{ algorithm: 'chartChordAtRoot' }`. No plugin registration, no menu tree, no `PluginProperty` scaffolding required for v1 — this can be a plain command-line/JSON-editable option exactly like other `ToolDisplayOptions` fields already are, per `checkOptionsForToolTables()`.
2. **A small, pure "notesource resolver" module** (peer to `fill-role-engine.js`, could literally live in `fill/` and reuse `computeRoleNoteSets`) turns `{ algorithm, ...params }` + the current `Section` into a note-name → color/function map. Because `computeRoleNoteSets()` already takes `rootID`/`chordSource`/`modeSource`/`useSectionChart` and returns sets with no song mutation, this is mostly new glue, not new music logic.
3. **Extend `getReplayOptionsArray()`/`replayTable()`** in [NoteTableController.js](../../../../NoteTableController.js#L1000-L1149) with a new branch, sibling to the existing `SELF`/`RELATIVE`/`LISTENER` types: if a table's `tuning.Tool` is true and it has a `notesource` config (instead of/alongside a `wirings` entry), compute the note set via the resolver instead of reading `sectionNotesByTable[listenToTablename]`, then run it through the exact same `lookupUserColorClass`/`createNotetableLookupContext` painting code that already exists for every other table type. No new persisted note storage, nothing to commit or clear, evaluated on every `replay()` regardless of transport/play state, and multiple Tool tables can each have independent config with zero cross-talk because each is just a data lookup at render time.

Why this is preferable to Options 1 and 2:
- **Zero risk to FillPlugin.** Not one line of `plugins/fill/FillPlugin.js` changes.
- **Matches the actual contract Tool tables need** (informational, always-on, never played/committed, no click handlers per the design doc) instead of bending FillPlugin's committed-write/event-driven contract to also do this.
- **Reuses the exact rendering seam that already exists** for "this table's cells come from somewhere else" (the `LISTENER` branch), rather than inventing a parallel rendering path.
- **Naturally multi-instance**: because config is per-`tableID` data (like `ToolDisplayOptions` already is) rather than per-plugin-instance state, "many Tool tables, many settings" falls out for free — there's no singleton to work around.
- Leaves the door open to *later* add a menu-driven UI (a thin `NotesourcePlugin` that only edits `ToolDisplayOptions.notesource` via `PluginProperty`/`MenuItemProxy`, the same way other plugins edit persisted song state) once the underlying resolver + render hook are proven, without that later UI work being on the critical path or touching FillPlugin.
- If "FillPlugin driving a Tool table with real practice-fill semantics" (commit notes, clear, etc.) turns out to be a genuinely wanted feature later (a user might want to *practice* the fourths, not just view them), that's still available today with zero changes, by pointing FillPlugin's existing single `targetTable` at a Tool tuning — Option 3 doesn't remove that; it adds a second, lighter-weight path for the purely-informational case, which is what both of the design doc's examples actually describe.

Costs / open questions for Option 3:
- Needs a small, explicit "algorithm registry" (even if it starts with one entry, `everyNamedNote`) so it doesn't itself become an ad hoc special case — but this is inherent to any of the three options.
- `replay()` currently iterates `getSong().getVisibleTunings()` and branches only on `wirings`; teaching it about a second, independent per-table special case (`notesource`) alongside `wirings` needs a decision about precedence if a table somehow has both (recommend: mutually exclusive, validated at config-write time).
- Command-line/config authoring UX for `ToolDisplayOptions.notesource` is not solved by this — it would initially be JSON-editable only (consistent with how `ToolDisplayOptions` presumably is today), with a friendlier menu as a follow-on.

## 5. Comparison

| | Option 1 (FillPlugin multi-target) | Option 2 (new Notesource plugin) | Option 3 (Notesource as render type) |
|---|---|---|---|
| Risk to existing FillPlugin behavior | High — pervasive refactor of single-target assumption | None | None |
| New persistence/menu surface | Extends existing (large) | New parallel plugin scaffolding | Minimal (one config object, reuses `ToolDisplayOptions`) |
| Matches "informational, non-committed, always-on" contract | No (still commit/clear/event-driven) | Depends on implementation — likely also drifts toward commit-style if built plugin-shaped | Yes, by construction |
| Multi-instance ("many Tool tables at once") | Requires refactor to support | Native, but at plugin-instance-state complexity | Native, at plain-data complexity |
| Reuses existing prior art in codebase | Partial (reuses fill math) | Partial (reuses fill math) | Full (reuses fill math *and* the `LISTENER` render seam) |
| Effort to first working version | Medium-high | Medium-high | Low-medium |

## 6. Recommendation

Pursue Option 3 first: a small pure resolver (reusing `fill-role-engine.js`) plus one new branch in `NoteTableController`'s replay pipeline, configured via a `notesource` key inside the already-planned `ToolDisplayOptions`. It is the smallest change, has no blast radius on `FillPlugin.js`, and is the only option of the three whose runtime contract (render-time, non-mutating, always-on, independently-configured per table) actually matches what a Tool table needs. Treat "FillPlugin fills multiple instruments" (Option 1's secondary goal) as a separate, independently-justified enhancement to FillPlugin's practice-fill workflow, not a prerequisite for Tool tables — the two problems don't need the same solution.

Section 7 below refines *how* Option 3 gets configured: rather than a JSON-only `ToolDisplayOptions.notesource` key, use the existing Wiring UI/model itself as the configuration surface. That turns out to fit unusually well.

## 7. Wiring a table to a notesource via the existing Wiring UI

The user asked specifically about this, so it deserves its own discussion. Short answer: this is not just possible, it's arguably the *most natural* home for Option 3's configuration — better than a bespoke `ToolDisplayOptions.notesource` JSON key — because the Wiring UI already is "pick where this table's notes come from," and every piece of scaffolding needed already exists for real tables. The work is in safely admitting a *virtual* table id into that machinery.

### 7.1 What "wiring" already is, mechanically

- **Model:** [Wiring.js](../../../../Wiring.js) is a plain 4-field record: `tablename` (the table being configured), `relativeSection`, `listenToTablename` (the source table), `listenerProjection`. `song.addWiring()`/`song.removeWiring()` ([Song.js](../../../../Song.js#L423-L444)) just upsert/remove one `Wiring` by `tablename` and fire `Wiring:added`/`Wiring:removed`.
- **UI:** Every visible tuning — Tool tunings included, since `getVisibleTuningIDs()`/`getVisibleTunings()` don't filter on `tuning.Tool` — already gets a mount point (`div<baseID>_wiring`, built unconditionally in [TableBuilder.js](../../../../TableBuilder.js#L179-L183) regardless of the `Tool` early-return in `buildCaptionRow()`) and a `Wiring-controls` widget cloned from [templates/templates.html](../../../../templates/templates.html#L1-L19) by `WiringBuilder.addWiringWidget()`. The one `<select class="selTablename">` in that widget is populated by `updateAllWiringSelects()` ([WiringBuilder.js](../../../../templates/WiringBuilder.js#L206-L226)) by iterating `song.getAllModelTableIDs()` ([Song.js](../../../../Song.js#L215-L237)) and excluding self.
- **Render:** `NoteTableController.getReplayOptionsArray()`/`replayTable()` ([NoteTableController.js](../../../../NoteTableController.js#L1000-L1149)) is what actually turns a `Listener` wiring into painted cells, by reading `currSection.sectionNotesByTable[listenToTablename]` at every `replay()`.

So: **a Tool table can already be pointed at a real instrument's notes with zero code changes**, purely through the existing UI (pick the source instrument from `selTablename`, click "Add Wiring"). The only missing piece for the design doc's use cases is that `selTablename`'s option list is built exclusively from *real* tables (`getAllModelTableIDs()`), and `replayTable()`'s Listener branch only knows how to read `sectionNotesByTable`, not "compute this on the fly from an algorithm." Both are narrow, additive gaps, not a different architecture.

### 7.2 Proposed shape: virtual notesource ids as first-class wiring targets

1. **Reserve a distinct id namespace for notesources**, parallel to `Constants.TABLE_ID_PREFIX` (`tbl`) — e.g. `Constants.NOTESOURCE_ID_PREFIX = 'ns'`, so ids look like `nsPerfect4ths` or `nsChartChordAtRoot`. This mirrors how the codebase already discriminates "real table" vs. "baseID" purely by string prefix (`tableIDForBaseID()` / `.startsWith(Constants.TABLE_ID_PREFIX)` in [InstrumentRoleBadges.js](../../../../InstrumentRoleBadges.js#L21-L37)), so every existing prefix-test call site (`getAllModelTableIDs`, `isSongTableVisible`, `classifyInstrumentRole`, FillPlugin's `getEligibleTargetTunings`) can keep working unmodified — none of them will ever see an `ns…` id unless explicitly taught to, because none of them currently enumerate a notesource registry.
2. **A small static registry** (the same "algorithm registry" flagged as a cost in section 4) maps each `ns…` id to a pure resolver function built on `computeRoleNoteSets()` from [fill/fill-role-engine.js](../../../../fill/fill-role-engine.js#L13-L34) — e.g. `nsPerfect4ths` = "every named note, section-key-relative, chord/scale roles all colored." This registry is the only new "model" concept; it need not be persisted (the id string is all that's persisted, same as today's `listenToTablename`).
3. **`updateAllWiringSelects()`** appends a second group of `<option>`s (ideally an `<optgroup label="Notesources">`) built from the registry, after the real-table options, in the same `<select>`. No new widget, no new button, no new template — this is the "very slick" part: the existing Add Wiring / Wired / Mute / relative-section controls all keep working unmodified, because they're generic over `tablename`/`listenToTablename` strings today.
4. **`replayTable()`'s Listener branch** gets one new fork: if `replayOptions.listenToTablename` starts with `NOTESOURCE_ID_PREFIX`, resolve notes via the registry (passing the render-time `Section`'s `rootID`/`chartChord`/`chartMode`, exactly as `computeRoleNoteSets` already expects) instead of reading `currSection.sectionNotesByTable[listenToTablename]`. Everything downstream (painting via `lookupUserColorClass`, `styleNamedNote`) is untouched, since it already operates on a resolved note-name → style/color mapping regardless of where that mapping came from.
5. **`relativeSection` comes along for free.** Because a notesource wiring is just a `Wiring` record like any other, a Tool table can be wired to "notesource, relative section +1" and get fourths for the *next* section without any additional design — the existing `relativeSection` resolution in `getReplayOptionsArray()` already handles that independent of what `listenToTablename` points at.
6. **Mute/unmute comes along for free too** — `muteListenerWiringForWidget`/`unmuteListenerWiringForWidget` in [Wiring.js (templates)](../../../../templates/WiringBuilder.js#L60-L86) already treat `listenToTablename` as an opaque string to stash and restore; a notesource wiring mutes/unmutes exactly like a table-to-table Listener wiring.

### 7.3 Things that need explicit, deliberate handling (not free)

- **Reciprocal-loop detection** (`wouldCreateReciprocalWiring()`, [Wiring.js templates](../../../../templates/WiringBuilder.js#L98-L107)) checks whether `listenToTable` has its own wiring pointing back at `thisTable`. A notesource id will never appear as a `wiring.tablename` (notesources don't own a `Wiring` record of their own — they aren't a table), so this check simply never fires for them, which is correct and requires no change, but it's worth confirming with a test so it isn't accidentally "solved" by luck.
- **`listenerProjection`** (row-midi / midi-low-to-high / midi-high-to-low, [templates.html](../../../../templates/templates.html#L9-L14)) is meaningless for a notesource that only emits `NamedNote`s (no row/fret geometry), matching the design doc's "informational only" framing. The widget should hide or disable that select when a notesource option is chosen, otherwise a user could pick a projection mode with no effect — small UX gap, not architectural.
- **Capture-to-clip** (`btnCaptureWiring` → `Wiring.js`'s `runCaptureForTable()` → `ClipPlugin.copyListenedToGraveyard`, [templates/WiringBuilder.js](../../../../templates/WiringBuilder.js#L27-L52)) is currently defined only for genuine Listener wirings and, per `ClipPlugin.getTuningByTableID()`/`getSelectedListenerSelection()` ([ClipPlugin.js](../../../../plugins/clip/ClipPlugin.js#L769-L785)), expects `listenToTablename` to resolve to a real tuning via `getEligibleTargetTunings()`. For a notesource id this lookup will simply fail to find a tuning, so `updateWiringButtonStatus()`'s `isWiredListener` gate (and thus the enabling of Capture/Mute) needs to explicitly recognize "wired to a notesource" as its own case — capturing a computed-but-unplayed notesource result into a clip is a plausible future feature (freeze "today's fourths" into a static clip) but is not free; it would need the clip payload builder taught to read from the registry the same way `replayTable()` will.
- **`getAllModelTableIDs()` must not need to include notesource ids.** Since notesources are a fixed, code-defined registry (not user-created "instruments"), they shouldn't be added to model persistence enumeration (`getAllModelTableIDs`), song-library table auditing, ghost-table detection (`getGhostTableIDs`), etc. — they're a *menu of algorithms*, not a *model entity*. `updateAllWiringSelects()` should pull them from the static registry directly, as a second, separate source of `<option>`s, not by teaching `getAllModelTableIDs()` about them (that function's job is enumerating real persisted-table references for audit/cleanup purposes, e.g. `getGhostTableIDs()`, and notesource ids would be false positives there).
- **Only Tool tables should be allowed to wire *to* a notesource** (a regular playable instrument wiring itself to "every named note in the key" would silently defeat the point of manually fingering notes). This is a UI-level constraint: `updateAllWiringSelects()` should only append the notesource `<optgroup>` when `thisTable`'s tuning has `Tool === true`, mirroring the existing `options.Tool === true` branch already present in `buildCaptionRow()` ([TableBuilder.js](../../../../TableBuilder.js#L235-L237)).

### 7.4 Why this is better than a bare `ToolDisplayOptions.notesource` JSON key

Section 3/4's original Option 3 wording proposed a `notesource` key living inside `ToolDisplayOptions`, edited only via raw JSON/command-line. Routing the same underlying mechanism (pure resolver + one new `replayTable()` branch) through the Wiring UI instead is strictly better on usability grounds and costs nothing extra in the runtime design:

- **One mental model, one place to look.** "Where do this table's notes come from" is already answered by the Wiring panel for every other table; splitting Tool tables into "Wiring panel for real sources, separate JSON blob for algorithmic sources" would be a confusing seam for users and future maintainers.
- **Discoverability.** A JSON-only `ToolDisplayOptions.notesource` key is invisible unless you already know it exists; an `<optgroup>` in a dropdown the user is already looking at (because they're setting up a Tool table) is self-documenting.
- **No new persistence shape.** `Wiring.toJSON()` already persists exactly the fields needed (`tablename`, `relativeSection`, `listenToTablename`); a notesource wiring is just a `Wiring` whose `listenToTablename` happens to be an `ns…` id. No new song schema, no migration path, no interaction with `ToolDisplayOptions` needed at all for the base case.
- **Mutual exclusivity for free.** Because "real Listener" and "notesource" are the same field (`listenToTablename`), a table can't accidentally have both a stale JSON notesource config *and* a live table wiring active at once — a problem the separate-JSON-key design would have to explicitly guard against (see section 4's open question about precedence).

The one place raw config still plausibly earns its keep is *parameterizing* a notesource (e.g. a hypothetical `nsFillLike` that takes a chord/mode formula rather than being fixed like `nsPerfect4ths`). If/when a parameterized notesource is needed, the cleanest extension is still wiring-shaped: add a small, optional `notesourceParams` object alongside `tablename`/`listenToTablename` on the `Wiring` record itself (persisted the same way `listenerProjection` already is as an optional field on `Wiring.toJSON()`), edited by one or two extra controls in the `Wiring-template` that only render when a notesource option is selected — not a parallel plugin, not a parallel JSON namespace.

### 7.5 Net recommendation, refined

Keep Option 3's runtime design (pure resolver off `fill-role-engine.js`, new render-time branch, no `FillPlugin.js` changes), but implement its *configuration* as: a reserved `ns…` id namespace, a small static notesource registry, and additive `<optgroup>` entries in the existing Wiring `<select>` — gated to Tool tuning tables only. This reuses essentially 100% of the existing Wiring model/UI/persistence and needs no new template, no new menu, and no new plugin; the only genuinely new code is the registry, the `replayTable()` fork, and the handful of "is this id a notesource" guards enumerated in 7.3.

## 8. Implementation prerequisite: `noteTablesLayout[].ToolDisplayOptions` has no writer yet

This section is written as an **input to the upcoming implementation iteration**, per the request that this document serve that role. Everything above (including all of section 7) assumes `entry.ToolDisplayOptions` in `song.noteTablesLayout` is a populated, persisted object that `checkOptionsForToolTables()` ([infinite-neck.js](../../../../infinite-neck.js#L1128-L1134)) can read. Today only the *read* side exists. This section documents what "freezing" a Tool table's current-Section DisplayOptions into `ToolDisplayOptions` requires, given the UI sequence the user described:

1. User works in the current Section (or a scratch Section created for this purpose, to be deleted afterward).
2. User sets View DisplayOptions (the panel described in 8.2).
3. User clicks a "Freeze" button in the Tool table's caption row.
4. The system captures the current View DisplayOptions in effect for that Section (including `autoColor`) — **and only those** — and writes a deep copy into that table's `ToolDisplayOptions`.
5. The Section can now be deleted or navigated away from — the frozen copy is independent of it.

**Important correction to an earlier draft of this section:** the frozen snapshot must *not* include `rootID`, `rootIDLead`, `sharps`, or `noteNamesFuncArr`. A Tool table must keep following whatever Section is currently playing for those fields — that's the entire mechanism behind the Perfect4thsCalculator use case: because every `NamedNote` is present in the Tool table already, when the song moves from a Section keyed to C to a Section keyed to F, the same physical notes (A, Bb, B, C, …) must be recolored/re-labeled for F's key without the Tool table itself changing anything — it's still just reading the live Section's `rootID`/`sharps` like any other table. Freezing `rootID` et al. would pin the Tool table to whatever Section happened to be current at freeze time, permanently breaking that behavior. Section 8.2 below is revised accordingly.

It must remain valid for a Tool tuning to have **no** `ToolDisplayOptions` at all — in that case it simply follows the current Section's own DisplayOptions, inherited the same way any other table's rendering is, via `Song.getDisplayOptionsInEffect()`. This already works correctly today: `checkOptionsForToolTables()`'s `if (entry.ToolDisplayOptions)` guard falls through to returning `options` unchanged when absent, so no change is needed to preserve that behavior — it just needs to keep being true once a writer exists.

### 8.1 Landmine: two existing normalizers will silently delete `ToolDisplayOptions`

This is the most important finding in this section, and it explains why no writer exists yet — simply adding a setter is not sufficient. There are **two independent, boolean-only normalization functions** that run on every `noteTablesLayout` entry, and both currently discard any key whose value is not the literal boolean `true`:

- `Song.ensureNoteTablesLayout()` ([Song.js](../../../../Song.js#L65-L95)), which runs on every call to `getNoteTablesLayout()` (i.e. constantly, at runtime):
  ```js
  Object.keys(entry).forEach((key) => {
      if (key === 'tableID' || key === 'tablename' || key === 'visible') return;
      if (entry[key] === true) normalizedEntry[key] = true;
  });
  ```
- `normalizeLayoutEntry()` in [SongPersistence.js](../../../../SongPersistence.js#L62-L82), which runs once at `new Song(jsonObj)` construction/load time, with the identical `entry[key] === true` filter.

Both exist to keep today's boolean layout flags (`CaptionLeft`, `SectionStatusLeft`) clean, but as written they mean **an object-valued `ToolDisplayOptions` would be silently stripped out** the moment either function runs — on load, and on every subsequent `getNoteTablesLayout()` call thereafter. Any implementation must update both functions to special-case `ToolDisplayOptions` (or, more generally, recognize it as an allowed non-boolean value) — e.g.:
```js
if (key === 'ToolDisplayOptions' && entry[key] && typeof entry[key] === 'object') {
    normalizedEntry[key] = entry[key];
    return;
}
if (entry[key] === true) normalizedEntry[key] = true;
```
This is a hard prerequisite, not an enhancement — without it, a freeze operation would appear to succeed in the running session (the in-memory entry object would have the key) but be silently erased on the very next `getNoteTablesLayout()` call or song reload, which would make the feature look broken/flaky rather than obviously absent.

### 8.2 What "DisplayOptions in effect" means, precisely — and what must be excluded

"View DisplayOptions" is exactly the object built by the existing `controlsToDisplayOptions()` ([infinite-neck.js](../../../../infinite-neck.js#L2864-L2921)) — the same function whose output is written into `section.displayOptions` by `handleBtnControlsToDisplayOptions()` ([infinite-neck.js](../../../../infinite-neck.js#L3054-L3060)), and which `Song.getDisplayOptionsInEffect()` ([Song.js](../../../../Song.js#L1413-L1427)) walks backward through `song.sections` to find (i.e. "possibly inherited from previous Sections"). It already includes `autoColor` (`options.autoColor = $("#cbAutomaticColor").prop("checked")`), colors, opacities, cell sizes, fonts, hide flags, etc. — the complete set of fields the View DisplayOptions panel and its `p`-tag Presentation-Mode-adjacent fields govern. **Freezing should capture exactly this object** (`controlsToDisplayOptions()`'s return value, deep-cloned), and nothing more.

Do **not** use `buildRenderOptionsForSection()` ([infinite-neck.js](../../../../infinite-neck.js#L1178-L1187)) as the freeze source, despite it superficially looking like "DisplayOptions in effect for a Section" — it deliberately layers three *Section-identity* fields on top of `controlsToDisplayOptions()`'s output for rendering purposes:
```js
function buildRenderOptionsForSection(section){
    const defaultDisplayOptions = ensureDefaultDisplayOptionsForNavigation();
    const displayOptions = cloneDisplayOptions(getSong().getDisplayOptionsInEffect(section, defaultDisplayOptions));
    const options = {
        ...displayOptions,
        rootID: section?.rootID ?? 0,        // Section identity — must NOT freeze
        rootIDLead: section?.rootIDLead ?? -1, // Section identity — must NOT freeze
        sharps: !!section?.sharps              // Section identity — must NOT freeze
    };
    options.noteNamesFuncArr = parseNoteNamesFuncArrForOptions(options); // derived/render-time — must NOT freeze
    return options;
}
```
`rootID`, `rootIDLead`, and `sharps` are the current Section's actual key, not a display *preference* — they're precisely the values that must keep changing as the song plays through different Sections so a Tool table recolors/relabels its fixed set of `NamedNote`s correctly for whatever Section is currently active (the Perfect4thsCalculator mechanism described above). `noteNamesFuncArr` is a derived render-time array computed from those same live inputs, not a stored preference either.

**Why this matters mechanically, not just conceptually:** `checkOptionsForToolTables()` ([infinite-neck.js](../../../../infinite-neck.js#L1128-L1134)) merges `entry.ToolDisplayOptions` **last** and unconditionally:
```js
return { ...structuredClone(options), ...entry.ToolDisplayOptions };
```
Whatever keys exist in `ToolDisplayOptions` win, unconditionally, over the live per-Section `options` passed in from `buildCellsForTable()` on *every single render call, for every Section, forever*. If `rootID`/`rootIDLead`/`sharps` were ever included in the frozen object, every subsequent Section change would render the Tool table using the frozen Section's key instead of the current one — silently and permanently defeating the feature. Because this merge is unconditional key-by-key, the freeze handler must be deliberately scoped to only the `controlsToDisplayOptions()` fields; it is not safe to freeze "whatever object happens to be convenient" and rely on downstream code to filter it back out.

### 8.3 Proposed persistence API

Because `Song.setNoteTablesLayoutOption()` ([Song.js](../../../../Song.js#L113-L149)) is hard-coded to only accept boolean values (`const nextValue = optionValue === true;`), it cannot be reused as-is for an object payload. Add two focused `Song` methods rather than overloading that one:

```js
setToolDisplayOptions(tableID, displayOptionsObject) {
    const safeTableID = `${tableID || ''}`.trim();
    if (!safeTableID) return;
    const layout = this.getNoteTablesLayout();
    let entry = layout.find((one) => one.tableID === safeTableID);
    if (!entry) {
        entry = { tableID: safeTableID, visible: true };
        layout.push(entry);
    }
    entry.ToolDisplayOptions = structuredClone(displayOptionsObject || {});
}

clearToolDisplayOptions(tableID) {
    const safeTableID = `${tableID || ''}`.trim();
    const entry = this.getNoteTablesLayout().find((one) => one.tableID === safeTableID);
    if (entry) delete entry.ToolDisplayOptions;
}
```
`structuredClone()` is the important detail: the frozen copy must not retain any reference back to `section.displayOptions` or the `Section` object itself, since the user's flow explicitly allows deleting that Section afterward.

### 8.4 UI wiring

- **Caption row button:** [TableBuilder.js](../../../../TableBuilder.js#L229-L237) currently gives Tool tables (`options.Tool === true`) only the Float button:
  ```js
  if (options.Tool === true){
      captionRow.html(btnPopOutDiv);
      return captionRow;
  }
  ```
  Add a sibling button here, e.g. `<button id="btnFreezeToolDisplayOptions_div${options.baseID}" class="subcaptionButton freezeToolDisplayOptionsButton" data-tableid="${tableID}">Freeze</button>`, matching the user's example id pattern (`#btnFloatSection_divPerfect4thsCalculator_1`-style, sibling in the same caption row).
- **Click handler:** wire it the same way `installBtnHamburgerClicks()` wires other caption-row buttons ([infinite-neck.js](../../../../infinite-neck.js#L3097-L3150)) — a delegated `.freezeToolDisplayOptionsButton` click handler reading `data-tableid`, calling `controlsToDisplayOptions()` (not `buildRenderOptionsForSection()` — see 8.2), then `getSong().setToolDisplayOptions(tableID, options)`.
- **Immediate feedback:** after freezing, re-render just that table (`buildCellsForTable(sharps, options, tableID)` or a targeted `replay()` for that table, using the *current* live per-Section options as always) so the caption row/table visibly reflects the newly-frozen colors/sizes/fonts while still showing the current Section's actual key — this also doubles as an implicit check that `checkOptionsForToolTables()`'s merge only overrode the intended display-preference fields.
- **Optional symmetric "un-freeze":** not requested, but trivial to add alongside Freeze (mirroring `#btnDeleteDisplayOptions_View` → `handleBtnDeleteDisplayOptions()`) by calling `clearToolDisplayOptions()` — flagged here only as a natural, low-cost follow-on, not a requirement.

### 8.5 Persistence and test-ability, once 8.1–8.3 land

- No additional serialization work is needed beyond fixing the two normalizers in 8.1: `noteTablesLayout` is already part of `Song`'s own serialization (`getPersistentSongFile()` → `JSON.stringify(this, SongPersistence.persistentSongFileReplacer, 2)`, and `persistentSongFileReplacer()` has no special-case that would strip `noteTablesLayout` or its nested keys), so once `ToolDisplayOptions` survives both normalizers it round-trips through save/load for free.
- The model-side pieces (`Song.setToolDisplayOptions()`/`clearToolDisplayOptions()`, and the `ensureNoteTablesLayout()`/`normalizeLayoutEntry()` fixes) are plain-data and fully unit-testable in Jest with no DOM/jQuery involved, consistent with this repo's existing Jest conventions (per [140-design-alt-analysis.md](140-design-alt-analysis.md) memory: Jest coverage here avoids JSDom/browser/jQuery expectations). The caption-row button and click-wiring pieces in 8.4 are UI-only and, per the same convention, are exercised via manual/UI acceptance testing rather than Jest.
