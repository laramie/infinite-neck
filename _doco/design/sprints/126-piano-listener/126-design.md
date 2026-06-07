# Design

## Iteration 1: Define the problem

When a Piano is a Listener of a Guitar, it is currently only listenening to notes on the first string, because a piano has "one string".  We want to include a checkbox or something on the Wiring options panel that allows the Listener to chose an algorithm that maps all playedNotes by MIDI number only, ignoring row and col.  It would chose to listen in order from low string to high string or from high string to low string on the source instrument, since notes will clobber earlier listened notes with this algorithm. 

We could put it in a ListenerPlugin if the algorithms got varied, but we think that if it could be contained to just listen in one string order or the other, and it could be contained in a routine or two, or a helper module, then we would not do it as a plugin.

Without coding changes, can you sketch out how we would do this, and which core files need to be changed?  

Please write the sketch as `_doco/design/sprints/126-piano-listener/126-sketch.md`

Iteration 1 completed with Copilot writing [design sketch](126-sketch.md)

## Iteration 2: Final Design + Implementation Plan

NOTE: Sprint has been promoted from sprint-903-piano-listener to sprint-126-piano-listener and is scheduled for implementation plan and subsequent cooding.

Here are the questions from the design sketch: 

1) Should the new mode affect only played notes, or should recorded highlights eventually follow the same MIDI-only projection rule? ANSWER: If recordedNotes and Highlights can be done, they should be included.  Now that we see the scope, we are changing that spec.

2) For multi-row non-piano targets in MIDI-only mode, is "first matching target cell" acceptable, or do we want a more musical preferred-row rule now?  ANSWER: First matching target cell is acceptable.  This is mostly for Piano Lineage instruments.  If other instruments seem to work out, we can tweak them later.

3) Do we want the UI label to say "string" or "row"? The user-facing language should probably stay musical and say "string" even though the model stores rows. ANSWER: User-facing is "string".

4) Should the persisted field name be explicit like listenerProjection, or shorter like listenMode? ANSWER: listenerProjection.

Additionally: 
- yes, a SELECT must be used instead of a checkbox.  This is better than a Radio Group.
- yes, not a plugin.  Especially with keeping algorithm in move-helper.js .
- yes, in move-helpers.js, with tight changes in the other core files.
- good catch on sorting source strings by starting pitch.  `ChapmanStick` is a particularly nasty one, but can be normalized when thought of as just a collection of string that all have a starting pitch.

For Iteration 2, please produce implementation plan in [implementation plan](126-implementation-plan.md) .

We will then approve and proceed to coding in Iteration 3.

## Iteration 3: Implementation, coding, testing

Implementation and coding have been successful, following [implementation plan](126-implementation-plan.md) 

UI Acceptance testing lead to the installation of this songfile fixture, which shows the Piano listening to a P46 Guitar: 

`songs/tests/piano-listener-guitar-wite-out-fixture.json`

During testing, we had two post-implementation code changes.  We are calling those Iteration 4 and Iteration 5.

## Iteration 4: Installing test fixtures

We have added an older test fixture file into the list of files to be tested, and have added a new one `songs/tests/piano-listener-guitar-wite-out-fixture.json` that has a new wiring.  This new file passes UI Acceptance testing of sprint-126.  We'd like you to incorporate it as a test fixture for this sprint.  Along the way, we've broken the song test.  This may be because we haven't installed it correctly in 

`songs/tests/test-song-list.json`

for 

`_tests/jest/song-load-library.test.js`

Please see if you can fix our error installing these two files, and please see if the new file helps you with the Jest testing for sprint-126.

### Response: 

Fixed.

Root cause:
1. The two fixture files were already installed correctly in test-song-list.json.
2. The actual failure was schema validation, not list registration.
3. Both fixtures include `tonalSourceSet` inside `sectionNotesByTable`, but the V2 schema in song-file-schema.js did not allow that field.

What I changed:
1. Updated song-file-schema.js to allow `tonalSourceSet` in `sectionNotesSchema`.
2. Added a focused sprint-126 load test in song-api-load-V2.test.js for piano-listener-guitar-wite-out-fixture.json.
3. The new test verifies:
   - the fixture loads
   - the wiring carries `listenerProjection: "midi-low-to-high"`
   - `tonalSourceSet` survives load on sections that use it

Validation run:
```text
./run-jest.sh _tests/jest/song-load-library.test.js _tests/jest/song-api-load-V2.test.js --runInBand
```

Result:
1. song-load-library.test.js passed
2. song-api-load-V2.test.js passed
3. 44 tests passed total

Conclusion:
1. The new fixture is now incorporated into Jest coverage for sprint 126.
2. The older fixture failure was fixed by bringing the schema back in sync with persisted song fields.
3. No further change to test-song-list.json was needed.


## Iteration 5: extending section-printer to display "owner"-tagged Notes

While testing we noticed with joy that notes recorded into the Model for P46_1 are correctly Listened to by Piano_1.  This is great because we knew that making ArpeggioPlugin Listener-aware would be pure spaghetti.  This elegantly solves this use-case we thought we'd never want to touch.  Yay!

However, it does make us want to be able to point out temporarily owned notes to the User, when they are looking at the most close-to-the-Model representation (other than /vdf and friends) which is section-printer's output in Chart > Notes.  The column `rec` (with class SPN_RN) for an Instrument shows notes by beat.  We'd like to have notes output in that view column to be wrapped in a span we can style, while ensuring that the note arrays computed there don't get polluted since they are used to pass to Tonal.js.

We'd like to see any note "owned" by anyone to be wrapped in  a span with a class we can style in section-printer.css : 

```
{
                "noteName": "C",
                "styleNum": 4,
                "midinum": "60",
                "row": "2",
                "col": "5",
                "owner": "ArpeggioPlugin"
              }
```
should be output under `<div class="SPN_RN">` where they are now, but with 

`<span class="SPN_OWNED">C</span>` 

We'd like the initial values in section-printer.css to be:
```
.SPN_OWNED {
 color: magenta;
 font-weight: bold;
}
```

If that means that there are two `C` notes, one with "owner" and one without, then two notes should appear in the View in Chart > Notes -- one with the style span, one without.  But again, that should not change what is sent to Tonal.js.  It is User-facing View only, and only on this tab page.

At this point we don't need the information that the owner is ArpeggioPlugin, we just want to see which notes might go away if someone hits "Clear" in the plugins.

Please check the plugins for additional columns that need this same styling.  The FillPlugin seems to do it for namedNotes and playedNotes.  Any plugin that leaves "owner" around after looping stops should cause this styling.



