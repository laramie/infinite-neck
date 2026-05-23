# ClipPlugin implementation plan

## Scope

This is a first-draft implementation plan for Iteration 1 of ClipPlugin.

The goal is to turn the current design request in [ClipPlugin-design.md](./ClipPlugin-design.md) into an implementation shape that is concrete enough to code, while still surfacing the places where product decisions are not fully locked down.

This plan intentionally favors:

- simple behavior
- reuse of existing plugin patterns
- minimal new model concepts
- conservative Graveyard integration

## Summary

ClipPlugin is a note clipboard for one table in one section.

It should:

1. Select one target table from the current song.
2. Select which note categories to include.
3. Copy or cut those notes from the current section into a Graveyard record of a new type, `CLIP`.
4. Revive a compatible stored clip into the current section and current selected table.
5. Paste by either:
	 - overwriting collisions, or
	 - skipping collisions

This is not section cloning, not section revival, and not a general song-to-song interchange format.

## Product goals

1. Make copy/cut/paste of notes feel fast and unsurprising.
2. Restrict iteration 1 to one selected table and one selected section at a time.
3. Reuse Graveyard as the multi-clipboard store rather than introducing a new storage system.
4. Preserve note payloads exactly where practical, including color classes.
5. Keep compatibility rules simple: same tuning identity only.

## Non-goals

1. No `RecordedNotes` support.
2. No cross-song normalization.
3. No string/fret-range filtering during clip creation.
4. No automatic transposition or color remapping on paste.
5. No support for pasting between incompatible tunings in iteration 1.
6. No attempt to revive whole sections from ClipPlugin. That remains the job of existing section Graveyard behavior.

## Recommended iteration-1 behavior

### Working note lanes

ClipPlugin should operate on these section-note lanes only:

1. `namedNotes`
2. `playedNotes` entries with `styleNum = STYLENUM_SINGLE`
3. `playedNotes` entries with `styleNum = STYLENUM_TINY`

`RecordedNotes` are explicitly ignored.

### Design mismatch to resolve safely

The design text says “The plugin only handles NamedNotes and PlayedNotes,” which fits the three categories above.

But the requested menu also lists:

- `b) bend`
- `h) highlight`

Those are valid note-display families in the UI, but they are outside the stated scope.

Safe recommendation for iteration 1:

1. implement only `named`, `single`, and `tiny`
2. omit `bend` and `highlight` from the actual menu for now
3. document that they are deferred rather than silently ignored

If product wants the visible menu entries now, they should be rendered as disabled with help text saying “not in iteration 1.”

## Proposed Graveyard model

## New grave type

Add a new `GraveType.CLIP` in [graveyard.js](../../../../graveyard.js).

This should be treated as a first-class stored type, similar in spirit to `SECTION` and `PLUGIN`, but with its own paste semantics rather than calling the generic `raise()` section revival path.

## Clip payload

The JSON payload should be a small object, not a raw `Section` and not a whole `SectionNotesByTable` map.

Recommended payload shape:

```json
{
	"schemaVersion": 1,
	"source": {
		"tableID": "tblP1",
		"baseID": "P1",
		"tuningSignature": "P1",
		"frets": 12
	},
	"include": {
		"named": true,
		"single": true,
		"tiny": true
	},
	"counts": {
		"named": 3,
		"single": 2,
		"tiny": 4
	},
	"sectionNotes": {
		"namedNotes": {},
		"playedNotes": []
	}
}
```

### Why this payload shape

1. It avoids storing unrelated section state.
2. It is explicit about source tuning/table metadata.
3. It preserves exact note data.
4. It is easy to validate during revive.
5. It avoids coupling ClipPlugin to the generic `Graveyard.raise()` section logic.

## Clip Graveyard context

Use normal Graveyard fields plus Clip-specific context metadata.

Recommended `context` shape:

```json
{
	"caption": "named-3-single-2-tiny-4-1202",
	"userKey": "named-3-single-2-tiny-4-1202",
	"logicalKey": "clip::named-3-single-2-tiny-4-1202",
	"tableID": "tblP1",
	"baseID": "P1",
	"tuningSignature": "P1",
	"schemaVersion": 1,
	"counts": {
		"named": 3,
		"single": 2,
		"tiny": 4
	}
}
```

### Naming recommendation

Store both:

1. `caption`: what the menu shows
2. `userKey`: the editable identity string

That follows the repo’s existing Graveyard context pattern used by plugin snapshots.

## Graveyard storage semantics

Use append semantics for clips by default.

Do not replace older clips automatically unless product later asks for key-based replacement.

Reasoning:

1. A clipboard should act like a stack/history.
2. The design explicitly describes a multi-clipboard feel.
3. Replacing by name would make accidental overwrites more likely.

So iteration 1 should use:

- `song.graveyard.bury(GraveType.CLIP, payload, context)`

not `buryReplacing(...)`.

## Compatibility rules

## Definition of compatibility

Iteration 1 compatibility should be:

1. source and target tuning have the same `baseID`

That is simpler and safer than comparing full tuning objects or row-range arrays.

