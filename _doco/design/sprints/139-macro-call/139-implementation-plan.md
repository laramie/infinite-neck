# sprint-139-macro-call Implementation Plan

Date: 20260805
Related design: [139-design.md](139-design.md)
Related sprint: [sprint-139.md](sprint-139.md)

## Scope summary

This sprint extends macro execution in four ways:

1. Allow macro-to-macro calls up to depth 4 (instead of current recursion block at depth > 0).
2. Add new menu command `/fmc` to call a macro with required JSON object input.
3. Add line expansion for macro lines using `${name}` placeholders, including call-time args and existing approved values.
4. Preserve blank/comment lines in stored macro text, and add `/fml` as a macro log line command that writes to User Log only when macro verbose mode is on.

## Current behavior (baseline)

- Macro recursion is blocked in [key-handlers.js](../../../../key-handlers.js) by checking `macroExecutionDepth > 0` in `runSongMacroById(...)`.
- Macro lines are normalized by trimming and removing blanks in [MacroExecutor.js](../../../../MacroExecutor.js) `normalizeMacroLines(...)`.
- Song load normalization also trims/removes blank macro lines in [SongPersistence.js](../../../../SongPersistence.js).
- Macro menu currently has add/delete/edit/move/list/run/verbose in [menu.js](../../../../menu.js); no `/fmc` and no `/fml`.
- Existing Jest coverage is mainly in [macro-executor.test.js](../../../../_tests/jest/macro-executor.test.js).

## Proposed implementation

## 1) Macro execution context and depth model

### Goals

- Permit nested macro calls with maximum active call depth of 4.
- Keep deterministic failure when depth would exceed limit.

### Changes

- In [key-handlers.js](../../../../key-handlers.js):
  - Replace recursion guard logic (`macroExecutionDepth > 0`) with max depth logic:
    - allow when current depth is 0..3
    - block when current depth is already 4
  - Add a constant such as `MAX_MACRO_EXECUTION_DEPTH = 4`.
  - Keep `macroExecutionDepth += 1` / `finally decrement` discipline.
  - Update error/log message from recursion wording to depth wording.

### Notes

- Depth limit applies to active stack frames, not total calls over time.
- Any nested failure should bubble up as current execute failure behavior already does.

## 2) `/fmc` macro call command

### Goals

- Add command-line entry for macro call with one required JSON object input.
- Input shape:
  - `{"macro":"macroId","args":{...}}`

### Menu changes

- In [menu.js](../../../../menu.js), under `/fm`:
  - Add `c) call` with action `macroCall`.
  - Add input metadata with id `call` and datatype `json` (or existing string + runtime JSON parse).

### Action changes

- In [key-handlers.js](../../../../key-handlers.js), add case `macroCall`:
  - Parse input object.
  - Validate object shape:
    - must be object
    - `macro` must be non-empty string and valid macro id
    - `args` must be present and an object (empty object allowed)
  - Invoke `runSongMacroById(macro, { callArgs: args })`.
  - Return command result consistent with existing macro action messages.

### Runtime behavior

- `/fmc` should be callable interactively and from inside macro lines (nested call support).

## 3) Macro line model: preserve blank/comment lines

### Goals

- Preserve line order exactly as entered.
- Treat the following as non-executable lines:
  - blank lines
  - lines with optional leading whitespace then `#`

### Changes

- In [MacroExecutor.js](../../../../MacroExecutor.js):
  - Introduce line classification helper, for example:
    - blank
    - comment
    - command
  - Update normalization so it no longer drops blank lines/comments.
  - Keep command parsing strict only for command lines.
  - Update validation to skip blank/comment lines while still line-numbering against original text.
  - Update execution loop to:
    - skip blank/comment lines without error
    - optionally emit verbose trace entries for skipped lines (decision question below)

- In [SongPersistence.js](../../../../SongPersistence.js):
  - Align macro normalization with executor behavior:
    - preserve raw macro lines as strings
    - do not trim-away blanks/comments

- In [templates/macros/macros.builder.js](../../../../templates/macros/macros.builder.js):
  - Ensure editor render/persist does not collapse blank/comment lines.
  - Keep status/error behavior, but line numbers must refer to original textarea line numbers.

## 4) Variable expansion for macro command lines

### Goals

- Expand `${name}` placeholders in each macro line before command parsing/execution.
- Support escape syntax so `\${name}` remains literal `${name}`.
- Allow call-time args to participate, including overriding existing approved values for this sprint.

### Expansion source precedence

Recommended for this sprint:

1. call-time args object (from `/fmc`)
2. existing value resolver (`getValue(...)` / approved values / plugin values)

This matches the design note about args shielding other expansions.

### Technical changes

- In [MacroExecutor.js](../../../../MacroExecutor.js):
  - Add expansion utility, for example `expandMacroLine(line, scope, resolveName)`.
  - Apply expansion before `parseMacroLine(...)`.
  - Expansion should work on full line text, including JSON segments.

