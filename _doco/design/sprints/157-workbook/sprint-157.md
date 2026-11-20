# sprint-157-workbook

sprint number: 157

sprint shortname: workbook

date: 20261118

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- Create a "Workbook" feature, where a User can save Songs from our library, customized, annotated, with rudimentary bookmark/link helpers, to both Browser persistence and downloaded file-sharable format.  
- When the User is working in the Browser, they can:
  - save on demand
  - optionally autosave
  - save the entire Workbook (multiple Songs) to a single-file format for download, filesharing, and reloading from another machine.  

## Sprint document locations

- [design document](157-design.md) 
- [iteration 1 analysis](157-it1-analysis.md)

## Iterations

  - "Iteration 1": Wishlist and discussion; Copilot analysis of storage, file format and UI. Report: [157-it1-analysis.md](157-it1-analysis.md). 
  - "Iteration 1 Round 2": Analysis approved; v1a + v1b implemented (IndexedDB store, Workbook block on the File page, Save to Workbook, Download/Open Workbook, help section). Design recorded in [157-design.md](157-design.md). Code: [Workbook.js](../../../../Workbook.js), [WorkbookStorage.js](../../../../WorkbookStorage.js), [WorkbookUI.js](../../../../WorkbookUI.js). Tests: [workbook.test.js](../../../../_tests/jest/workbook.test.js), [workbook-render.test.js](../../../../_tests/jest/workbook-render.test.js).
  - [Iteration 1 UA Test Report](157-design.md#iteration-1-ua-test-report) ALL PASS.

  - "Iteration 2": UX changes that add session-only list sorting, persisted list-order management, and persistence in Workbook only of `Include in Looping`, `Bookmark` and `Done` for Tutorials. Detailed in [Iteraion 2 UX changes](157-design.md#iteraion-2-ux-changes)
    - Implemented: sort bar, up/down/remove glyph buttons, Save opens destination folder, practice state (Include in Looping, Bookmark, Done) stored per Workbook Song. Code: [Workbook.js](../../../../Workbook.js), [WorkbookUI.js](../../../../WorkbookUI.js), [infinite-neck.js](../../../../infinite-neck.js). Tests: [workbook.test.js](../../../../_tests/jest/workbook.test.js), [workbook-render.test.js](../../../../_tests/jest/workbook-render.test.js). Full Jest: 95 suites, 1439 tests pass. Awaiting UA.
    - Copilot output saved as report: [157-it2-implementation-report.md](157-it2-implementation-report.md)
    - UA ALL PASS: [Iteration 2 UA Test Results](157-design.md#iteration-2-ua-test-results)  

  - "Iteration 2 Round 2": a few CSS targets and tweaks to set the controls for Workbook and Folders appart from Song rows. [Iteration 2 Round 2 Request](157-design.md#iteration-2-round-2-request)   

