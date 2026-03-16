# Infinite Neck Change Impact Map

This map is for planning refactors with minimal surprises.

## How To Use This

1. Pick a change area below.
2. Start in a low-risk zone first.
3. Expand to medium/high-risk zones only after tests pass.

## Risk Tiers

### Low Risk (safe first refactor targets)

- Pure formatting/readability and comment edits in [infinite-neck.js](../infinite-neck.js)
- Non-functional docs and section headers in [infinite-neck.js](../infinite-neck.js)
- Small helper extraction that does not change call order in [infinite-neck.js](../infinite-neck.js#L140)

Why low risk:
- No runtime behavior changes if call graph remains identical.

### Medium Risk (localized behavior)

- UI-only event handlers in [infinite-neck.js](../infinite-neck.js#L1374)
- Theme/display control mapping in [infinite-neck.js](../infinite-neck.js#L1166)
- File load post-processing in [infinite-neck.js](../infinite-neck.js#L792)

Why medium risk:
- Mostly local effects, but many user interactions route through these sections.

### High Risk (system wiring and broad blast radius)

- Provider wiring hub in [infinite-neck.js](../infinite-neck.js#L140)
- Core section state transitions in [infinite-neck.js](../infinite-neck.js#L258)
- App startup sequence in [infinite-neck.js](../infinite-neck.js#L1993)
- EventBus bridge in [infinite-neck.js](../infinite-neck.js#L2105)

Why high risk:
- Changes here can affect many modules and runtime ordering.

## Refactor Entry Points (Recommended Order)

1. Start with low-risk readability extractions in [infinite-neck.js](../infinite-neck.js#L404)
2. Refactor one event-handler cluster at a time from [infinite-neck.js](../infinite-neck.js#L1374)
3. Stabilize with tests and scans.
4. Refactor provider wiring only after above is clean: [infinite-neck.js](../infinite-neck.js#L140)

## Coupling Hotspots (Watch Carefully)

- Provider installation fan-out: [infinite-neck.js](../infinite-neck.js#L140)
- Desktop event binding fan-in: [infinite-neck.js](../infinite-neck.js#L1374)
- Song load and normalization path: [infinite-neck.js](../infinite-neck.js#L719)
- EventBus handlers linked to UI repaint/reset: [infinite-neck.js](../infinite-neck.js#L2114)

## Safe Refactor Patterns

- Extract helper functions without changing invocation order.
- Keep provider function names stable when possible.
- Prefer adapter wrappers instead of direct cross-module imports.
- Keep headless path and browser path aligned:
  - Test init: [infinite-neck.js](../infinite-neck.js#L1980)
  - Browser init: [infinite-neck.js](../infinite-neck.js#L1993)

## Risky Patterns To Avoid

- Moving provider installation below code that needs providers.
- Switching direct function calls to EventBus without test-path wiring.
- Bulk search/replace touching string literals and comments in long files.
- Combining startup-sequence refactor with UI-event refactor in one change.

## Validation Checklist Per Refactor Step

1. Run export audit: `npm run scan:exports`
2. Run tests: `npm test --silent`
3. Run dependency map: `npm run scan:deps`

Expected healthy state:
- unresolved symbols: 0
- tests: all passing
- cycles: 0

## Related References

- Reader guide: [infinite-neck-reading-guide.md](infinite-neck-reading-guide.md)
- Main file: [infinite-neck.js](../infinite-neck.js)
- Note table module: [notetable.js](../notetable.js)
- Color module: [colorFunctions.js](../colorFunctions.js)
- Key handler module: [key-handlers.js](../key-handlers.js)
- Section recorder module: [section-recorder.js](../section-recorder.js)
