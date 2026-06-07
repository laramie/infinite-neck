# Iteration 2 Implementation Plan

## Feature

ArpeggioPlugin should gain a new `from` option that chooses the note-name source used to build the candidate set.

Requested values:

- `NamedNote`
- `SingleNote`

Requested behavior:

1. `NamedNote` preserves current behavior exactly.
2. `SingleNote` reads note names from SingleNotes in the current section and uses those note names exactly as if they had come from `namedNotes`.

## Scope

This plan covers only Iteration 2 of sprint 120.

It does not propose code changes yet.

It does not change Arpeggio sequencing styles, display modes, persistence format beyond the new property, or other sprint-120 work.

## Viability

This is viable and should be a relatively small extension.

The main reason it is small is that ArpeggioPlugin already has a single candidate-collection choke point in [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js#L1289). Today that method collects note names from `sectionNotes.namedNotes`, then generates candidate positions across the target tuning by scanning rows and frets.

So the simplest implementation is:

1. leave all downstream sequencing logic unchanged
2. change only how the set of source note names is built
3. add one persisted plugin property to select the source

## Current behavior summary

Today ArpeggioPlugin candidate generation does this:

1. resolves the selected target table
2. reads that table's `SectionNotes`
3. extracts note names from `namedNotes`
4. scans the target tuning row/fret range
5. includes any position whose note name is in that extracted set

That is visible in [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js#L1289).

The important architectural point is that the plugin does not arpeggiate the stored note objects directly. It only uses them to derive a note-name set, then rebuilds candidate positions from the target tuning. That matches the requested feature very well.

## Proposed feature behavior

## New property

Add a new plugin property:

- `name`: `from`
- `datatype`: `org.dynamide.Select`
- `defaultValue`: `NamedNote`
- `value`: `NamedNote`
- `caption`: `from`
- `trigger`: requested as `f`
- `options`:
  - `NamedNote`
  - `SingleNote`

Requested visible menu shape:

- `f rom [NamedNote]`
- `f rom [SingleNote]`

In the repo's current menu system this would be rendered by the existing `PluginProperty` select node infrastructure once the property is added to [plugins/arpeggio/properties.json](plugins/arpeggio/properties.json).

## Behavioral definition

### `from = NamedNote`

Behavior remains exactly as today.

Candidate note-name source:

- keys of `section.getSectionNotes(targetTableID).namedNotes`

### `from = SingleNote`

Candidate note-name source becomes:

- note names from `section.getSectionNotes(targetTableID).playedNotes`
- filtered to `styleNum === Note.STYLENUM_SINGLE`

Those note names should be de-duplicated into a set before scanning the tuning grid.

After that, the existing candidate-position generation should run unchanged.

## Minimal implementation approach

## 1. Add the new property to `properties.json`

File:

- [plugins/arpeggio/properties.json](plugins/arpeggio/properties.json)

Add a new visible select property for `from`.

Recommended values:

```json
{
  "name": "from",
  "caption": "from",
  "trigger": "f",
  "datatype": "org.dynamide.Select",
  "value": "NamedNote",
  "defaultValue": "NamedNote",
  "visibleInMenu": true,
  "options": [
    { "value": "NamedNote", "caption": "NamedNote", "trigger": "N" },
    { "value": "SingleNote", "caption": "SingleNote", "trigger": "S" }
  ]
}
```

The option triggers above are just examples for the child choices. The top-level trigger is the more important product question because of the conflict noted below.

## 2. Surface the property in the Arpeggio menu

File:

- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Add the new property to `getVisibleMenuChildren()`.

Recommended position:

- near other core generation settings
- most likely after `style` and before display settings like `showNoteName`

Reasoning:

1. `from` affects candidate generation, not display
2. it conceptually sits closer to `style` and range selection than to flashcard/color options

## 3. Add a small getter for the source mode

File:

- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Add a helper with behavior equivalent to:

- return `this.getProperty('from')?.getValue() || 'NamedNote'`

This keeps all mode branching in one place.

## 4. Refactor candidate-note-name extraction into a small helper

The least invasive change is to split `collectCandidatesForSection(...)` into two steps:

1. resolve a set of target note names
2. build candidate positions from that set

Recommended new helper names:

- `collectCandidateNoteNames(section, tableID)`
- or two narrower helpers:
  - `collectNamedNoteSourceNames(sectionNotes)`
  - `collectSingleNoteSourceNames(sectionNotes)`

Behavior:

### NamedNote mode

Equivalent to today's code:

1. read `sectionNotes.namedNotes`
2. include only entries whose payload object is non-empty
3. return the note-name keys as a `Set`

### SingleNote mode

Recommended behavior:

1. read `sectionNotes.playedNotes`
2. filter to `styleNum === Note.STYLENUM_SINGLE`
3. include only entries with a usable `noteName`
4. return unique note names as a `Set`

## 5. Leave all sequence expansion logic unchanged

The following methods should not need algorithm changes if the feature is implemented correctly:

- `expandEverySequence(...)`
- `expandAlternateSequence(...)`
- `expandRandomSequence(...)`
- `expandBachSequence(...)`

They already operate on candidate positions, not directly on `namedNotes` or `playedNotes` storage.

That is the main reason this extension is low risk.

## 6. Persist the new property through existing plugin state flow

ArpeggioPlugin already loads and exports persisted property values through generic property handling in [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js#L193) and [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js#L208).

So if `from` is added to `properties.json`, it should persist automatically unless custom validation is introduced.

No custom persistence work is expected.

## Recommended exact behavioral rules

## Table scope

Use the selected Arpeggio target table only.

That matches current behavior and avoids cross-table ambiguity.

So for `SingleNote` mode, the plugin should read:

- `currentSection.getSectionNotes(targetTableID).playedNotes`

not all played notes across all tables.

## Included note styles in `SingleNote` mode

Use only `Note.STYLENUM_SINGLE`.

Do not include:

- tiny notes
- bend notes
- fingering notes
- recorded notes

Reasoning:

1. the requirement says `SingleNote`, singular and specifically
2. this is the narrowest interpretation
3. it avoids product drift into “all played note lanes”

## Deduplication rule

Deduplicate by note name before candidate scanning.

So if multiple SingleNotes in the current section have note name `C`, the candidate note-name source still just contains `C` once.

This is the closest match to how `namedNotes` currently work as a note-name source.

## Color rule

Ignore color completely for source extraction.

Only note names matter.

This matches the requested feature and the current architecture.

## Empty-source behavior

If the chosen source mode yields no note names:

1. candidate set is empty
2. generated sequence is empty
3. Arpeggio apply/display behaves as “nothing to arpeggiate”

No special fallback to the other mode is recommended.

## Alerts and questions

## Alert 1: requested trigger `f` conflicts with existing top-level `flashcard`

This is the only clear implementation problem surfaced by the current code.

In [plugins/arpeggio/properties.json](plugins/arpeggio/properties.json), `flashcard` already uses top-level trigger `f`.

So the requested new menu item trigger `f` for `from` conflicts with an existing visible sibling menu item.

This should be resolved before coding.

Recommended options:

1. move `flashcard` to another trigger
2. give `from` another trigger
3. if the menu system supports it safely, put one item deeper in a submenu, though that is not implied by the request

Recommended minimal choice:

1. keep the new caption text `from`
2. choose a different top-level trigger than `f`

Reasoning:

1. Iteration 2 is about candidate-source behavior, not menu refactoring
2. changing one trigger is lower risk than disturbing existing flashcard behavior

## Question 1: should `SingleNote` mean only `STYLENUM_SINGLE`?

Recommended answer:

- yes

This is the narrowest reading and the safest implementation.

## Question 2: should `SingleNote` source read only the selected target table?

Recommended answer:

- yes

Reading across all tables would be a larger product change and does not match current target-table behavior.

## Question 3: should bend/tiny/fingering ever become valid future `from` modes?

Recommended answer for this iteration:

- no

Do not broaden the scope unless a later iteration asks for it explicitly.

## Expected code touch points for the coding phase

Primary:

1. [plugins/arpeggio/properties.json](plugins/arpeggio/properties.json)
2. [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Likely tests:

1. [_tests/jest/arpeggio-plugin.test.js](_tests/jest/arpeggio-plugin.test.js)

No changes should be needed in:

1. note table display code
2. replay infrastructure
3. Section model shape
4. persistence schema outside normal plugin property persistence

## Recommended tests for the later coding iteration

1. default `from` value is `NamedNote`
2. `NamedNote` mode preserves current candidate behavior exactly
3. `SingleNote` mode uses note names from `playedNotes` entries with `styleNum === STYLENUM_SINGLE`
4. duplicate SingleNote note names collapse to one source note-name entry
5. tiny/bend/fingering notes do not contribute source note names in `SingleNote` mode
6. empty SingleNote source yields no generated sequence
7. the `from` property persists through plugin save/load
8. UI menu shows the new property in the intended location
9. bach/every/alternate/random still operate normally once candidates are built from SingleNotes

## Suggested implementation order

1. resolve the trigger conflict
2. add the `from` property to `properties.json`
3. surface it in `getVisibleMenuChildren()`
4. add a getter for the source mode
5. refactor candidate note-name extraction into a helper
6. implement `SingleNote` extraction from `playedNotes`
7. add Jest coverage for both modes and persistence

## Bottom line

This is a straightforward extension, not a redesign.

The real implementation work is mostly:

1. adding one persisted select property
2. extracting note names from `playedNotes` when `from = SingleNote`
3. leaving the rest of the candidate-position and sequence logic alone

The only notable alert is the requested top-level trigger `f`, which currently conflicts with `flashcard` and needs a product decision before coding.