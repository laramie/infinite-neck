# Iteration 1

## Goals this Iteration

- identify which plugin properties are stored per-session  
- provide an audit grid of per-session plugin data
  - juxtaposing related properties, specifically fillPositionsStatus vs arpeggioPositionsStatus as widgets

## Design

The code will mostly live in new module `PluginAudit.js`.

The audit will be launched from the plugins menu `/fp`, with menu item appearing after all plugins, trigger and caption: `A) Audit plugins`

The action will be to do a showMessages, in the style of `/vdd`, including the table header column being in rotated text, and using the same background-color.

There will be two tables output per audit.  
- first will be a report of curated properties that are in plugin data at the Song level.
- second will be a juxtaposition of curated properties that are in plugin data *in Sections*. For this, the rows will be section numbers in the same way as `/vdd`.

For the per-song audit table, across the top will be agregating columns for plugins, so that ArpeggioPlugin will cover several columns using its short name `arpeggio`, Instrument, minFret, maxFret, minRow, maxRow.  Then FillPlugin (as short name `fill`) will also cover Instrument, minFret, maxFret, minRow, maxRow columns. TransposePlugin (as `transpose`) will cover chroma (alias for intervals).

For the per-section audit table, we think there are only two properties that are used now, but we need to find out if there are others. ArpeggioPlugin will cover arpeggioPositionsStatus as a widget showing the values for the Section, but without its current pair highlighted. FillPlugin will cover  fillPositionsStatus for the Section, but without its current pair highlighted.

Please produce an implementation plan for Iteration 1 in 
`135-it1-implementation-plan.md`.