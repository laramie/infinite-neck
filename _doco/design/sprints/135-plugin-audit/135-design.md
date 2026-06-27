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

# Iteration 2: refine audit report

The report looks very good.

The "Audit plugins" menu-item has trigger `A` but does not literally have an `A) ` in the caption.

Table "Plugin Audit: Section-Level pluginData" is perfect.

We now want the first table, "Plugin Audit: Song-Level Persisted Properties" to be restructured.

The left column for each row (exclding header row) should be the plugin short name.
The header row then becomes just the plugin property names.  We continue providing the curated list of property names to include in a code constant.  

Not all columns will apply to all plugins.  Where a plugin does not have the property, the cell should be `background-color: #555;`.  Where it has a property, but the property is not set, the background should be unset (normal). Where it has a property, and it is set in a plugin, it would just have the value in normal font, normal background.

All plugins are listed in the table, even if none of their properties line up.  The plugin order in the table is identical to the run-time value of `/fap` "plugin firing order".



