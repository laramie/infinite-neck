# sprint-139-macro-call Design

## Remove recursion block

Current calling macro prevents calling a macro with the log message "Macro recursion blocked: " plus the macro name.

We want to extend this to allow macros to call macros, to a depth of four.

## Add command-line menu item

New call: `/fmc`
Executes new menu item with the captions shown, and the triggers in bold: 
"/ > <b>f</b>ile > <b>m</b>acro > <b>c</b>all"
`/fmc` takes one INPUT, a JSON object.

We want the macro call to be available in the macro menu, with a required JSON object passed in as its value, although the object may be empty: 

`/fmc {"macro":"macroA", "args": {"var1": "some value", "var2": "some other value", "foo": "3", "bar": "true"}}`

`/fmc {"macro":"macroB", "args":{}}`

`/fmc {"macro": "macroC", "args":{"key":"e", "chord":"M"}}`

`/fmc {"macro": "macroD", "args":{"colorKey":"we", "chord":"s", "caption":"E minor 7"}}`

Within the macro, defined normally using `/fma`, allowed expansions would be expanded.  This will happen for all macros now.  Even if not called by a macro, a macro should attempt to expand each line as it executes each of its lines.  Thus, the following menu command-lines in a macro would have variable paths, and "macroD" would also have an expanded value to pass to `/sc`:

"macroC":
```
/skw${key}
/fpfoc${chord}
/fpfA
```

"macroD":
```
/sk${colorKey}
/fpfoc${chord}
/fpfA
/sc "${caption}"
```

For the duration of the call, "key", "colorKey", "chord" and so on as defined, would be allowed value expansions.

Any other allowed expansions would also work per ES6-like rules: 

"macroE":
```
/snf
/sc "${currentSectionCardinal} \${sectionCount}"
```

thus, sectionCount would *NOT* be expanded, but currentSectionCardinal *WOULD* be expanded before setting the section caption. 

## Comments

We want to add three comment facilities: 
1) blank lines preserved in macros.
2) lines starting with `#` preserved, but not processed.  Whitespace is allowed before `#` so `  #` is a legal comment.
3) new menu item `/fml` runs `<b>l</b>og` which logs to the User log *if* verbose mode.

## Parameter list

In this iteration, all named parameters would be passed and callable, even if they shield other allowable expansions.  We'll fix this in a later iteration.  

In a later iteration we will also provide a menu item that specifies the parameter list, so that is out of scope now.

## Copilot Request

Copilot, please review this design and prepare an implementation plan ready for coding, and place it in new file `139-implementation-plan.md`.  Please include any questions that need to be answered before coding.

