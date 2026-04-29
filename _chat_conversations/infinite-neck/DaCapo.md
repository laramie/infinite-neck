## Laramie Request 

- Date: 20260329

DaCapo implementation.

We want a new implementation similar to a plug-in.

We could hardcode some of the below patterns, but we want to keep it structured like plugin framework, so that we can add more plugins, and extend the framework as we see how the parameters are specified, how they are passed to the command-line (key-handlers.js, command-line.js, menu.js)

It will be called DaCapo.  It will be a class.

It will live in the plugins folder in the file ./plugins/DaCapo.js

it will plug into various cut points in the Looper (looper.js) .

We want recommendations on where these cut points in looper.js and song.js will be.

And we want a first-iteration implementation in DaCapo.js.

Some of these may require EventBus (event-bus.js) events triggered from song.js

We will need an enum with [ ON_SECTION_BEGIN, ON_SECTION_END, ON_SONG_BEGIN, ON_SONG_END ] . The actual type of this enum will depend on what makes sense as the implementation develops:  whether it's a map or an array or just constant integers.

Our first implementationWill be to handle  ON_SONG_END  by calling infinite-neck.js::transposeSong(amount) that should be passed some amount.  ON_SONG_END is defined when the Looper has hit the last beat in the last Section, and before it triggers song.gotoNextSection(true), but it may need more knowledge from Song than it currently gets.

This amount (and in the next iteration, an array of section numbers), should all be parameters that can be sent to DaCapo.  All parameters should be string representations, so that a user can specify, via a command-line "[1,2,5]" as the array of Sections, for example.

In our test-harness, let us assume that we will call it with:

   let daCapo = new DaCapo();
    ....
    let amount = 1;
    let sections = "[]"; //empty array means "all sections"
   daCapo.installHook(DaCapo.ON_SONG_BEGIN, amount, sections);
    restartLoopSections(); //from import { restartLoopSections } from '../looper.js';

In this implementation, daCapo will listen for events from the EventBus, triggered by Looper and Song, and synchronously call
   transposeSong(amount);

You may put any patches, implementations, and code in plugins/DaCapo.js.

Do NOT put any code in song.js, looper.js or other existing modules.  Please prepare code-snippets and recommended cut points here in the chat, as these modules are getting big and tricky.

Please hit us up with any questions needed for a meaningful implementation, or features or details that we have missed in our specification.


## Copilot (GPT-5.4) Response

I’m implementing the first DaCapo plugin class in the plugin file only, and I’m checking the existing plugin file so the implementation stays isolated and doesn’t assume changes in other modules.

