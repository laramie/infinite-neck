# sprint-148 Iteration 6 round 4

## Startup NoteDisplaySizes

We like the new Song-DEFAULTS.  We want to use this slot to set the NoteDisplaySizes when not in Presentation mode.

### New Order

Read and apply to UI on opening a song or song from link.

1. Read UI coding such as `<element selected ...>` when building the UI the first time
2. Read DEFAULTS as set in code in sprint-148 and apply when building the UI the first time
3. Read Song-DEFAULTS and apply *even if not in Presentation Mode*.
4. Apply User preferences stored in Browser storage, presumably the same as is found from `#btnApplyScaling`.
5. Apply from value stored as it is today when Presentation Mode is found to be on in the Song.  Presumably this follows a similar order of operations, flowing through DEFAULTS, then Song-DEFAULTS, then Sections.

So the User Scaling Prefs should be lower than Presentation Mode finds in the stored prefs in the Song.

The Song-DEFAULTS should win over LIVE in the event NoteDisplaySizes are stored in Song-DEFAULTS, even if PresentationMode is off.  So the Song author can store size defaults and have them win over LIVE controls left around by actions previous to opening a Song.  He cannot expect to override stored Scaling Prefs in Browser storage.

And Presentation Mode always wins when true, even over Scaling Prefs in Browser storage.

If the User has opened a blank Song, then fiddled with width, etc., then opens a Song, then we have LIVE with different values from DEFAULTS.  In this case, I believe that LIVE now wins if nothing is stored in Song-DEFAULTS, Browser storage, or Presentation Mode.  That is good.  But once there is a value stored in Song-DEFAULTS even with Presentation Mode off, Song-DEFAULTS  should win over LIVE.

Please clarify if `1.` and `2.` above happen on loading a song from Library, File Open, or Song link, after being in a state of having loaded a blank song on startup.

## Request for Round 4

Please validate the requested order makes sense and produced cleaned up tables of order of precedence based on the facts of the code, and with this new precedence requested, also addressing how LIVE actually fits into the proposed order and how it works today.  If there are holes, please point them out for us to make decisions.   

For clarity please produce this order as two precedence order tables: 
  1. How it is now
  2. What we are proposing 

Please output the report in `148-it6-round-4-report.md`

## Answers for Round 4 after report

Reading `148-it6-round-4-report.md` we are answering `## 8. Decisions needed`

| # | Question | Recommendation |
|---|---|---|
| H1 | Exempt only `NoteDisplaySizes` from the adapter gate for the Song-DEFAULTS tier? | Yes, only that key |
| H2 | Open-time only (B) or cascade (A)? | B |
| H3 | Re-apply the whole Prefs blob on Song open, silently? | Yes |
| H4 | Whole-blob replacement for sizes? | Yes |
| H5 | Presentation on with no stored value leaves Prefs or LIVE alone? | Yes |
| H6 | Skip a size that is not a dropdown option? | Yes, with a status line |
| H7 | Legend sentence rather than new Inspect provenance for "overridden by Prefs"? | Yes |

ANSWERS:

- H1 : Yes, only that key

- H2 : Open-time only (B).  This is to take advantage of the slot in Song-DEFAULTS to provide a reasonable initial view of the Instruments that is less strict than Presentation Mode and doesn't require Presentation Mode.  These resonable defaults are thus based on the authored content of the Song, and what the Song author knows.  It is not to change the application flow while navigating or looping.   Presentation Mode is hard for normal use-cases where a User is driving and practicing the content, so a User can expect to resize the song to his view preferences without constantly being reset on looping and navigation.  Presentation Mode is more for making hands-free Presentations that are rehearsed beforehand, and maybe even on a separate computer than is available for the Presentation, such that Browser Display Options should lose to Presentation mode.  The Browser storage options are for Users who, either by preference, ability, or available Browser, cannot abide by the resonable defaults, and thus wants to override them unless Presentation Mode is on.

- H3 : Yes. This seems like two decisions wrapped in one. To clarify: yes, the whole blob applies together, and yes, the User loses fiddled LIVE settings on Song Open if the higher precedence settings are available.

- H4 : Yes.

- H5 : Yes.

- H6 : Yes, with a status line.

- H7 : Yes.

Note that we have noticed what you mentioned about Presentation Mode checkbox change not applying immediately.  Our decision on that is to keep current behavior, otherwise it might never be possible to have Presentation Mode on and fiddle with widths.  This case is needed when doing Presentations, because the Instructor may need to "zoom in" while in a Section, but then knows that hitting LOOP will reset things.  With LOOP OFF, he can zoom in and out and point out details of the Section without navigating.

We may later want more granular Browser display options prefs, for example 1) separate override for low-vision Users and 2) stored option just for songs without reasonable defaults.  For now, we'll leave it as one preference that respects the precedence we have discussed here. If the User wants the prefs not to win so much, he can delete the prefs with the button `#btnClearScaling`. 

To reiterate:
- we do want the NoteDisplaySizes to hang together as a blob
- we do not want to affect the Theme automation.
- we do want to leave Theme automation out of this NoteDisplaySizes change. 
- Core change to infinite-neck.js is APPROVED.

## Help File Update

After coding, please add to `help.html` a new HTML table giving a User-facing description of the startup and song-open precedence at the end of section `<a name="startup"></a>`  before section `<a name="copy-paste-delete-undo-o-my"></a>`.

## Request

Having answered questions, and given approval, we now request that you proceed to coding.
