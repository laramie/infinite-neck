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