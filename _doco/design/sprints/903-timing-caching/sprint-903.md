# sprint-903-timing-caching

sprint number: 903

sprint timing-caching:

date: 20260727

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: cache building of Sections html overhead.

## Sprint document locations

- phase-1:
  - [design document](903-design-chat.md) 
  - [implementation plan](903-implementation-plan-1.md) 

- phase-2: 
  - [design document](903-timing-revisited.md)
  - [Copilot report ](903-timing-revisited-plan-1.md)
  - [Copilot report](903-timing-confirmed.md)
  - [Copilot report](903-timing-confirmed-2.md)

## Status

### phase-1 complete 

Done, with some code points installed for future investigation.

- 903-timing-caching
  - [903-timing-caching design chat](../design/sprints/903-timing-caching/903-design-chat.md)
  - Figure out how to get rid of loop hiccup on first beat
  - Investigate paint/rebuild optimization
  - Investigate warming up the next Section in idle time.  
  - Investigate caching possibilities
  - *IMPLEMENTED* A first implementation was done and installed.  Its caching and console messages are controlled with flags:
    - const NOTE_TABLE_RENDER_CACHE_ENABLED = true;
      - const NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED = false;

### phase-2 complete
- 20260831 Reopenned phase with `903-timing-revisited.md`

- Made coding changes recommended in `903-timing-confirmed-2.md`

- relativeSection double-builds are fixed.

### phase-3

- This is a new phase following recommendations in phase-2.  The goal is to try to eliminate expensive DOM calls, including calls to jQuery.

  - From Copilot: 
      "Not implemented — the other, larger finding (>50% of cache-hit buildCells() time spent in jQuery's per-cell .html()/.css() DOM writes in buildCellsFromSelector()) is documented as a "design-level, not yet decided" redesign (batch whole-table markup into one DOM write instead of per-cell writes). Per the repo's SOP, that kind of structural change to top-level files needs its own design discussion/approval first, so I left it as-is rather than making that call unilaterally. Let me know if you want to proceed with a design doc for that next."

- New implementation plan for phase-3: `903-implementation-plan-ph3-1.md`

