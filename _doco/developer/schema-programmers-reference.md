# infinite-neck JSON Schema Songfile Programmer's Reference

This note covers the V2 songfile schema and the CLI validator flow for developers who already know Ajv, JSON Schema, and repository-level validation workflows.

## How To Run Validation

### Default validation

Run the base validator when you want the same pass/fail boundary used by the repository's songfile validity checks.

```bash
cd infinite-neck
npm run validate:song-schema
```

This validates the default song lists:

- `songs/song-list.json`
- `songs/tests/test-song-list.json`

Equivalent direct command:

```bash
node bin/validate-song-schema.js
```

### Strict validation

Run strict mode when you want to detect schema-valid but incomplete or useless files.

```bash
cd infinite-neck
npm run validate:song-schema:strict
```

Equivalent direct command:

```bash
node bin/validate-song-schema.js --strict
```

Strict mode currently does three things beyond base schema validation:

- Enables empty-section reporting.
- Fails songs whose sections are all empty.
- Fails songs missing `visibleNoteTables`.

`visibleNoteTables` is intentionally not required by the base schema. A song may be structurally valid while all tables are hidden. That becomes a strict-mode quality gate, not a schema-invalid condition.

### Empty-section alert mode

Run alert mode when you want empty-section counts in the output without turning them into failures.

```bash
node bin/validate-song-schema.js --alert-empty-songs
```

Output format example:

```text
PASS songs/name-that-note-game.json | empty sections: 79/79
```

This is useful for converter audits and large batch review when you want visibility into degraded files before deciding whether they should fail CI or release validation.

### Targeted validation

Validate a specific file:

```bash
node bin/validate-song-schema.js --file songs/name-that-note-game.json
node bin/validate-song-schema.js --file songs/name-that-note-game.json --strict
```

Validate a specific song list:

```bash
node bin/validate-song-schema.js --song-list songs/song-list.json
node bin/validate-song-schema.js --song-list songs/tests/test-song-list.json --strict
```

When `--file` or `--song-list` is provided, the validator does not fall back to the default song lists. It validates only the explicit targets.

### Jest versus CLI

Keep the distinction clear:

- Jest tests treat base schema validity as the pass/fail contract for supported V2 files.
- The CLI supports stricter audit modes for incomplete, converter-damaged, or operationally suspicious files.

That split is deliberate. Do not casually move strict-only checks into the base schema unless the runtime contract has actually changed.

## File Locations

### Core schema module

- `bin/song-file-schema.js`

This file owns the Ajv 2020 schema, schema compilation, and the exported `validateSongFileSchema()` helper.

### CLI validator

- `bin/validate-song-schema.js`

This file owns repository-oriented validation behavior:

- target expansion from song lists
- CLI argument parsing
- strict mode policy
- empty-section analysis
- output formatting and exit codes

### Jest-side import shim

- `_tests/jest/SongFileV2Schema.js`

This is intentionally thin. It re-exports the shared schema helper from `bin/song-file-schema.js` so Jest and CLI use the same schema logic.

### Primary Jest integration

- `_tests/jest/song-load-library.test.js`

This test validates song JSON against the base V2 schema and then loads the file through the canonical `new Song(data)` path.

### Canonical model load path

- `SongPersistence.js`
- `Song.js`
- `SectionPersistence.js`
- `SectionNotesPersistence.js`

The constructor path is the source of truth for V2 hydration. `Song.addSections()` was removed because it bypassed that model lifecycle.

## Specific Maintenance Tips

### Treat `myTunings` as persisted song ownership

The V2 schema requires `myTunings` and forbids top-level `tunings`.

Reasoning:

- `AllTunings` is application-owned source data.
- `myTunings` is the song-owned persisted clone set.
- Top-level `tunings` in a songfile is treated as a leak, not a supported persistence form.

If a converter or save path reintroduces `tunings`, fix the producer rather than weakening the schema.

### Keep base schema and strict policy separate

Base schema should answer: is this a supported V2 songfile shape?

Strict mode should answer: is this file complete enough to be useful and operationally safe?

Examples of strict-only checks:

- all sections empty
- `visibleNoteTables` missing

Examples of base-schema checks:

- `songfileVersion === "V2"`
- `myTunings` present
- section shape is `sectionNotesByTable`, not legacy `noteTables` / `namedNotes` / `recordedNotes`

### Be conservative with note-level tightening

The current schema intentionally allows some variability in persisted `Note` payloads because the repository still contains legitimate V2 files with sparse note fields.

If you tighten note requirements:

- audit the whole song library first
- audit the V2 test fixtures second
- update the producer code before or alongside the schema change

Do not assume every persisted note carries `noteName` and `colorClass`. Current V2 files prove otherwise.

### Prefer constructor-based load verification

If you add new tests around loading, use:

```js
const song = new Song(data);
song.setHeadless(true, true);
song.ensureDefaultSection();
song.fixupCurrentIndexForLoadedSong();
```

Do not reintroduce ad hoc section injection helpers that bypass the Song/Section persistence constructors.

### Empty-section counting semantics

The validator currently counts a section as empty when every table in `sectionNotesByTable` is empty, or when the section has no tables at all.

Content is counted from:

- `playedNotes.length`
- `Object.keys(namedNotes).length`
- total notes across all `recordedNotes[beat]` arrays

If that policy changes, update only the CLI-side emptiness helpers unless the runtime definition of a meaningful section has changed.

### Keep documentation and scripts aligned

If you add flags or validation modes:

- update `bin/validate-song-schema.js` usage text
- update `package.json` scripts if the mode is common enough to deserve a shortcut
- update this document
- update `README.md` if the command should be visible from the top-level maintenance notes

## Current Commands Summary

```bash
npm run validate:song-schema
npm run validate:song-schema:strict
node bin/validate-song-schema.js --alert-empty-songs
node bin/validate-song-schema.js --file songs/name-that-note-game.json --strict
node bin/validate-song-schema.js --song-list songs/song-list.json
```

