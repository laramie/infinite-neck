# Feature request: map spacebar

## Iteration 1: discussion

We would like a feature to allow mapping of the key-handler for the spacebar when focus is not in a control.  

It currently works that global key-handlers don't fire if the key is focused on a control. This is good.

When the spacebar is hit, we would then want one of these things to happen, shown with their menu-item triggers, and the menu item text in single quotes, followed after a colon by what you should programmatically do if the text is not obvious:

l) 'toggle looping'
b) 'toggle beat looping'
n) 'next beat'
>) 'next section' : Section is advanced and DeCapo:OnSectionBegin is fired
<) 'restart section' : Section is not advanced, but DeCapo:OnSectionBegin is fired.  (If possible without a bunch of wacky or brittle coding, reset at first beat. Otherwise, don't implement or install menu item.)
s) 'song restart' :  DeCapo:OnSongEnd is fired, and song is restarted from beginning of song at Section[0].  This may have to be sequenced differently, so that TransposePlugin and any others work correctly.
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

Copilot's analysis revealed that many of the planned design actions would produce unstable or inconsistent results.  This iteration will attempt to clarify which User-facing cases we truly need.  There are two categories:
1) "ConvenienceMapping" convenience mapping of existing loop, beat, and section controls to spacebar for ease of initiating that action from the large keyboard spacebar while also playing a physical musical instrument
2) "NewActions" actual actions that are not quite available in the existing keymaps or command-line.

For category 1, ConvenienceMapping, we accept Copilot's suggestions to map to existing actions.  We will also provide an updated menu structure below.  That menu structure will chose a different set of menu-item triggers than \> and \< and use a simpler single alphabet letter instead.

For category 2, NewActions, discussion follows.

## NewActions

### TransposePlugin

TransposePlugin only acts on DeCapo:OnSongEnd so we just need a way to advance to SongBegin and make sure DeCapo:OnSongEnd got fired, without having to play all the remaining Sections or parts of a Section.  This would be tied to a menu such as `a) advance to next song loop`.  We can currently fake this up by using `SHIFT+>` to go to the last Section, then repeatedly hitting `n` to get nextBeat to take us to the last beat, then TransposePlugin correctly fires at song end.

TransposePlugin already plays well with beat looping, and navigating to different sections because it doesn't care, and does nothing.  The widgets it provides already work and provide meaningful display during such navigation.

### ArpeggioPlugin

ArpeggioPlugin already plays well because it doesn't write notes permanently, and resets correctly on navigating to song begin. It does leave highlights in recorded notes, and this is a desired and designed feature.  We must ensure that one of the mappings is the same as `SHIFT+<` which goes to the song beginning.

### FillPlugin

FillPlugin also plays well at going to the beginning of the song because it just reacts to entering the first Section as any Section.

## Table of all Looper states, as seen by User

- This should be edited to align with the reality of the code.
| state | avail | notes |Cmd | Key| UI |
| --- | --- | --- | --- | --- | --- |


| LoopSong     | 🗹 | | Transport:btnLoopSections
| SongBegin    | 🗹 | | Transport:btnFirstSection |
| SectionBegin |    | 
| FirstBeat    |    | default spot, but no direct call |
| FirstSection | 🗹 | Transport:btnFirstSection
| PrevBeat     | 🗹 | Transport:btnPrevBeat |
| LastBeat     |   | Transport:btnNextBeat |
| PrevSection  | 🗹 | Transport:btnPrevSection | 
| NextSection  | 🗹 | Transport:btnNextSection |
| LoopSection  |   | Transport:btnLastSection |
| LoopBeats    | 🗹 | Transport:btnLoopBeats | 
| RestartSection |    | (plugins work because they work today when you do first section and you are already in first section) 
| NextSection  | 🗹 | 
| RestartSong  | 🗹 | works | Transport:FirstSection works|
| NextSongLoop |   | skips ahead, fires OnSongEnd |
| LastSection  | 🗹 | first beat of|





