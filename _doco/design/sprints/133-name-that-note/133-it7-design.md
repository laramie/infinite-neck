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