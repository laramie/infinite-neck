// Built-in MIDI Paste string maps (sprint 151).
//
// Key:   "<source tuning id> > <dest tuning id>"   (tuning ids match by lineage id, see midiPasteMaps.js)
// Value: "source:dest, source:dest, ..."           (1-based string numbers; 1 is the top string on the page)
//
// Edit this list by hand.  Strings left out of a map are simply not pasted / receive nothing.
// The reverse direction of any "A > B" map is inferred, so do not add "B > A" unless it must differ.
export const BUILTIN_MIDI_PASTE_MAPS = Object.freeze({
  'P46 > P48': '1:1, 2:2, 3:3, 4:4, 5:5, 6:6',
  'P48 > P46': '1:1, 2:2, 3:3, 4:4, 5:5, 6:6',
  'P46 > S6': '1:1, 2:2, 3:3, 4:4, 5:5, 6:6',
  'P48 > S6': '1:1, 2:2, 3:3, 4:4, 5:5, 6:6',
  'Bass5 > Bass4': '1:1, 2:2, 3:3, 4:4',
  'Bass6 > Bass4': '2:1, 3:2, 4:3, 5:4',
  'Bass6 > Bass5': '2:1, 3:2, 4:3, 5:4, 6:5'
});

export default BUILTIN_MIDI_PASTE_MAPS;
