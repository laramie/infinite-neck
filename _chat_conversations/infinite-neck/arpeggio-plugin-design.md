# ArpeggioPlugin design

When ArpeggioPlugin is enabled, it creates a Section's worth of recordedNotes every time it recieves DaCapo:OnSectionBegin from the Looper.

## Overview

On DaCapo:OnSectionBegin

    At this moment, when we've entered a Section, but haven't gone into the first beat yet, ArpeggioPlugin should create recordedNotes.

    We will want the User to pick the note type in a future iteration.  For now, we'll always use 

         Highlight "Multi" which is styleNum: 4

    We will support multiple algorithms. 

    Here is the first algorithm to implement: 
        "style": "every": 

## Implementation 

      You will find the constants needed for midi/note-name calculations in Constants.js
      You will find example uses in TableBuilder.js

      Look at all the NamedNotes in the Section
      
      Look at the minFret and maxFret

      Up to the number of beats existing in the Section, add recordedNotes, one per beat, as a Highlight "Multi", Note.STYLENUM_MIDIPITCHESSINGLE

        Add these notes between minFret and maxFret, starting on the lowest string (the last in the rowRange array) and proceding  up the string until maxFret, then continuing on the 0 fret of the next string working backwards in the rowRange, and so on until at the 0 string and the maxFret.  Not all strings and frets will have notes at them, but those
        cells that do, will have a Multi on a beat at that cell.

        A minFret of 0 means the "Nut" position may be played, thus in terminology, the "Nut" is "fret 0".
        
        A minFret of 1 means the first playable position is the "first fret" or "fret 1"
        
        A maxFret of 5 means the Note may appear at column 5, since 0 is the nut, and columns are zero-based. 

        Column numbers have to be computed, since they are known at table construction time, and the cells are marked with row and column number, but it is better to calc them with the same information the table manager uses, rather than digging around in the View which would involve jQuery.  We want to have the plugin do a pure model addition of highlight notes before the notes are rendered in the UI.  
        
        row is stored in a recordedNote, and the midi number is stored.  But for NamedNotes, you just get the NoteName.
        
        For one instrument tuning, you have the array of midi numbers by row, so you can calculate the column / fret position.

        So "P46", a P4 tuned guitar, we have: 

            "baseID": "P46_1",
            "baseInstrument": "Guitar",
            "caption": "P4",
            "nStrings": 6,
            "rowRange": [
                65,
                60,
                55,
                50,
                45,
                40
            ],

        Here, string 0 is row 0 is the 0th member of the rowRange, so the nut, column 0 has a midi value of 65. 
        We call string 0 the "highest" string, and string 5 the "lowest" string, because the table presentation shows the highest string towards the top of the page and the lowest string towards the bottom of the page, and this aligns with how players think of their instruments, though they hold them upside down or sideways.  

        For this design case, assume: 
            minFret: 0 
            maxFret: 3
            lowToHigh: true
            upOnly: true
            style: "every"

        therefore if the existing namedNotes are: 

                "namedNotes": {
                    "C": {
                        "noteName": "C",
                        "styleNum": 0,
                        "colorClass": "noteTransparent"
                    },
                    "Gb": {
                        "noteName": "Gb",
                        "styleNum": 0,
                        "colorClass": "noteTransparent"
                    }
                },

        you can generate these Note values by knowing the fret range, and the midi number of the Note found in nameNotes that is on the string and fret range we want to generate,
        which can be calculated the way TableBuilder does it.

        One new property of Note should be added:
            "owner": "ArpeggioPlugin"
        This should also be added to the schema as an optional property.
            bin/song-file-schema.js
        Use this property to clean up these notes on cleanup or on iteration, specified below.        

     Here is the desired output after Arpeggio plugin has filled in the recordedNotes, and is ready for the Looper to start rendering them:            

    "sectionNotesByTable": {
        "tblP46_1": {
          "namedNotes": {
            "C": {
              "noteName": "C",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "Gb": {
              "noteName": "Gb",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            }
          },
          "recordedNotes": {
            "1": [
              {
                "noteName": "Gb",
                "styleNum": 4,
                "midinum": "42",
                "row": "5",
                "owner": "ArpeggioPlugin"
              }
            ],
            "2": [
              {
                "noteName": "C",
                "styleNum": 4,
                "midinum": "48",
                "row": "4",
                "owner": "ArpeggioPlugin"
              }
            ],
            "3": [
              {
                "noteName": "C",
                "styleNum": 4,
                "midinum": "60",
                "row": "1",
                "owner": "ArpeggioPlugin"
              }
            ],
            "4": [
              {
                "noteName": "Gb",
                "styleNum": 4,
                "midinum": "66",
                "row": "0",
                "owner": "ArpeggioPlugin"
              }
            ]
          },
          "chord": "",
          "mode": "",
          "playedNotes": []
        }
    }

    So in this case, the User has placed NamedNotes at C and Gb, and the minFret was 0 and the maxFret was 3, so the (to be implemented) ArpeggioPlugin has generated highlight notes (styleNum: 4) recorded in the beats at

        Gb, midinum: 42
        C, midinum: 48
        C, midinum: 60
        Gb, midinum: 66 

    ArpeggioPlugin should keep doing this until the number of beats in the Section are filled.  (We will add a feature in the next iteration to add beats to the Section with a property to control the count.  Because if the fret range is wide enough, the user will need more beats to cover the available notes meaningfully.  For now, we are sticking with the popular 4 beats per Section, which is what Song defaults the new Section to. So in this iteration, use all available beats, adding none, but not assuming it is 4, because a User will be able to add beats with the UI before enabling the plugin, or even while the plugin is running.)  

    If a highlight of the same styleNum is already on that note at that beat, leave it, and don't overwrite it.  It will play because the user wanted it there, and on cleanup, we won't delete it because it won't have "owner": "ArpeggioPlugin".  

    Even though ArpeggioPlugin *could* rip through the song and add recordedNotes to the model (and *will* in a future iteration with a matching property), the design in *this* iteration is that it does so only for the current Section on event DaCapo:OnSectionBegin.  This covers a use-case where the user may want to be surprised by the notes, rather than being able to peek with an Observer instrument, for practice/play purposes.  It also handles cases where the user may be inputing notes in later sections as he composes or transcribes a song, then restarts the Looper.

  ## Cleanup and iteration

    We will need a new verb/action on ArpeggioPlugin called "clear" which will clean up all notes generated, which will be findable since each generated Note in recordedNotes now has: 
       "owner": "ArpeggioPlugin"
    Please add this verb/action in the implementation iteration.   

    When looping, we will inevitably come across a Section that ArpeggioPlugin has already processed.
    For this iteration, simply cleanup that section, that is, delete all Notes that have 
    "owner": "ArpeggioPlugin"
    since the algorithm may have changed via "upOnly" or "style" having been changed, the algorithm in future iterations may be "random", or something about the song may have changed, e.g. "key".
    Since these operations are so fast, it would be fine to just cleanup every time before placing notes.  

    However, if the user stops Looping before coming around to a new Section, they should be able to save the song since all recordedNotes so far are in the model.  If they then set "enabled" to false, they can play the song at any time and still have all the note ArpeggioPlugin has calculated and placed.

## Answers to iteration 1, with numbers matching points in "Findings" : 

1. fix looper.js to emit DaCapo:OnSectionBegin at loop start as part of the implementation iteration.  This was an oversight and will not break existing clients.
2. emit the pattern of ArpeggioPlugin :: invokeAction :: help with a message saying that set of choices is not implemented yet.  For this iteration, User must know the magic combination, which you can document in the message. So "3." and not "4."
5. action "clear" should clean up all generated notes in the whole song.  The ArpeggioPlugin does cleanup-one-Section-only when coming to a new Section while looping.  So not "6." but yes "7."
8. For this iteration, choose the instrument that is the first in myTunings that is not wired as a Listener or Observer.  Thus we do one table/instrument only.
13. For this iteration, if upOnly is false, then continue in reverse, skipping the last note highlighted so it is not a double-play.  So if the logical sequence of notes played was 1,2,3 but we had six beats, the sequence would be 1,2,3,2,1,2.   if upOnly is true, the sequence would be 1,2,3,1,2,3.
17. Yes, please add to the schema with optional.  We want the schema to represent optional properties for documentation purposes so no one creates a property with another meaning.


  ## First Request

    I think we have specified enough to allow you to make the algorithm work. If you need additional midi/note-name functions because our existing set doesn't give the information needed for calculation, please let us know.  In this iteration, please let us know any question you have, or any holes in our specification.

    Please do this one iteration of planning the algorithm and give us a minimal report before doing code changes in the next iteration.  We will review the report and then request code changes in the next iteration. 

  ## Full Chat after that

  _chat_conversations/infinite-neck/arpeggio-plugin-design-chat-full.md

  ## Defining "bach" better.
This is tricky!  Body memory is very different from logical thinking for us humans!  I have fixed the rules to handle the case that is wrong.  You can compare it to the previous rules if that helps, but I think I have made a consistent rule set.

Logical assertion: Since we are using namedNotes, if a note was found near the bottom of the octave range, it is guaranteed to be found near the top of the octave range. This would be true for any namedNote, but is useful to remember when calculating actingRoot and notes just above and below it.  So if the sequence started with C because C was found at the bottom, there is guaranteed to be a C at the top.  (Later we will add a use-case where we don't use namedNotes, but for that case, we won't use "bach".)


  0) "bach" is the same logic as "alternate" with a few more rules.

  1) start on the tonic, the namedNote of the key.  Find the key, find the first note of that key, else use the next available note of that key.  Call this the actingRoot.  In general, the actingRoot should be the first note in rootKey, but that's why we are saying "actingRoot", because a musician can play in other "modes" where the second note in the scale acts as the first note in the scale.  They would signal this by ommitting the tonic.  Since you can't find it, you can find the next note and call it the actingRoot.

  2) find the next note to play by using the "alternate" algorithm.  Continue with "alternate".  

  3) At the top.
  
    a) Here is a definition of "octave": when we have traversed one full "octave", we would be playing the actingRoot+12 calculated in midi distances.  Let us use the synonym actingRoot+12 to be the actingRoot at the octave.   If {"noteName": "C", "midinum": "48"} is the actingRoot, then actingRoot+12 === {"noteName": "C", "midinum": "60"}.
    b) But do not consider this actingRoot+12 just played to be "At the top".  Instead, we will continue the "alternate" algorithm three more notes: 
        1) the note just below the actingRoot+12
        2) then the note just above the actingRoot+12
        3) then the actingRoot+12. This is the second time we have played the actingRoot in the octave position, which we are calling actingRoot+12
    c) We are now done with the sequence "up".
    d) We now commence the "down" sequence, starting from sitting on actingRoot+12.
    
  4) when we go back down, we are sitting on the actingRoot+12 already. It does not get repeated on the way down, but counts as the first note in the down sequence.

  5) the next note down follows the "alternate" algorith.

  6) when we get to the actingRoot at the bottom on the way down, we are not done: we have three more notes to play: 
      1) the note just above the actingRoot
      2) the note just below the actingRoot
      3) the actingRoot
  Now we are done with the "down" sequence.

  7) if we miss the actingRoot on the way down because of even/odd mismatch, then the note just below the actingRoot that we do hit becomes the penultimate note. After this, play the actingRoot, and the "down" sequence is done. 

  8) if more beats are available, continue with "alternate" in the "up" direction as though we just played the actingRoot as the first note in the sequence.

  9) Just like "alternate", if you run out of beats, just quit.

  10) upOnly means we hit actingRoot+12 twice to end the sequence, then jump to the begining of the sequence at actingRoot if we have more beats available.

  1) lowToHigh: false should be implemented as the exact same sequence, just starting at the actingRoot+12 the second time, or at the end of "up" and the beginning of "down".  Its the same sequence, we just start later at actingRoot+12.