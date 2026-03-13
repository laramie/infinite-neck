# Hi,  I have a tricky bit of cross-file UI work to do in my web app.  

## Files

- infinite-neck.js
- index.html
- tunings.js
- table-builder.js

## Background 



- The main html page, index.html, attached, has two div's divMyTunings, and divAllTunings. 

- These are populated by button click handlers which end up hitting reloadAllTuningsDisplay(), attached.

- The table with the "Clone" buttons is itself built by table-builder.js :: dumpTuningsToTable()

- produces:
```
    <div id="divAllTunings">
        <table class="tuningsTable">
```



- (I should probably change this to id="tuningsTable", but let's hold off on that and just do it for the new table id="myTuningsTable" and revisit the class-to-id refactor in the next iteration.)

- The data structure lives in  tunings.js::allTunings    

## Goal

- The goal is to break the current handling into two actions.

- Currently: 
    - mashing on the "Clone" button does: cloning a row in the table and setting its visible to true, and just rebuiling the tuningsTable

- Desired: 
   - mashing on the "Clone" button clones a row, but adds it to another data structure just like allTunings, but now called myTunings, which will now live in class Song as a new member.  That becomes the source for a new table that should live inside divMyTunings.

- In MVC terms, we wan to end up with: Two model objects [allTunings, myTunings]  viewed by two  div/table view objects [divAllTunings, divMyTunings]

## Request:    Can we take a first iteration of this?  I'm source-version-controlled, so if it looks squirrelly I'll just roll back and refine the prompt.  

