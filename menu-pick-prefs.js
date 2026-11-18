// Session-only display prefs for generated pick-lists (sprint 156): /vml lines, /vmc columns.
// They change layout only.  They never change which key picks which item.

export const DEFAULT_PICK_LINES = 9;
export const MAX_PICK_LINES = 99;

let gPickLines = DEFAULT_PICK_LINES;
let gPickColumns = true;

export function getPickLines() {
  return gPickLines;
}

export function getPickColumns() {
  return gPickColumns;
}

/** Accepts an integer from 0 to MAX_PICK_LINES (0 = no limit, one column).  Returns the stored value, or null if invalid. */
export function setPickLines(rawValue) {
  const text = `${rawValue ?? ''}`.trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const lines = Number.parseInt(text, 10);
  if (lines > MAX_PICK_LINES) {
    return null;
  }
  gPickLines = lines;
  return gPickLines;
}

export function setPickColumns(enabled) {
  gPickColumns = !!enabled;
  return gPickColumns;
}

export function resetPickPrefs() {
  gPickLines = DEFAULT_PICK_LINES;
  gPickColumns = true;
}
