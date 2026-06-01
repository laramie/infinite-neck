# Iteration 1: define LeadSheetLine

- We need a mode/class that will be just like `Chart > Chart Options > Bar Style > LeadSheet`
- It will be named LeadSheetLine
- It will only show the current line the current Section is in, and will follow tranport navigation via events.  However, with a checkbox option on `Chart Options` called `Show Next Line`, it will show two lines: the line containing the current section, and the next line that would be shown in LeadSheet after the line containing the current section.  When there is no next line, the vertical space that would have been consumed by that line will remain.
- It will be encompassed by a container with `background-color: rgb(251, 185, 99)`
- The LeadSheetLine will have a `background-color: rgb(255, 235, 156)`
- The current Section will get a `background-color: #a1fde9`
- The second line of LeadSheetLine will be the LINE following the LINE the current section is on, with BARs as presented by LeadSheet, but the whole line will be `background-color: rgb(247, 197, 106)`
- The LeadSheetLine will continue to show :hover for clicking any Section BAR which will continue to jump to that section.  This should cause re-rendering of LeadSheetLine because the current Section may change, and the row it is on may change, bringing in a new second line.
- It will live in a new tab after `Chart` called `Line`

# Iteration 2: tweaks after implementation

- Tightened up the display so that when no other text is in the BAR, chord determines the height and height of the LINE is minimal.
- Added command-line /cl
