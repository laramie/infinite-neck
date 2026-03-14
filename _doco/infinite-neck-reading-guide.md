# Infinite Neck Reader's Guide

Use this as a quick map while reading [infinite-neck.js](../infinite-neck.js).

## Start Here

- Module/provider wiring hub: [infinite-neck.js](../infinite-neck.js#L140)
- Provider wiring invocation point: [infinite-neck.js](../infinite-neck.js#L214)
- Section index comment block: [infinite-neck.js](../infinite-neck.js#L124)

## If You Want To Understand...

### 1) App state and section flow

- Current section refresh logic: [infinite-neck.js](../infinite-neck.js#L258)
- Section status UI update: [infinite-neck.js](../infinite-neck.js#L271)
- Note-label rebuild path: [infinite-neck.js](../infinite-neck.js#L404)

### 2) Song load/save lifecycle

- Open song and merge model: [infinite-neck.js](../infinite-neck.js#L719)
- Post-open rehydration + repaint: [infinite-neck.js](../infinite-neck.js#L792)
- Default color dictionaries: [infinite-neck.js](../infinite-neck.js#L816)
- Full table install pass: [infinite-neck.js](../infinite-neck.js#L852)

### 3) UI event wiring

- Desktop UI binding hub (largest event surface): [infinite-neck.js](../infinite-neck.js#L1374)
- Theme event handlers: [infinite-neck.js](../infinite-neck.js#L1876)
- Data-action dispatcher: [infinite-neck.js](../infinite-neck.js#L1904)

### 4) Headless tests vs browser init

- Test bootstrap path: [infinite-neck.js](../infinite-neck.js#L1980)
- Browser startup path: [infinite-neck.js](../infinite-neck.js#L1993)

### 5) EventBus bridge points

- EventBus import/start: [infinite-neck.js](../infinite-neck.js#L2105)
- Full repaint event mapping: [infinite-neck.js](../infinite-neck.js#L2123)

## Suggested Reading Order (Fast)

1. [infinite-neck.js](../infinite-neck.js#L140)
2. [infinite-neck.js](../infinite-neck.js#L258)
3. [infinite-neck.js](../infinite-neck.js#L404)
4. [infinite-neck.js](../infinite-neck.js#L719)
5. [infinite-neck.js](../infinite-neck.js#L1374)
6. [infinite-neck.js](../infinite-neck.js#L1980)
7. [infinite-neck.js](../infinite-neck.js#L2105)

## Related Modules (Post-Decoupling)

- Color composition + stylesheet logic: [colorFunctions.js](../colorFunctions.js)
- Note-table rendering and cell behavior: [notetable.js](../notetable.js)
- Keyboard command router: [key-handlers.js](../key-handlers.js)
- Section recording helpers: [section-recorder.js](../section-recorder.js)
- Tuning/table utilities: [table-builder.js](../table-builder.js)

## Session Notes

- Copy of ongoing scan phases and findings: [doco/copy-of-infinite-neck-scanning.md](../doco/copy-of-infinite-neck-scanning.md)
