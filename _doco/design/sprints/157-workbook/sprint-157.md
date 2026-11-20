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

