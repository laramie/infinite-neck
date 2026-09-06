# Purpose

In this iteration we are integrating the real device "VoiceLive 3" as our sound output device, using Section info plus Notes inbound from the Launchpad.  

We talk to the real device "VoiceLive 3" over a Class-Compliant cable, which acts like a MIDI receiver as though it is its own device, but really it sends everything on to the VoiceLive.  We need to get the outputs and clears from infinite-neck forwarding MIDI notes to be exactly like how the Launchpad would send MID if it were wired straig(ht into the MID port of the VoiceLive 3.

# Files

We are specifying Iteration 5 here.  We will keep working on this document through Iteration-Rounds. 

Copilot, please keep track of implementation steps you have taken per-Round here: [143-it5-copilot-plan.md](143-it5-copilot-plan.md), with new Heading sections for each Round you implement.

# Requests

1. We are now specifying Iteration 5, Round 1.  Please proceed to coding, and keep track of design/forwarding/integration rules as you find and refine them going forward.  At the end of this Iteration, we'll want a document stating the rules.

# Scenarios

We need to deal with two realities: 
1. Pressing buttons in the main 8x8 grid area of the Launchpad should send true MIDI scale notes to the VoiceLive.  In Programmer Mode of the Launchpad, these are row/column encoded, but we already translate these to true MIDI pitches (Middle C == 60 decimal).
2. Pressing bottons on the Launchpad also sends those translated notes to the Section/Song, and we deal with these in a separate handling.

Both of these realities need to exist.  That is why we have a "forward" feature.  Once the notes are translated, we can send them on.  But we need to do a bit more rule-based editing:
- User presses Middle C, which comes in as some row/column encoded note value.
- If NamedNotes are selected in the palette, then the Section will create NamedNotes.
- However, we can not send NamedNotes as such to the VoiceLive.  The User has really clicked one VoiceLive button, so *that* is the one that goes through to the VoiceLive.  The octaves calculated for the Section (C == 80 ==> [36,48,60,72]) should *not* be sent since the rule is: "one Launchpad button == one MIDI NOTE ON".
- If Single, Tiny, Bend, Fingering are sent, forward that one note.
- If Pitch note type is sent, that  is really one midi pitch, so send that note.
- If Multi note type is sent, send the note pressed, regardless of how many highlights have accumulated in the song.
- On tick beat and friends (i.e. replay() ), do *not* re-send pitches through the forwarding channel.

This last rule, "Do not replay notes through the forwarding channel" is a tricky one, because at some point we may want to do exactly that.  But the VoiceLive is limited to creating sound for maximum four notes "ON".  So we want Launchpad-button-up messages to translate to NOTE ON 0 messages, and these should forward correctly to the VoiceLive.  So we are constantly clearing because any Launchpad buttons pressed are then released.  This is currently handled by both Latch and Momentary by using the rules of the td.note click.  We just need to ensure that the NOTE OFF/NOTE ON 0 messages all go through in the right scenarios so the VoiceLive doesn't accumulate more than 4 active notes.

Defensively, after our debugging is through, we'll adopt a "send `CC 123 127` on every Section change", and we'll map a Launchpad button and a UI button to do it also.  The most important thing with this audio gear in performances is being able to clear held notes immediately.  Not having notes is no fun, but having a note that won't let go is a disaster.  But that's not going in to the code yet.

# Features

## Iteration 5, Round 1

These features are ready for coding in Round 1.

### CC_AllClear

- This sequence is sent from Launchpad when the control button in column 0, row 8 is pressed.  
```
2109.850 receive [B0 50 7F] Launchpad Pro Standalone Port
2110.015 receive [B0 50 00] Launchpad Pro Standalone Port
```

So we want to wire this button, similar to how Clear, Rec, and Momentary are wired through column 0, rows 1,2,3
- This new button is doing action CC_AllClear for naming purposes.
- When this new button is pressed, send CC 123 127 on the forwarding output.

### Mouse Clicks silent

Any creation or removal of notes through the UI should *not* be forwarded.  Only buttons on the Launchpad sending NOTE messages are forwarded, after translation and rules.

### Debug output versus wired output

There is currently some confusion about setting up the main wiring versus debug panels.
- "MIDI OUT" seems to be necessary (especially setting "Launchpad Pro Standalone Port") when wiring the Launchpad to infinite-neck.
- "MIDI OUT" can then be reset to "CH345 MIDI 1" to send debug commands directly to CH345 thence to VoiceLive.  But we are unsure of the effect of two uses for one panel.  We'd prefer a second panel for debuggin, and a separate "Output device" select box for when wiring.
- Presumably, after wiring, we can re-use the debug panel to talk to any device, including either the VoiceLive *or* the Launchpad, without messing up the wiring, because that's what's happening right now and is useful.

### Prefer NOTE ON 0 to NOTE OFF

The VoiceLive seems to prefer `NOTE ON pitch 0` rather than `NOTE OFF pitch`.  
This sequence shows we are using NOTE OFF messages: 
```
2963.836 send    [90 2B 3C] CH345 MIDI 1 pitch:43
2963.841 fwd-on  [90 35 72] CH345 MIDI 1 pitch:53
2963.919 receive [90 2B 00] Launchpad Pro Standalone Port pitch:43
2965.434 receive [90 2B 5D] Launchpad Pro Standalone Port pitch:43
2965.448 send    [90 2B 00] CH345 MIDI 1 pitch:43
2965.454 fwd-off [80 35 00] CH345 MIDI 1
2965.524 receive [90 2B 00] Launchpad Pro Standalone Port pitch:43
```
Fixing that now would clean up a lot of the problems we are having integrating.

## Iteration 5, Round 2

The CC_AllClear is working.  We'd like to have it permanently lit (lit at initialization, and reset on every button release) with LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_GREEN.  When the User presses it, it should go LAUNCHPAD_MAJOR_COLOR_VELOCITIES.MAGENTA while pressed, then resume LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_GREEN when released.

The latency is killing us.  We need to do the forward first thing, even async if necessary.  But the forward is what creates the soundd in real-time, so it must be critical-path.

## Iteration 5, Round 3

### Speeding up batch lighting.

Since the time spent in sending lots of individual notes is high, the user manual for the Launchpad Pro gives us the SysEx messages to use:

```
Lighting LEDs Using SysEx Messages

It is possible to control Launchpad Pro’s LEDs using SysEx messages. This allows a number of LEDs to be
updated quickly in a single message. In this SysEx message, the index of the LED is taken to be the same as
Programmer layout, regardless of the currently selected layout. This is also applicable to the round buttons,
with the LED index using the same value defined in the Programmer layout. Please refer to figures 14 and
15.

Note that the SysEx LED message will override the colour of the specific pad LED, regardless of the previous
colour (including the special round cursor buttons.) However, if those buttons are subsequently pressed and
released, the LEDs will return to the official colour of that button. (i.e. The SysEx message LED colour will be
overridden by the default colour for that specific button on that layout.)

- Light LED using SysEx

The side LED can also be updated by this message. It has an LED index of 99 (63h).

  Host >> Launchpad Pro: F0h 00h 20h 29h 02h 10h 0Ah <LED> <Colour> F7h
                         (240,0,32,41,2,16,10,<LED>,<Colour>,247)

<LED> <Colour> pairs may be repeated up to 97 times in the message.

- Light a column of LEDs using SysEx

Columns are numbered left to right, 0 – 9, with 0 and 9 referring to the round buttons. The sequence of LED
colours starts at the lowest LED, with the next colour referring to the next higher LED in the same column.
However, the LEDs that are missing from the corners (in the columns of round buttons) still occupy a
position in the message. They just cannot be seen. Also, the side LED cannot be updated by this message.

  Host >> Launchpad Pro: F0h 00h 20h 29h 02h 10h 0Ch <Column> <Colour> F7h
                         (240,0,32,41,2,16,12, <Column>, <Colour>, 247)

The <Colour> parameter may be repeated within the message up to 10 times.

-  Light a row of LEDs using SysEx

Rows are numbered bottom to top, 0 - 9, with 0 and 9 referring to the round buttons. The sequence of LED
colours starts at the most left LED, with the next colour referring to the next LED to the right in the same
row. However, the LEDs that are missing from the corners (in the rows of round buttons) still occupy a
position in the message. They just cannot be seen. Also, the side LED cannot be updated by this message.

  Host >> Launchpad Pro: F0h 00h 20h 29h 02h 10h 0Dh <Row> <Colour> F7h
                         (240,0,32,41,2,16,13,<Row>,<Colour>,247)

The <Colour> parameter may be repeated within the message up to 10 times

Light all LEDs using SysEx

The side LED cannot be updated by this message.

  Host >> Launchpad Pro: F0h 00h 20h 29h 02h 10h 0Eh <Colour> F7h
                         (240,0,32,41,2,16,14,<Colour>,247)

The <Colour> parameter cannot be repeated in this message

```

This should be part of Launchpad's Programmer Mode profile.  We should be able to switch between SysEx and simple NOTE OFF with a checkbox in the UI that gets us wired with Programmer Mode.  When checked, bulk OFF messages should use this.  Individual forwards are better off always using NOTE ON/NOTE ON 0 sequence we have been working with .  So this feature would be used when looping and replaying notes, which go to the lights but not the VoiceLive.  It sounds like it will be possible to paint and clear LEDs on the Launchpad this way, so we'd do that
 for the replay().

### Ignore Aftertouch

Don't waste any time on these messages, VoiceLive doesn't use "Aftertouch" which is what these are.  They mean the User is holding hte button down, possibly varying pressure. So the parameter is pressure.  But VoiceLive doesn't respond, so we'd like to throw these away as soon as possible and not clog up our critical path.  A checkbox with label "Filter Aftertouch" near the log clear button would mean "completely ignore this message and don't log it", and unchecked would mean do log it, although we still aren't doing anything with them.

```
335.692 receive [D0 35] Launchpad Pro Standalone Port
335.721 receive [D0 28] Launchpad Pro Standalone Port
335.769 receive [D0 1C] Launchpad Pro Standalone Port
```

## Iteration 5, Round 4

### Output LED Optimization

Sending NOTE ON to the Launchpad physically lights the LED at that 8x8 grid button on with the color encoded.  So flashing an LED equals turing on a note with a velocity.

We never need greater resolution than the beats of a song.  If everything happened on the beat within a time that is discernable, then that's the greatest time resolution.  There are no 1/32 or 1/64 notes in our software.  The beat is the fundamental interval.

Currently, flashing the LEDs when there are many in separate messages happens on the Launchpad in a long sequence of discerable wall-clock time, so the begin and end paint/light moments can be seen as a clear sequence of events, taking a total time for the paint to be almost a half or a whole beat. Very discernable and distracting, since humans play music in manipulating objects in the timeframes of 1/1000 of a second being discernable, 1/100 of a second being visible, 1/10 of a second being operable, so we interact best when echos in a UI are less than 1/10 of a second.

These lights have a latency in the 1/100 to 1 second, both for Momentary and Latched notes when the system traffic is high.  

And they routinely have 1 second replay() ==> paint ==> light LEDs for a Section, which is problematic at 60 BPM. This is our biggest and most sluggish system delay.

So we want to try SysEx for these when painting because of Replay.  Single notes played should go out when they go out.  A User may only meaningfully press up to 4 notes simultaneously.

So we'd think some kind of in-memory structure is called for when optimizing for the 8x8 grid, and the notes that replay() called for, that at the end of replay() you'd call with rows sliced up however the most efficient write is and necessary for SysEx.  If possible as a matrix, then the matrix, but if only possible by rows or columns, then sliced up.

And, Yes, we do want to wait on repainting control notes when doing SysEx.  They are currently re-lighting as needed.