Read [](file:///home/laramie/infinite-neck/plugins/DaCapo.js)

Read [](file:///home/laramie/infinite-neck/event-bus.js)

Read [](file:///home/laramie/infinite-neck/looper.js)

I have enough context now. I’m adding a self-contained DaCapo class that subscribes to EventBus hook points, parses string-based parameters, and executes the first supported action for `ON_SONG_END` without touching the larger modules.

Generating patch (166 lines) in [](file:///home/laramie/infinite-neck/plugins/DaCapo.js)


The plugin file is in place. I’m validating it for syntax and then I’ll give you the cut-point recommendations and minimal integration snippets for the larger modules without modifying them.

Checked [](file:///home/laramie/infinite-neck/plugins/DaCapo.js), no problems found

Read [](file:///home/laramie/infinite-neck/plugins/DaCapo.js)

Read [](file:///home/laramie/infinite-neck/song.js#720-720), lines 720 to 770

Implemented the first DaCapo plugin class in DaCapo.js.

What is in the first iteration

1. A DaCapo class with hook-point constants:
   ON_SECTION_BEGIN
   ON_SECTION_END
   ON_SONG_BEGIN
   ON_SONG_END

2. EventBus integration only
   The plugin subscribes to EventBus events and does not require direct calls from looper or song.

3. String-based parameter handling
   amount is normalized from a string-like value
   sections is parsed from a JSON array string such as [] or [1,2,5]

4. First supported behavior
   ON_SONG_END synchronously calls transposeSong(amount)

5. Lifecycle helpers
   installHook
   uninstallHook
   clearHooks
   dispose
   static emit

Important detail

Your example harness uses ON_SONG_BEGIN, but the behavior you specified for the first iteration is ON_SONG_END. The class supports both hook names, but only ON_SONG_END currently performs work.

Recommended usage

    import DaCapo from '../plugins/DaCapo.js';
    import { restartLoopSections } from '../looper.js';

    const daCapo = new DaCapo();
    daCapo.installHook(DaCapo.ON_SONG_END, '1', '[]');
    restartLoopSections();

Recommended cut points

I did not modify the large modules, per your instruction. These are the cut points I recommend.

Looper cut points

1. Song begin
   In startLoopSections, after the looper is switched on and before the interval starts, emit:
   DaCapo:OnSongBegin

   Why:
   That gives plugins a clean “transport just started” semantic instead of inferring from beat and section state.

2. Section end
   In tickBeat, inside the branch where beat >= beats and before any section change happens, emit:
   DaCapo:OnSectionEnd

   Why:
   This is the last moment where the outgoing section is still current.

3. Song end
   In tickBeat, specifically in the branch where:
   beat >= beats
   sectionsLooping is true
   current section is the last section
   and before song.gotoNextSection(true)

   emit:
   DaCapo:OnSongEnd

   Why:
   That matches your requested semantic exactly.

4. Section begin
   In tickBeat, after the move to the next section completes, emit:
   DaCapo:OnSectionBegin

   Why:
   This gives plugins a clean point after section navigation has committed.

Minimal looper snippet

    import EventBus from './event-bus.js';

    export function tickBeat(song, { sectionsLooping, showBeats }) {
        var beat = song.getBeat();
        var beats = song.getBeats();

        if (beat >= beats) {
            const currentSectionIndex = song.getSectionsCurrentIndex();
            const sectionCount = song.getSections().length;
            const isLastSection = currentSectionIndex >= (sectionCount - 1);

            EventBus.trigger('DaCapo:OnSectionEnd', {
                sectionIndex: currentSectionIndex,
                sectionCount,
                beat,
                beats
            });

            if (sectionsLooping) {
                if (isLastSection) {
                    EventBus.trigger('DaCapo:OnSongEnd', {
                        sectionIndex: currentSectionIndex,
                        sectionCount,
                        beat,
                        beats
                    });
                }

                song.gotoNextSection(true);

                EventBus.trigger('DaCapo:OnSectionBegin', {
                    sectionIndex: song.getSectionsCurrentIndex(),
                    sectionCount: song.getSections().length,
                    beat: song.getBeat(),
                    beats: song.getBeats()
                });
            } else {
                song.incBeatLoop();
                showBeats();
            }
        } else {
            song.incBeatLoop();
            showBeats();
        }
    }

Minimal startLoopSections snippet

    import EventBus from './event-bus.js';

    function startLoopSections(){
        looperProviders.showBPM();
        var caption = LOOPING_FRAMES_CAPTION;
        var song = looperProviders.getSong();
        if (song && song.randomLoop){
            caption = LOOPING_FRAMES_CAPTION_RANDOM;
        }
        looperProviders.setLoopSectionsButton(caption, true);

        if (song) {
            EventBus.trigger('DaCapo:OnSongBegin', {
                sectionIndex: song.getSectionsCurrentIndex(),
                sectionCount: song.getSections().length,
                beat: song.getBeat(),
                beats: song.getBeats()
            });
        }

        var millisNextBeat = looperProviders.getMillisForBeatClock();
        showBeatsIntervalPointer = looperProviders.setLoopInterval(showBeatsIntervalHandler, millisNextBeat);
    }

Song cut points

If you want plugins to also react to manual navigation, then song.js should emit section lifecycle events too.

Recommended song.js cut points:

1. In gotoSection, after gSectionsCurrentIndex changes and before UI replay:
   emit section begin

2. In gotoNextSection and gotoPrevSection:
   emit section end before the index changes
   emit section begin after the index changes

3. If you want “song begin” to include manual first-section navigation, emit from firstSection when appropriate

My recommendation:
Keep transport lifecycle in looper.js.
Keep manual navigation lifecycle in song.js.
Do not try to make one file own both concepts.

Suggested payload contract

Use one shared payload shape for all DaCapo events:

    {
        hookPoint: 'ON_SONG_END',
        sectionIndex: 5,
        sectionCount: 6,
        beat: 4,
        beats: 4,
        willWrap: true,
        isRandomLoop: false
    }

That keeps plugins decoupled from Song internals.

Observations on the current design

1. The plugin file imports transposeSong from infinite-neck.js
   That is acceptable for a first iteration, but longer-term I would move to injected actions/providers so plugins depend on a narrower interface.

2. sections is parsed now but not applied yet
   That matches your requested first iteration. If a non-empty sections array is passed during ON_SONG_END, the plugin currently warns and still transposes the whole song.

3. The current event naming is explicit
   DaCapo:OnSongBegin
   DaCapo:OnSongEnd
   DaCapo:OnSectionBegin
   DaCapo:OnSectionEnd

   That is preferable to generic names because it avoids collisions as more plugins arrive.

Questions that matter before the next iteration

1. Should section numbers in the sections parameter be 0-based indexes or 1-based user-facing section numbers?

2. Should ON_SONG_BEGIN fire only when restartLoopSections or toggleLoopSections starts transport, or also when looping wraps from the last section back to the first?

3. For ON_SONG_END, should the transpose happen before wrap only, or also when randomLoop is active and the last section happens to be reached?

4. Do you want plugins to be able to veto or alter looper behavior later, or only observe and react?

Validation

I checked DaCapo.js for errors after the edit. No syntax errors were reported.

Natural next steps

1. I can prepare the exact looper.js patch for the recommended cut points, but leave it unapplied for your review.
2. I can implement a second plugin-manager layer so DaCapo becomes one plugin among many instead of each plugin subscribing directly to EventBus.
3. I can extend DaCapo so the sections parameter actually filters which sections get transposed.

Made changes.

## Laramie Request 2

DaCapo:OnSongBegin is confused with something that should be called DaCapo:OnTransportStart.
