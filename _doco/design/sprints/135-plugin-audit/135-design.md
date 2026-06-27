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

# Iteration 3: summarize inputs/outputs

Next, we want a two-column summary to be added to "Plugin Audit: Song-Level Persisted Properties".
One column will be "inputs", the second new column will be "outputs".
These will be questions asked of each plugin, which may respond with undefined or somesuch if not applicable.  Each plugin will format its "inputs" and "outputs" answer, such that it is compact, fits in one column, and may span several text lines within one report cell using `<br>`.  The PluginManager or report writer should not dig around in these plugins for the answers for "inputs" and "outputs" but rather ask each plugin the same two questions.

## Representative outputs for the existing plugins: 

### ArpeggioPlugin:  

----

Example 1:
inputs:
```
named
```
outputs:
```
played
color:true
```
----

Example 2:
inputs:
```
chord+mode
```
outputs:
```
played
color:true
flashcard:true
```
----

Values are elided when false.


### FillPlugin: 

----

Example 1: 
inputs:
```
auto-chart:true
```

state of menu: 
```
named [r:noteRoot,c:noteChord,s:none]
single [r:none,c:none,s:none]
tiny [r:none,c:none,s:noteScale]
```
outputs:
```
named:r,c
tiny:s
```


In other words, for Fill, show `[named, single, tiny]` if they have non-"none" values, and abreviate to just the non-"none" `[r,c,s]` categories.  They should appear on separate text lines as shown, within the report cell.

"auto-chart" is a condensed caption alias for "automatic from chart".

----

Example 2: 
(here "automatic from chart" is false, so FillPlugin uses `chord` and `mode` if set.)
inputs: 
```
chord:M
mode:lydian
```
outputs:
```
named:r,c
tiny:s
```

### TransposePlugin

inputs:
```
include:n,s,t,b,f,r
```

outputs: non pertinent, make background-color: #555;

### ClipPlugin

inputs: 
Show just the categories, not the counts:
`include [n:0,s:0,t:0,b:0,f:0]`
would map to: 
`include:n,s,t,b,f`
or if only n and s were 'true' then
`include:n,s`

### MovePlugin
inputs: 
if include were:
`
include [s,h,r]`
then inputs would be:
`include:s,h,r`

### TonalPlugin
TonalPlugin does not respond to these questions.


## Fix arpeggio `type` value display

To help normalize this, ArpeggioPlugin needs to have its menu display of selected value fixed.
The `type` submenu has these sub-menu-items:
```
named
single
auto chord
auto mode
b auto chord+mode
```
But when we pop back, we get displays like this:
```
type [AutoChartChordMode]
```
We should get values like this, not all at once, but shown for each of the above menu items in order: 
```
type [named]
type [single]
type [chord]
type [mode]
type [chord+mode]
```


