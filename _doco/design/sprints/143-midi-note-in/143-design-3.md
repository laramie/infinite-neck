# Request   143-design-3

We have found the Launchpad device does two modes of interest: [User, Programmer] 
- User is MIDI notes on NOTE ON with velocity > 0, and MIDI ON with velocity == 0 after it when the User releases the button on the Launchpad.   Row and column on the device cannot be calculated.  However, it has a built-in light display programmed to the C-Scale which is standard for these devices and easy to play because it is tuned like a P4 guitar.  However, Launchpad won't tell cell and row in this mode.
- User mode must be supported because entering a song while the device shows the key of C, and automatically displays lights for where you press, and finds equivalent MIDI number buttons and lights those as well.
- internal note: to enter Programmer mode on the device, press Setup, then press top row column 5, orange--bright.
- in Programmer mode, Launchpad encodes the entire button board in a special sequence.  It sends these as midi notes but they are not midi notes.  The default lighting for the key of C is absent.
- Programmer mode is desired because we can program what to do with inputs and outputs.  Therefore, a note from Launchpad tells row and column, which we calculate using our "8x8"/"MIDI" tuning, and therefore we can place a note on 8x8 as our natively supported tuning, since this tuning was written to model this Launchpad Pro MkI device.
- We will want that row and column clicked on the Launchpad and thus sent to infinite-neck, to place a note at that row-column on the 8x8.  Since the 8x8 is geared for this layout, it should work.  We'll define other tunings the same way - treat them like they occupy n-strings of available 8-strings on the Launchpad's 8 row x 8 column buttons. (Actually, the Launchpad's numbers also cover control buttons that act like extra notes.  It's really an 8x8 grid with one extra column of 8 on the left, and one extra column of 8 on the right, so that it looks like a 10 column by 8 row grid.  Above and below are one more row above the top of 8 buttons, so those line up over the 8x8 grid.  Below is also 8 buttons, so it ends up like a grid 10 x10 with the four corner buttons missing.)
In Programmer mode the buttons map, omitting the center of the grid since it follows the sequence, just showing how the edge buttons work: 
-  5B 5C 5D 5E 5F 60 61 62  -
50 51                   58 59
46
3C
32
28
1E
14 15 16
0A 0B 0C 0D 0E 0F 10 11 12 13
-  01 02 03 04 05 06 07 08 -

These are Hex. Here is the doco on how Launchpad encodes row and column into the base-10 digits:
```
When the Launchpad Pro is in Programmer/Developer mode, the 8x8 grid of pads sends distinct MIDI note numbers calculated by standard base-10 math using standard two-digit or decimal note values.

The Row Calculation: Divide the incoming MIDI note number by 10 (or use integer division note // 10). This gives you the row tens-digit, corresponding to rows 1 through 8 (from bottom to top or top to bottom depending on the specific firmware coordinate system).

The Column Calculation: Take the remainder of the note number divided by 10 (note % 10). This gives you the column units-digit, corresponding to columns 1 through 8 from left to right.

Example: If note number 36 comes in:
   Row = 36 // 10 = Row 3
   Column = 36 % 10 = Column 6
```

- The next step is that in Programmer mode, we must send a NOTE ON to the device at each repaint, including a mapping of color number to velociy which is the device's color map number (appears to be 127 colors).  Here is a first-pass using the device documentation:

Velocity Color Values

3: White (exception value)
5: Red
9: Orange
13: Yellow-Orange / Amber
17: Yellow
21: Yellow-Green
25: Green
29: Turquoise / Cyan
33: Light Blue
37: Blue
41: Purple / Violet
45: Magenta
49: Pink
53–57: Light/Soft Pink variations

Each major color value has two dimmer settings.  Adding +1 or +2 to the base color number makes that respective color dimmer (e.g., if 5 is full red, 6 and 7 are dimmer shades of red).

# Next iteration

For Iteration 2, move 143-it1-midi-prototype.html code into a new tab page on "Desktop" with tab button caption "MIDI".
Let the tab buttons now be: 
```
Keyboard | Buttons | MIDI
```
Where MIDI shows a div that contains the controls copied from the prototype.

Add a toggle button, like `#btnAutoColor` in `#divQuick`.  When it is PunchedIn, it means MIDI is on, routing NOTE DOWN, through the row/column calculator, and into the Instrument.  

Eventually controls will end up in the Wiring Mapping side-panel div.  For now, living on the new MIDI tab page will be sufficient.  The routing should be handled by an Instrument picker, similar to the one in the Wiring area -- its a dropdown built of all Instruments in the song that are Main instruments -- no Observers or Listeners.

There will need to be some state kept: we need to keep track of which buttons are lit on the device.  If a User presses a button, which we are lighting because it is a note in a Section on this Instrument, then we must highlight the button on the device with a NOTE ON in a brighter color, then when they let go, we must undo that brighter color with a NOTE OFF, but then we must restore the light corresponding to that note on the Instrument.  If the User clicks a button, they get a NOTE ON, we turn that into a hit on the Instrument, consult what Note type is in effect, and add that note to the Model.  Which means we send out a color for that button.  Then when the NOTE OFF comes, we ignore it except for removing the bright velocity and adding the color/velocity that corresponds to our note color.  We don't have to implement all that in this iteration, but wanted to specify it so classes can be implemented in the midi-io.js module. 

So for this next implementation step let's:
- The User will add an 8x8 to the Song, then wire in with the Select for Instrument on the MIDI tab page in Desktop.
- Map MIDI NOTE ON from Launchpad in Programmer Mode to actual rows and columns in the 8x8, through to its Note Model, and thence to replay().
- Whenever a note is on in the Model, during replay(), send that note to the device on MIDI OUT.  We'll worry about the ON/OFF flipping in the next iteration.  
- Whenever a User presses a button on the device (NOTE ON), route it to the same as `TD.note click` in our instrument.  And that NOTE OFF means nothing to us.  Just use Velociy 5 / Red for every color in this iteration.  We'll worry about the semantics of how to turn notes off at Section changes and Note edits in the next iteration. 





