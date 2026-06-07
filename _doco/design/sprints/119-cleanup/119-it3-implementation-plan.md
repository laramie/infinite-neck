# sprint-119-cleanup Iteration 3: section-status implementation plan

This document turns the sketch into a concrete implementation plan for the current iteration.

It assumes the round-3 decisions now in the design notes:

1. `leadSheetHorizontal` should get its own dedicated host span within the existing `SongTitleLeadSheet` row.
2. Existing hide/show behavior should be preserved.
3. Left-rail Instrument ID and vertical section-status should become a vertical stack, but the exact structural strategy can be chosen pragmatically.
4. Beat display remains out of scope for this implementation pass.

## Scope

The section-status widget owns only the section/loop/key display.

That means the widget content remains conceptually limited to:

```html
<span class="lblSectionNumber LooperLight"><span class="lblSectionmark">§</span><span class="lblSectionsStatusSectionNo">2</span></span>
<span class="lblRootID">C</span><span class="lblRootIDLead">&nbsp;</span>
```

The following remain outside the widget and continue to live as siblings in the page-level title/status row:

```html
<span class="lblSectionChartChord"></span>
<span class="lblSectionMode"></span>
<span class="lblLeadSheetWidgets"></span>
```

The `fretTableLeftCaption` also remains outside the widget.

## Target end state

After implementation, there will be one section-status widget family with three placements:

1. `leftRailVertical`
2. `captionRowHorizontal`
3. `leadSheetHorizontal`

All three placements will render the same core section/loop/key state, but in different layouts.

## Current code touchpoints

The implementation will primarily touch these files:

1. `index.html`
2. `TableBuilder.js`
3. `templates/SectionStatus/section-status.builder.js`
4. `templates/SectionStatus/section-status.html`
5. `templates/SectionStatus/section-status.css`
6. `instrument.css`
7. `infinite-neck.js`
8. `Song.js`
9. `NoteTableController.js`

Likely test updates or additions:

1. `_tests/jest/key-handlers.test.js`
2. `_tests/jest/transport-controller.test.js`
3. new focused tests for `SectionStatusBuilder` if the repo already has a suitable test pattern for template widgets

## Implementation plan

### Phase 1: establish explicit placements and unique widget identity

Goal: remove ambiguity from the current widget registration and event targeting.

Changes:

1. In `TableBuilder.js`, stop creating both instrument widgets with the same placement id of `caption`.
2. Use explicit placement ids:
   1. `leftRail`
   2. `captionRow`
3. In `index.html` plus app init, use `leadSheet` for the page-level widget instance.
4. In `templates/SectionStatus/section-status.builder.js`, keep `widgetID = ownerID + '_' + placementID + '_SectionStatus'`, but rely on those distinct placement ids so ids are truly unique.

Why this phase goes first:

The current left-rail and caption-row widgets collide conceptually and practically because they share the same placement id. That makes every later event and CSS decision harder to trust.

## Phase 2: add a dedicated lead-sheet host span and mount the third placement

Goal: make the top-of-page section/key display part of the same widget family without swallowing the rest of the title row.

Changes:

1. In `index.html`, add a dedicated host span inside the existing `.SongTitleLeadSheet` row.
2. Keep `lblSectionChartChord`, `lblSectionMode`, and `lblLeadSheetWidgets` in place as siblings after that host span.
3. In `infinite-neck.js`, replace the currently commented-out lead-sheet widget mount with a real widget creation call.
4. Keep the old hand-coded page-level section/key fragment only long enough to compare output during migration, then remove it after parity is verified.

Recommended DOM direction:

```html
<span class="SongTitleLeadSheet">
    <span id="spanSectionStatusLeadSheetHost"></span>
    <span class="lblSectionChartChord"></span>
    <span class="lblSectionMode"></span>
    <span class="lblLeadSheetWidgets"></span>
</span>
```

Why this host strategy is preferable:

It keeps the widget isolated and replaceable while preserving the existing top-line composition. It is cleaner than reusing the whole `SongTitleLeadSheet` container as the widget root.