The design says “same Tuning,” and in current repo language the practical stable identifier for that is the tuning `baseID`.

## Fret-count mismatch behavior

Allowed.

Paste rules:

1. `namedNotes` always remain valid because they are note-name keyed, not fret-position keyed.
2. `playedNotes` with `col > target frets` are silently dropped.
3. `playedNotes` with valid coordinates paste normally.

This matches the design request and keeps revive logic simple.

## Row mismatch behavior

Not explicitly specified, but a safe rule is needed.

Recommendation:

1. require identical tuning identity, which should imply compatible row count in normal usage
2. still guard row bounds during paste
3. silently drop any `playedNotes` whose `row` exceeds the target table row range

This is defensive and cheap.

## Plugin surface

## Proposed plugin id and menu trigger

- plugin id: `clip`
- menu trigger: `c`

## Recommended menu for iteration 1

Actual menu to implement:

- `targetTable`
- `copyToGraveyard`
- `cutToGraveyard`
- `reviveFromGraveyard`
- `overwrite`
- `include`
	- `named`
	- `single`
	- `tiny`
- `help`

### Include menu recommendation

Use toggle properties:

- `includeNamed`
- `includeSingle`
- `includeTiny`

Optional future placeholders:

- `includeBend`
- `includeHighlight`

But iteration 1 should not persist or act on them unless product confirms they belong in scope now.

## Action semantics

### Copy

`Copy` should:

1. collect included notes from the current section and selected table
2. build the clip payload
3. prompt for the default generated name
4. bury the clip in Graveyard
5. leave the current section unchanged

### Cut

`Cut` should:

1. do everything `Copy` does
2. then remove only the selected note categories from the current section and selected table
3. refresh the current section UI

### Revive/Paste

`Revive from Graveyard` should:

1. enumerate candidate `CLIP` records in the Graveyard
2. filter to compatible records for the currently selected target table
3. show them by stored caption/user key
4. paste into the current section and selected table
5. mark `lastRevived` on the used Graveyard record

This should not call the generic `Graveyard.raise()` path. Clip revive needs plugin-specific merge rules.

## Default generated name

Recommended builder:

1. count included notes by category after filtering
2. emit only non-zero categories
3. append local 24-hour `HHMM`

Examples:

- `named-3-single-2-tiny-4-1202`
- `single-12-2305`
- `named-7-0814`

If no selected notes exist, do not store an empty clip. Return a no-op result such as:

- `Clip copy skipped: no included notes found`

## Paste merge rules

## NamedNotes

Collision unit: note name.

Rules:

1. if `overwrite=true`, incoming named note replaces target named note of the same name
2. if `overwrite=false`, incoming named note is skipped when the target already has that note name

## Played Single/Tiny notes

Collision unit: cell lane.

Recommended collision rule:

1. `single` collides only with existing `Single` at the same `row:col`
2. `tiny` collides only with existing `Tiny` at the same `row:col`

This matches the repo’s lane-oriented note model and avoids unnecessary cross-lane destruction.

### Overwrite behavior

If `overwrite=true`:

1. remove the existing note in the same lane/cell
2. insert the incoming note preserving its original payload

If `overwrite=false`:

1. leave the existing note in place
2. skip the incoming note

## Color preservation

Preserve original note payloads exactly.

Do not normalize:

- `colorClass`
- note naming
- note function classes
- any auxiliary note fields that already exist on the stored note objects

This matches the design and reduces surprise.

## Cut behavior details

For cut, remove only what the include toggles selected.

Examples:

1. `includeNamed=true`, `includeSingle=false`, `includeTiny=false`
	 - cut only named notes
2. `includeNamed=false`, `includeSingle=true`, `includeTiny=true`
	 - cut only matching played-note lanes

This should reuse the section-note helper patterns already used by FillPlugin:

- `clearNamedNote(...)`
- `removePlayedNotesWhere(...)`

## Suggested implementation shape

## Files likely to add

1. `plugins/clip/ClipPlugin.js`
2. `plugins/clip/properties.json`
3. tests in `_tests/jest/clip-plugin.test.js`

## Files likely to modify

1. [graveyard.js](../../../../graveyard.js)
2. plugin registration/runtime wiring files for plugin discovery
3. plugin help docs if ClipPlugin is user-facing in help

## Core helpers recommended inside ClipPlugin

1. `getSelectedTargetTableID()`
2. `getTargetTuning(song)`
3. `collectClipPayload(song, section, tableID)`
4. `buildDefaultClipName(counts)`
5. `buryClip(payload, context)`
6. `getCompatibleClipRecords(song, tableID)`
7. `pasteClipRecord(record, song, section, tableID)`
8. `removeIncludedNotesFromSection(sectionNotes)`
9. `refreshCurrentSectionUi(song)`

These closely follow the structure used by existing plugins like MovePlugin and FillPlugin.

## Recommended revive implementation strategy

Do not extend `Graveyard.raise()` to know how to paste clips in iteration 1.

Instead:

