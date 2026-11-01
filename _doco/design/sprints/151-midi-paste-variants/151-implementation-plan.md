# sprint-151 Iteration 1: Implementation Plan, MIDI Paste String Maps

Request: [151-design.md](151-design.md) (section "Request").  Sprint: [sprint-151.md](sprint-151.md).

This iteration produces the plan only.  No code has been written.  Rejected ideas from the chat (fret-preserving paste, `0` as a skip marker, flat lists, source-only specifiers, other grammars) are left out on purpose.

Contents:

1. [What we found in the code](#1-what-we-found-in-the-code)
2. [The accepted model](#2-the-accepted-model)
3. [Code shape](#3-code-shape)
4. [Menu](#4-menu)
5. [Phases](#5-phases)
6. [Test plan](#6-test-plan)
7. [Edge cases and risks](#7-edge-cases-and-risks)
8. [Questions](#8-questions)

---

## 1. What we found in the code

Facts the plan depends on.  Line links are to the current branch.

| # | Fact | Consequence |
|---|---|---|
| F1 | MIDI Paste is `midiPasteClip` ([ClipPlugin.js](../../../../plugins/clip/ClipPlugin.js#L1552)).  Each played note goes through `buildMidiPasteCandidate` ([L1381](../../../../plugins/clip/ClipPlugin.js#L1381)), which looks up `getCellByRowMidi(targetLayout, sourceRow, midinum)`.  So today the string is an **identity map** (row N to row N) and the MIDI number picks the fret.  A note with no cell on that target string is dropped (`droppedOutOfRange`). | The map replaces `sourceRow` with one or more target rows at this single point.  MIDI-only placement (design: "all mappings are based on MIDI numbers") is already how it works. |
| F2 | Three callers use `buildMidiPasteCandidate`: `midiPasteClip` ([L1580](../../../../plugins/clip/ClipPlugin.js#L1580)), recorded-notes MIDI Paste via `mapRecordedSourceBeatsForMidiPaste` ([L1003](../../../../plugins/clip/ClipPlugin.js#L1003)), and Listener copy ([L842](../../../../plugins/clip/ClipPlugin.js#L842)). | The map applies to the first two.  Listener copy keeps identity (it has its own wiring projections). |
| F3 | The only eligibility gate is `canMidiPasteBetweenTunings` ([move-helpers.js](../../../../move-helpers.js#L45)): both sides must be a 6-string `Guitar`.  It filters the `/fpc M` choice list (`getMidiPasteClipRecords`, [L1278](../../../../plugins/clip/ClipPlugin.js#L1278)), `midiPasteClip`, and the recorded-paste context ([L1021](../../../../plugins/clip/ClipPlugin.js#L1021)). | With an applicable map the gate becomes "a map resolves for this source/target pair".  With no applicable map the gate is unchanged, so every existing test keeps its meaning. |
| F4 | The copy already stores what we need: `payload.source` has `baseID`, `fromBaseID`, `baseInstrument`, `nStrings`, `rowRange`, `frets`, `nut`, `reverse` ([L690](../../../../plugins/clip/ClipPlugin.js#L690)); `getSourceTuningForRecord` ([L1255](../../../../plugins/clip/ClipPlugin.js#L1255)) merges it with the live tuning. | No change to Copy. |
| F5 | **`baseID` is runtime-generated** (`P46_1`, `P46_2`); the lineage identity is `fromBaseID` ([Song.js](../../../../Song.js#L476)).  The existing tests use `S6_1` with `fromBaseID: 'S6'`. | A map endpoint such as `P48` must match on `fromBaseID || baseID`, never on `baseID`. |
| F6 | Plugin state persists as `song.plugins.clip.properties` through `exportSongState` / `loadSongState` ([L470](../../../../plugins/clip/ClipPlugin.js#L470), [L483](../../../../plugins/clip/ClipPlugin.js#L483)).  [song-file-schema.js](../../../../bin/song-file-schema.js#L258) types `properties` as an open `object`, and `shouldPersistPluginEntry` writes a plugin only when a value differs from its default.  Extra properties therefore need **no schema change**, and Songs without maps write nothing new. | User maps and the active map id are two ordinary clip properties. |
| F7 | `PluginProperty.normalize` ([PluginProperty.js](../../../../plugins/PluginProperty.js)) knows String, Number, boolean, Select, Action and IntegerArray.  An array of objects would fall into the `String` default and be flattened to `"[object Object]"`. | One new datatype is needed (structural check only). |
| F8 | Plugin menus are rebuilt by `getVisibleMenuChildren` ([L242](../../../../plugins/clip/ClipPlugin.js#L242)), and `invokePluginAction` calls `refreshPluginsMenuNode` after every action.  Per-item actions are dispatched by a name prefix, as `reviveClip:<index>` already is in `invokeAction` ([L550](../../../../plugins/clip/ClipPlugin.js#L550)).  `args` carry only the typed input, not `menuItem.value` ([PluginManager.js](../../../../plugins/PluginManager.js#L697)). | Dynamic choice lists are easy.  A choice encodes its target in the action name, for example `selectMidiPasteMap:<encoded id>`. |
| F9 | User Log messages go out as `EventBus.trigger('UserLog', { subSystem, message })`, imported as in [ArpeggioPlugin.js](../../../../plugins/arpeggio/ArpeggioPlugin.js).  That file also notes that throwing during Song load can block the load, so it logs instead. | Warnings use the User Log.  Load-time validation of stored maps must drop and log, never throw. |
| F10 | Action results return `{ result, message }`; `message` is HTML (the help text is a `<pre>` block). | Anything echoed from a map id or spec in a message or caption must be HTML-escaped. |
| F11 | Existing Jest: `midi paste maps played notes by midi on the same string` expects the exact text `dropped 1` and `named +1 overwrite 0 skip 0` ([clip-plugin.test.js](../../../../_tests/jest/clip-plugin.test.js#L796)). | The no-map result text must stay byte-identical.  Map-specific counts are appended only when a map is applied. |
| F12 | **The Bass built-ins in the design disagree with the tuning library.**  [tunings.js](../../../../tunings.js#L170): `Bass4` = `[43,38,33,28]`, `Bass5` = `[43,38,33,28,23]`, `Bass6` = `[48,43,38,33,28,23]`.  In the library, Bass5 adds its string at the **bottom** (low B), and Bass6 adds a high C at the top plus the low B. | MIDI-correct maps are `Bass5 > Bass4`: `1:1, 2:2, 3:3, 4:4`; `Bass6 > Bass5`: `2:1, 3:2, 4:3, 5:4, 6:5`; `Bass6 > Bass4`: `2:1, 3:2, 4:3, 5:4`.  The design's `2:1..5:4` and `3:1..6:4` would put a note a fourth or a seventh away from where it came from and drop most of the clip.  See Q1. |

---

## 2. The accepted model

### 2.1 Grammar

Everything the User types or sees is 1-based.  String 1 is the lowest row number in the HTML table, the top of the page, for every instrument, including tunings whose open pitches run out of numerical order.  Conversion to row indexes (`n - 1`) happens at one place, the apply step.

```
add-input = ws '"' map-id '"' ws map-spec ws
map-spec  = pair { ws ',' ws pair }
pair      = number ws ':' ws number          source:dest
number    = [1-9] [0-9]*
```

- The User types the quotes around the id only.  The stored spec has none.
- Spaces around commas and colons are tolerated and **kept** in storage, so the listing shows what was typed (`1:1, 2:2` or `1:1,2:2`).  The spec is trimmed at both ends.
- `0` is not a valid string number.  Skipping is done by omission.
- Not JSON.  No wildcards, ranges or defaults; the lists are explicit.

### 2.2 Semantics of a spec

A spec is a list of (source, dest) edges in the order written.

| Situation | Behavior |
|---|---|
| Source string not in the spec | Its notes are not pasted anywhere.  Counted as `unmapped`. |
| Dest string not in the spec | Receives nothing. |
| One-to-many (`1:1, 1:2`) | One note produces a candidate on each dest string.  Each candidate is MIDI-looked-up on its own dest string; a string that cannot play the pitch is skipped. |
| Many-to-one (`1:2, 3:2`) | Allowed.  If two candidates land on the same cell, the one from the **later pair in the spec** wins.  The User Log gets a warning when the map is added, and again when a paste actually collides.  The collision is resolved before the note-merge step, so it is last-wins whatever the `overwrite` setting is. |
| Same pair twice | Accepted, ignored after the first, warning at add time. |
| Pair names a string beyond the instrument's count | The pair is skipped for that paste, and the User Log says so.  Not an error, so a map written for a larger instrument still works on a smaller one. |
| A note's MIDI number does not exist on the dest string | Dropped, counted in the existing `dropped`. |
| Named notes | Unchanged by the map (they are keyed by name, not by string), as today. |

Output order is preserved: candidates keep clip order, so a paste with no map is identical to today.  Only collision resolution uses the pair order.

### 2.3 Map ids

- A map has an id and a spec.  Built-in ids have the form `Source > Dest`.  A User may also add any other sanitized string (a "custom id" such as `lute reorder`).
- Sanitize: trim; collapse runs of spaces; keep letters, digits, space, `_`, `-`, `.`, `'`, and at most one `>`; drop everything else (so no `<`, `&` or quotes).  Pair-form ids are rewritten to the canonical `A > B` spacing so that lookups are exact.  The id that was actually stored is echoed back to the User.
- Ids are unique, ignoring case, across built-in and User maps (Q9).
- `A` and `B` in a pair-form id are **tuning ids**.  They match a tuning by `fromBaseID || baseID` (F5), case-sensitive.

### 2.4 Which map applies to a paste

One map is active at a time (`m)ap [current-id]`).  Given a source tuning and a target tuning, the paste resolves like this:

1. **Active map is pair-form `A > B`.**
   1. **Forward.**  If the source matches `A` and the target matches `B`, use the active map.
   2. **Reverse.**  If the source matches `B` and the target matches `A`, use the stored map whose id is exactly `B > A` if there is one; otherwise use the active map with every pair swapped.  This is the "reverse is inferred unless a reverse rule is stored" rule.  It is why the built-in `P46 > P48` is redundant.
2. **Active map has a custom id** (no `>`): it applies to whatever pair is being pasted, with no reverse inference.  The User chose it by name, so we trust them (Q5).
3. **No active map, or the active map does not fit this pair:** fall back to today's gate and identity behavior (F3).  A map that does not fit is never an error.  The result line says which route was taken (see 3.5).

**Matching an endpoint.**  A tuning matches id `X` when:

- **Lineage match.**  `fromBaseID || baseID` equals `X`.  Or
- **Class match** (the one wildcard in the design).  `X` names a known tuning, found first in the Song's `myTunings` and then in the library ([tunings.js](../../../../tunings.js)), and the paste tuning has the same `baseInstrument` and `nStrings` as that tuning.  So choosing `P48 > S6` and pasting to DropD or DADGAD works (all are Guitar with 6 strings), and so does pasting from them in reverse.  An id that names no known tuning matches by lineage only.

Class matching is applied to both endpoints (Q6).

### 2.5 Built-in maps

- A frozen constant in its own small file, `plugins/clip/midiPasteMapBuiltins.js`: an object of `id: spec string`, in display order.  It is meant to be edited by hand; the list is data, not logic.
- Seeded from the design (values for the three Bass entries pending Q1).  The redundant `P46 > P48` is included as written, and may be removed after testing, as the design says.
- Tests walk the frozen list and check **syntax only** (each id sanitizes to itself, each spec parses, no duplicate ids).  They never compare a built-in's value, so editing the constant cannot break a test.

### 2.6 User maps and the active map

- User maps are stored in the Song (clip plugin properties), so they return on the next load of that Song and are not visible to other Songs.  There is no import or export.
- The active map id is stored the same way.
- Maps are listed built-in first, then User maps in the order added.

---

## 3. Code shape

All new code is under `plugins/clip/`, `_tests/jest/` and the docs.  **No top-level `./` file needs editing** (the gate in [move-helpers.js](../../../../move-helpers.js#L45) is left as it is and used for the fallback).  The one top-level file that is documentation, [help-plugins.html](../../../../help-plugins.html), is listed in section 5 for approval.

### 3.1 New modules (pure: no DOM, no jQuery, no Song access)

**`plugins/clip/midiPasteMapBuiltins.js`**

```js
export const BUILTIN_MIDI_PASTE_MAPS = Object.freeze({
  'P46 > P48': '1:1, 2:2, 3:3, 4:4, 5:5, 6:6',
  // ...
});
```

**`plugins/clip/midiPasteMaps.js`**

| Function | Does |
|---|---|
| `cleanMapId(raw)` | Sanitizes and canonicalizes an id (2.3).  Returns `''` if nothing is left. |
| `splitMapId(id)` | `{ source, dest }` for a pair-form id, else `null`. |
| `parseMapSpec(text)` | `{ ok, spec, pairs: [{ from, to }], errors, warnings }`.  `pairs` are 1-based, in written order; duplicates removed with a warning; many-to-one detected for the warning. |
| `parseAddInput(line)` | Splits `"id" spec`.  `{ ok, id, spec, pairs, errors, warnings }`.  Errors are User-readable and name the bad token (`expected "id" then 1:2,3:4`; `string 0 is not valid, omit the string instead`). |
| `invertPairs(pairs)` | Swaps every pair. |
| `listMidiPasteMaps(userMaps)` | Built-in then User, as `[{ id, spec, builtin }]`. |
| `matchEndpoint(tuning, endpointId, lookupTuning)` | `'lineage'`, `'class'` or `null` (2.4). |
| `resolveMidiPasteMap({ maps, activeId, sourceTuning, targetTuning, lookupTuning })` | `{ id, pairs, route }` where `route` is `forward`, `reverse-stored`, `reverse-inferred` or `custom`; or `null` for the fallback. |
| `buildMappedCandidates({ notes, pairs, sourceLayout, targetLayout, ... })` | The apply step (3.3). |

`lookupTuning(id)` is passed in, so the module never imports the song or the library.

### 3.2 Changes in `ClipPlugin.js`

| Where | Change |
|---|---|
| [properties.json](../../../../plugins/clip/properties.json) | Two hidden properties: `midiPasteMapId` (`String`, default `""`) and `midiPasteUserMaps` (new datatype, default `[]`; entries are `{ "id": "...", "spec": "..." }`). |
| [PluginProperty.js](../../../../plugins/PluginProperty.js) | New datatype `org.dynamide.ObjectArray`: accepts an array or a JSON string, keeps entries that are objects.  Structural only; the semantic check lives in the plugin. |
| `loadSongState` ([L470](../../../../plugins/clip/ClipPlugin.js#L470)) | After the properties load, re-parse each stored map.  Entries that are invalid or duplicate an id are dropped, and the User Log says which.  A stored active id that no longer exists is cleared.  Never throws (F9). |
| User-map storage | An **array** of `{ id, spec }`, not an object keyed by id: object keys that look like integers (`"2"`) are re-ordered by JavaScript, which would break "in the order added". |
| `resolveValue` ([L504](../../../../plugins/clip/ClipPlugin.js#L504)) | New field `midiPasteMapId` (HTML-escaped, `none` when empty) for the menu caption. |
| `getMidiPasteClipRecords` ([L1278](../../../../plugins/clip/ClipPlugin.js#L1278)) | A clip is listed if `resolveMidiPasteMap` returns a map, or if the legacy gate passes. |
| `midiPasteClip` ([L1552](../../../../plugins/clip/ClipPlugin.js#L1552)) | Resolve the map.  Map found: build candidates with it.  Not found: the legacy gate and identity pairs.  Same result text as today unless a map was used. |
| `getRecordedPasteContext` ([L1021](../../../../plugins/clip/ClipPlugin.js#L1021)) and `mapRecordedSourceBeatsForMidiPaste` ([L1003](../../../../plugins/clip/ClipPlugin.js#L1003)) | Same resolution when `recordedMidiPaste` is on (Q11). |
| `buildMidiPasteCandidate` ([L1381](../../../../plugins/clip/ClipPlugin.js#L1381)) | Unchanged and still used by Listener copy.  A sibling method `buildMidiPasteCandidatesForRows(note, sourceLayout, targetLayout, targetRows)` returns an array, one candidate per mapped dest row. |
| `invokeAction` ([L550](../../../../plugins/clip/ClipPlugin.js#L550)) | New actions: `selectMidiPasteMap:<encoded id>`, `addMidiPasteMap` (typed input), `deleteMidiPasteMap:<encoded id>`, `listMidiPasteMaps`. |
| `buildHelpMessage` ([L599](../../../../plugins/clip/ClipPlugin.js#L599)) | Replace the line "MIDI Paste remaps ... for supported 6-string guitars" and add the map rules. |
| `getAuditInputs` ([L661](../../../../plugins/clip/ClipPlugin.js#L661)) | Optionally add `map:<id>` to the audit string (changed when non-default). |

### 3.3 The apply step

`buildMappedCandidates`, for one clip:

1. Convert pairs to 0-based, drop pairs beyond either tuning's string count (log once per paste).
2. For each played note, in clip order: find the pairs whose source equals the note's row (spec order).  No pair: count `unmapped`, continue.  For each pair, look the MIDI number up on the dest row; no cell: count `droppedOutOfRange` once, only if **no** pair placed the note.
3. Each candidate remembers its pair index.  Group by collision key (`styleNum:row:col`); keep the highest pair index, count the others as `collisions`.  The kept candidates stay in clip order.
4. Pass the kept candidates to the existing `applyPlayedCandidate`, so `overwrite` still governs collisions with notes **already in the section**.

With no map the pairs are the identity (`i:i` for every source row), which reproduces today's output exactly.

### 3.4 Where warnings go

| Event | Channel |
|---|---|
| Many-to-one detected, duplicate pair, or sanitized id differs from what was typed | Result line of the add action **and** User Log |
| Paste collided (many-to-one) or skipped out-of-range pairs | User Log once per paste, plus counts in the result line |
| Stored map dropped on load | User Log |

### 3.5 Result text when a map is used

Appended to the existing result line, only when a map was used, for example:

`MIDI Paste revived s6-riff [map "P48 > P46" reverse-inferred]: named +1 ...; dropped 1; unmapped 2; collisions 0`

---

## 4. Menu

Syntax as in the design: `m)` means trigger `m` bolded; the `)` is not in the caption.  Only new items are shown.

```
/fpc
   m)idi paste map
      m)ap [current-id]
         1) P46 > P48
         2) P48 > P46
         ...
         a) <11th map>
      a)dd
      d)elete
         1) <first User map>
            Y)es: delete <id>
            n)o: keep map
      l)ist
```

| Item | Behavior |
|---|---|
| `m)idi paste map` | Trigger `m` (lowercase).  The existing `M)IDI Paste` uses uppercase `M`; triggers are case-sensitive and `C`/`c` already coexist in this menu. |
| `m)ap [current-id]` | Caption shows the active id (or `none`).  Children are built-in maps first, then User maps, triggered `1` to `9`, then `a` to `z`.  There is no `0)`.  Picking one sets the active id and pops the menu (`popOnBang`).  Beyond 35 maps, the extras are visible in `l)ist` but not selectable by key (Q14). |
| `a)dd` | One typed line: `"Foo > Bar" 1:2, 3:4`.  Success: the stored id, the stored spec, and warnings.  Failure: the specific error and nothing stored.  Does not change the active map. |
| `d)elete` | Numbered/lettered list of **User** maps only (built-ins are not deletable).  Choosing one asks Y/n, as `/fmd` does ([MacroMenu.js](../../../../MacroMenu.js#L21)).  Deleting the active map sets the active id back to none. |
| `l)ist` | Shows a message like `/fml`: a table of number/letter, id, spec as stored, `built-in` or `yours`, and a mark on the active map. |

Captions and messages built from ids or specs are HTML-escaped (F10); in particular `>` is written `&gt;`.

---

## 5. Phases

Each phase: Jest first, then code, then the full suite:
`export INFINITE_NECK_VERBOSE=-1; node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`.
Jest follows the existing non-browser pattern (plain objects, no JSDOM).

| Phase | Content | Top-level `./` files |
|---|---|---|
| **1. Grammar and built-ins** | `midiPasteMaps.js` (`cleanMapId`, `splitMapId`, `parseMapSpec`, `parseAddInput`, `invertPairs`, `listMidiPasteMaps`) and `midiPasteMapBuiltins.js`.  No behavior change anywhere. | none |
| **2. Storage** | The two properties, the new `PluginProperty` datatype, load-time validation with User Log, `resolveValue` field.  A Song round-trips with maps and with an active id; a Song with none writes nothing new. | none |
| **3. Resolution** | `matchEndpoint`, `resolveMidiPasteMap` (forward, reverse-stored, reverse-inferred, custom, class wildcard, fallback), `lookupTuning` built from `song.myTunings` then the library. | none |
| **4. Apply** | `buildMappedCandidates`; `midiPasteClip`, the choice-list filter and the recorded-notes path use it; result text and counts (3.5); collision handling and warnings. | none |
| **5. Menu** | `m)idi paste map` and its four children, action dispatch, trigger numbering, delete confirmation. | none |
| **6. Docs and close** | Plugin help text; [help-plugins.html](../../../../help-plugins.html) clip section; this sprint's closing report and the acceptance checklist. | [help-plugins.html](../../../../help-plugins.html) (documentation) |

Phases 1 to 4 can be reviewed without any UI; Phase 5 is the first that is visible.

### 5.1 User acceptance checklist (written at close of Phase 5)

Browser items only.  Everything else is in Jest.

- Menu shows `m)idi paste map` beside `M)IDI Paste`; both reachable by key.
- `m)ap` lists built-ins first, numbered `1)`; a User map follows them; the current id is shown in the caption.
- `a)dd` with the quoted-id syntax; a typo shows the specific error; a many-to-one map shows the warning and the User Log entry.
- Typing `"` and `>` in the command line input behaves (not swallowed by the menu parser).
- Reload the Song: User maps and the active id are still there; open another Song: they are not.
- P48 to P46 paste with `P48 > P46` active: strings 7 and 8 are not pasted; the result line names the map.
- P46 to P48 with `P48 > P46` active: the reverse is inferred.
- A lute-style reorder map (`1:1, 2:4, 3:2, 4:3`) on a 4-string instrument.
- Delete a User map (Y/n); delete the active one: the active id becomes `none`.

---

## 6. Test plan

New file `_tests/jest/midi-paste-maps.test.js` for the pure modules; additions to [clip-plugin.test.js](../../../../_tests/jest/clip-plugin.test.js) for the plugin.

**Pure module**

- `parseMapSpec`: accepted and rejected lists, including spaces around `,` and `:`, spaces preserved in the stored text, trailing comma, `0`, non-numeric, empty, duplicate pair, many-to-one warning.
- `parseAddInput`: missing quotes, empty id, id with `<`/`&`, pair-form id respaced to `A > B`, more than one `>`.
- `cleanMapId` idempotent; `invertPairs` involutive.
- Built-ins: walk the frozen list and check that every id round-trips `cleanMapId` and every spec parses.  **No value assertions.**
- `matchEndpoint` and `resolveMidiPasteMap`, with synthetic maps and tunings (not the built-in values): lineage vs `baseID` (`P46_1` matches `P46`); class wildcard on target, on source; unknown endpoint id matches by lineage only; reverse inferred; stored reverse wins over inferred; custom id applies to any pair; no fit falls back.

**Plugin**

- Properties round-trip through `exportSongState` / `loadSongState`; a bad stored entry is dropped and logged; defaults write nothing.
- One-to-many; many-to-one with the later pair winning even with `overwrite` false; unmapped source string; dest string that cannot play the pitch; a 4-to-4 reorder; 8 strings to 6 and back with the identity-shaped maps; pair beyond a string count skipped and logged.
- With no map and with a non-fitting active map the output of the existing MIDI Paste tests is unchanged (F11).
- Choice list: a clip becomes listed when a map fits and the legacy gate fails (for example Bass).
- Recorded-notes MIDI Paste uses the same map; Listener copy does not.
- Menu: structure and triggers (`1`-`9` then `a`...), no `0`, caption shows the current id, built-ins first, delete lists User maps only, action names, escaped captions.
- Action results for add (success, each failure, warnings), select, delete (including the active one), list.

---

## 7. Edge cases and risks

| Risk | Plan |
|---|---|
| A built-in map whose MIDI values do not agree with the library tunings (F12). | Q1.  Optional advisory script `bin/check-midi-paste-maps.js` that prints, per built-in pair with known tunings, how far each mapped open-string pitch moves.  It is a report, not a test, so it does not bind values (Q15). |
| `baseID` vs lineage mix-up (F5). | Matching is by `fromBaseID || baseID` only; a test uses `P46_1` / `P46_2`. |
| Id text reaching HTML. | Sanitizer drops `<`, `&`, quotes; every echo is also escaped. |
| Load of a damaged stored map blocking the Song open. | Validation drops and logs; never throws (F9). |
| Integer-like ids re-ordered in an object. | Array storage (3.2). |
| A map references a string the instrument does not have. | Skipped per paste with a User Log line; never an error (Q8). |
| Many maps overflowing the 35 trigger keys. | `l)ist` shows all; selection by key is capped (Q14). |
| Reverse inference for a lossy map (P48 to P46 reversed is not a round trip). | Strings with no edge stay empty by rule, so the inferred reverse of `1:1..6:6` pastes only strings 1 to 6 of P46 into P48 and leaves 7 and 8 empty.  This is the intended sparse behavior. |
| `m` / `M` confusion in the menu. | Same pattern as `c` / `C`; the captions differ (`midi paste map` vs `MIDI Paste`). |

---

## 8. Questions

Each has a recommendation; reply with the numbers to override.

1. **Bass built-ins.**  The library puts Bass5's extra string at the bottom (F12), so the MIDI-correct maps differ from the design.  *Recommend using the library-derived values:* `Bass5 > Bass4` `1:1, 2:2, 3:3, 4:4`; `Bass6 > Bass5` `2:1, 3:2, 4:3, 5:4, 6:5`; `Bass6 > Bass4` `2:1, 3:2, 4:3, 5:4`.  Or do you want the design values as written (if the real basses you have in mind are tuned from the top)?
2. **Starting selection.**  *Recommend the active id starts empty and shows `[none]` in `m)ap`, which means today's behavior.*  The list has no `0)`, so how does the User go back to none?  *Recommend a final `n)one` child under `m)ap` (letter `n` is reserved, so choices skip it).*  Alternative: the first built-in is the default and "none" does not exist.
3. **Pick a map by hand every time?**  Pasting P48 to P46 and then Bass5 to Bass4 means switching the active map between them.  *Recommend also trying a stored pair-form map automatically when the active map does not fit,* the Song's own maps first, then built-ins.  The active map still wins when it fits.  The design only describes the active map; this is an addition, so say no if you want it strictly manual.
4. **Active map does not fit the pair.**  *Recommend fall back to today's behavior* (identity, 6-string Guitar only) *with the result line saying so.*  Alternative: refuse the paste.
5. **Custom ids** (no `>`): *Recommend they apply to any pair, with no reverse inference.*  Alternative: they are valid only if the User also gives the endpoints, which would add syntax.
6. **Class wildcard on both sides.**  *Recommend yes:* `P48 > S6` matches any 8-string-Guitar source and any 6-string-Guitar target, and the reverse.  Endpoint class is looked up from the Song's tunings and then the library; an unknown tuning id matches only by lineage.  The design states the target side explicitly; the source side is my reading.
7. **Many-to-one: last wins by pair order** (the later pair in the spec), not by clip order.  The User controls precedence by the order they write.  OK?
8. **Pair beyond an instrument's string count:** skip the pair and log (recommended), or fail the paste.
9. **Same id as a built-in or User map:** *Recommend reject on add.*  Alternative: a User map with a built-in's id shadows it, and deleting it brings the built-in back (lets the User override a built-in without a new name).
10. **Delete:** number/letter then Y/n (recommended, matches `/fmd`), or delete directly.  Built-ins are never deletable.
11. **Where the map applies:** `midiPasteClip` and recorded-notes MIDI Paste (`/fpcrp m`); not Listener copy.  OK?
12. **Named notes** are pasted unchanged, as today.  OK?
13. **Id characters:** letters, digits, space, `_ - . '` and one `>`; spacing of pair-form ids rewritten to `A > B`.  Case-insensitive uniqueness, case-sensitive endpoint matching.  OK?
14. **Key cap of 35 (`1-9`, `a-z`)**, with the rest shown only in `l)ist`.  Acceptable, or do you want an `i)d` entry at the end of `m)ap` (like `/fmd`) that takes a typed id?  *Recommend the cap, since 35 maps is far beyond what a Song needs.*
15. **Advisory script** `bin/check-midi-paste-maps.js` (section 7): wanted now, later, or never?
16. **Approvals:** this plan edits no top-level `./` code file.  [help-plugins.html](../../../../help-plugins.html) is documentation at the top level; may it be updated in Phase 6?  Also, [sprint-151.md](sprint-151.md) gets a link to this plan once you accept it.
