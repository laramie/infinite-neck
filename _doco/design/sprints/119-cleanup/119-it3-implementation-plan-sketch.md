# sprint-119-cleanup Iteration 3: section-status implementation plan sketch

This document is a draft implementation-plan sketch, not the final implementation plan. Its purpose is to make the likely direction concrete enough to evaluate before coding.

## Summary direction

The section-status widget should be narrowed and regularized rather than expanded.

The widget should own only the section/loop/key status display:

```html
<span class="lblSectionNumber LooperLight"><span class="lblSectionmark">§</span><span class="lblSectionsStatusSectionNo">2</span></span>
<span class="lblRootID">C</span><span class="lblRootIDLead">&nbsp;</span>
```

That widget should support three layouts:

1. `leftRailVertical`
2. `captionRowHorizontal`
3. `leadSheetHorizontal`

The following should remain outside the widget and continue to be treated as sibling UI in the page-level title/status area:

```html
<span class="lblSectionChartChord"></span>
<span class="lblSectionMode"></span>
<span class="lblLeadSheetWidgets">  </span>
```

The `fretTableLeftCaption` should also remain outside the widget. It needs to be laid out correctly near the left-rail widget, but it should not become part of section-status.

Beat display should be treated as out of scope for this iteration, while the design should leave a clean seam for adding it later.

## Design goals

1. Make the widget scope explicit and small.
2. Preserve the working qualities of the current vertical presentation.
3. Recover a good horizontal presentation without dragging unrelated top-line fields into the widget.
4. Make the page-level lead-sheet section display use the same widget family as the instrument-level displays.
5. Remove unfinished or misleading widget wiring that makes the current implementation hard to reason about.

## Proposed model

Treat section-status as one small status component with three placements.

Each placement uses the same core data:

1. loop-active state
2. displayed section number
3. current root key
4. lead/secondary key spacing or adornment if still needed by current styling

Each placement can render that data differently:

1. `leftRailVertical`: stacked, optimized for the left side of the instrument
2. `captionRowHorizontal`: compact inline version near the instrument caption
3. `leadSheetHorizontal`: inline top-of-page version that fits into the existing SongTitleLeadSheet row as one sibling among other siblings

This keeps one conceptual widget while avoiding the current mistake of pretending that all horizontal uses are the same UI.

## Recommended implementation slices

### Slice 1: tighten widget scope

Goal: redefine the widget contract before changing layout details.

Concrete steps:

1. Define the widget as owning only section/loop/key markup.
2. Remove any plan to move `lblSectionChartChord`, `lblSectionMode`, or `lblLeadSheetWidgets` into section-status.
3. Document that `fretTableLeftCaption` is an adjacent label, not widget content.
4. Update builder/template naming so the three layouts reflect placements, not vague vertical vs horizontal flavors.

Expected result:

The section-status widget becomes small enough that its responsibilities are obvious, and the page-level title line stops being conflated with it.

### Slice 2: fix instance identity and placement semantics

Goal: make each widget instance unambiguous.

Concrete steps:

1. Give each placement a distinct placement id.
2. Stop reusing the same placement id for multiple instances on the same table.
3. Ensure generated widget ids are unique across left-rail and caption-row instances for the same instrument.
4. Align event targeting and CSS hooks with those distinct placement ids.

Expected result:

The left-rail widget and the caption-row widget stop colliding conceptually and technically.

### Slice 3: simplify the data/update path

Goal: feed all section-status layouts from one small, explicit payload.

Concrete steps:

1. Define a minimal section-status payload for current scope.
2. Prefer a single update path for section-status instead of several partially implemented event types.
3. Keep loop-light state in that payload even if the current visual effect still leans on existing CSS behavior.
4. Defer beat fields until a later follow-up, but leave the event and renderer structure easy to extend.

Proposed initial payload shape:

```js
{
  tableName,
  placement,
  sectionNumber,
  rootKey,
  leadKey,
  isLoopActive
}
```

