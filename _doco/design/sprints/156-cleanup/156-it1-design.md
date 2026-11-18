# Iteration 1 

- Goal: increase number of items listable in numbered command-line menus using alphanumeric keys, like sprint-151.


## Discussion

    - sprint-151 used "Key cap of 35 (`1-9`, `a-z`)" for menu items where there were more than 9.  We'd like to implement this naming/numbering scheme for other menu items that blow past 9.  We have found that this works well, in that 1-9 are created first, and then the lower-case letters.  They don't interfere with other menus because the list is a sub-menu that is just a pick-list.
    
    - We'd like to tweak the display of the list and see if we can allow various columnar (flex?) layouts, so that if there is room on the screen (unlikely to work well on Mobile, which is OK) then a second column is begun. For example, 1..9 on column 1, a-i on column 2, j-r on column 3.  Not sure whether it might be better to let flex calculate the available space and fit columns and rows best.  This might require a separate input for desired max rows in the menu, which we would stash in menu prefs: `/vml` `l) lines`.  For example `/vml` -> "LINES:" --INPUT--> 9 `ENTER` would yeild the above scheme of 1-9 in the first column.

    - One option is to also include `/vmc` `c)olumns` which is a boolean/toggle so that if false (defaults to true) then no columns are produced.
    
    - The candidate menus that would get this new increased number of items in the pick list would include:
      - `/fmen`
      - `/fmdn`
      - `/fmm`
      - `/fmrn`
      - `/fpaI`
      - '/fpcI`

    - Some lists may include menu option `i` to list by id, so this may have to be left at this level, and excluded from the optional letters, and placed last in the list, perhaps with a blank link over it.  `/fpagr` appears to be one of these.  
    
    ```
    1 USER               a foo7
    2 no-transposition   b foo8
    3 chromatic          c foo9
    4 foo                
    5 foo2               i<b>d</b>
    6 foo3
    7 foo4
    8 foo5
    9 foo6
    ```   

    - In this example, the numbered and lettered (a,b,c) menu items are also formatted as bold, but we just showed the `id` menu item with its bold.  It launches the INPUT.

    - It is not clear whether we would attempt to format the columns using whitespace as in this above example (not preferred), or whether we would place the items in elements and let flex lay them out (preferable at this point) and deal with elements that are not pure text within `TR#CmdMenuResults > TD`.  

    - Since many menus do offer `id` as the last menu item, this is to be preserved one way or another.  So even if a blank line is not used, `id` should remain the last menu item. (It is possible that it makes sense as the first, this should be considered.)

    - Hopefully, menus that offer option to pick by id have a separate menu item already.  This is to be investigated and reported.  As a deliverable to Iteration 1 Round 1, we'd like to see a table of which menu items produced these long lists, and which ones include `id` as a special menu item.

    - Specifically, this is for generated pick lists.  It should *not* touch curated lists such as `/fpfoc`.

## Request

Please produce a report `156-it1-report.md` with findings about the current state of the menus, which menus fall into the candidate list, recommendations for preserving access by macros and songs yet allowing these new menus, and presentation of options for laying out menu pick list columns.

    



