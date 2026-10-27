# sprint-148 Iteration 6 round 4

## Startup NoteDisplaySizes

We like the new Song-DEFAULTS.  We want to use this slot to set the NoteDisplaySizes when not in Presentation mode.

### New Order

Read and apply to UI on opening a song or song from link.

1. Read UI coding such as `<element selected ...>`
2. Read DEFAULTS as set in code in sprint-148
3. Read Song-DEFAULTS *even if not in Presentation Mode*.
4. Apply User preferences stored in Browser storage, presumably the same as is found from `#btnApplyScaling`.
5. Apply from value stored as it is today when Presentation Mode is found to be on in the Song.  Presumably this follows a similar order of operations, flowing through DEFAULTS, then Song-DEFAULTS, then Sections.

So the User Scaling Prefs should be lower than Presentation Mode finds in the stored prefs in the Song.

The Song-DEFAULTS should win over LIVE in the event NoteDisplaySizes are stored in Song-DEFAULTS, even if PresentationMode is off.  So the Song author can store size defaults and have them win over LIVE controls left around by actions previous to opening a Song.  He cannot expect to override stored Scaling Prefs in Browser storage.

And Presentation Mode always wins when true, even over Scaling Prefs in Browser storage.

If the User has opened a blank Song, then fiddled with width, etc., then opens a Song, then we have LIVE with different values from DEFAULTS.  In this case, I believe that LIVE now wins if nothing is stored in Song-DEFAULTS, Browser storage, or Presentation Mode.  That is good.  But once there is a value stored in Song-DEFAULTS even with Presentation Mode off, Song-DEFAULTS  should win over LIVE.

## Request for Round 4

Please validate the requested order makes sense and produced cleaned up tables of order of precedence based on the facts of the code, and with this new precedence requested, also addressing how LIVE actually fits into the proposed order and how it works today.  If there are holes, please point them out for us to make decisions.   

For clarity please produce this order as two precedence order tables: 
  1. How it is now
  2. What we are proposing 

Please output the report in `148-it6-round-4-report.md`