Possible later extension for beats:

```js
{
  beatNumber
}
```

Expected result:

The widget update story becomes understandable and the implementation stops depending on half-migrated legacy handlers.

### Slice 4: rebuild left-side layout around a shared column container

Goal: satisfy the clarified left-side layout requirement.

Concrete steps:

1. Replace the current left-side structure that treats the vertical widget and the instrument label as separate, unrelated cells.
2. Create one left-side container that stacks:
   - section-status vertical widget
   - instrument label (`fretTableLeftCaption`)
3. Ensure that container aligns to the top of the instrument table without floating above it.
4. Preserve the current ergonomics of having section/key status near the instrument display.

Expected result:

The vertical widget sits above the instrument id in one intentional left column, and neither element drifts above the table.

### Slice 5: restore horizontal usefulness in two different places

Goal: make both horizontal uses legitimate rather than accidental.

Concrete steps:

1. Keep `captionRowHorizontal` intentionally compact.
2. Create `leadSheetHorizontal` as a first-class layout that is placed inside the existing top-line status row.
3. Keep chart chord, mode, and plugin widget spans beside it as siblings.
4. Migrate the page-level section/key display by parity before removing the old hand-coded section/key fragment.

Expected result:

The top line gains a real widget-based section/key display, but without turning section-status into a giant all-purpose title bar component.

### Slice 6: clean out unfinished migration artifacts

Goal: reduce false abstraction and dead-end code paths.

Concrete steps:

1. Remove or finish event handlers that are declared but not part of the real runtime plan.
2. Align builder selectors and DOM assumptions with the markup actually emitted by the current widget templates.
3. Replace brittle template expansion techniques if they are getting in the way of reliable layout variants.
4. Consolidate widget-specific styling so each of the three layouts has an explicit CSS contract.

Expected result:

The widget system becomes smaller, clearer, and easier to extend after this sprint.

## Recommended order of implementation

1. Lock scope and placement terminology.
2. Fix unique placement and widget identity.
3. Define the minimal shared status payload.
4. Refactor left-side DOM structure for the stacked vertical widget plus instrument id.
5. Finish compact caption-row horizontal rendering.
6. Introduce lead-sheet horizontal rendering inside the existing top-line area.
7. Remove obsolete code paths only after the new section/key widget is proven in all three placements.

## What should explicitly stay out of this iteration

1. Beat display rendering and beat-specific event wiring
2. Folding chart chord, section mode, or lead-sheet plugin widgets into section-status
3. Broad redesign of unrelated title-line content
4. Cleanup of every old updater in the app unless it directly blocks the section-status migration

## Main risks to watch

1. Repeating the earlier mistake of treating page-level lead-sheet UI and instrument-level caption UI as identical layouts
2. Fixing CSS symptoms without first fixing widget identity and placement semantics
3. Trying to add beat support before the smaller section-status widget is stable
4. Over-coupling the widget to legacy top-line markup instead of using it as one sibling inside that row

## Questions to settle before final implementation plan

1. Should `leadSheetHorizontal` reuse the existing SongTitleLeadSheet container exactly, or should it get a dedicated host span within that row?
2. Should loop-active state remain global-CSS-driven for this iteration, or should it move immediately into explicit widget rendering state?
3. Should the caption-row horizontal layout remain always visible, or should it still participate in existing show/hide display options?
4. Should the left-rail vertical widget and instrument id be one flex column inside a table cell, or should the table-side structure be reduced more aggressively?

## Suggested completion criteria for the eventual implementation

1. All three placements render the same section/loop/key information correctly.
2. The top-line lead-sheet area still contains chart chord, mode, and plugin widgets as siblings outside section-status.
3. The left-side instrument label appears below the vertical section-status display and neither element floats above the instrument table.
4. Widget instances have unique identities and do not collide.
5. The code path for section-status updates is smaller and easier to trace than the current mixed legacy/template state.
