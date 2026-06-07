# sprint-117-chart-layout

sprint number: 117

sprint short name: chart-layout

date: 20260530

Index of all sprints for reference to how other plugins have been discussed, designed, and implemented: [sprint planning index](_doco/lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- add a Chart with Sections in rows of BARS delineated by INTRO, HEAD, LINE, etc.

## Sprint document locations

- [sprint-117 design document](117-design.md) 
- [sprint-117 implementation plan](117-implementation-plan.md) 
- [sprint-117 Iteration 5 implementation plan](117-it5-implementation-plan.md)
- [songfile test fixture](../../../../songs/tests/chart-test-fixture.json)

## Iterations

- Iteration 1 includes designing and writing the implementation plan.
  - Chart based on each Section deciding whether it belongs in a Chart section:
    - 'INTRO'
    - 'HEAD'
    - 'LINE'
    - 'BAR'
    - 'OUTRO'

- Iteration 2: Design Changes, Questions answered
  - Section.chartPosition
  - Section.chartCaptionWidth
  - controls limited to Chart | Chart Details.

- Iteration 3 : Final answers before implementation

- Iteration 4: adjusting
  - Chart Options tab added
  - Song.chartOptions
  - barClass
  - font tweaks
  - all captions off

- Iteration 5: LeadSheet bars/sections
  - Vertical lines/borders
  - % repeat bars
  Section.beatsPerBar so Sections can be algorithmically broken up into Chart BARs.

- Iteration 6: LeadSheet tweaks
  - test songfile with chart properties added as test fixture: `songs/tests/chart-test-fixture.json` 
