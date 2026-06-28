# Sprint 135 Plugin Audit

## Iteration 1 Implementation Plan

## Scope

Deliver a first working Plugin Audit report surfaced from the plugins menu [menu.js](menu.js), rendered via existing show-messages flow in [key-handlers.js](key-handlers.js), with implementation concentrated in a new module [plugins/PluginAudit.js](plugins/PluginAudit.js).

This iteration includes:
1. A menu entry under `/fp` after all plugin entries: `A) Audit plugins`.
2. A showMessages HTML report with two tables.
3. Curated song-level plugin property audit columns.
4. Curated section-level plugin data audit rows (one row per section, `/vdd` style).
5. A lightweight discovery signal for unexpected per-section plugin keys.

This iteration does not include:
1. New persisted schema fields.
2. Editing plugin state from the audit table.
3. Any migration/legacy compatibility layer.

## Output Definition

The audit output is one HTML message payload with:
1. Heading block and short legend.
2. Table 1: per-song plugin persisted properties.
3. Table 2: per-section plugin data, including side-by-side widgets for fill/arpeggio position status.

Visual requirements (matching `/vdd` style from [display-options.js](display-options.js) and [infinite-neck.css](infinite-neck.css)):
1. Rotated column headers using the existing `vertical-header` class.
2. Same style direction for table borders/background usage as display-options table.
3. Section row numbering starting at 1.

## Data Contract For Iteration 1

### Table 1: Song-Level Curated Columns

Grouped headers and columns:
1. arpeggio
2. arpeggio Instrument
3. arpeggio minFret
4. arpeggio maxFret
5. arpeggio minRow
6. arpeggio maxRow
7. fill
8. fill Instrument
9. fill minFret
10. fill maxFret
11. fill minRow
12. fill maxRow
13. transpose
14. transpose chroma (mapped from transpose property `intervals`)

Data source:
1. `song.plugins[pluginId].properties` from plugin persistence managed in [plugins/PluginManager.js](plugins/PluginManager.js).

### Table 2: Section-Level Curated Columns

Row model:
1. One row per section in song order.

Curated columns:
1. Section #
2. arpeggio positions widget (from `arpeggioPositionsStatus` semantics)
3. fill positions widget (from `fillPositionsStatus` semantics)
4. extra keys (discovery column, empty when none)

Data source:
1. `section.pluginData` for each section.

Discovery logic:
1. Curated known keys for this iteration:
2. arpeggio: `positions`, `lastPositionIndex`
3. fill: `positions`, `lastPositionIndex`
4. Any additional keys discovered under section plugin data are listed in `extra keys` and summarized in footer notes.

## Implementation Steps

### 1) Add Plugin Audit Module

Create [plugins/PluginAudit.js](plugins/PluginAudit.js) to encapsulate report building.

Core exports:
1. `buildPluginAuditHtml({ song, pluginManager })`
2. Internal helpers:
3. song-level extraction/normalization
4. section-level extraction/normalization
5. HTML table rendering
6. safe text escaping

Normalization rules:
1. Missing value renders as `&nbsp;` (table-friendly).
2. Instrument values strip `tbl` prefix for readability when applicable.
3. Transpose `intervals` renders as a compact JSON array string.
4. Widget cells can embed HTML from plugin status builders.

### 2) Reuse Existing Widget Builders Without Highlight

For section table juxtaposition cells, reuse existing plugin widget generation points:
1. arpeggio widget path in [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)
2. fill widget path in [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)

Add a non-breaking optional option to each widget builder to suppress current-pair highlight in audit context.

Proposed shape:
1. `buildPositionsStatusWidget(state, options = {})`
2. `options.highlightCurrent` default `true`

Audit call path uses `highlightCurrent: false`.

### 3) Add Plugins Menu Item After Runtime Plugin Entries

Integrate in [plugins/PluginManager.js](plugins/PluginManager.js):
1. Extend runtime children generation to append one action node after plugin nodes:
2. caption `A) Audit plugins`
3. trigger `A`
4. action route dedicated to plugin audit (for example `pluginAction:audit`)

Notes:
1. Keep trigger uppercase `A` as designed.
2. Do not use `x` trigger (reserved).

### 4) Wire Audit Action To Existing Message Display Flow

Use existing plugin-action handling path in [key-handlers.js](key-handlers.js) so report displays through `showMessages(...)`.

Plan:
1. Handle audit action in [plugins/PluginManager.js](plugins/PluginManager.js) `invokeMenuAction(...)` before pluginId-specific dispatch.
2. Return normalized plugin-result object with HTML in `message`.
3. Keep default menu-stack behavior unless user feedback indicates preserving stack is preferable.

### 5) Build Two Tables In One Report

In [plugins/PluginAudit.js](plugins/PluginAudit.js):
1. Render table 1 with grouped headers and rotated sub-headers.
2. Render table 2 with section rows and the two status widgets side by side.
3. Add a compact footer summary:
4. total sections scanned
5. plugins found in section.pluginData
6. unknown keys count/list

### 6) Tests

Add focused Jest coverage in [_tests/jest](_tests/jest) with a new file, for example [_tests/jest/plugin-audit.test.js](_tests/jest/plugin-audit.test.js).

Test cases:
1. menu runtime children include `A) Audit plugins` after plugin entries.
2. audit action returns message HTML and does not throw when song has no plugin data.
3. song-level table includes expected grouped columns and transpose chroma mapping.
4. section-level table has one row per section.
5. fill/arpeggio widgets are rendered in section table without highlighted current pair.
6. unknown section plugin keys are surfaced in discovery output.

Recommended validation command:
1. `cd ~/infinite-neck`
2. `export INFINITE_NECK_VERBOSE=-1`
3. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

## File Change Plan

Planned new file:
1. [plugins/PluginAudit.js](plugins/PluginAudit.js)

Planned edits:
1. [plugins/PluginManager.js](plugins/PluginManager.js)
2. [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)
3. [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)
4. [_tests/jest/plugin-audit.test.js](_tests/jest/plugin-audit.test.js)

Possible optional style touch (only if needed for readability):
1. [infinite-neck.css](infinite-neck.css)

## Acceptance Criteria

1. From `/fp`, selecting `A) Audit plugins` shows a Messages report with two tables.
2. Table 1 shows curated song-level columns for arpeggio, fill, transpose chroma.
3. Table 2 shows all sections with side-by-side arpeggio/fill position widgets.
4. Section widget cells show values but no current-pair highlight.
5. Rotated header style and overall visual language match existing `/vdd` pattern.
6. Unknown section plugin keys are visible in report output.
7. Jest tests for new audit behavior pass.

## Risks And Mitigations

1. Risk: coupling UI display logic into plugin manager.
2. Mitigation: keep HTML generation isolated in [plugins/PluginAudit.js](plugins/PluginAudit.js) and return message text through existing action result contract.

1. Risk: widget builder changes alter existing plugin menu/status behavior.
2. Mitigation: optional parameter defaults preserve current behavior (`highlightCurrent: true`).

1. Risk: unknown pluginData shapes cause runtime exceptions.
2. Mitigation: defensive guards and escaping in audit builder, plus explicit tests for sparse/missing data.

## Definition Of Done

1. Code complete for files listed in File Change Plan.
2. New tests added and passing in Jest run.
3. Manual verification in UI: `/fp` -> `A) Audit plugins` produces expected two-table report on a representative song with section plugin data.
