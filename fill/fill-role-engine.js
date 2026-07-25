import * as Constants from '../Constants.js';
import {
  chordNotesFromStoredChord,
  modeNotesFromStoredMode,
  chordNotesFromType,
  modeNotesFromType
} from '../plugins/chart/chart-tonal-resolver.js';

export const MODE_NONE = 'none';
export const MODE_KEEP = 'keep';
export const MODE_ROLE = 'role';
export const ROLE_PASS_ORDER = ['scale', 'chord', 'root'];

export function computeRoleNoteSets({
  rootID = 0,
  chordSource = '',
  modeSource = '',
  useSectionChart = false
} = {}) {
  const normalizedRootID = Number.parseInt(rootID, 10) || 0;
  const rootName = Constants.NOTE_NAMES_ARRAY[normalizedRootID] || Constants.NOTE_NAMES_ARRAY[0];

  const chordSet = useSectionChart
    ? chordNotesFromStoredChord(`${chordSource || ''}`, normalizedRootID, { transposeToRootID: true })
    : chordNotesFromType(`${chordSource || ''}`, normalizedRootID);

  const modeSet = useSectionChart
    ? modeNotesFromStoredMode(`${modeSource || ''}`, normalizedRootID, { transposeToRootID: true })
    : modeNotesFromType(`${modeSource || ''}`, normalizedRootID);

  return {
    root: new Set([rootName]),
    chord: chordSet,
    scale: modeSet
  };
}

export function collectRoleNoteNames(roleNoteSets = {}) {
  const noteNames = new Set();
  Object.values(roleNoteSets).forEach((noteSet) => {
    (noteSet || []).forEach((noteName) => noteNames.add(noteName));
  });
  return noteNames;
}

export function resolveRoleDecision(noteName, roleNoteSets = {}, {
  getModeForRole,
  getColorForRole,
  rolePassOrder = ROLE_PASS_ORDER
} = {}) {
  let matched = false;
  let preserveExisting = false;
  let outputColorValue = null;

  (rolePassOrder || ROLE_PASS_ORDER).forEach((roleName) => {
    if (!roleNoteSets[roleName]?.has(noteName)) {
      return;
    }

    matched = true;
    const modeValue = `${(typeof getModeForRole === 'function') ? getModeForRole(roleName) : MODE_NONE}`;
    if (modeValue === MODE_KEEP) {
      preserveExisting = true;
      return;
    }

    preserveExisting = false;
    if (modeValue === MODE_ROLE) {
      outputColorValue = (typeof getColorForRole === 'function') ? getColorForRole(roleName) : null;
      return;
    }

    outputColorValue = null;
  });

  return {
    matched,
    preserveExisting,
    outputColorValue
  };
}

export function buildNamedRolePlan(roleNoteSets = {}, {
  getModeForRole,
  getColorForRole,
  buildNamedNote,
  rolePassOrder = ROLE_PASS_ORDER
} = {}) {
  const notePlans = [];
  collectRoleNoteNames(roleNoteSets).forEach((noteName) => {
    const decision = resolveRoleDecision(noteName, roleNoteSets, {
      getModeForRole,
      getColorForRole,
      rolePassOrder
    });
    if (!decision.matched) {
      return;
    }
    notePlans.push({
      noteName,
      preserveExisting: decision.preserveExisting,
      outputNote: decision.outputColorValue
        ? (typeof buildNamedNote === 'function' ? buildNamedNote(noteName, decision.outputColorValue) : null)
        : null
    });
  });
  return { notePlans };
}

export function applyNamedPlanToSectionNotes(sectionNotes, plan = { notePlans: [] }) {
  let added = 0;
  let kept = 0;

  (plan.notePlans || []).forEach((notePlan) => {
    const existingNote = sectionNotes?.namedNotes?.[notePlan.noteName];
    if (notePlan.preserveExisting && existingNote) {
      kept += 1;
      return;
    }
    if (existingNote) {
      sectionNotes.clearNamedNote(notePlan.noteName);
    }
    if (notePlan.outputNote) {
      sectionNotes.setNamedNote(notePlan.noteName, notePlan.outputNote);
      added += 1;
    }
  });

  return { added, kept };
}

export function legacyFillColorToRoleMode(colorValue = '') {
  const normalized = `${colorValue || ''}`;
  if (normalized === 'noteKeep') {
    return MODE_KEEP;
  }
  if (normalized === 'noteClear' || normalized === 'noteHighlightSingle') {
    return MODE_KEEP;
  }
  return MODE_ROLE;
}
