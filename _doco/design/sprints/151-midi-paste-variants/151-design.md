# sprint-151-midi-paste-variants

## Goal

We would like to design how MIDI Paste will work with disparate tunings.

The core will be a string specifier that is the map of source-string to dest-string.  We can handle one-to-many, can tolerate many-to-one with last-wins and a User Log warning, remapings by allowing any order of string specifiers, and disparate numbers of strings by omitting source or destination strings.

The string specifier is not JSON.  It is a small grammar.

All mappings are based on MIDI numbers, which are invariant.  No handling of preserving frets is included, since the point of MIDI Paste is that the MIDI numbers are preserved when placing on the destination Instrument, although some notes may be "dropped" as is currently allowed by the algorithm.

## small grammar

All string numbers are:
- 1-based like they are in the rest of the command-line menu.  Internally they are converted to 0-based JSON array indices.
- smallest number string is the top of the page for Instruments, i.e. the lowest row number in the HTML table.  Thus a 4-string instrument has these string numbers:
```
1
2
3
4
```
- This is always true, even for instruments with tunings that put MIDI pitch of the zeroth fret out of numerical order.

`"Foo > Bar" 1:2,3:4`  take source string 1, map to desination string 2. take source string 3, map to destination string 4.

or: `"SourceID > DestID" source:dest,source:dest,source:dest...`

The User would not enter the quotes on the string specifiers, only on the map ID, just the nubmers, commas, and colons.

Spaces around commas should be tolerated. They should be preserved in storage so they display with spaces in the command-line menu listing.

## sparse handling

If a string on the destination Instrument is not specified, it recieves nothing.

If a string on the source Instrument is no specified, it's values are not copied anywhere.

Thus, there is no need for specifying `0` as a string identifier.

## built-in specifiers

The system should keep built-in specifier maps and offer them in the menu.  These should live in a file that is easy to edit, such as a frozen constant in a .js file.  These should not be bound to tests in a brittle way.  It is OK to walk the frozen list and see if they are syntactically valid, but the values themselves should not be bound to the test, so that if we change the constant the test breaks.

Each map gets a name.  They system has the default map name set, and the User can add any valid string (not an identifier, but sanitized) to track their mappings.

We would start with: 

"P46 > P48": "1:1, 2:2, 3:3, 4:4, 5:5, 6:6"

"P48 > P46": "1:1, 2:2, 3:3, 4:4, 5:5, 6:6"

"P46 > S6": "1:1, 2:2, 3:3, 4:4, 5:5, 6:6"

"P48 > S6": "1:1, 2:2, 3:3, 4:4, 5:5, 6:6"

"Bass5 > Bass4": "2:1, 3:2, 4:3, 5:4"

"Bass6 > Bass4": "3:1, 4:2, 5:3, 6:4" 

"Bass6 > Bass5": "2:1, 3:2, 4:3, 5:4, 6:5" 

Note that the first four in this set are boring because P48 adds strings 7 and 8, and even though the tunings are different from S6, the same basic ranges are preserved.  Bass5 is the first one that is interesting because 5-string basses add a new string first/top.  However, the explicit nature of these listings keeps it simple, editable, and intuitive.  So we don't need any fancy grammar that lets us do wildcards or defaults, for example.

One wildcard usage we *would* allow, is if the User chose specifier "P48 > S6" and in fact attempted to MIDI Paste to any 6-String Guitar (since S6 is a "6-String"+"Guitar") then the map would apply because the number of source and destination strings match.  So this would work to paste to "DropD", "DADGAD" etc.

Also, if a map is known and selected, then its reverse should be allowed.  So choosing "P46 > P48" but then copying from P48 and attempting a MIDI Past to P46 should infer the rule.  This should only be not infered if there is a reverse rule stored.  So the above rule is redundant and may be removed after testing, since inferrence should make it obviated.  It would only be included, therefore, if P48 > P46 were one way and P46 > P48 used different strings (it doesn't). So the Bass examples as shown should rely on the inferrence rule for the reverse direction.

## User specifiers

The Song should store specifier maps the User has added with the "add" menu item.  These would be available on the next Song load, but not to other Songs.  No need to attempt any fancy import facility since the strings are easy enough to enter.

## Menu design

menu syntax: like other sprints, `/fpc` means command-line menu level, `m)idi paste map` means trigger `m`, `m` is bolded, and `)` doesn't appear in the caption, it is there to show which letter is the bolded trigger. In the menu list below, we show only the new menu items and children, indented to show menu hierarchy.

`/fpc` gets new menu item: `m)idi paste map`
`/fpcm` gets new children: 
```
/fpc
   m)idi paste map
      m)ap [current-id]
      a)add
      d)elete
      l)ist
```
where `m)ap` is a sub-menu that lists and lets the User select from built-in choices and User-added choices, in that order, numbered 1) to 9) then a) to z) if needed, similar to how many plugins create numbered choices.  No item `0)` is created.  The identifier is used in the current-id field shown at the `m)ap [current-id]` dynamic menu item, and is shown in the child menu to pick it: `1) Bass4 > Bass6`.

`a)dd` would allow the User to type in the syntax from the small grammar.  They should be required to enter the ID in double quotes so the map doesn't get lost. This is similar to `/fma` except that ID and map value are entered on one line so no editor is needed.

`d)elete` would present a menu and let the User chose the number/letter to delete, similar to the CRUD of `/fmd`.

`l)ist` is similar to `/fml`

## Request

Please incorporate these rules, plus the previous discussion in the chat, eliding rejected design possibilities (such as fret-based copies, `0` for skipped strings, flat lists with source-only specifiers, alternate small-grammars), and write an implementation plan in `151-implementation-plan.md` for us to review and answer questions.  This will give us a documentation of the accepted portions of the chat so far.

This Iteration has an output of the implementation plan, and no coding yet.