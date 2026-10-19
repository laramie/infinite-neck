# sprint-148 Iteration 4 Round 4 testing report

1. When View :: "HIDE TinyNotes, Bends" is checked, "Palette::Keep is now selected" shows.  User hits `7` for SingleNote, then clicks in a cell to place a SingleNote.  
  a. Per our recent bugfix, (I think it is in presentation.js) all "HIDE" checkboxes clear, and all note types are shown, and the User is able to place a SingleNote.  Problem is, now that registers as dirty for "Hide TinyNotes, Bends" but really we should have only cleared "HIDE SingleNotes" if it had been checked.  The way it is now is not granular enough: all HIDE checkboxes are cleared.   The clearing of HIDE checkboxes should match the note chosen on the palette, this time with the keyboard shortcut, but behavior should be the same if the palette SingleNote radio button had been clicked.  User should then place notes, and SingleNotes would all be visible, which is sane while placing SingleNotes.  And if he wants to not have View be dirty, he could *then* reset "HIDE Single Notes", presuming he has some Macro to show the notes he just placed, or some other reason to go back to hiding.  
  b. Second issue is that, related to the current sprint, the dirty flag is not set but the "HIDE TinyNotes, Bends" differs from the saved state, as verfied by navigating forward and backward one Section.  Upon coming back, the "HIDE TinyNotes, Bends" is duly checked, and TinyNotes are duly hidden.  So the DisplayOptions are correct, but the temporary display of the checkbox is incorrect, because when cleared by presentation.js the checkbox is unchecked, DisplayOptions thinks it is checked, yet the dirty flag is not turning the SAVE button magenta. So probably presentation.js should be triggering a scan for the dirty flag when it flips these HIDE checkboxes. Note that when we manually click "HIDE TinyNotes, Bends" after `7` then placing a SingleNote, the dirty flag is not tripped, so the SAVE button is not magenta, which is correct actually because the checkbox now matches DisplayOptions, and when we uncheck "HIDE TinyNotes, Bends" one more time, now SAVE is magenta, because unchecked doesn't match DisplayOptions.  So this confirms the checkbox comparison is correct, but the temporary turning off of it does not trigger the dirty flag.

  2. cell:r in autoColor seems not to take effect until the next Section.
  - step 1: `c` to turn AutoColor checkbox off in Section 1
  - step 2: SaveDiff
  - step 3: /vpmgac 1,autoColor,read-blocked
  - step 4: verify gate is there with /vdd : cell is green with text "cell:r"
  - step 5: Loop. 
  - RESULT: On first Section, AutoColor is off, but Song default implies it should be on, and green in Section 1,autoColor implies that it is off.  Looking at the Instrument, AutoColor is unchecked because notes are not AutoColored. On Section 2, autoColor is gray, AutoColor is back on because notes are AutoColored, and the AutoColor checkbox is checked, implying that the DEFAULT plus not reading the OFF from Section 1 properly sets Section 2 AutoColor to ON.  But somehow, this did not apply to Section 1.  Expected that Section 1 would follow DEFAULT since we aren't supposed to read green+blank which means changed+OFF.
  - Creating a new Song, adding two Sections, SaveDiff in Section 1, then nav to Section 3, turn AutoColor off, SaveDiff.  After this, looping shows AutoColor being ON in Sections 1 and 2, and turning OFF properly in Section 3.  So the DEFAULT for Section 1 is working.  In this state, Section 1 autoColor is gray implying read DEFAULT which is ON, and Section 3 is green and empty, implying OFF.  These colors match expected.

  3. `/vpmgac 2,autoColor,read-blocked` works as expected for Section 2, and similarly for Section 3 with the corresponding Section number.

  4. `/vpmgac 3,autoColor,write-blocked` works for blocking attempts to write AutoColor on and off in Section 3, and the same command but for Section 2 works also.

  5. `/vpmgdk` and `/vpmgak` working well, tested with opacity for NamedNotes, added gate for read and write, automation stopped across Sections. delete read, automation resumes. Attempt to SaveDiff new value has no effect, proving write-block works.

  6. Presentation Mode works as it did before this sprint, which is good.

  7. Theme automation works as it did before, respecting the Allow Theme Automation checkbox, and saving values to the /vdd table view.


  
  