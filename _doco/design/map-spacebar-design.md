# Feature request: map spacebar

# Iteration 1: discussion

We would like a feature to allow mapping of the key-handler for the spacebar when focus is not in a control.  

It currently works that global key-handlers don't fire if the key is focused on a control. This is good.

When the spacebar is hit, we would then want one of these things to happen, shown with their menu-item triggers, and the menu item text in single quotes, followed after a colon by what you should programmatically do if the text is not obvious:

l) 'toggle looping'
b) 'toggle beat looping'
n) 'next beat'
>) 'next section' : Section is advanced and DaCapo:OnSectionBegin is fired
<) 'restart section' : Section is not advanced, but DaCapo:OnSectionBegin is fired.  (If possible without a bunch of wacky or brittle coding, reset at first beat. Otherwise, don't implement or install menu item.)
s) 'song restart' :  DaCapo:OnSongEnd is fired, and song is restarted from beginning of song at Section[0].  This may have to be sequenced differently, so that TransposePlugin and any others work correctly.
e) 'song end' : DaCapo:OnSongEnd is fired, and song is parked at Section[n-1].  If this is weird, may not be implemented.  We expect that the use-case will make sense, but it may not.
z) 'zero spacebar action' : nothing, and mapping is removed so that spacebar doesn't have a handler wired.

We will then need a static addition to menu.js so that the above menu items trigger.  They would call into key-handlers.js, which would map the actions.

The menu items would be installed with a parent as `m) map spacebar handler` so that this command-line command would get you to '/',  'run', 'map spacebar handler', 'zero spacebar action': 

`    /rmz`

## Request

No coding changes on this iteration.

Please provide analysis of this proposed feature.  Include especially an analysis of where firing events may miss the intended design, or potentially break looping or the plugins.  Include whether using the \< or \> characters would break menu handling. 

Please provide your report in currently empty `_doco/design/map-spacebar-design-copilot.md` in a new section with headers as needed.


# Iteration 2 : paring down to needed semantics


## Iteration Goal

Copilot's analysis revealed that many of the planned design actions would produce unstable or inconsistent results.  We don't want to invent any new paths or add complications to Looper.  However, there are a few actions that we have identified as missing.  This iteration will attempt to clarify which User-facing cases we truly need, and ditch everything else.    There are two categories:

1) "ConvenienceMapping" convenience mapping of existing loop, beat, and section controls to spacebar for ease of initiating that action from the large keyboard spacebar while also playing a physical musical instrument.  This includes navigation actions that should have been available in the UI previously, but were not made available because they weren't core requirements, or not imporant enough for valuable screen real estate in the Transport.  Any missing actions that are added are thus to be available on the command-line menu only, so no HTML UI changes are needed.

2) "NewActions" are actual actions that are not quite available in the existing keymaps or command-line.

For category 1, ConvenienceMapping, we accept Copilot's suggestions to map to existing actions.  We will also provide an updated menu structure below.  That menu structure will chose a different set of menu-item triggers than \> and \< and use a simpler single alphabet letter instead.  The commdand-line menus don't need any deletions, but some are shown withouth much context.  Focus on the new menu items, rather than the whole menu listing.

For category 2, NewActions, discussion follows.

## Design Assumptions
User navigation (song,section,beat) actions are allowed at all times: looping, beat looping, recording, plugins active, command-menus navigating.

