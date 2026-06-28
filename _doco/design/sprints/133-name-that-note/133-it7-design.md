# Design

We want to allow the User more fine-grained graveyard cleanup

## Status

Currently 
  - `/fg` shows graveyard
  - `/faC` clears entire graveyard, with confirmation menu-item.
  - `/fg` displays the graveyard table, with links to show/hide records, and no way to remove records.

## New /fac sub-menu

We want 
  - new `/fac` `c) clear graveyard by type`
  - performs a backup before action happens (after sub-menu choice), just like `/faC` creates backup.
  - does not need confirmation
  - presents sub-menu of choice of type of graveyard records to remove.
    - A subset of graveyard.jsGraveType should be presented as `org.dynamide.toggle`. The subset is shown in the menu example below.
      - e.g.
```
/fa
    ....
    c) clear graveyard by type
    C) Clear graveyard, with backup
    ....
/fac  
        c) CLIP [false]
        i) INSTRUMENT [false]
        p) PLUGIN [false]
        s) SECTION [false]
        t) TUNING [false]
        y) STYLESHEET [false]
        C) Clear selected types, with backup
```       
    - One action (C) executes cleanup of all checked/toggled-true GraveTypes, with backup:
      - `/facC`  `C) Clear selected types, with backup` 


## New delete one record link

When the User is looking at the table in `/fg` we want a new delete link to appear in each record, but only when show/hide is in the "show" state.  In this state, show a link in the `ACTION` column.  It should delete the record without backup or confirmation, and refresh the view of the graveyard.  The text of the link would be like the "raise" ACTION link, but be "delete" instead.  So in the record where one might see `raise_9` one would see in the next row, the row where the show/hide shows the record, a link `delete_9`.

## Answers to implementation plan questions


1. For `/facC` with no toggles selected, should backup still occur, or should we skip backup and return `no types selected`?
ANSWER: Good catch.  No: skip and return suggested message.

2. Should selective clear include a compact action result string listing selected types, for example `cleared: SECTION,PLUGIN (12)`?
ANSWER: Yes.

3. For delete link label, do you want exact format `delete_9` (underscore) or `delete 9` (space) to match current `raise 9` style?
ANSWER: yes, that format with underscore. In our browser we can see the current style is `raise_9`.

4. Should delete link appear for CLIP records as well, or do you want CLIP protected because top-row action is `use ClipPlugin`?
ANSWER: Yes, include CLIP records.

5. Should `/fac` toggle state reset to all false every time the submenu opens, or persist until command-line session/menu reset?
ANSWER: Yes, reset is good.

Additionally, we think the delete link should appear in column `ACTION` so would be the last column in the table, (td currently missing).  It should be hidden when the JSON is hidden.  This sounds slightly different to us than the "adjacent" language in the plan: "2. In the second row (show/hide JSON row), include `delete_{id}` link adjacent to the toggle link."  We would *not* want "adjacent" to mean put it right next to the show/hide link in the first column.
`.

```
<tr><td><a href="#" class="graveyard-toggle-json" data-target="#grave1782227644618">show/hide</a></td><td colspan="6"><div id="grave1782227644618" style="">{
    "enabled": true,
    "enableOnSongLoad": true,
    "graveyardKey": "USER",
    "properties": {
        "targetTable": "tblP46_1",
        "minFret": 0,
        "maxFret": 12,
        "songLoopsPerPositionPair": 1,
        "minRow": 0,
        "maxRow": 5,
        "lowToHigh": true,
        "upOnly": false,
        "style": "every",
        "type": "AutoChartMode",
        "showNoteName": "played",
        "colorNotes": true,
        "flashcard": false
    }
}</div></td></tr>
```