- In [key-handlers.js](../../../../key-handlers.js):
  - Pass resolver into macro executor options:
    - call args scope (if present)
    - fallback resolver backed by `getValue(...)`

### Behavior examples to satisfy

- `/skw${key}` resolves with call arg `key`.
- `/sc "${currentSectionCardinal} \${sectionCount}"` resolves first token and preserves second literal.

## 5) `/fml` macro log command

### Goals

- Add macro log command usable in macro lines.
- Emits to User Log only when macro verbose mode is true.

### Menu and action changes

- In [menu.js](../../../../menu.js), under `/fm`:
  - Add `l) log` with action `macroLog` and one input value.
- In [key-handlers.js](../../../../key-handlers.js):
  - Add action case `macroLog`.
  - If macro verbose enabled, write log line with `addToUserLog('Macro', message)`.
  - If verbose off, return success/no-op result.

### Interaction with existing `/fml` path conflict

- Existing `/fml` currently means list-all. This sprint requires reassignment to log.
- Move list-all to a different trigger under `/fm` (question below), or intentionally remove it for this iteration.

## 6) Error handling and diagnostics

### Goals

- Keep current fail-fast execution model.
- Make nested errors and expansion errors actionable.

### Changes

- Include context in errors where practical:
  - macro id
  - line number
  - expanded line text (when parse fails post-expansion)
- Depth-exceeded errors should indicate current/max depth and target macro.

## 7) Tests

## Unit tests to update

- [macro-executor.test.js](../../../../_tests/jest/macro-executor.test.js)
  - Preserve blank/comment lines in normalization path.
  - Validation skips comments/blanks but validates command lines.
  - Expansion success and escape behavior.
  - Execute skips blank/comment lines.

## New tests recommended

- Add focused tests for nested macro call/depth behavior in a new test file:
  - [macro-nested-call.test.js](../../../../_tests/jest/macro-nested-call.test.js) (recommended)
  - or extend [macro-executor.test.js](../../../../_tests/jest/macro-executor.test.js) if preferred.

- Add key-handler action tests (if practical in current mocks) for:
  - `macroCall` input validation
  - `/fml` verbose-only logging behavior
  - depth limit boundary (4 allowed, 5th blocked)

## Regression checks

- Existing macro add/edit/run/move/list/delete flows still work with preserved-line storage.
- Song load/save round-trip keeps macro line text fidelity.

## Suggested coding sequence

1. Refactor line model in [MacroExecutor.js](../../../../MacroExecutor.js) (classification + preserve lines + validate/execute skip logic).
2. Align macro persistence normalization in [SongPersistence.js](../../../../SongPersistence.js).
3. Implement expansion utility and wire scope/resolver from [key-handlers.js](../../../../key-handlers.js).
4. Implement depth-limit changes and nested invocation plumbing in [key-handlers.js](../../../../key-handlers.js).
5. Add `/fmc` and `/fml` menu nodes in [menu.js](../../../../menu.js).
6. Add `macroCall` and `macroLog` action handlers in [key-handlers.js](../../../../key-handlers.js).
7. Update macro editor text handling in [templates/macros/macros.builder.js](../../../../templates/macros/macros.builder.js).
8. Add/update Jest coverage.

## Acceptance criteria

1. A macro can call another macro via `/fmc ...` up to depth 4.
2. A 5th-level nested call fails with a clear depth-limit message and does not crash execution state.
3. Macro lines support `${name}` expansion from call args plus existing resolver values.
4. Escaped placeholders `\${name}` remain literal.
5. Blank lines and `#` comment lines remain stored in the song and are skipped at execution time.
6. `/fml` writes to User Log only when macro verbose mode is enabled.
7. Updated/new Jest tests pass.

## Questions to resolve before coding

1. Trigger conflict: `/fml` is currently list-all. Should list-all move to a new trigger (for example `/fms`) or be removed this sprint?
2. `/fml` payload type: should it require a JSON string (example `/fml "message"`) or accept any JSON value and stringify objects?
3. Depth boundary wording: should depth 4 mean maximum active stack is 4 (recommended), or maximum of 4 nested calls beneath the root?
4. Unknown expansion names: should unresolved `${name}` stay literal, resolve to empty string, or fail the line?
5. Verbose tracing for skipped lines: when verbose is on, should blank/comment lines be logged as skipped entries?
6. Expansion scope for non-string arg values: if args contain numbers/booleans/objects, should expansion insert JSON stringification or JS-style string coercion?
7. Validation strictness for `/fmc` object: should extra top-level keys beyond `macro` and `args` be allowed or rejected?

## Out of scope (per design)

- Parameter declaration/list command for macros.
- Restricting passed named parameters to declared parameters.
- Additional legacy-format compatibility work.