## Phase 3: reduce the widget API to one real update path

Goal: replace the half-finished event surface with one explicit status payload.

Changes:

1. In `templates/SectionStatus/section-status.builder.js`, make `sectionChanged` the primary widget update event for this iteration, but rename or reshape it so it behaves like a real status event rather than a narrow replay-options pass-through.
2. Remove or defer `keyChanged`, `layoutChanged`, and `IDChanged` if they are not needed by the actual runtime path.
3. In `NoteTableController.js` and `Song.js`, publish one explicit section-status payload instead of relying on implicit assumptions about `replayOptions` shape.

Recommended payload for this iteration:

```js
{
  ownerID,
  placementID,
  sectionNumber,
  rootKey,
  rootKeyLead,
  keyMode,
  isLoopActive
}
```

Notes:

1. `placementID` can be optional when broadcasting to all widgets for an owner.
2. `keyMode` can continue to reflect current self/relative/listener styling rules.
3. Beat-related fields should not be included yet.

Why this change matters:

The widget should render from a small view-model-like payload. It should not need to understand more of `ReplayOptions` than necessary.

## Phase 4: replace the current loop-light CSS broadcast with explicit widget state

Goal: preserve current behavior while making loop-active state part of the widget's own rendering contract.

Current behavior:

1. `infinite-neck.js` adds or removes `LooperLightOn` on every `.LooperLight` element globally.
2. The widget template relies on inheriting that global class behavior.

Planned behavior:

1. Loop state becomes `isLoopActive` in the section-status payload.
2. Each widget applies its own active class when it renders or updates.
3. Global CSS broadcast can then be retired from section-status responsibilities.

Recommended class direction:

1. Keep existing visual CSS as much as possible.
2. Introduce widget-local classes such as:
   1. `.SectionStatus_loopLight`
   2. `.SectionStatus_loopActive`

Sketch of the code direction:

```js
function publishSectionStatus(song, ownerID, replayOptions) {
  EventBus.trigger('Widget:SectionStatus:statusChanged', {
    ownerID,
    sectionNumber: replayOptions.sectionIndex + 1,
    rootKey: replayOptions.rootKey || '',
    rootKeyLead: replayOptions.rootKeyLead || '',
    keyMode: replayOptions.type,
    isLoopActive: !!song.looping
  });
}

handleStatusChanged(data) {
  const $container = $(this.container);
  const $loop = $container.find('.SectionStatus_loopLight');

  $loop.toggleClass('SectionStatus_loopActive', !!data.isLoopActive);
  $loop.attr('data-loop-active', data.isLoopActive ? 'true' : 'false');
  $container.attr('data-loop-active', data.isLoopActive ? 'true' : 'false');

  updateIfChanged($container.find('.SectionsStatus_SectionNumber'), String(data.sectionNumber || ''));
  updateIfChanged($container.find('.SectionStatus_rootKey'), data.rootKey || '', true);
  updateIfChanged($container.find('.SectionStatus_rootKeyLead'), data.rootKeyLead || '', true);
}
```

Merits of replacing broadcast now:

1. The widget becomes self-contained and easier to reason about.
2. Lead-sheet, caption-row, and left-rail placements all update through one data contract.
3. Future beat support becomes easier because loop and beat state live in the same widget update model.

Risk:

The current global broadcast is simple and working. The safest approach is a short migration window where the new widget-local class is added first, verified visually, and only then the old global `.LooperLightOn` dependency is removed from section-status markup.

## Phase 5: make left-rail layout a deliberate vertical stack

Goal: place the vertical section-status widget above the Instrument ID without either element floating above the table.

There are two plausible structural approaches.

### Option A: one flex column inside a table cell

Description:

1. Keep the existing three-cell structure in `TableBuilder.js`.
2. Replace the current separate left-caption cell and section-status cell with one left-side cell.
3. Inside that cell, render a container that stacks:
   1. vertical section-status widget
   2. `fretTableLeftCaption`

Example direction:

