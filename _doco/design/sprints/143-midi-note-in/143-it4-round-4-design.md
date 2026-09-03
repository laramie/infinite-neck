# Iteration 4, Round 4

## Status

(143-it4-round3-chat.md)[143-it4-round3-chat.md] Describes how we added control buttons on the Launchpad surface.

The control buttons are rows 0 and 9 if grid is thought of as rows 0-9 and Columns 0 and 9 if columns are 0-9.  They are in addition to the 8x8 grid, and their midi numbers have been identified and used in the code.

We see the rows as being row 0 on the top of the page, and row 9 as the bottom of the page, if the Launchpad were presented on screen just as the 8x8 MIDI_1 Instrument is. We see column 0 as the "Left" column, and column 9 as the "Right" column.

## Feature request

In the first column, the control buttons, column 0 we already have the Latch/Momentary button.
We want to add a button to match the REC button.  If the REC button is red, column 0, row 7 should be red (velocity 5).

column 0:
- row 7: REC 
- row 8: Latch/Momentary

The buttons on the right side, column 9, we want mapped thusly: 

column 9:
- row 1: Add Section : `#btnNewSection`
- row 2: Add Beat : `#btnInsertBeat`
- row 3: First Section : `#btnFirstSection`
- row 4: Prev Section : `#btnPrevSection`
- row 5: Next Section : `#btnNextSection`
- row 6: Last Section : `#btnLastSection`
- row 7: Beat Loop Toggle : `#btnLoopBeats`
- row 8: Section Loop Toggle : `#btnLoopSections`

row 9 has already been implemented for columns 1 through 6.  
We are adding columns 7 and 8 for Prev Beat and Next Beat, which do not latch a color or state.

row 9: 
- col 1: Named
- col 2: Single
- col 3: Tiny
- col 4: Bend
- col 5: Pitch
- col 6: Multi
- col 7: Prev Beat : `#btnPrevBeat` : Flash magenta when pressed, clear on CC for button released.
- col 8: Next Beat : `#btnNextBeat` : Flash magenta when pressed, clear on CC for button released.

These actions should do the things that similar functions in the `#transport` do.

For the column 9 entries, the lighting feedback is as follows:
button press: light up decimal velocity 7.
button release: send decimal velocity 21.
When any other button is pressed in column 9, blank out all other buttons in rows 1-6.  This means the velocity 21 latches the light until the blank out happens.  So the User will see a magenta (velocity 7) when they press rows 1-6, then green (velocity 21) when they release, and any other button in the column clears.

For column 9, the last two buttons, row 7 and row 8, are tied to the Looper buttons in the transport, and the recently centralized handling of all looper buttons.  So they won't get cleared by rows 1-6.  They will get magenta (velocity 7) if they looper button in the UI gets magenta (looping or beat looping respectively).  They will get off (velocity 0) if the loop or beat loop respectively, are off.  So Loop and Beat Loop buttons do a double-duty: they toggle their own color to match the transport UI buttons, and they clear column 9, rows 1-6 on *any* row 7-8 press.

