# spike test 1 "3 x 2 on Letter portrait"

- didn't print cell shadow borders
- adds a page 2 with half of the Transport showing.  Desired: don't print the Transport.  Acceptable to have it auto toggle the Transport off as a reminder if there's no way to mark the Transport as being on a non-printing layer.  Turning Transport off/hidden means the browser no longer tries to print page 2.

# spike test 2 "2 x 3 on Letter portrait"

- did print cell shadow borders.
- weird cropping: 
  - on screen with browser window Maximized to fill laptop screen, we see Nut plus 9 frets, matches Tunings 9 frets.
  - printed preview in system dialog and printed actual page shows Nut plus 4 frets, and whitespace in rest of tile to the right of each table.
  - with browser window non-Maximize we can now see the cropping on the screen.  So system print preview is using some browser width other than Maximize.
  - Using DevTools > inspect we can see that the full tile with weird whitespace is `.div.instrumentBackground` while cropped table is `div.fretTableWrapper` and/or `div.wiringAndFretTable`. Tiling stretches to full width of page, responds to browser resizing of window/page.  At some point when viewport approaches 90% or more of screen width, the table cells are all present.  However, when we go with very wide cells using keyboard cell width shortcut `w`, the table doesn't show all frets (as expected), but it is interesting to see that the extra whitespace in the tile is a constant percent of viewport.  Stretching the browser window proportionally changes the whitespace width.  Resetting cell widths so the whole table shows all cells, then stretching the window increases the whitespace and leaves the table constant width.
  - `browser > system window print dialog > scaling > 74%` made the preview and paper printed tables fit better, and at 60% more closely matched the screen at full width.

# spike test 4 "Manual scale"

console paste: `spike.apply({ scale: 0.5 })` 
- Yes: Rescaled in system print preview.
- Also, cropped more of instrument tables. 
- print preview dialog custom scaling at 40% restored most of tables.

# spike test 5 "Rows that run past a page"

console paste: `spike.apply({ cols: 1, scale: 1 })`

print preview dialog > scaling : reset to "Default"

print preview proposed 6 pages, one tile per page

# spike test 6 "Browsers"

Only Chrome tested in this round.

# spike test 7 "Theme"

Dialog previews Theme correctly.  Light and dark shadow borders shown correctly compared to what we see on screen.

# spike test 8 "Rebuild cost (Step 0)"

Test inconclusive because timing was mostly our time getting to the dialog and clicking a change.  Would need a stub to paste that did a change and rebuild programmatically. At any rate, changing "Left-handed" is reasonably snappy, and not that much different than older version on different server with 6 tables.  Difference can be seen in both when only one table, so there is a cost to having multiple tables anyway, but acceptable.

# spike test 9 "Background graphics : off"

No visible difference.

# 5.4 results
- `print-color-adjust` seems to work fine.  Colors look the same as on-screen.  Didn't try any other values.

- print in grayscale ("Black and White" in our printer): looks like our expectations: elements appear in relatively correct contrast, diamonds, Nut, highlights, shadows all visible.

## 5. Spike addendum (the recipe is in it2 section 5, still valid)

Did not fully test this section.  Will revisit.