```html
<td class="tdLeftRailStack">
    <div class="leftRailStack">
        <span class="leftRailSectionStatusHost"></span>
        <span class="fretTableLeftCaption"></span>
    </div>
</td>
```

Merits:

1. Minimal structural churn.
2. Easier to preserve current table alignment.
3. Easier to attach per-instrument hide/show behavior to separate descendants in one local container.
4. Lower risk for this iteration.

Costs:

1. It keeps some old table-driven structure in place.
2. It is not a broad cleanup of the surrounding instrument layout.

### Option B: reduce the table-side structure more aggressively

Description:

1. Rework the left-of-table layout more broadly.
2. Potentially replace the small table wrapper arrangement with a simpler flex-based outer structure.

Merits:

1. Cleaner long-term layout model.
2. Could simplify future responsive adjustments.

Costs:

1. Higher regression risk.
2. Larger CSS blast radius.
3. Harder to keep iteration scope tight.

Recommendation:

Use Option A for this iteration.

Reasoning:

The design requirement is primarily about stacking and independent visibility control, not about redesigning the whole instrument frame. One flex column inside a table cell solves the actual problem with much less risk.

## Phase 6: preserve and localize show/hide behavior

Goal: keep current user-visible controls working, while changing the left-side controls from global to per-instrument.

Required behavior from round 3:

1. `a` continues to hide/show the page-level title area, including the lead-sheet section-status widget.
2. `SHIFT+a` continues to hide/show the instrument caption row, including the caption-row horizontal widget.
3. `showLeftCaption subcaptionButton` hides/shows the Instrument ID per instrument.
4. `showLeftSectionMark subcaptionButton` hides/shows the vertical section-status widget per instrument.
5. The `C` and `S` buttons remain hidden whenever the instrument caption row is hidden.

Changes:

1. Keep `toggleCaption()` and `toggleInstrumentCaptionRow()` behavior at their current scope.
2. In `TableBuilder.js`, add table-specific data attributes to the `C` and `S` buttons so handlers know which instrument they belong to.
3. In `infinite-neck.js`, replace the current global handlers:
   1. `$('.fretTableTDCaption').toggle()`
   2. `$('.LooperLightTD').toggle()`
   with per-instrument lookups rooted from the clicked button.

Recommended event-binding shape:

```js
$('.showLeftCaption')
  .off(`click${eventNamespace}`)
  .on(`click${eventNamespace}`, function() {
    const tableID = $(this).data('tableid');
    $(`#${tableID}`).closest('.instrumentBackground').find('.fretTableLeftCaption').first().toggle();
  });

$('.showLeftSectionMark')
  .off(`click${eventNamespace}`)
  .on(`click${eventNamespace}`, function() {
    const tableID = $(this).data('tableid');
    $(`#${tableID}`).closest('.instrumentBackground').find('.leftRailSectionStatusHost').first().toggle();
  });
