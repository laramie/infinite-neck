
## DOCO

- Add documentation for add one tuning.  For now, I put this in the Glossary:
    ```
    Note: if you wish to add a 4-row Organ, Lineage is "Organ" or some other name you make up, can't be a Lineage in the 
                Library such as "Piano" that has only one "string".  
    ```
  - You can add strings all starting at the same MIDI pitch, or octaves or whatever you want.
  
  - DOCO: 
  - FAQ / "I want to":
    - Use the chart to fill in the notes on an instrument: FillPlugin, 
    - Copy the notes from one instrument into another: `L` Listened notes copy
    - Turn the notes from many Sections into chart chords: `rip-through` flow in TonalPlugin
    - how do I copy highlighted notes from Arpeggio? I can see them in Chart > Notes!
      - You can't.  They are just highlights, not NamedNotes or SingleNotes or TinyNotes.
      - You can pause looping and click on the positions with a NamedNote or SingleNote, and you can look through the beats with `n` and `b` or the Transport.  These notes you click would become a permanent part of the Section, and will stick around because you authored them.  You Could also record highlights over the highlights you see Section by Section and beat by beat, and these will persist because you authored them.  You would click REC, also choose Multihighlight note style `]`, then click onec to clear the highlight Arpeggio has placed, then click again to place yours.  Then `n` to go to the next beat, then click twice on the next highlight you see, and so on.  Then, when you Clear in Arpeggio and set Enable to false, you'll see your highlights in beat looping and looping, but not Arpeggio, and Chart > Notes no longer shows notes with "owner": "ArpeggioPlugin". 
    - Preserve the changes made by TransposePlugin
    - Roll back the changes made by TransposePlugin
        - You have several options:
          1) Keep a backup of the songfile by downloading a copy before Enabling TransposePlugin
          2) Use the Graveyard for backups of Sections or Plugin settings
          3) Use TransposePlugin's built-in commands which will roll the changes it has made since the songfile was opened. 
              - Before closing the file, just go into TransposePlugin's Reset command sub-menu.  Hitting Reset won't reset anything until you choose an option from the sub-menu, which has: 
                - original
                - current interval
                - set original to current
             - After the song is downloaded, the transpositions are kept, and TransposePlugin starts fresh the next time the song is opened.
  
         
  - "HELP!"
    - no clicky? Check Note KEEP
    - can't select my Instrument in ArpeggioPlugin? Check that it is not Wired. Arpeggio doesn't work on Listeners or Observers.
    