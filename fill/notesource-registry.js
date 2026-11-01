// fill/notesource-registry.js
// Registry of "notesource" algorithms that Tool tables can wire to via the
// Wiring UI (a Wiring whose listenToTablename is a virtual ns... id instead
// of a real table id). Pure module: no getSong()/DOM/jQuery dependencies.
// See _doco/design/sprints/140-tool-notesource/140-design-alt-analysis.md
// sections 7 and 8 for the design this implements.

import * as Constants from '../Constants.js';
import { Note } from '../Note.js';
import { computeRoleNoteSets } from './fill-role-engine.js';

function buildNamedNote(noteName, colorClass) {
  return {
    noteName,
    styleNum: Note.STYLENUM_NAMED,
    colorClass,
    owner: 'notesource'
  };
}

/** Perfect4thsCalculator: every named note is always present. Colored via a
 *  baseline 'noteScale' class; the existing AutoColor pipeline
 *  (colorFunctions.js::lookupClassForNote) recolors by function number
 *  relative to whatever Section's rootID is live at render time, so the same
 *  fixed set of notes automatically re-colors/re-labels itself as the song
 *  moves between Sections with different keys. */
function resolveEveryNamedNote() {
  const namedNotes = {};
  Constants.NOTE_NAMES_ARRAY.forEach((noteName) => {
    namedNotes[noteName] = buildNamedNote(noteName, 'noteScale');
  });
  return namedNotes;
}

/** Shows just the current chart chord's tones, anchored to the Section's
 *  rootID (design doc's "chart chord on a one-string tuning" use case). */
function resolveChartChordAtRoot({ rootID = 0, chartChord = '' } = {}) {
  const roleNoteSets = computeRoleNoteSets({
    rootID,
    chordSource: chartChord,
    modeSource: '',
    useSectionChart: true,
    transposeChartToRootID: true
  });
  const namedNotes = {};
  (roleNoteSets.chord || new Set()).forEach((noteName) => {
    namedNotes[noteName] = buildNamedNote(noteName, 'noteChord');
  });
  return namedNotes;
}

/** Shows just the current chart chord's tones exactly as charted, preserving
 *  the chart tonic instead of anchoring to Section.rootID. */
function resolveChartChordAsCharted({ rootID = 0, chartChord = '' } = {}) {
  const roleNoteSets = computeRoleNoteSets({
    rootID,
    chordSource: chartChord,
    modeSource: '',
    useSectionChart: true,
    transposeChartToRootID: false
  });
  const namedNotes = {};
  (roleNoteSets.chord || new Set()).forEach((noteName) => {
    namedNotes[noteName] = buildNamedNote(noteName, 'noteChord');
  });
  return namedNotes;
}

const NOTESOURCE_REGISTRY = [
  {
    id: `${Constants.NOTESOURCE_ID_PREFIX}EveryNamedNote`,
    caption: 'Calculator',
    resolve: () => resolveEveryNamedNote()
  },
  {
    id: `${Constants.NOTESOURCE_ID_PREFIX}ChartChordAtRoot`,
    caption: 'Chart chord at Section Root',
    resolve: (sectionContext) => resolveChartChordAtRoot(sectionContext)
  },
  {
    id: `${Constants.NOTESOURCE_ID_PREFIX}ChartChordAsCharted`,
    caption: 'Chart chord as charted',
    resolve: (sectionContext) => resolveChartChordAsCharted(sectionContext)
  }
];

const NOTESOURCE_REGISTRY_MAP = new Map(NOTESOURCE_REGISTRY.map((entry) => [entry.id, entry]));

export function isNotesourceID(candidateID) {
  return typeof candidateID === 'string' && candidateID.startsWith(Constants.NOTESOURCE_ID_PREFIX);
}

/** Returns [{id, caption}, ...] for populating the Wiring select's Notesources optgroup. */
export function getNotesourceEntries() {
  return NOTESOURCE_REGISTRY.map((entry) => ({ id: entry.id, caption: entry.caption }));
}

/** Resolves a notesource id + section context (rootID, chartChord, ...) into a
 *  namedNotes-shaped map: { [noteName]: { noteName, styleNum, colorClass, owner } },
 *  matching the shape of Section.sectionNotesByTable[tableID].namedNotes so
 *  NoteTableController.replayTable() can paint it through the existing
 *  lookupUserColorClass()/styleNamedNote() pipeline unchanged.
 *  Returns null if notesourceID is not a registered notesource. */
export function resolveNotesourceNamedNotes(notesourceID, sectionContext = {}) {
  const entry = NOTESOURCE_REGISTRY_MAP.get(notesourceID);
  if (!entry) {
    return null;
  }
  return entry.resolve(sectionContext);
}
