# sprint-137-macros

# Iteration 1: Design

## Goals

We need a macro processing facility.  
- on song load, a URL query param should be able to specify a macro stored in the song to be run
- at any point after the song is loaded, a User should be able to select a macro from a menu list of macros stored in the song, and run it.
- A User should be able to create a new macro, and store it in the song with an identifier name.
- A User should be able to edit a named macro.

## Use of current menu plumbing

We feel that the current menu system is the right mechanism for processing.  However, there may be vagaries of how the command-line is actually handled that mean a separate driver is needed.  Most importantly, is that the current menu system is a mix of static menu items found in menu.js, and dynamic menus that are installed, and dynamic menus that are installed by plugins.  We need to attach to the live, built-up menus at all times.

## Macro format

The format of the macro is simple: a collection of lines to be run in file order, one command per line.
Each line starts with a command-line path.
If the command-line path ends on a menu-item that takes a User input field, then the macro path can pass valid JSON and the line processor should find that action, and pass it the JSON as User input.
Thus, the syntax for the file is multiple lines of: 
`path`
or 
`path json`

Each line is stand-alone. If it fails, the macro stops execution, with a message to UserLog.

The json would be everything on the line after the first space, and should be a valid JSON property value.

Thus a value like this:
`/fpapv [[7, 12]]` 
would parse as
`{"path": "/fpapv", "value":[[7,12]]}`
because only the very first space is considered the end of the path, and the rest is considered the JSON.

Persisted in the song file, the macro should be stored as an array of line strings, all within some object stored in a collection keyed by macro identifier.

In verbose mode, each `path` or `path json` execution logs its command result to UserLog.

So for example, a macro could consist of :
```
/fpapv [[7,12]]
/fpasl 4
/fpac true
/fpaye
```
This macro would 
- set ArpeggioPlugin positions value to `[[7,12]]`
- set ArpeggioPlugin > strings > lower to `4`
- set ArpeggioPlugin > color to `true`
- set ArpeggioPlugin > style to `every`
This requires a bit of introspection because /fpasl is an input, while /fpac is an org.dynamide.toggle, and /fpaye is an org.dynamide.Select.  Since an org.dynamide.toggle toggles and doesn't accept a boolean but rather just an action to toggle, that will need to be added as a mechanism.

Storage in the song file could be something like this: 

```
"macros":{
  "macro1":{
    "lines":[
        "/fpapv [[7,12]]",
        "/fpasl 4",
        "/fpac true",
        "/fpaye"
    ]
  },
  "macro2":{
    "lines":[
        "/sa",
        "/skwa",
        "/sf"
    ]
  }
}
```

## Menu 

To access the macro features, we will primarily use the command-line menu.  There will be a textarea for editing macros, and a save button, and these two will be in a new page-level menu div like File > Info.  It closes with ESC key.  It saves on losing focus from textarea.  Whitespace is trimmed from the beginning and ending of every line.  Blank lines removed, no comment syntax. 

Here is the new menu structure that will be needed:
```
/f
  m) macro
    a) add
      INPUT: id --> on valid id, create macro, open macro-editing page
    d) delete
      n) number
      i) id
    e) edit
      n) number
         1) <show first macro in file> --> on select, open macro-editing page
         2) <show second macro in file> --> on select, open macro-editing page
         ....
      i) id
         INPUT: id --> on select, open macro-editing page
    r) run
      n) number --> show submenu of 1) first macro, 2) second macro, etc. On User entering 1, execute macro 1, etc. 
      i) id
        INPUT: id --> execute macro.
    v) verbose mode <org.dynamide.toggle, default false, if true, all executed lines have command result sent to UserLog>    
```

## Added menu needed to support driving use case

One of the first macros we need to use and test is to show/hide all/one Instruments/Tunings.
Menu would be: 
```
/t
  s) show
    a) all --> show/make-visible all tunings
    l) list
      1) <first tuning>
      2) <second tuning>
    i) id
        INPUT: id --> on valid ID, show that tuning
  h) hide
    a) all
    l) list
    i) id        
```

# Iteration 1 implementation

The implementation plan looks solid, and has minimal impact on current system, so we are ready to move forward on a first implementation.  We have answered design questions below.

A few general points.

We like all the proposals, and have commented below on the options.

We like the proposed templates structure for the "Macro editor UI".

We like this option: `macro=macro1` matches the design language and is concise.


In describing our menu system, we have stuck to some short-hand document conventions, and we'd like to stick to these.

1) When we say `/fpa` we mean the User actually types this in the command-line prompt input box.  So we refer to all menu-item nodes by this path.  So we prefer not to use a directory-like syntax such as `/f/p/a` so as not to confuse programmers and Users, since the `/` character is a reserved character in the command-line that always jumps to the root menu-item.  Please adjust the implementation plan to use the syntax `/fpa` always, and refrain from using the `/f/p/a` syntax.