Navigating to SongBegin should address these areas:
- DisplayOptions should be applied OnSectionBegin.  They may be currently managed with direct calls in infinite-neck, and should probably be migrated to using EventBus to trigger it.  We need to discuss this.
- OnSongEnd should not be fired when navigating backwards to the beginning of the Song or the beginning of the first Section.
- However, OnSongBegin and OnSectionBegin probably *should* be fired when navigating backwards to first Section or SongBegin.
- We don't want to add any EventBus events that aren't necessary to handle the current Plugins architecture and the current UI use cases already wired in.  This is a discussion point.  We have made a first pass in the [Looper States Table](#looper-states-table) section below.
- We do want to support Looper and Song/Section states that are logical to the User's mental model of the song, and that can make Plugin authors have access to all the needed states.
- Proposed events should be scoped in the existing framework.  They may need to live under the existing "Looper:" namespace.  DaCapo namespace should be reviewed to ensure that it is related to musical events (restarting a section, starting a song...), and Looper namespace should be related to the Looper and the Transport.  This should be reviewed and aligned in this iteration.

## NewActions

### RestartSong

We just need a way to advance backwards (rewind) to SongBegin and make sure DaCapo:OnSongEnd does *not* get fired, without having to play all the remaining Sections or parts of a Section.  In fact, this action should *skip* these remaining items, so that plugins may skip filling in notes, Sections may skip having DisplayOptions applied, and so on.  This would be tied to a menu such as `/fmR` shown below. 

- Probably implemented as new event "RestartSong"
- May be functionally equivalent to navigating to first section first beat.  Currently we feel that having a separate event will allow Plugin authors more granularity, but we don't have the justification nailed down.

## ResetSong
- Probably implemented with new event "ResetSong"
- Also available in flavor ResetSong(hard).  Could be implemented with a data item in event for OnResetSong, default would be not-hard.  The big current use-case is that TransportPlugin has two reset states: "original" which is how the user started the session, and "current" which is withing the current state created by setting "intervals" property--in this case, reset just goes back to intervals[0] but does not reset to "original".

### NextSongLoop

We need a way to advance forwards to the next SongBegin after SongEnd, and make sure DaCapo:OnSongEnd *does* get fired.  However, we don't think it is necessary or desireable to fire any plugin action or DisplayOptions or events for skipped beats and Sections.  This is primarily for the Looper while looping, but the state should make sense when the Looper is stopped.  It's not clear how TranposePlugin will behave, but somehow DaCapo:OnSongEnd probably *should* fire when the transport is advanced this way.


### TransposePlugin

TransposePlugin only acts on DaCapo:OnSongEnd, so we can currently fake this up by using `SHIFT+>` to go to the last Section, then repeatedly hitting `n` to get nextBeat to take us to the last beat, then TransposePlugin correctly fires at song end.

TransposePlugin already plays well with beat looping, and navigating to different sections because it doesn't care, and does nothing.  The widgets it provides already work and provide meaningful display during such navigation.

### ArpeggioPlugin

ArpeggioPlugin already plays well because it doesn't write notes permanently, and resets correctly on navigating to song begin. It does leave highlights in recorded notes, and this is a desired and designed feature.  We must ensure that one of the mappings is the same as `SHIFT+<` which goes to the song beginning.

ArpeggioPlugin should implement new event "OnSongReset" by doing its "Clear" action.

### FillPlugin

FillPlugin also plays well at going to the beginning of the song because it just reacts to entering the first Section as any Section.


FillPlugin should implement new event "OnSongReset" by doing its "Clear" action.

## Looper States Table

- Looper States, as seen by User or User's mental model.
- This should be edited to align with the reality of the code.
- *TODO: add column for key-handler mappings.*

| state | avail | menu | UI | notes |
| --- | --- | --- | --- | --- | 
| LoopSong       | 🗹 | /rl  | #transport:btnLoopSections ||
| SongBegin      | 🗹 | /rsf | #transport:btnFirstSection ||
| SectionBegin   |    |     |                           | works for sections[0] when btnPrevSection or btnFirstSection|
| FirstBeat      |    |     |                           | default spot, but no direct call |
| FirstSection   | 🗹 | /rsf | #transport:btnFirstSection ||
| PrevBeat       | 🗹 | /rbp | #transport:btnPrevBeat ||
| LastBeat       |    | /rbn | #transport:btnNextBeat ||
| PrevSection    | 🗹 | /rsp | #transport:btnPrevSection | |
| NextSection    | 🗹 | /rsn | #transport:btnNextSection ||
| LastSection    | 🗹 | /rsl | #transport:btnLastSection |  first beat of|
| LoopSection    |    |       |                        ||
| LoopBeats      | 🗹 | /re  | #transport:btnLoopBeats  | |
| RestartSection |    |      |                        | (plugins work because they work today when you do first section and you are already in first section) |
| RestartSong    | 🗹 | /rsf  | #transport:FirstSection | FirstSection works, but not dedicated |
| NextSongLoop   |    |       |                        | skips ahead, fires OnSongEnd |

## States grouped by object

Entries followed by \* are not implemented.

- Song
    -   Loop
    -   Restart *
    -   Begin
    -   LastBeat *
    -   NextSongLoop *
 
- Section
    -   First
    -   Next
    -   Prev
    -   Last
    -   Restart *
    -   LoopSection *
 
- Beat
    -   First *
    -   Next
    -   Prev
    -   Last *
    -   LoopBeats


## Command-line menu additions

- Functions (make available through /run/section or /run/beats and /section/nav or /section/beats with user input value "n")
  - gotoBeat n
  - gotoSection n

- new Song Looper events
  - restart (goto sections[0] beat[0] does not fire DaCapo:OnSongEnd)
  - reset (go to sections[0] beat[0] and Clear any plugin values added, such as owner: items, Transport only does reset current.)
  - reset hard (mostly for Transpose which will implement event with resetting to original)


First menu item is mounted here as "/", "file", "map spacebar": /fm

- f) file
  - m) map spacerbar
    - R) restart song (w/o DaCapo:OnSongEnd)
    - r) restart Section (begin Section / firstBeat)
    - z) reset song
    - Z) reset song hard
    - u) unset spacebar

These menus under "/" should be updated

- r) run
  - s) section
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n 
  - b) beats
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n  

- s) section
  - n) nav
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n 
  - b) beats
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n 
    - a) add
    - d) delete
    - '0') insert first
    - i) insert beat   

## Request

Copilot, please process Iteration 2, and put a report in `_doco/design/map-spacebar-design-copilot-2.md`

Please ditch most assumptions from Iteration 1 as clarified in our Iteration 2 in this document.  Your report can assume that the Iteration 2 document is how we want things, and only refer to features in Iteration 1 if they seem truly missing from what is needed by Iteration 2, or if the danger exposed in Iteration 1 persists in Iteration 2.