```

Implementation note:

The exact selector path can be refined during coding, but the key change is scope: these actions should toggle only the owning instrument.

## Phase 7: align templates and CSS with the three placements

Goal: make the layouts explicit in markup and stylesheet structure.

Changes:

1. In `templates/SectionStatus/section-status.html`, add placement-specific container classes or data attributes.
2. In `templates/SectionStatus/section-status.builder.js`, map placements to template variants cleanly.
3. In `templates/SectionStatus/section-status.css`, define separate layout rules for:
   1. left rail
   2. caption row
   3. lead sheet
4. In `instrument.css`, remove assumptions that the live-info widget is a tiny generic badge if those assumptions interfere with the new caption-row layout.
5. In `infinite-neck.css`, ensure the lead-sheet placement inherits the intended top-line typography without relying on old hand-coded section/key markup.

Design rule:

The compact caption-row layout and the page-level lead-sheet layout should not share a single set of horizontal sizing assumptions.

## Phase 8: retire obsolete migration artifacts

Goal: remove code that only exists because the template migration stopped halfway.

Changes:

1. Remove unused or misleading widget events if not used after the refactor.
2. Remove builder code that still targets old selector names where the template now uses `SectionStatus_*` classes.
3. Remove the old page-level hand-coded section/key fragment once parity is confirmed.
4. Remove section-status dependence on the old global loop-light CSS broadcast if the new payload-driven path is stable.

## Concrete file-by-file plan

### `index.html`

1. Add the dedicated lead-sheet section-status host span inside `.SongTitleLeadSheet`.
2. Keep chord/mode/plugin spans outside that host.
3. Remove the now-redundant external lead-sheet section-status host if it is no longer needed.

### `TableBuilder.js`

1. Rename placement ids from generic `caption` to explicit placements.
2. Restructure the left rail into a stack container.
3. Attach data attributes to `C` and `S` buttons for per-instrument toggling.
4. Keep the caption-row host appended inside `.captionRow` so `SHIFT+a` still hides it with the rest of the row.

### `templates/SectionStatus/section-status.builder.js`

1. Replace the current layout-only distinction with placement-aware rendering.
2. Move to one real status update handler.
3. Add local loop-active rendering state.
4. Remove or defer dead event pathways.

### `templates/SectionStatus/section-status.html`

1. Ensure markup exposes selectors for:
   1. section number
   2. root key
   3. root key lead
   4. loop-light element
2. Keep template variants small and placement-focused.

### `templates/SectionStatus/section-status.css`

1. Add explicit placement classes.
2. Add loop-local active class styling.
3. Keep existing root-key style semantics for self/relative/listener modes.

### `instrument.css`

1. Add styles for the new left-rail stack container.
2. Adjust caption-row widget sizing rules so compact horizontal layout has a stable contract.

### `infinite-neck.js`

1. Mount the lead-sheet widget during startup.
2. Replace global left-side toggle behavior with per-instrument behavior.
3. Migrate loop-light behavior from pure global CSS broadcast to explicit widget payload updates.
4. Keep `toggleCaption()` and `toggleInstrumentCaptionRow()` behavior unchanged from the user perspective.

### `Song.js` and `NoteTableController.js`

1. Publish the minimal section-status payload.
2. Ensure section-status refresh still happens on the current triggers.
3. Include loop-active state in that published payload.

## Testing plan

1. Verify page-level `a` toggles the entire top caption area and therefore hides the lead-sheet section-status widget.
2. Verify `SHIFT+a` toggles each instrument caption row and therefore hides the caption-row section-status widget.
3. Verify clicking `C` hides only the owning instrument's left-side Instrument ID.
4. Verify clicking `S` hides only the owning instrument's left-side vertical section-status widget.
5. Verify the `C` and `S` buttons disappear whenever the caption row is hidden.
6. Verify section number and keys stay synchronized across all three placements.
7. Verify loop-active visual state turns on and off in all three placements without relying on global `.LooperLight` broadcast.
8. Verify no duplicate widget ids are produced for a single instrument.

## Recommended implementation order

1. Add explicit placement ids.
2. Add the dedicated lead-sheet host span.
3. Refactor the builder to one real status event payload.
4. Convert loop-active rendering to explicit widget state.
5. Rebuild the left rail as a stack using the minimal-risk table-cell strategy.
6. Localize `C` and `S` toggles per instrument.
7. Finalize placement-specific CSS.
8. Remove obsolete hand-coded and migration-only paths.

## Deferred work

These items should remain out of scope for this implementation:

1. Beat rendering in section-status
2. Adding a `Show LooperLight Beats` control
3. Folding chart chord, mode, or plugin widgets into section-status
4. Large-scale rearchitecture of the entire instrument outer layout

## Completion criteria

The implementation is complete when all of the following are true:

1. A dedicated lead-sheet host span is used inside `.SongTitleLeadSheet`.
2. The section-status widget renders in three placements from the same small payload.
3. Left-rail vertical section-status and Instrument ID appear as a vertical stack.
4. `C` and `S` operate per instrument.
5. `a` and `SHIFT+a` continue to behave as they do today.
6. Loop-active visual state is driven by widget state rather than only by global CSS broadcast.
7. The old hand-coded page-level section/key fragment is no longer required.
