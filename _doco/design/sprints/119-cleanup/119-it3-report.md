
I’ve identified the key files: the current widget is in templates, while the working horizontal display is still driven directly from the old update path in the main app. I’m reading those exact sections now so I can separate “good data flow” from “legacy but working markup”.

The old updater confirms the split: it still populates the lead-sheet line, while instrument-level widget updates are coming through EventBus. I’m now reading where the new widget is actually mounted and how the caption row is structured, because that’s where the vertical layout issue will be decided.

Read [](file:///home/laramie/infinite-neck/templates/SectionStatus/programmer-instructions.md)

Read [](file:///home/laramie/infinite-neck/_doco/design/widget-design-SectionStatus.md#280-280), lines 280 to 380

The original widget design doc confirms the intended pattern, but the real code never finished the lead-sheet instance or the wider state model. I’m locating the actual runtime mount points next so the report can be concrete about what is missing versus what is only half-wired.

The first pass suggests the lead-sheet widget is not mounted at all in current app init, which already points to one root cause. I’m verifying whether instrument widgets are mounted through some other path or whether vertical mode is only “working” because older caption-row markup still exists elsewhere.

The instrument widgets are mounted in TableBuilder, not in app init. The lead-sheet host exists but its widget creation is explicitly commented out, so horizontal mode is not just broken stylistically; it is largely not wired into runtime at all.

The caption row mount is concrete now: TableBuilder creates both a horizontal widget in the caption row and a vertical widget beside the table. That means horizontal mode does exist for instruments, and I need to check why it underperforms despite being mounted. Next I’m tracing the actual update events and the caption-row CSS interaction.

I’ve confirmed the caption-row widget is being created per instrument. The next question is whether the EventBus updates are actually complete for that widget or whether it only gets the reduced section/key payload, which would explain why the old hand-coded top line still looks richer and more stable.

The event flow is now clear: Song publishes EventBus events, but the main app still handles those by calling the monolithic legacy update functions. I’m reading the sectionChanged path and the transport/beat rendering next, because the requested beat display likely needs data that the widget never receives today.

I have one concrete layout defect now: the caption-row host for the horizontal widget is constrained to `height: 1em; width: 1.8em`, which is enough for a tiny badge but not for a horizontal section-plus-keys layout. I’m checking the rest of the file for any horizontal-specific CSS or feature flags, because right now it looks like horizontal mode was mounted without getting a real layout contract.

I found one false lead: the old `.captionRowLiveInfo` size constraints in [instrument.css]( /home/laramie/infinite-neck/instrument.css#L92 ) don’t actually apply to the current runtime host, because TableBuilder creates the host with only an id, not that class. The stronger issue remains that horizontal mode has almost no layout-specific CSS and only a reduced data model.

I’ve now separated three things that were conflated: instrument caption-row widget, left-of-table vertical widget, and the page-level SongTitleLeadSheet. I’m checking the loop-light and beat update path one more time so the report can say exactly what new event or payload would be needed for the requested `SS:bb` beat display.

I found a stronger structural bug than the earlier CSS suspicion: both instrument widgets are created with the same `placementID` of `caption`, so they get the same computed `widgetID`. That means the “horizontal” and “vertical” instances for a given table are not actually distinguishable for any widget-targeted events.

The text-search tool is unreliable in this workspace for focused file matches, so I’m using direct grep on the known files to pin exact lines for the report.

I have enough for the report now. I’m pinning two last references around beat refresh so the recommendations can point to the right integration seam instead of hand-waving toward “transport somewhere”.


**Report**
The section-status work is only partially migrated. The vertical widget is close to a real widget system, but the horizontal story is split between a compact instrument-caption widget and the old page-level SongTitleLeadSheet. Replacing the hand-coded version is viable, but not by treating the current horizontal template as a drop-in replacement. It needs a richer layout and a unified status data source first.

**What I found**
1. There are really three section-status surfaces today, not one.
The page-level lead-sheet line is still hand-coded in infinite-neck/index.html and still populated by the legacy updater in infinite-neck/infinite-neck.js, including song name, section caption, chart chord, chart mode, and plugin widgets in infinite-neck/infinite-neck.js, infinite-neck/infinite-neck.js, infinite-neck/infinite-neck.js, and infinite-neck/infinite-neck.js.

2. The widget host for the lead-sheet already exists, but it is not used.
The empty host is present in infinite-neck/index.html, but the intended widget mount remains commented out in infinite-neck/infinite-neck.js. So the page-level horizontal replacement path is not merely buggy; it is not wired into runtime.

3. Each instrument already gets two SectionStatus widgets.
TableBuilder creates a vertical widget at the left of the instrument in infinite-neck/TableBuilder.js and a horizontal widget in the caption row in infinite-neck/TableBuilder.js. The caption-row host is appended in infinite-neck/TableBuilder.js.

4. The two instrument widgets for a given table currently collide on widget identity.
Widget ids are derived from ownerID plus placementID in infinite-neck/templates/SectionStatus/section-status.builder.js. Both instrument widgets are created with placementID equal to caption in infinite-neck/TableBuilder.js and infinite-neck/TableBuilder.js. That means both widgets for one table compute the same widgetID. This is a real structural bug and makes any widget-targeted event ambiguous.

5. The widget receives only a reduced data model.
The only runtime event I found that actually feeds the widget is Widget:SectionStatus:sectionChanged from infinite-neck/NoteTableController.js and infinite-neck/NoteTableController.js. That path carries replayOptions and is enough for relative section, section number, root key, and lead key. It does not cover song name, section caption, chart chord, chart mode, plugin widgets, or beat display. Those remain owned by the legacy updater in infinite-neck/infinite-neck.js.

6. The widget API looks more complete on paper than in runtime.
The builder subscribes to keyChanged, layoutChanged, and IDChanged in infinite-neck/templates/SectionStatus/section-status.builder.js, infinite-neck/templates/SectionStatus/section-status.builder.js, and infinite-neck/templates/SectionStatus/section-status.builder.js, but I did not find runtime triggers for those events outside design docs. More importantly, handleKeyChanged still targets legacy selectors in infinite-neck/templates/SectionStatus/section-status.builder.js and infinite-neck/templates/SectionStatus/section-status.builder.js, not the current widget selectors. That is a clear sign of an unfinished migration.

7. Vertical mode works mainly because its job is smaller and its slot is stable.
The left-side vertical widget is given a dedicated table cell in infinite-neck/TableBuilder.js with simple side-rail styling in infinite-neck/templates/SectionStatus/section-status.css. It only needs the limited data the widget currently gets. That is why it can look mostly correct even though the widget system is incomplete.

8. The current side-rail DOM cannot satisfy the requested “widget above label” layout.
The left label and the left vertical widget are hardcoded into separate cells in infinite-neck/TableBuilder.js and infinite-neck/TableBuilder.js. With that structure, the label cannot sit below the vertical widget in the same left column. The current global toggles also still act on entire classes, not per-instrument elements, in infinite-neck/infinite-neck.js and infinite-neck/infinite-neck.js.

9. Horizontal mode has almost no dedicated layout contract.
The section-status stylesheet has general key-badge styling and left-rail styling, but no meaningful horizontal-specific layout rules in infinite-neck/templates/SectionStatus/section-status.css. So the horizontal widget is mounted, but it is not really designed as a first-class layout.

10. Loop-light state is still a global CSS broadcast.
Looping still lights everything with the LooperLight class through infinite-neck/infinite-neck.js. That is workable, but it means loop state is not part of a clean widget view model yet.

11. Beat updates bypass the widget.
Beat refresh flows through TransportController.refreshBeatUi in infinite-neck/transport-controller.js, then Song.requestUiShowBeats in infinite-neck/Song.js, then the SongUiShowBeats bridge in infinite-neck/infinite-neck.js. That path updates transport beat UI, but nothing currently turns it into widget state. So the requested SS:bb display cannot happen without new plumbing.

**Why horizontal mode feels broken**
1. The current horizontal widget is only a compact section-plus-keys strip, while the working hand-coded lead-sheet line is a richer status line. Those are not equivalent UIs.

2. The page-level replacement path is not mounted at all, so the only live “horizontal widget” today is the compact instrument-caption version, not a true replacement for SongTitleLeadSheet.

3. The widget identity collision means any future widget-targeted layout or key event will hit both instrument instances for the same table.

4. The builder still contains legacy selector assumptions, which means parts of the API were never finished after the template migration started.

**How to fix horizontal mode and replace the hand-coded version**
1. Treat compact horizontal and lead-sheet horizontal as two different layouts.
The caption-row horizontal widget and the page-level lead-sheet line have different content density and different jobs. I would not try to make one tiny template serve both. Keep the compact caption-row layout, but add a dedicated leadSheet layout for the full-width top line.

2. Introduce a single SectionStatus view model.
One presenter should compute all status fields once: sectionIndex, sectionCount, relativeSection, rootKey, rootKeyLead, chartChord, chartMode, sectionCaption, songName, pluginWidgets, beat, beats, and loop state. Right now those values are split between replayOptions in infinite-neck/NoteTableController.js and the legacy updater in infinite-neck/infinite-neck.js.

3. Give each widget instance a truly distinct placementID.
For example: leftRail, captionRow, and leadSheet. That fixes the collision created by infinite-neck/templates/SectionStatus/section-status.builder.js together with infinite-neck/TableBuilder.js and infinite-neck/TableBuilder.js.

4. Mount the lead-sheet widget in the existing host and migrate by parity.
Use the existing host in infinite-neck/index.html, replace the commented-out mount in infinite-neck/infinite-neck.js, and do not remove the old SongTitleLeadSheet until the new leadSheet layout displays all of the currently populated fields.

5. Add beat support as a separate status event or a fuller statusChanged event.
The cleanest seam is the beat refresh path already used by transport in infinite-neck/transport-controller.js, infinite-neck/Song.js, and infinite-neck/infinite-neck.js. I would not make the widget pull directly from getSong. Keep it event-fed. Either add Widget:SectionStatus:beatChanged, or replace the current narrow sectionChanged event with a single richer statusChanged payload.

6. Keep loop-light as a field in the same view model even if the CSS broadcast remains for now.
That will let the lead-sheet widget, caption-row widget, and left-rail widget stay visually consistent without relying on global incidental styling forever.

**Refactorings that look indicated and worthwhile before Version 2**
1. Split the current monolithic updateSectionsStatus responsibilities into presenter data generation versus DOM rendering.
Right now infinite-neck/infinite-neck.js is still the kitchen-sink updater.

2. Finish or remove dead widget API paths.
If keyChanged, layoutChanged, and IDChanged are not part of the runtime plan, remove them. If they are part of the plan, finish them and align the selectors with the real widget markup in infinite-neck/templates/SectionStatus/section-status.builder.js.

3. Rebuild the left side rail as one stacked container instead of two cells.
That is required to place the table label below the vertical widget. The current split cells in infinite-neck/TableBuilder.js and infinite-neck/TableBuilder.js prevent the requested layout.

4. Convert the global left-side toggles to per-instrument toggles when convenient.
The current handlers toggle all matching elements globally in infinite-neck/infinite-neck.js and infinite-neck/infinite-neck.js. That is survivable now, but it is not a strong Version 2 direction.

5. Stop using string-eval style template expansion in the widget builder when you do the implementation pass.
The current builder uses runtime template evaluation in infinite-neck/templates/SectionStatus/section-status.builder.js. Since you already have template elements, clone-and-fill would be simpler and more robust.

6. Consolidate duplicate LooperLight and key-badge styling once the new widget path is stable.
Today those styles are split across infinite-neck/infinite-neck.css and infinite-neck/templates/SectionStatus/section-status.css.

**Recommended implementation direction**
1. Do not aim for “one horizontal mode”.
Use three explicit placements: leftRail vertical, captionRow compact horizontal, leadSheet full horizontal.

2. Make the widget system own all section-status surfaces.
That includes the top lead-sheet line, not just the instrument surfaces.

3. Migrate by parity, not by wholesale replacement.
First make the new leadSheet layout show everything the old hand-coded line shows. Only then remove the legacy SongTitleLeadSheet markup and its direct DOM updates.

4. Add beat display only after the unified status payload exists.
Otherwise you will end up with a second ad hoc path just for SS:bb.

No code changes made. Natural next steps are:
1. I can turn this into a concrete implementation plan with proposed data shape, event names, and DOM/CSS changes.
2. I can answer a narrower design question first, such as whether leadSheet should be a third layout or a feature-enabled horizontal layout.