# sprint 145-face-diamonds design document

## sprint 145-face-diamonds Iteration 1

We have attached a bit of CSS that creates diamonds on the bottom edge of each cell except the outer strings:

```

/* Ensure the table borders collapse so cells share a single intersection point */
table.fretTable {
  border-collapse: collapse;
}

.fretTable th, 
.fretTable td {
  border: 1px solid #ccc;
  padding: 2px;
  /* Required to position the diamond relative to the cell's boundaries */
  position: relative; 
}

/* Create the intersection diamond using a pseudo-element */
.fretTable td::before, 
.fretTable th::before {
  content: "";
  position: absolute;
  
  /* Place the center of the diamond exactly on the bottom-right intersection */
  bottom: 0;
  right: 50%;
  transform: translate(50%, 50%) rotate(45deg);
  
  /* Size the diamond to exactly 5% of the cell's width */
  width: 0.6em; 
  height: 0.6em; /* Keeps it a perfect square diamond */
  
  /* Styling */
  background-color: #007bff; /* Blue color */
  z-index: 10; /* Ensures it sits on top of the borders */
  pointer-events: none; /* Prevents interference with text selection or clicks */
}

/* Optional: Hide the diamonds on the outer right and bottom edges of the table */
.fretTable tr:last-child td::before,
.fretTable td:last-child::before,
.fretTable th:last-child::before {
  display: none;
}

```

This is currently being tested for proof-of-concept in 
    `infinite-neck.css:1407-1451`



This is not at all how the logic of placing the new diamonds will go.  But the look and the concept are demonstrated.

Here are the rules for the actual placements:

1. We are calling these "face" diamonds, because they are like the diamonds in the diamonds row, but appear on the "face" of the fretboard, the cells of the Instrument that are not the diamondsRow.

2. We need these properties on the per-instrument tunings rows that become part of MyTunings, and should be editable as text boxes in MyTunings (except showDiamonds is a checkbox).  For the values that are arrays, they should be normalized on string input allowing the user to skip the brackets `[]` but should be stored as JSON/ES6 arrays:
      "showDiamonds": true,
      "diamonds": [3, 5, 7, 9, 15, 17, 19, 21],
      "doubleDiamonds": [12, 24],
      "faceDiamondsStrings: [2],
      "faceDoubleDiamondStrings:[1,3],
      "faceTinyDiamondsStrings:[0,1,3,4],
      "faceDiamondsLeft": 50%,
      "faceDoubleDiamondsLeft": 100%,
      "faceTinyDiamondsLeft": 50%,
      
3. Since specialBackgroundRows is zero-based, let the property names and User-facing indexing for strings for diamonds be zero-based.

4. Using the above CSS, the diamond sits on the bottom of the cell.  Therefore, there can never be a diamond on the top of the top row of strings.  There can be a diamond on the bottom of the bottom row.  Both of these are good.

5. Theme-able properties give colors to the face diamonds, and follow the Diamonds and DoubleDiamonds theme-ing.

e.g. `dropDownDiamondsSize` in the Theme needs to have new siblings: 

dropDownFaceDiamondsSize
dropDownFaceDoubleDiamondsSize
dropDownFaceTinyDiamondsSize
dropDownFaceDiamondsColor
dropDownFaceDoubleDiamondsColor
      

6. Three new diamond classes will appear on the face of the Instrument in the same columns as diamonds and doubleDiamonds: 

  A. FaceDiamonds at faceDiamondsLeft, using FaceDiamondsColor, on the rows indicated by faceDiamondsStrings, and in the columns the same as tunings["diamonds"] and tunings["doubleDiamonds"] arrays.

  B. FaceTinyDiamonds at faceTinyDiamondsLeft, using FaceDiamondsColor, on the rows indicated by faceTinyDiamondsStrings, and in the columns the same as tunings["diamonds"] and tunings["doubleDiamonds"] arrays. FaceTinyDiamonds use the FaceDiamonds color. 

  C. FaceDoubleDiamonds appear in the doubleDiamonds columns, using the dropDownFaceDoubleDiamondsColor and dropDownFaceDoubleDiamondsSize, and the faceDoubleDiamondStrings.


### Request

Some of this needs to be cranked out in code, the rest of it should be in CSS classes that are editable, in infinite-neck.css in the `Instrument / NoteTable / FretTable ` area.  We would guess there'd be three main CSS classes, plus CSS vars for the colors and sizes, following the Theme and storage pattern for the existing properties and theme properties.

Hopefully we specified it right, but it seems that column 0 is the Nut, so column 1 is the "first fret" and diamonds:"[3]" creates a diamond in column 3, left a bit and centered.  So the calculation should be the same here.  Left of the fret/right edge of the cell, centered on the bottom of the cell if "Placement" is 50%.

Please make adjustments if we bungled some of the example property names.


