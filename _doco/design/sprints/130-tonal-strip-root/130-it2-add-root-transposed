# Design

Now that we have the root stripped from the Chart as a view-only option via `stripTonalRoots`, we need to add back in the root as it has been transposed.  

To help the User spot the difference, we want to wrap the new transposed root in a `<b>` tag, which we want styled to be bold+brown when it is in a Chart or LeadSheet or LeadSheetLine or lblSectionChartChord or lblSectionMode, using CSS rules in section-printer.css.

The new transposed root Key should be grabbed from the Section.rootID such that `<b>C</b>` is the root glued on for Section.rootID = 3 after TransposePlugin has transposed this Section to rootID == 3.

The new checkbox will live under `Strip Tonal roots (view only)` and have a caption `Add transposed root to chord`.

The checkbox should be bound to stripTonalRoots somehow so that checking stripTonalRoots enables adding the transformed root back in.  We don't want to be able to add a transposed root if it has not been stripped.

Please proceed to coding this feature.

# Copilot Response

I’ve got the design requirements and will now patch the chart view pipeline so `stripTonalRoots` can optionally prepend a bold transposed root (from `Section.rootID`) across Chart, LeadSheet/Line, and the lead-sheet labels, with the new dependent checkbox in Chart Options.
I patched the schema to accept both strip and add-root chart flags. I’ll rerun the failing loader test and then rerun the full Jest suite.

**What I changed**
- Added dependent chart option behavior and rendering support in section-printer.js:
  - New effective option: `addTransposedRootToChord` (only active when `stripTonalRoots` is true).
  - `getChartDisplayValue(...)` now supports section context and prepends `<b class='chartTransposedRoot'>Root</b>` for chord/mode when enabled.
  - Added dependent checkbox under strip option in Chart Options UI, disabled unless strip is enabled.
  - Wired section context through Chart and LeadSheetLine render paths.
- Added default persistence key in SongPersistence.js:
  - `chartOptions.addTransposedRootToChord: false`.
- Added dependency enforcement and label context wiring in infinite-neck.js:
  - Prevent enabling add-root while strip is off.
  - Auto-clear add-root when strip is turned off.
  - Lead-sheet header labels now pass section context into display formatting.
- Added brown+bold styling for the prepended transposed root in section-printer.css.
- Extended chart option/tests in chart-layout.test.js:
  - Default and options expectations for the new key.
  - Dependent disabled-checkbox behavior test.
  - Rendering assertions for chart + lead-sheet line with transposed root prepended.
- Fixed schema validation for persisted chart options in song-file-schema.js:
  - Added `stripTonalRoots` and `addTransposedRootToChord` to `chartOptionsSchema`.
