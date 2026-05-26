# Design for sprint-111-cleanup-plugins-menus

# Scope

The following items are in scope:

## plugin menus 

- cleanup the plugin menus, moving string, and position options to be consistent across plugins.

- in all examples `exit` menu is not shown and will be as it is today.

### ArpeggioPlugin Menu Structure

ArpeggioPlugin today:

```
Enable [false]
Load enabled [false]
Bury
Target table [P46_1]
positions
Apply
Clear
help
minFret position [0]
maxFret position [12]
upper string limit [1]
lower string limit [6]
low to high [true]
up only [false]
style [every]
show note name [off]
color notes [false]
flashcard [false]

exit
```

Change "Target table" to "Table", same trigger.

Move "help" to end.

Change trigger for `style` to `y` so `s` can be the trigger for `strings`

Move minFret and maxFret positions and strings into sub-menus `p) positions` and `s) strings`.

ArpeggioPlugin after sprint-111 with ${} representing pseudo-code:

```
Enable [false]
Load enabled [false]
Bury
Table [P46_1]
Apply
Clear
positions [${minFret:maxFret} or ${values}]
strings [${upper:lower}]
low to high [true]
up only [false]
style [every]
show note name [off]
color notes [false]
flashcard [false]
help
```
strings sub-menu:
```
upper string limit [1]
lower string limit [6]
```
positions sub-menu:
```
minFret default position [0]
maxFret default position [12]
cLear all sections
clear This section
Copy to all sections
copy to Unset sections
Refresh values
values this section []
```

### FillPlugin Menu Structure

Change `Target table` to `Table` with same trigger, action and value display.

options sub-menu modified in the same way as ArpeggioPlugin for positions and strings:

today:
```
chord formula [Maj]
g scale formula [Ionian/Major]
minFret position [0]
maxFret position [4]
upper string limit [1]
lower string limit [6]
NamedNote
SingleNote
TinyNote
Apply
```

becomes:

options with positions and strings ranges computed and shown in this example as their [value]:
```
chord formula [Maj]
g scale formula [Ionian/Major]
positions [0:4]
strings [1:6]
NamedNote
SingleNote
TinyNote
Apply
```

positions:
```
minFret position [0]
maxFret position [4]
```

strings:
```
upper string limit [1]
lower string limit [6]
```

### MovePlugin menus

Change `Target table` to `Table` with same trigger, action and value display.

### ClipPlugin menus

Change `Target table` to `Table` with same trigger, action and value display.

## keymapping

- add keymappings for global keystrokes in the app to tie into the plugin command-line menus.
- SHIFT-p, `P` should be moved from Palette to showing the command-line menu and parking the user there: /fp . lower case `p` continues to be palette shortcut.
- SHIFT-c, `C` should park the user on the ClipPlugin command-line menu. lower case `c` continues to be auto-color.
- SHIFT-s, `S` should run /sax , or just the action associated, so the User flow is not disturbed by the command-line, but a new Section is added and navigated to in the exact same way /sax would do.
- While in the command-line txtCmdLine, SHIFT-ArrowDown and SHIFT-ArrowUp should do the same thing as /vms , that is, show short menus, but not change the User's flow in the command-line.  ArrowUp and ArrowDown already toggle to /vmt and /vmo respectively.


## menu dump

- fix the /vdm menu dump so it is compatible with the help.html file view:
  - doesn't use hyphens to show indentation. Use `&nbsp;` instead, and ensure output is in a PRE element or equivalent white-space handler.
  - doesn't put a `>` at the end of the line

## help.html updates

Add keymaps and menus modified in this sprint to help.html in the relevant sections and tables.

## TODO later

### menu audit

These items are deferred to a later Iteration in the sprint.

- ensure that the developer tools for auditing menus can show current needs for helpfile generation, key-handler maintenance, and menu auditing as designed.  This is deferred to a later Iteration in this sprint until it can be defined.  No action yet or need to include it in the implementation plan.

### TODO in a later sprint

These actions should be moved to a later sprint.

- Ensure that function symbol parser is not an eval()
  
- Add a chooser under CLEAR so that you can
  - All: delete all note types from one cell
  - last: delete the selected note type before clicking CLEAR (perhaps the system can autoselect the correct ones below)
  - Single: delete SingleNotes
  - Named: delete NamedNotes
  - Tiny: delete TinyNotes and Bends
- For Highlights, help.html should mention that you just click a MIDI highlight twice and it clears highlights.  This should work in beat recording too. 

# Iteration 2: implementation questions from Iteration 1 answered

## Questions for the Design team before coding - ANSWERED

NOTE: We omitted pointing to our previous sprints.  This is not necessary, as your implementation plan seems complete.  However, if you want to review issues that came up while coding the dynamic plugin menus before, each of the plugins has had to deal with this, and that is documented in the sprints, which can be found here: [sprint planning index](../../../lifecycle/sprints.md)

1. For ArpeggioPlugin, what is the exact top-level `positions` caption rule?

Should it show the default min/max range, the current section `values` array, or a hybrid rule depending on whether section values are set? The design says `[${minFret:maxFret} or ${values}]`, but coding needs a single deterministic display rule.

  a) ANSWER: When the values are set, they win.  When the are unset, the defaults are shown.
    - no `values`: show ${minFret:maxFret} from the two default options
    - `values` available: show ${values}, ignoring the two default options, since this is what the algorithm does


2. For ArpeggioPlugin, what should the `positions` summary display when section-specific values are unset or empty?

  a) ANSWER: a JSON.stringify of the values for this Section, else empty, so that the menu looks like `positions []`.

3. For FillPlugin, should `positions` and `strings` remain inside the existing `options` submenu, or should they be promoted to the plugin root to match Arpeggio more closely?

  a) ANSWER: `positions` and `strings` remain inside the existing `options` submenu

4. For uppercase `S`, should the implementation call the exact same underlying action used by `/sax`, or is any behavior-equivalent direct section-add action acceptable?

  a) ANSWER: preference is to call key-handlers.js::runActionByName('sectionAdd', args) with appropriately empty args,  which itself calls `getSong().newSection();`

5. For uppercase `S`, should any command-line status/result text still be shown, or should the action be completely silent unless something fails?

  a) ANSWER: silent.  Error should showMessage().

6. For command-line `Shift+ArrowDown` and `Shift+ArrowUp`, should both keys always force short-menu mode, or should one of them restore a previous menu layout?

  a) ANSWER: both shifted keys do the same thing, because the other two states are availble without the SHIFT.

7. Should the new uppercase shortcuts continue to obey the current global rule that keyboard shortcuts do not run while the user is typing in normal text inputs, except for the specific `txtCmdLine` arrow-key behavior called out in the design?

  a) ANSWER: Yes.

8. For the `/vdm` help example, does the Design team want the help file to contain a manually curated snapshot, or should the example be treated as a generated copy of the live dump format and updated mechanically whenever menu text changes?

  a) ANSWER: For now, update the helpfile once.  As part of that deferred menu tools Iteration, we'll be putting in an automated flow.

  
  
  