1. ClipPlugin reads compatible `CLIP` records from `song.graveyard.records`
2. the revive menu is built directly by the plugin
3. selecting a menu item invokes a plugin action like `reviveClip:<timestamp-or-index>`
4. the plugin performs the merge itself
5. the plugin updates `record.lastRevived`

Reasoning:

1. `raise()` currently handles generic global revive behavior, not table-aware paste logic
2. Clip revive depends on the current selected target table and overwrite toggle
3. plugin-owned revive logic is simpler and less invasive

## Graveyard record addressing recommendation

For revive menu actions, use the record index from the current Graveyard list.

That is acceptable for iteration 1 because:

1. menu items are built from the current list snapshot
2. selection is immediate
3. the repo already uses index-driven Graveyard UI actions

If later needed, move to a timestamp-based identifier.

## Persistence recommendation

ClipPlugin should persist only lightweight user settings, likely:

1. `targetTable`
2. `overwrite`
3. include toggles

It should not persist:

1. the last shown compatible clip list
2. runtime counters
3. selected temporary revive target

## Result-message recommendations

Use concise result strings like:

1. `Clip copied: named 3, single 2, tiny 4 as named-3-single-2-tiny-4-1202`
2. `Clip cut: named 3, single 2, tiny 4 as named-3-single-2-tiny-4-1202`
3. `Clip revive skipped: no compatible clips`
4. `Clip revived: added named 3, single 2, tiny 4, dropped 1, skipped 2`

The revive result should separately count:

1. added
2. skipped due to overwrite=false collisions
3. dropped due to table bounds incompatibility

## Implementation phases

## Phase 1: storage and menu surface

Deliverables:

1. ClipPlugin skeleton
2. properties schema
3. target-table selection
4. include toggles
5. overwrite toggle
6. grave type constant `CLIP`

Validation:

1. plugin loads and menu renders
2. target table options follow existing plugin patterns
3. compatible clip menu returns empty safely when no clips exist

## Phase 2: copy and cut

Deliverables:

1. note collection by lane
2. default clip naming
3. Graveyard bury path for `CLIP`
4. cut removal logic

Validation:

1. copy stores correct payload and context
2. cut removes only selected lanes
3. copy/cut skip empty selections cleanly

## Phase 3: revive/paste

Deliverables:

1. compatible clip discovery
2. revive menu entries
3. overwrite/skip collision behavior
4. bounds dropping for oversized played notes
5. `lastRevived` update

Validation:

1. named note replacement and skip behavior
2. single/tiny lane collision behavior
3. out-of-range played notes drop silently
4. incompatible tuning clips do not appear in the revive menu

## Phase 4: help, polish, and docs

Deliverables:

1. help text
2. summary text
3. user docs/help entry if desired

Validation:

1. help clearly states supported note categories
2. help clearly states that `RecordedNotes` are not copied

## Recommended tests

At minimum:

1. target table menu excludes wired display tables the same way other plugins do
2. copy stores `CLIP` records with expected payload shape
3. default generated names skip zero-count categories
4. cut removes only included named notes
5. cut removes only included single/tiny played notes
6. revive menu shows only compatible tuning clips
7. revive with overwrite=true replaces named note collisions
8. revive with overwrite=false preserves named note collisions
9. revive with overwrite=true replaces single-note lane collisions only
10. revive with overwrite=false skips single-note lane collisions only
11. revive drops played notes that exceed target fret count
12. revive preserves note `colorClass`
13. revive updates `lastRevived`
14. empty copy/cut is a no-op and does not bury a clip

## Open questions for refinement

## 1. Are `bend` and `highlight` in scope now or intentionally deferred?

Current plan recommendation:

- defer them from iteration 1 implementation

## 2. What exact tuning identity defines “same Tuning”?

Current plan recommendation:

- use `baseID`

If product means a deeper structural identity, that needs to be specified.

## 3. Should clip names be unique?

Current plan recommendation:

- no uniqueness enforcement beyond whatever Graveyard already allows
- multiple clips may share the same caption

## 4. Should revive operate only on the plugin’s selected target table, or should the revive action itself also allow choosing a compatible destination table?

Current plan recommendation:

- selected target table only

That keeps the first version simpler and consistent with the other plugins.

## 5. Should `namedNotes` overwrite behavior count a same-name replacement as “added” or “replaced” in result text?

Current plan recommendation:

- keep separate internal counts if convenient, but report it under “added/skipped/dropped” only unless debugging requires more detail

## 6. Should cut create a section backup in the Graveyard the way MovePlugin does before destructive operations?

Current plan recommendation:

- not in iteration 1 unless product explicitly asks for undo-like protection

Reason: the clip itself already contains the removed notes, and this plugin is intended to feel like clipboard editing rather than transformation-with-backup.

## Bottom line

ClipPlugin iteration 1 is straightforward if kept narrow:

1. one selected table
2. named/single/tiny only
3. same-tuning clips only
4. overwrite or skip on paste
5. clip-specific Graveyard records handled by the plugin, not generic Graveyard raise

That delivers the requested copy/cut/paste workflow with minimal model churn and a clear path for later expansion.
