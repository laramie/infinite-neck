# ClipPlugin

# Iteration 1: Design

## Description

We need a new plugin, ClipPlugin.

It will operate simply: select notes to include by type on one selected instrument in one current section.  Copy or Cut these to the Graveyard.  Then, in the same or other section, Paste these from the Graveyard as a Graveyard revive, but not blindyl just reviving a Section.  Instead, going through the set of notes, placing them all in the current Section, and replacing any notes found to collide, or skipping collisions, depending on an option, that will be specified in the menu as "overwrite" which is a toggle.

The Graveyard record will be a new type CLIP, similar to SECTION.  It will store the SectionNotes of a Section, but nothing else, except the Tuning.  The Tuning should be available in the Context of the Graveyard record, and the name of the table it came from. The normal Graveyard fields such as timestamp should also be available in the normal way.  We haven't specified the Graveyard record semantics very well, so please propose sensible patterns following the other consumers of Graveyard.

For the first iteration, only compatible tables will be allowed to be seen in the choice from the Graveyard.  A compatible table has the same Tuning, but may not have the same number of frets, since this can be set at any time after a tuning is already in MyTunings.  CLIP notes that exceed the number of frets on the target instrument are silently dropped. Insufficient notes for the neck of the target instrument are allowed and ignored, with no attempt to fill them.  Except that NamedNotes will automatically fill the neck.

The menu item that looks for candidate CLIP records in the Graveyard should walk the Graveyard list looking for CLIP, then for identical Tunings, then present these as the name they were stored under.  The default name to store should be a system-generated short name default with 
`named-3-single-2-tiny-4-1202` where 1202 is a four-digit 24-hour time HHMM format, and the others are counts of types included.  Zero counts are skipped.  The user can edit this name to anything when saving it, as long as the rules for Graveyard IDs are not broken.

The plugin only handles NamedNotes and PlayedNotes.

RecordedNotes are skipped.  The correct way to copy RecordedNotes is by cloning Sections.

No attempts should be made to normalize the colors to the target section, instead, the original values in the Notes are preserved.  

It is assumed that the User is not copying between songs so that colorDicts are not available.

## Design Limits

This doesn't need to get too fancy, such as string or fret limits.  Just grab all notes by type, select or cut them reasonably, and be able to revive them in a compatible instrument later. It should feel like Cut/Copy/Paste using a multi-clipboard, with the option of overwriting or not. 

## Menu

- f) file
  - p) plugins
    - c) clip
      - C) C copy to Graveyard
        - input: confirm name
      - X) X cut to Graveyard
        - input: confirm name
      - V) V Revive from Graveyard
        - 1) "named-2-1202"
        - 2) "single-12-2305" 
      - o) overwrite [true]  
      - i) include [n,s,t]
        - n) named
        - s) single
        - t) tiny
        - b) bend
        - h) highlight

## Request

Copilot, please format your report as a proposed implementation plan to be refined.  Because this is a simple but not-refined request, don't worry that it may not be implementable until questions are answered.  Rather, use it as a framework to ensure that we have concrete questions to answer and decisions to make.  Please make choices for the implementation that are safe, and follow the patterns of MovePlugin and the other plugins.  Work to make the implementation plan more concrete and not as hand-waivey as this document.  Resonable assumpptions and simplifications are welcome where they lean towards simplicity and clean coding.

Please produce your report in `_doco/design/plugins/clip/ClipPlugin-implementation-plan.md`

## Iteration 2: implementation plan cleanup and Design questions answered

Since we are not highlighting selected note for clipping, we'll want some confirmation in the menu. Perhaps the `include` menu can show `include [n:3,s:4,t:0]` or something.

Highlights make sense to keep out of scope, since practically they are RecordedNotes, and non-recorded Highlights are transitory.

Not sure why Bends are out of scope, but if it simplifies the coding, deferral is fine.  Otherwise we'd prefer them included, and strike anything in our design that says otherwise.

Since baseID is things like "P46" and "P48" then these are curated to be tunings, which specify not only string count, but MIDI locations per string, so are guaranteed compatible.  Future sprints will likely attempt a cross-tuning paste.  For now, we've got Listener tables.  So yes, use baseID.

Probably, any "owner:" field should be stripped, as these are plugin-owned properties for managing Note state within a Section being run by a plugin.

The clip id and caption should include the baseID, or perhaps preferrably the tableID as seen in the table selector.  It would be possible to be working on two instruments at once, but not attempting to cross-paste.  In this case, the tableID makes the choice list smaller, since the user has already chosen tableID.  I guess then they don't need to see the tableID in the clip name, since it will automatically filter in the menu, but if they look at the Graveyard, the id or the context should have the tableID.

We currently allow SECTION records to look almost identical, and they must be scrutinized by timestamp.  This is acceptable for CLIP.  In the chooser they should still be presented in stack-order.

For this version, selected target table is fine for revive choser.

Not sure about 5. namedNotes overwrite.  Given that there are only 12 NamedNotes, optimal would be to report number of collisions and number of uncontested additions.  Simpler is better, but if it happens quickly, the User may want to know how many NamedNotes they replaced.  

Don't do the Section backup.  We are concerned about silently filling up the Graveyard, and want to keep Users in control of that.

Speaking of which, the menu should have a Clear Clipped notes for cleanup before saving a file.  Otherwise the Graveyard automatically persists, which is often good, but we want a way to clean up in case the User wants to stay lean.

All your recommendations not addressed by the above are Approved. Please proceed to coding!

Thanks!

## Iteration 3: Coding