2) When we say `f) file` we mean `f` is the trigger, and the menu item is rendered as `<b>f</b>ile` in the menu system.  When we say `1) first-item macro` we mean a literal `1` is the display `<b>1</b> first-item` and `1` is the generated trigger.

The menu item `/t` is currently a placeholder for "tunings", and therefore is the place to add menu items we are discussing.  It currently only allows `;` which shows the "Tunings in Song" tab page.  When we say `/ts` for `show` we mean `s) show` sub-menu will be added to menu `/t` as a child, and as a sibling to `;`.  We aren't providing access to "Tunings Library" in this Iteration.  So a listing for `/tsl` would just list MyTunings, i.e."Tunings in Song", and "ID" means a tuning ID found in the "ID" column such as "P46_1" or "S6_1", which is actually `baseID`.

Options in macro edit UI: we would like the Save button, and the status aread, since the proposed status area could warn about invalid JSON.  We do not want the Delete button, or a Run button.  These we would prefer to do through the command-line.

## Implementation plan questions answered


### 1. Should macro verbose mode persist in the song?

Recommendation: no for Iteration 1.  Keep it runtime-only.

ANSWER: Accept Recommendation.

### 2. Should invalid macro JSON be rejected on save?

Recommendation: yes.  It is much friendlier than accepting a macro that cannot run.

ANSWER: Accept Recommendation.

### 3. Should macro paths be validated on save?

Recommendation: no.  Dynamic/plugin menus can depend on song state, selected section, selected instrument, plugin enablement, or runtime conditions.  Validate paths at run time.

ANSWER: Accept Recommendation.

### 4. Should delete require confirmation?

Recommendation: yes, or postpone delete.  Do not silently delete persisted macro definitions.

ANSWER: Accept Recommendation.

### 5. How many number-list macros/tunings should `/n` and `/l` support?

Recommendation: support `1` through `9` for Iteration 1 and rely on ID input for larger collections.  Multi-character menu triggers are a separate command-line design issue.

ANSWER: Accept Recommendation.

### 6. Should macros be allowed to run macros?

Recommendation: not in Iteration 1.  Prevent or ignore macro-run actions while a macro is already running, or enforce a recursion depth limit of `1` with a clear UserLog message.

ANSWER: Accept Recommendation.  

### 7. Should macro execution roll back partial changes on failure?

Recommendation: no.  Existing command actions are imperative UI/application mutations with no transaction model.  Log the partial-failure state clearly.

ANSWER: Accept Recommendation.

### 8. Should macro execution use command-line UI state?

Recommendation: no.  Macro execution should traverse and invoke the menu tree directly.  The command-line UI may show status, but it should not be required for execution.

ANSWER: Accept Recommendation.

### 9. Should select parent nodes accept JSON values?

Recommendation: not in Iteration 1.  Use full child paths such as `/fpaye`.  Consider parent select-by-value later.

ANSWER: Accept Recommendation.

### 10. Should toggle value-setting be available interactively too?

Recommendation: not initially.  Add idempotent toggle-with-value behavior for macro execution only, unless there is explicit UX demand for interactive value setting.

ANSWER: No.  We won't add this as a feature.  Accept Recommendation: "Add idempotent toggle-with-value behavior for macro execution only."

# Iteration 2

For this Iteration, we are just tweaking two things:
1) Macros need to be re-ordered in the song file by the User, via a new Move sub-menu.
2) All plugins that set `I) Instrument` need to have a new sub-menu `i) id` for choosing Instrument by `baseID`.

## Macro re-order

New menu `/fmm`: 
```
/fm
  m) move
    1) first macro --> INPUT: the destination number
    2) second macro --> INPUT: the destination number
    3) third macro --> INPUT: the destination number
```
- INPUT get the 1-based destination number from User, bumps current item at that number, re-orders list. Pops back to /fmm which shows new, ordered list.
- must be 1-based.  If 0 entered, bump into location 1, 1-based. 
- If length+1, add at end, renumber list from 1.
- If greater than list length+1, add at end with correct sequential numbering for list, 1-based.


## set menu item Instrument by baseID

Since the order of Instrument is generated from the current display order, macros need a stable target for macro calls such as `/fpaI1` which should now instead call new menu item `/fpaIi` with INPUT "Bass4_1" in other words, a macro would have a line:
```
/fpaIi "Bass4_1"
```
This being what the User sees.  It would of course be escaped in the song file.

The menus should be retained in the command-line so Users can still choose by number.  We are just adding `i) id` at the end of the number list.

New menu, for ArpeggioPlugin, but all plugins that have an `I) Instrument` menu item will need this.

```
/fpaI
  1) Bass4_1
  2) Bass5_1
  3) Bass6_1
  4) Bass8_1
  i) id --> INPUT: the baseID
```
