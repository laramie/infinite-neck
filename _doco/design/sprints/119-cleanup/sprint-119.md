# sprint-119-cleanup

This sprint is a grab-bag of cleanup and fixes in preparation for the rollout of Version 2. See the discussion in sprints.md.

Specific work alloted to this sprint is broken into Iterations.  See the Iterations sections below.

# Iterations

Here are the work items, grouped by status.

## Complete

- Iteration 1: /ch should also be fullscreen aware.  Weird that it affects fullscreen when not fullscreen, and doesn't hide non-fullscreen. 
  - DONE.

- Iteration 2: Track down and supress or replace message: "noteRoot:undefined" Chart>Notes>Chords per instrument.  If no noteRoot found, should just be silent.  
  - DONE.

- Iteration 3: finish the coding of `section-status-vertical-widget` and friends, and sync with `.SongTitleLeadSheet` widget area, probably ditching the hand-coded LooperLight, and Key indicator. 
    - make the title and the looper light be in the same vertical column on the LHS of the Instrument.
    - ensure that the title in vertical mode in the instrument doesn't creep up above the table, leaving a space at the top.
    - Add optional beat counter to looper light. Add "Show LooperLight Beats" after "Piano Width Scale Factor". 
    - See: [119-it3-design.md](119-it3-design.md)
  - DONE

- Iteration 4: clean up ArpeggioPlugin handling of "Clear" and Song Reset, specifically /fpaC.
  - See: [Iteration 4 notes](119-it4.md)
  - DONE

- Iteration 5: /sei :: instrument clone-into-Section and Clear-from-current-Section. 
  - See: [Iteration 5 /sei](119-it5.md) 

- Iteration 6: Clip recordedNotes/beats
  - See: [Iteration 6 Clip recordedNotes/beats](119-it6.md) 
  - Iteration pre-6 was implemented, so now REC has real state in Song.
  TODO: add SHIFT-R for REC mode
  add clone into different table in Section where legacy is the same

- Iteration 7:
  - autoColor, currentColorDict labels in View page and dirty flag updating.
  [controls away from View page: 119-it7.md](119-it7.md) 

- Iteration 8:
  - color palette tweaks, including MiniPalette live links.
  - [Iteration 8 chat log](119-it8-chat.md)  


### Complete (without Iteration number)

#### menu prompt stale sometimes
  - specific bug introduced by command-line one-line is FIXED.  
  - CLOSED. Keep an eye out for other use-cases, such as in Plugins.

#### palete KEEP, etc. should get a highlight ring so that KEEP is not so unexpected
  - COMPLETE (actually a complete refactor of the four radio buttons)

#### default spacebar to looper is getting trapped so you must hit ESC to use it again.
  - CLOSED. Can't replicate. [EDIT 20260627: actually this happens when LOOP button gets focus, so that SPACE triggers it.]

#### in /fpoa "Refresh" should be "Refresh [section 1]" 
  - DONE
#### command line loses LHS tracks when we go into short and one-line.
  - FIXED

#### If you start /fpa on Piano, then change Instrument to guitar, it retains that its strings range is 1:1. changing instrument should upgrade strings to the number of that instrument's capacity.
  - FIXED

#### Add menu choices and action to /vmo "o) opacity" to set this: 
  - "1) 100% 2) 95% 3) 90% 4) 85% 5) 80% 6) 60%  v) value"
  - ".CmdMenuClass {opacity: 85%;....}"
  - COMPLETE

#### When not in presentation mode and first section has saved DisplayOptions, apply width and height once.  (Otherwise they are never saved or restored.)
  - COMPLETE, with a different strategy.  Now every Section looks back to DisplayOptions properly.

#### add verb under Clip to "Copy all Listened notes in song into this Listening/wired instrument"
  - DONE : /fpcL, and also "Capture" button in Wiring.

#### Make Find Color work for other Note types than just NamedNote.
  - COMPLETE

#### Add MUTE and CAPTURE buttons to Wiring
- Leave 'Wired' wired, but allow MUTE to override.  CAPTURE does Listener paste.
- COMPLETE 
  

#### In Chart Notes, we need a link next to the TH for "Caption" that toggles "hide"/"show" so you can hide the caption except for the first 10 characters then "...". The Captions get so long they blow out the width of the table.  Wrapping wouldn't help because then the rows would get tall.
  - DONE.  Used max-width instead on SPN_CAPTION.

#### In Chart Notes, you can select tonalResultSet of "Tiny".  Since TinyNote  follows LeadKey, when you select a LeadKey that is different from Key, the note sent to Tonal must be set to LeadKeyRoot, unless noteRoot is specifically placed in the Section elsewhere.
  - **IMPLEMENTED** in getTonalForTable() [TonalFunctions.js, lines 27-33]. When TinyNote source is used and leadKey differs from Key, the leadKey is used as rootKey for Tonal analysis. This respects explicit noteRoot placement (takes precedence). Validated with 3 new regression tests in tonal-functions.test.js.

#### add menu under /vp - view, presentation mode
  - COMPLETE implemented with /vpa and /vpm (automate and manual)     

#### in /fpoa you need to do refresh to get it to sync.

  - key-handlers.js :

```
      function parkCommandLineAtPath(triggerPath = '') {
        setMenuAtRoot();
        // Ensure plugin runtime menu nodes are rebuilt for direct path entry (/fpoa, etc.)
        // so nested suggestion menus are not stale from prior sections/notes.
        pluginManager.refreshPluginsMenuNode();
```

  - key-handlers.js : 

```
                case "/":
              // Rebuild runtime plugin menu nodes before entering command mode
              // so /fpoa starts with fresh tonal suggestions every time.
              pluginManager.refreshPluginsMenuNode();
                      setMenuAtRoot();
        
```

  - infinite-neck.js : 
```
      export function sectionChanged(){
          syncSectionUi();
          clearAndReplaySection();
          // Refresh plugin menus so that Tonal datalables/suggestions are current when user navigates to /fpoa, etc.
          pluginManager.refreshPluginsMenuNode();
        }
```

  - Cody also made an attempt to do this in command-line.js hardcoding for /fpoa, which I rolled back but committed in git for history.             


#### /vp presentation menu re-org
      We would like a menu re-organized.
      Current: 
      `/vp` `p) presentation mode` calls to toggle it
      New: 
      `/vp` `p) presentation` shows a sub-menu:
          `p) presentation mode [true]` calls to toggle it, displays current value
          `s) save Display Options [state]` does what #btnControlsToDisplayOptions_View does
          `c) clear Display Options [state]` does what #btnDeleteDisplayOptions_View does
        Each of these items would display a bang and stay at this level.
        Since there is state behind the buttons in the UI in `View | SAVE` and `View | CLEAR`, represent this state in the [state] in the menu item: 
        `save` state: ['unsaved','saved','none']
        `clear` state: ['none','present']
  - COMPLETE

#### palette and View consistency
  - current color palette button (color: Emboss) not updating
    - FIXED
  - +/- Font button not showing "dirty" in riskyButton riskyButtonActionRequired
    - FIXED

#### plugin menu capitalizations on triggers inconsistent or unneeded in sub-menus
  - COMPLETE 

#### In All menus, make sure "table" and "Table" are replaced by "Instrument".
  - COMPLETE




## Deferred

#### chart colors and shadows
  - DEFERRED.  Looks good for now.

#### Allow navigation limited set in command-line when not in a value edit, to naviga<>]  Would be cleanest
  - DEFERRED (probably brittle and wonky.  /fpoa allows navigation, as do a few others that need it.) 









