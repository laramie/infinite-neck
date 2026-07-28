import properties from './properties.json' with { type: 'json' };
import { PluginProperty, buildCaption, buildValueReference } from '../PluginProperty.js';
import { MenuItemProxy } from '../MenuItemProxy.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { lookupClassForNote } from '../../colorFunctions.js';
import { getSong, transposeSong } from '../../infinite-neck.js';
import { createTuningLayout, getPreferredCellForMidi } from '../../move-helpers.js';

const TRANSPOSE_PROG_EM_OPEN = '<em class="transposeProg">';
const TRANSPOSE_PROG_EM_CLOSE = '</em>';
const AUTO_COLOR_CLASS_RE = /^note([1-9]|1[0-2])$/;
const PLAYED_TRANSPOSE_STYLES_BY_PROPERTY = new Map([
  ['SingleNotes', Note.STYLENUM_SINGLE],
  ['TinyNotes', Note.STYLENUM_TINY],
  ['BendNotes', Note.STYLENUM_BEND],
  ['FingeringNotes', Note.STYLENUM_FINGERING]
]);
const PLAYED_TRANSPOSE_STYLES = new Set(PLAYED_TRANSPOSE_STYLES_BY_PROPERTY.values());
const RECORDED_TRANSPOSE_STYLES = new Set([
  Note.STYLENUM_SINGLE,
  Note.STYLENUM_TINY,
  Note.STYLENUM_BEND,
  Note.STYLENUM_FINGERING,
  Note.STYLENUM_MIDIPITCHES,
  Note.STYLENUM_MIDIPITCHESSINGLE
]);
const CELL_BOUND_RECORDED_TRANSPOSE_STYLES = new Set([
  Note.STYLENUM_SINGLE,
  Note.STYLENUM_TINY,
  Note.STYLENUM_BEND,
  Note.STYLENUM_FINGERING,
  Note.STYLENUM_MIDIPITCHESSINGLE
]);

function canonicalizeIntervals(rawIntervals) {
  if (!Array.isArray(rawIntervals) || rawIntervals.length === 0) {
    throw new Error('intervals must contain at least one integer');
  }

  const parsed = rawIntervals.map((value) => {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    const normalized = Number.parseInt(`${value}`.trim(), 10);
    if (!Number.isInteger(normalized)) {
      throw new Error(`intervals must contain only integers, received: ${value}`);
    }
    return normalized;
  });

  return [0, ...parsed.filter((value) => value !== 0)];
}

function normalizeIntervalsInput(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  const text = `${rawValue}`.trim();
  if (text.length === 0) {
    throw new Error('intervals must contain at least one integer');
  }

  const normalizedJson = text.startsWith('[') ? text : `[${text}]`;
  return JSON.parse(normalizedJson);
}

function normalizeNoteIndex(noteIndex) {
  const normalized = Number.parseInt(noteIndex, 10);
  if (!Number.isInteger(normalized)) {
    return 0;
  }
  return ((normalized % 12) + 12) % 12;
}

function formatOptions(propertiesByName) {
  return {
    NamedNotes: !!propertiesByName.get('NamedNotes')?.getValue(),
    doKeyLead: !!propertiesByName.get('doLeadKey')?.getValue()
  };
}

function toInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function valuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function normalizeOctavesInput(rawValue) {
  const text = `${rawValue ?? ''}`.trim();
  if (text === '') {
    return { value: '', cap: 0, isFullNeck: true, notice: '' };
  }
  if (!/^\d+$/.test(text)) {
    return {
      value: '0',
      cap: 0,
      isFullNeck: true,
      notice: `Transpose octaves normalized to 0 from invalid value: ${rawValue}`
    };
  }
  const cap = Number.parseInt(text, 10);
  if (cap <= 0) {
    return { value: '0', cap: 0, isFullNeck: true, notice: '' };
  }
  return { value: `${cap}`, cap, isFullNeck: false, notice: '' };
}

function buildRecordedNotes(recordedNotes = {}, mapFn) {
  const result = {};
  Object.entries(recordedNotes || {}).forEach(([beat, notesForBeat]) => {
    result[`${beat}`] = (notesForBeat || []).map((note, index) => mapFn(note, `${beat}`, index));
  });
  return result;
}

function getCellKey(note) {
  const row = toInt(note?.row, null);
  const col = toInt(note?.col, null);
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return null;
  }
  return `${row}:${col}`;
}

function getPlayedCollisionKey(note) {
  const styleNum = toInt(note?.styleNum, null);
  if (!PLAYED_TRANSPOSE_STYLES.has(styleNum)) {
    return null;
  }

  const cellKey = getCellKey(note);
  if (!cellKey) {
    return null;
  }

  if (styleNum === Note.STYLENUM_SINGLE) {
    return `single:${cellKey}`;
  }
  if (styleNum === Note.STYLENUM_TINY || styleNum === Note.STYLENUM_BEND) {
    return `tinybend:${cellKey}`;
  }
  if (styleNum === Note.STYLENUM_FINGERING) {
    return `fingering:${cellKey}`;
  }
  return null;
}

function detectPlayedNoteCollisions(playedNotes = []) {
  let collision = false;
  const playedKeys = new Set();

  (playedNotes || []).forEach((note) => {
    const key = getPlayedCollisionKey(note);
    if (!key) {
      return;
    }
    if (playedKeys.has(key)) {
      collision = true;
    }
    playedKeys.add(key);
  });

  return collision;
}

function shouldRecalculateColor(colorClass) {
  return AUTO_COLOR_CLASS_RE.test(`${colorClass || ''}`);
}

function getTuningByTableID(song, tableID) {
  return (song?.myTunings || []).find((tuning) => `${Constants.TABLE_ID_PREFIX}${tuning.baseID}` === `${tableID}`) || null;
}

function getRowBoundaries(layout, row) {
  const rowLayout = layout?.rows?.[row] || null;
  const nutCell = rowLayout?.nutCell || null;
  const maxVisibleCell = rowLayout?.cells?.[rowLayout.cells.length - 1] || null;
  if (!nutCell || !maxVisibleCell) {
    return null;
  }
  return {
    minVisibleFret: nutCell.col,
    maxVisibleFret: maxVisibleCell.col
  };
}

function isRecordedTransposeStyle(styleNum) {
  return RECORDED_TRANSPOSE_STYLES.has(styleNum);
}

function isCellBoundRecordedTransposeStyle(styleNum) {
  return CELL_BOUND_RECORDED_TRANSPOSE_STYLES.has(styleNum);
}

function getRowNutCol(layout, row) {
  return toInt(layout?.rows?.[row]?.nutCell?.col, null);
}

function isNutLanding(layout, row, col) {
  const nutCol = getRowNutCol(layout, row);
  return Number.isInteger(nutCol) && nutCol === col;
}

function normalizePitchDeltaStringOneOctave(delta) {
  let normalized = delta;
  while (normalized > 12) {
    normalized -= 12;
  }
  while (normalized < -12) {
    normalized += 12;
  }
  return normalized;
}

function normalizePitchDeltaForOctaves(delta, octavesMode) {
  if (octavesMode?.isFullNeck) {
    return delta;
  }
  const step = Math.max(12, (octavesMode?.cap || 0) * 12);
  let normalized = delta;
  while (normalized > step) {
    normalized -= step;
  }
  while (normalized < -step) {
    normalized += step;
  }
  return normalized;
}

function resolveSourceFret(note, tuning, row) {
  const sourceFretFromCol = toInt(note?.col, null);
  if (Number.isInteger(sourceFretFromCol)) {
    return sourceFretFromCol;
  }

  const openMidi = toInt(tuning?.rowRange?.[row], null);
  const sourceMidinum = toInt(note?.midinum, null);
  if (Number.isInteger(openMidi) && Number.isInteger(sourceMidinum)) {
    return sourceMidinum - openMidi;
  }
  return null;
}

function logMalformedRecordedTransposeNote(tableID, beat, reason) {
  console.log(`TransposePlugin recorded note preserved unchanged: ${reason} in table ${tableID} beat ${beat}`);
}

function normalizeFretForRecordedTranspose(targetFret, layout, row, isBend, mode) {
  const nutCol = getRowNutCol(layout, row);
  if (!Number.isInteger(nutCol)) {
    return null;
  }

  let normalized = targetFret;
  while (normalized < nutCol) {
    normalized += 12;
  }

  if (mode === 'oneOctave') {
    const threshold = nutCol + 12;
    while (normalized > threshold) {
      normalized -= 12;
    }
  }

  while (isBend && isNutLanding(layout, row, normalized)) {
    normalized += 12;
  }

  return normalized;
}

function normalizeFretForRecordedOctaves(targetFret, layout, row, isBend, octavesMode) {
  const boundaries = getRowBoundaries(layout, row);
  if (!boundaries) {
    return null;
  }

  let normalized = targetFret;
  while (normalized < boundaries.minVisibleFret) {
    normalized += 12;
  }

  if (!octavesMode.isFullNeck) {
    const step = Math.max(12, octavesMode.cap * 12);
    const threshold = boundaries.minVisibleFret + step;
    while (normalized > threshold) {
      normalized -= step;
    }
  } else {
    const wrapStep = Math.floor((boundaries.maxVisibleFret - boundaries.minVisibleFret) / 12) * 12;
    while (wrapStep > 0 && normalized > boundaries.maxVisibleFret) {
      normalized -= wrapStep;
    }
  }

  while (isBend && isNutLanding(layout, row, normalized)) {
    normalized += 12;
  }

  return normalized;
}

function normalizeCellBoundNoteColor(note, section) {
  if (!shouldRecalculateColor(note?.colorClass)) {
    return note?.colorClass;
  }
  const lookedUp = lookupClassForNote(note, { section, autoColor: true });
  return lookedUp?.colorClass || note.colorClass;
}

function transposePlayedNoteOnString(note, delta, tuning, layout, section, octavesMode) {
  const row = toInt(note?.row, null);
  if (!Number.isInteger(row)) {
    return clone(note);
  }

  const boundaries = getRowBoundaries(layout, row);
  const openMidi = toInt(tuning?.rowRange?.[row], null);
  if (!boundaries || !Number.isInteger(openMidi)) {
    return clone(note);
  }

  const sourceFretFromCol = toInt(note?.col, null);
  const sourceMidinum = toInt(note?.midinum, null);
  const sourceFret = Number.isInteger(sourceFretFromCol)
    ? sourceFretFromCol
    : (Number.isInteger(sourceMidinum) ? sourceMidinum - openMidi : null);
  if (!Number.isInteger(sourceFret)) {
    return clone(note);
  }

  let targetFret = sourceFret + delta;
  while (targetFret < boundaries.minVisibleFret) {
    targetFret += 12;
  }

  if (!octavesMode.isFullNeck) {
    const step = Math.max(12, octavesMode.cap * 12);
    const threshold = boundaries.minVisibleFret + step;
    while (targetFret > threshold) {
      targetFret -= step;
    }
  } else {
    const wrapStep = Math.floor((boundaries.maxVisibleFret - boundaries.minVisibleFret) / 12) * 12;
    while (wrapStep > 0 && targetFret > boundaries.maxVisibleFret) {
      targetFret -= wrapStep;
    }
  }

  if (toInt(note?.styleNum, null) === Note.STYLENUM_BEND) {
    while (isNutLanding(layout, row, targetFret)) {
      targetFret += 12;
    }
  }

  const targetMidinum = openMidi + targetFret;
  const moved = clone(note);
  moved.row = `${row}`;
  moved.col = `${targetFret}`;
  moved.midinum = `${targetMidinum}`;
  moved.noteName = Constants.midinumToNoteName(targetMidinum);
  moved.colorClass = normalizeCellBoundNoteColor(moved, section);
  return moved;
}

function transposeSectionTablePlayedNotes(sectionNotes, delta, tuning, section, octavesMode, includedStyles) {
  const layout = createTuningLayout(tuning);
  const playedNotes = (sectionNotes?.playedNotes || []).map((note) => {
    if (!includedStyles.has(toInt(note?.styleNum, null))) {
      return clone(note);
    }
    return transposePlayedNoteOnString(note, delta, tuning, layout, section, octavesMode);
  });

  return {
    playedNotes,
    recordedNotes: clone(sectionNotes?.recordedNotes || {}),
    collision: detectPlayedNoteCollisions(playedNotes)
  };
}

function transposeCellBoundRecordedNote(note, delta, tuning, layout, section, tableID, beat, mode, octavesMode = null) {
  const row = toInt(note?.row, null);
  const styleNum = toInt(note?.styleNum, null);
  if (!Number.isInteger(row)) {
    logMalformedRecordedTransposeNote(tableID, beat, 'malformed row');
    return clone(note);
  }

  const boundaries = getRowBoundaries(layout, row);
  const openMidi = toInt(tuning?.rowRange?.[row], null);
  if (!boundaries || !Number.isInteger(openMidi)) {
    logMalformedRecordedTransposeNote(tableID, beat, 'malformed tuning row');
    return clone(note);
  }

  const sourceFret = resolveSourceFret(note, tuning, row);
  if (!Number.isInteger(sourceFret)) {
    logMalformedRecordedTransposeNote(tableID, beat, 'malformed col/midinum');
    return clone(note);
  }

  const targetFret = mode === 'octaves'
    ? normalizeFretForRecordedOctaves(sourceFret + delta, layout, row, styleNum === Note.STYLENUM_BEND, octavesMode)
    : normalizeFretForRecordedTranspose(
      sourceFret + delta,
      layout,
      row,
      styleNum === Note.STYLENUM_BEND,
      mode
    );
  if (!Number.isInteger(targetFret)) {
    logMalformedRecordedTransposeNote(tableID, beat, 'malformed nut boundary');
    return clone(note);
  }

  const targetMidinum = openMidi + targetFret;
  const moved = clone(note);
  moved.row = `${row}`;
  moved.col = `${targetFret}`;
  moved.midinum = `${targetMidinum}`;
  moved.noteName = Constants.midinumToNoteName(targetMidinum);
  moved.colorClass = normalizeCellBoundNoteColor(moved, section);
  return moved;
}

function transposePitchRecordedNote(note, delta, layout, tableID, beat, mode, octavesMode = null) {
  const sourceMidinum = toInt(note?.midinum, null);
  if (!Number.isInteger(sourceMidinum)) {
    logMalformedRecordedTransposeNote(tableID, beat, 'malformed midinum');
    return clone(note);
  }

  const pitchDelta = mode === 'octaves'
    ? normalizePitchDeltaForOctaves(delta, octavesMode)
    : normalizePitchDeltaStringOneOctave(delta);
  const targetMidinum = sourceMidinum + pitchDelta;
  const preferredRow = toInt(note?.row, null);
  const targetCell = getPreferredCellForMidi(layout, targetMidinum, Number.isInteger(preferredRow) ? preferredRow : null);
  const moved = clone(note);
  moved.midinum = `${targetMidinum}`;
  moved.noteName = Constants.midinumToNoteName(targetMidinum);
  moved.row = `${targetCell?.row ?? (Number.isInteger(preferredRow) ? preferredRow : 0)}`;
  delete moved.col;
  return moved;
}

function transposeRecordedNote(note, delta, tuning, layout, section, tableID, beat, mode, octavesMode = null) {
  const styleNum = toInt(note?.styleNum, null);
  if (!isRecordedTransposeStyle(styleNum)) {
    return clone(note);
  }
  if (isCellBoundRecordedTransposeStyle(styleNum)) {
    return transposeCellBoundRecordedNote(note, delta, tuning, layout, section, tableID, beat, mode, octavesMode);
  }
  return transposePitchRecordedNote(note, delta, layout, tableID, beat, mode, octavesMode);
}

function getRecordedCollisionKey(note, beat) {
  const styleNum = toInt(note?.styleNum, null);
  if (!isRecordedTransposeStyle(styleNum)) {
    return null;
  }

  if (styleNum === Note.STYLENUM_MIDIPITCHES) {
    return `pitch:${beat}`;
  }

  const cellKey = getCellKey(note);
  if (!cellKey) {
    return null;
  }

  if (styleNum === Note.STYLENUM_SINGLE) {
    return `single:${beat}:${cellKey}`;
  }
  if (styleNum === Note.STYLENUM_TINY || styleNum === Note.STYLENUM_BEND) {
    return `tinybend:${beat}:${cellKey}`;
  }
  if (styleNum === Note.STYLENUM_FINGERING) {
    return `fingering:${beat}:${cellKey}`;
  }
  if (styleNum === Note.STYLENUM_MIDIPITCHESSINGLE) {
    return `multi:${beat}:${cellKey}`;
  }
  return null;
}

function detectRecordedTransformCollision(recordedNotes = {}) {
  let collision = false;
  Object.entries(recordedNotes || {}).forEach(([beat, notesForBeat]) => {
    const keys = new Set();
    (notesForBeat || []).forEach((note) => {
      const key = getRecordedCollisionKey(note, beat);
      if (!key) {
        return;
      }
      if (keys.has(key)) {
        collision = true;
      }
      keys.add(key);
    });
  });
  return collision;
}

function transposeRecordedNotesForSectionTable(sectionNotes, delta, tuning, section, tableID, mode = 'oneOctave', octavesMode = null) {
  const layout = createTuningLayout(tuning);
  const recordedNotes = buildRecordedNotes(sectionNotes?.recordedNotes || {}, (note, beat) => (
    transposeRecordedNote(note, delta, tuning, layout, section, tableID, beat, mode, octavesMode)
  ));

  return {
    recordedNotes,
    collision: detectRecordedTransformCollision(recordedNotes)
  };
}

export class TransposePlugin {
  constructor() {
    this.id = 'transpose';
    this.registeredName = 'transpose';
    this.menuTrigger = 't';
    this.eventNames = ['DaCapo:OnSongEnd', 'Looper:OnResetSong'];
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
    this.canonicalizeIntervalsProperty();
    this.resetRuntimeState();
  }

  setManager(manager) {
    this.manager = manager;
  }

  getId() {
    return this.id;
  }

  getRegisteredName() {
    return this.registeredName;
  }

  getMenuTrigger() {
    return this.menuTrigger;
  }

  getEventNames() {
    return [...this.eventNames];
  }

  getProperties() {
    return [...this.properties];
  }

  getProperty(name) {
    return this.propertyMap.get(name) || null;
  }

  getVisibleMenuChildren() {
    return [
      this.getProperty('apply')?.getMenuNodeSpec(this),
      this.buildResetMenuNode(),
      this.getProperty('intervals')?.getMenuNodeSpec(this),
      this.buildIncludeMenuNode(),
      ...['octaves', 'useOctavesForRecorded', 'autoSharpsFlats', 'doLeadKey']
         .map((propertyName) => this.getProperty(propertyName)?.getMenuNodeSpec(this)),
      this.getProperty('help')?.getMenuNodeSpec(this),
    ].filter(Boolean);
  }

  buildIncludeMenuNode() {
    const token = `plugin:${this.id}:includeSummary`;
    return new MenuItemProxy(this, {
      name: 'include',
      caption: `${buildCaption('include', 'i')}${buildValueReference(token)}`,
      trigger: 'i',
      vars: [token],
      children: [
        this.getProperty('NamedNotes')?.getMenuNodeSpec(this),
        this.getProperty('SingleNotes')?.getMenuNodeSpec(this),
        this.getProperty('TinyNotes')?.getMenuNodeSpec(this),
        this.getProperty('BendNotes')?.getMenuNodeSpec(this),
        this.getProperty('FingeringNotes')?.getMenuNodeSpec(this),
        this.getProperty('RecordedNotes')?.getMenuNodeSpec(this)
      ].filter(Boolean)
    });
  }

  buildResetMenuNode() {
    return new MenuItemProxy(this, {
      name: 'resetMenu',
      caption: buildCaption('Reset', 'R'),
      trigger: 'R',
      children: [
        this.buildResetChildNode('resetOriginal', 'original', 'o'),
        this.buildResetChildNode('resetCurrentInterval', 'current interval', 'c'),
        this.buildResetChildNode('setOriginalToCurrent', 'set original to current', 's')
      ]
    });
  }

  buildResetChildNode(actionName, caption, trigger) {
    return new MenuItemProxy(this, {
      name: actionName,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName,
      popOnBang: true
    });
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
    this.canonicalizeIntervalsProperty();
    this.resetRuntimeState();
  }

  loadSongState(persistedProperties = {}) {
    this.resetToDefaults();
    Object.entries(persistedProperties).forEach(([name, value]) => {
      const property = this.getProperty(name);
      if (!property || property.datatype === 'org.dynamide.Action') {
        return;
      }
      this.setPropertyValue(name, value);
    });
    if (Object.keys(persistedProperties).length > 0) {
      this.wakeAtCurrentPosition();
      this.restartIntervalSequence();
    }
  }

  exportSongState() {
    const result = {};
    this.properties.forEach((property) => {
      if (property.datatype === 'org.dynamide.Action') {
        return;
      }
      result[property.name] = property.toPersistedValue();
    });
    return result;
  }

  setPropertyValue(name, rawValue) {
    const property = this.getProperty(name);
    if (!property) {
      throw new Error(`TransposePlugin unknown property: ${name}`);
    }
    this.wakeAtCurrentPosition();

    let nextValue;
    if (name === 'intervals') {
      nextValue = property.setValue(canonicalizeIntervals(property.normalize(normalizeIntervalsInput(rawValue))));
    } else if (name === 'octaves') {
      const normalized = normalizeOctavesInput(rawValue);
      nextValue = property.setValue(normalized.value);
      if (normalized.notice) {
        this.setOperationMessage(normalized.notice);
      }
    } else {
      nextValue = property.setValue(rawValue);
    }

    if (name === 'intervals') {
      this.sequenceBaselineOffset = this.liveSongOffset;
      this.restartIntervalSequence();
    }
    return nextValue;
  }

  resolveValue(fieldName) {
    if (fieldName === 'currentInterval') {
      return this.currentAppliedInterval;
    }
    if (fieldName === 'currentOffset') {
      return this.getCurrentSequenceOffset();
    }
    if (fieldName === 'originalOffset') {
      return this.getCurrentOriginalOffset();
    }
    if (fieldName === 'includeSummary') {
      return ` ${this.buildIncludeFlagsSummary()}`;
    }
    return undefined;
  }

  enable() {
    this.wakeAtCurrentPosition();
    return 'Transpose enabled';
  }

  disable() {
    return 'Transpose disabled';
  }

  beforeBury() {
    const sequenceOffset = this.getCurrentSequenceOffset();
    const originalOffset = this.getCurrentOriginalOffset();
    if (sequenceOffset === 0 && originalOffset === 0) {
      return { proceed: true };
    }
    return {
      proceed: true,
      warning: `Transpose current interval=${this.currentAppliedInterval}, sequence offset=${sequenceOffset}, original offset=${originalOffset}. Continuing will bury the current settings from this live transposed state. Continue?`
    };
  }

  handleEvent(eventName, payload = {}, context = {}) {
    this.clearOperationMessage();
    if (eventName === 'Looper:OnResetSong') {
      const song = context.song || this.manager?.song || getSong();
      return this.buildActionResponse(payload?.hard ? this.resetOriginal(song) : this.resetCurrentInterval(song));
    }
    return this.buildActionResponse(this.advanceInterval(`event ${eventName}`, context.song || this.manager?.song || getSong()));
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || this.manager?.song || getSong();
    this.clearOperationMessage();
    switch (actionName) {
      case 'apply':
        return this.buildActionResponse(this.advanceInterval('manual apply', song));
      case 'reset':
      case 'resetCurrentInterval':
        return this.buildActionResponse(this.resetCurrentInterval(song));
      case 'resetOriginal':
        return this.buildActionResponse(this.resetOriginal(song));
      case 'setOriginalToCurrent':
        return this.buildActionResponse(this.setOriginalToCurrent(song));
      case 'help':
        return {
          result: 'Transpose help shown',
          message: this.buildHelpMessage()
        };
      default:
        return { result: `Unknown transpose action: ${actionName}` };
    }
  }

  buildSummary() {
    return `current interval=${this.currentAppliedInterval} sequence offset=${this.getCurrentSequenceOffset()} original offset=${this.getCurrentOriginalOffset()} auto sharps/flats=${this.getAutoSharpsFlatsEnabled()} do lead key=${this.getDoLeadKeyEnabled()} include=${this.buildIncludeFlagsSummary()} octaves=${this.getOctavesDisplayValue()} use octaves for recorded=${this.getUseOctavesForRecordedEnabled()}`;
  }

  buildHelpMessage() {
    const graveyardKey = this.manager?.resolveValue(`plugin:${this.getId()}:graveyardKey`) || 'USER';
    return `<pre>${buildPluginHelpHeader(this, 'Transpose plugin:', this.buildSummary())}

Current settings:
- ${this.buildSummary()}
- chroma = ${JSON.stringify(this.getIntervals())}
- graveyard key = ${graveyardKey}
- named notes = ${this.getNamedNotesEnabled()}
- single notes = ${this.getSingleNotesEnabled()}
- tiny notes = ${this.getTinyNotesEnabled()}
- bend notes = ${this.getBendNotesEnabled()}
- fingering notes = ${this.getFingeringNotesEnabled()}
- recorded notes = ${this.getRecordedNotesEnabled()}
- octaves = ${this.getOctavesDisplayValue()} (legal values: empty, 0, or positive integer)
- use octaves for recorded = ${this.getUseOctavesForRecordedEnabled()}
- chroma list is canonicalized to start from 0
- each trigger advances to the next interval
- Reset > original returns to the original session baseline and restarts from 0
- Reset > current interval returns to the current sequence baseline and restarts from 0
- Reset > set original to current rebases both baselines to the current live Song state

${buildPluginEventsHelpFooter(this)}</pre>`;
  }

  getIntervals() {
    const value = this.getProperty('intervals')?.getValue();
    return Array.isArray(value) ? canonicalizeIntervals(value) : [];
  }

  getNamedNotesEnabled() {
    return !!this.getProperty('NamedNotes')?.getValue();
  }

  getSingleNotesEnabled() {
    return !!this.getProperty('SingleNotes')?.getValue();
  }

  getTinyNotesEnabled() {
    return !!this.getProperty('TinyNotes')?.getValue();
  }

  getBendNotesEnabled() {
    return !!this.getProperty('BendNotes')?.getValue();
  }

  getFingeringNotesEnabled() {
    return !!this.getProperty('FingeringNotes')?.getValue();
  }

  getRecordedNotesEnabled() {
    return !!this.getProperty('RecordedNotes')?.getValue();
  }

  getUseOctavesForRecordedEnabled() {
    return !!this.getProperty('useOctavesForRecorded')?.getValue();
  }

  buildIncludeFlagsSummary() {
    const include = [];
    if (this.getNamedNotesEnabled()) include.push('n');
    if (this.getSingleNotesEnabled()) include.push('s');
    if (this.getTinyNotesEnabled()) include.push('t');
    if (this.getBendNotesEnabled()) include.push('b');
    if (this.getFingeringNotesEnabled()) include.push('f');
    if (this.getRecordedNotesEnabled()) include.push('r');
    return `[${include.join(',')}]`;
  }

  getAuditInputs() {
    const include = this.buildIncludeFlagsSummary().slice(1, -1);
    const includePropertyNames = ['NamedNotes', 'SingleNotes', 'TinyNotes', 'BendNotes', 'FingeringNotes', 'RecordedNotes'];
    const changed = includePropertyNames.some((propertyName) => {
      const property = this.getProperty(propertyName);
      return property ? !valuesEqual(property.getValue(), property.getDefaultValue()) : false;
    });
    return { value: `include:${include}`, changed };
  }

  getAuditOutputs() {
    return undefined;
  }

  getIncludedPlayedTransposeStyles() {
    const included = new Set();
    PLAYED_TRANSPOSE_STYLES_BY_PROPERTY.forEach((styleNum, propertyName) => {
      if (this.getProperty(propertyName)?.getValue()) {
        included.add(styleNum);
      }
    });
    return included;
  }

  getOctavesDisplayValue() {
    const value = `${this.getProperty('octaves')?.getValue() ?? ''}`;
    return value === '' ? '[]' : value;
  }

  getNormalizedOctavesMode() {
    const normalized = normalizeOctavesInput(this.getProperty('octaves')?.getValue() ?? '');
    if (normalized.notice) {
      this.getProperty('octaves')?.setValue(normalized.value);
      this.setOperationMessage(normalized.notice);
    }
    return normalized;
  }

  getAutoSharpsFlatsEnabled() {
    return !!this.getProperty('autoSharpsFlats')?.getValue();
  }

  getDoLeadKeyEnabled() {
    return !!this.getProperty('doLeadKey')?.getValue();
  }

  getFunctionSymbol(distance) {
    return Constants.noteNamesFuncArrDEFAULT[normalizeNoteIndex(distance)] || '';
  }

  wrapTransposeProg(text) {
    return `${TRANSPOSE_PROG_EM_OPEN}${text}${TRANSPOSE_PROG_EM_CLOSE}`;
  }

  getSectionDisplayKey(section, noteIndex) {
    if (section && typeof section.noteIDToDisplayName === 'function') {
      return section.noteIDToDisplayName(normalizeNoteIndex(noteIndex));
    }
    return Constants.noteIDToNoteNameRaw(normalizeNoteIndex(noteIndex)) || '';
  }

  getApprovedCaptionState(context = {}) {
    const song = context.song || this.manager?.song || getSong();
    const section = context.section
      || song?.getCurrentSection?.()
      || this.manager?.song?.getCurrentSection?.()
      || getSong()?.getCurrentSection?.();
    const entry = this.manager?.getPluginEntry?.(this.id);
    const enabled = !!entry?.enabled;

    if (!section) {
      return { meaningful: false, steps: [] };
    }

    const currentRootID = normalizeNoteIndex(section.rootID);
    const currentInterval = Number.parseInt(this.currentAppliedInterval, 10) || 0;
    const currentOffset = Number.parseInt(this.getCurrentSequenceOffset(), 10) || 0;
    const originalOffset = Number.parseInt(this.getCurrentOriginalOffset(), 10) || 0;
    const currentRootKey = typeof section.getRootKey === 'function'
      ? section.getRootKey()
      : this.getSectionDisplayKey(section, currentRootID);
    const sequenceRootID = normalizeNoteIndex(currentRootID - currentOffset);
    const originalRootID = normalizeNoteIndex(currentRootID - originalOffset);
    const sequenceRootKey = this.getSectionDisplayKey(section, sequenceRootID);
    const originalRootKey = this.getSectionDisplayKey(section, originalRootID);
    const sequenceDistance = normalizeNoteIndex(originalOffset - currentOffset);
    const currentDistance = normalizeNoteIndex(currentOffset);
    const meaningful = enabled && this.isAwake && (currentInterval !== 0 || currentOffset !== 0 || originalOffset !== 0);
    const steps = [];

    if (meaningful && sequenceDistance !== 0) {
      steps.push({
        fromKey: originalRootKey,
        toKey: sequenceRootKey,
        distance: sequenceDistance
      });
    }

    if (meaningful && currentDistance !== 0) {
      steps.push({
        fromKey: sequenceRootKey,
        toKey: currentRootKey,
        distance: currentDistance
      });
    }

    return {
      enabled,
      hasSection: true,
      meaningful: meaningful && steps.length > 0,
      currentInterval,
      currentOffset,
      originalOffset,
      currentRootKey,
      sequenceRootKey,
      originalRootKey,
      steps
    };
  }

  buildApprovedStepList(state, formatter) {
    if (!state.meaningful || state.steps.length === 0) {
      return '';
    }
    return state.steps.map((step) => this.wrapTransposeProg(formatter(step.distance))).join(',');
  }

  buildProgressionWidget(distance, { includeFunction = true, includeDistance = true } = {}) {
    const parts = [];
    if (includeFunction) {
      parts.push(`<span class="transposeProgFunc">+${this.getFunctionSymbol(distance)}</span>`);
    }
    if (includeDistance) {
      parts.push(`<span class="transposeProgOffset">+${normalizeNoteIndex(distance)}</span>`);
    }
    parts.push('<span class="transposeArrow">&Rang;</span>');
    return `<span class="transposeCaptionBox">${parts.join('')}</span>`;
  }

  buildApprovedProgressionWidgets(state, options = {}) {
    if (!state.meaningful || state.steps.length === 0) {
      return '';
    }
    let output = '<span class="transposeKey">'+state.steps[0].fromKey+'</span>';
    state.steps.forEach((step) => {
      output += this.buildProgressionWidget(step.distance, options);
      output += '<span class="transposeKey">'+step.toKey+'</span>';
    });
    return '<span class="transposeProgressionFunctionDistances">'+output+'</span>';
  }

  buildIntervalsStatusWidget(state) {
    if (!state.enabled || !state.hasSection) {
      return '';
    }
    const intervals = this.getIntervals();
    if (intervals.length === 0) {
      return '';
    }
    const current = this.currentAppliedInterval;
    const tds = intervals.map((val) => {
      const tdClass = val === current ? ' class="transposeCurrentAppliedInterval"' : '';
      return `<td${tdClass}>${val}</td>`;
    }).join('');
    return `<span class="transposeIntervalsStatus"><table><tr>${tds}</tr></table></span>`;
  }

  getApprovedCaptionValue(tokenName, context = {}) {
    const state = this.getApprovedCaptionState(context);
    const formatDistance = (distance) => `${normalizeNoteIndex(distance)}`;
    const formatFunction = (distance) => this.getFunctionSymbol(distance);
    const formatFunctionDistance = (distance) => `${this.getFunctionSymbol(distance)}+${normalizeNoteIndex(distance)}`;

    if (tokenName === 'transposeIntervalsStatus') {
      return this.buildIntervalsStatusWidget(state);
    }

    if (!state.meaningful) {
      return '';
    }

    switch (tokenName) {
      case 'transposeCurrentInterval':
        return `${state.currentInterval}`;
      case 'transposeCurrentOffset':
        return `${state.currentOffset}`;
      case 'transposeOriginalOffset':
        return `${state.originalOffset}`;
      case 'transposeOriginalRootKey':
        return state.originalRootKey;
      case 'transposeSequenceRootKey':
        return state.sequenceRootKey;
      case 'transposeFunctionSteps':
        return this.buildApprovedStepList(state, formatFunction);
      case 'transposeDistanceSteps':
        return this.buildApprovedStepList(state, formatDistance);
      case 'transposeFunctionDistanceSteps':
        return this.buildApprovedStepList(state, formatFunctionDistance);
      case 'transposeProgressionFunctions':
        return this.buildApprovedProgressionWidgets(state, { includeFunction: true, includeDistance: false });
      case 'transposeProgressionDistances':
        return this.buildApprovedProgressionWidgets(state, { includeFunction: false, includeDistance: true });
      case 'transposeProgressionFunctionDistances':
        return this.buildApprovedProgressionWidgets(state, { includeFunction: true, includeDistance: true });
      default:
        return '';
    }
  }

  canonicalizeIntervalsProperty() {
    const property = this.getProperty('intervals');
    if (!property) {
      return;
    }
    property.value = canonicalizeIntervals(property.getValue());
    property.defaultValue = canonicalizeIntervals(property.getDefaultValue());
  }

  resetRuntimeState() {
    this.isAwake = false;
    this.liveSongOffset = 0;
    this.sequenceBaselineOffset = 0;
    this.originalBaselineOffset = 0;
    this.operationMessage = '';
    this.restartIntervalSequence();
  }

  clearOperationMessage() {
    this.operationMessage = '';
  }

  setOperationMessage(message) {
    if (!message) {
      return;
    }
    this.operationMessage = this.operationMessage ? `${this.operationMessage}\n${message}` : message;
  }

  buildActionResponse(result) {
    return {
      result,
      message: this.operationMessage || ''
    };
  }

  restartIntervalSequence() {
    const intervals = this.getIntervals();
    this.currentIntervalIndex = 0;
    this.currentAppliedInterval = intervals.length > 0 ? intervals[0] : 0;
  }

  wakeAtCurrentPosition() {
    if (this.isAwake) {
      return;
    }
    this.isAwake = true;
    this.sequenceBaselineOffset = this.liveSongOffset;
    this.originalBaselineOffset = this.liveSongOffset;
  }

  getCurrentSequenceOffset() {
    return this.liveSongOffset - this.sequenceBaselineOffset;
  }

  getCurrentOriginalOffset() {
    return this.liveSongOffset - this.originalBaselineOffset;
  }

  transposePlayedNotesAllSections(delta, song = this.manager?.song || getSong()) {
    if (delta === 0 || !song || !Array.isArray(song.sections)) {
      return { movedTables: 0, fallbackUsed: false };
    }

    const includedStyles = this.getIncludedPlayedTransposeStyles();
    if (includedStyles.size === 0) {
      return { movedTables: 0, fallbackUsed: false };
    }

    let octavesMode = this.getNormalizedOctavesMode();
    let fallbackUsed = false;
    let movedTables = 0;

    song.sections.forEach((section) => {
      Object.entries(section?.sectionNotesByTable || {}).forEach(([tableID, sectionNotes]) => {
        const tuning = getTuningByTableID(song, tableID);
        if (!tuning) {
          return;
        }

        let result = transposeSectionTablePlayedNotes(sectionNotes, delta, tuning, section, octavesMode, includedStyles);
        if (!octavesMode.isFullNeck && result.collision) {
          octavesMode = { value: '0', cap: 0, isFullNeck: true, notice: '' };
          this.getProperty('octaves')?.setValue('0');
          this.setOperationMessage('Transpose played-note collision detected for capped octaves; octaves reset to 0 and full-neck/off-screen placement used.');
          fallbackUsed = true;
          result = transposeSectionTablePlayedNotes(sectionNotes, delta, tuning, section, octavesMode, includedStyles);
        }

        sectionNotes.playedNotes = result.playedNotes;
        movedTables += 1;
      });
    });

    if (movedTables > 0 && !song.isHeadless && !this.getNamedNotesEnabled() && typeof song.requestUiFullRepaint === 'function') {
      song.requestUiFullRepaint();
    }

    return { movedTables, fallbackUsed };
  }

  transposeRecordedNotesAllSections(delta, song = this.manager?.song || getSong()) {
    if (delta === 0 || !song || !Array.isArray(song.sections)) {
      return { movedTables: 0, fallbackUsed: false };
    }

    const useOctavesForRecorded = this.getUseOctavesForRecordedEnabled();
    const octavesMode = useOctavesForRecorded ? this.getNormalizedOctavesMode() : null;
    const initialMode = useOctavesForRecorded ? 'octaves' : 'oneOctave';
    let fallbackUsed = false;
    let movedTables = 0;

    song.sections.forEach((section) => {
      Object.entries(section?.sectionNotesByTable || {}).forEach(([tableID, sectionNotes]) => {
        const tuning = getTuningByTableID(song, tableID);
        if (!tuning) {
          return;
        }

        let result = transposeRecordedNotesForSectionTable(sectionNotes, delta, tuning, section, tableID, initialMode, octavesMode);
        if (result.collision) {
          fallbackUsed = true;
          result = transposeRecordedNotesForSectionTable(sectionNotes, delta, tuning, section, tableID, 'fullNeck');
        }

        sectionNotes.recordedNotes = result.recordedNotes;
        movedTables += 1;
      });
    });

    if (movedTables > 0 && !song.isHeadless && !this.getNamedNotesEnabled() && typeof song.requestUiFullRepaint === 'function') {
      song.requestUiFullRepaint();
    }

    return { movedTables, fallbackUsed };
  }

  applySongDelta(delta, song = this.manager?.song || getSong()) {
    if (delta === 0) {
      return;
    }

    transposeSong(delta, formatOptions(this.propertyMap));

    this.transposePlayedNotesAllSections(delta, song);

    if (this.getRecordedNotesEnabled()) {
      this.transposeRecordedNotesAllSections(delta, song);
    }

    this.liveSongOffset += delta;
    if (this.getAutoSharpsFlatsEnabled()) {
      this.applyAutoSharpsFlats(song);
    }
  }

  moveToOffset(targetOffset, song = this.manager?.song || getSong()) {
    const delta = targetOffset - this.liveSongOffset;
    this.applySongDelta(delta, song);
    return delta;
  }

  advanceInterval(sourceLabel, song = this.manager?.song || getSong()) {
    this.wakeAtCurrentPosition();
    const intervals = this.getIntervals();
    if (intervals.length === 0) {
      return 'No intervals configured';
    }

    const nextIndex = intervals.length === 1 ? 0 : (this.currentIntervalIndex + 1) % intervals.length;
    const nextInterval = intervals[nextIndex];
    const delta = nextInterval - this.currentAppliedInterval;
    this.currentIntervalIndex = nextIndex;
    this.currentAppliedInterval = nextInterval;

    this.applySongDelta(delta, song);

    return `${sourceLabel}: interval ${nextInterval} (delta ${delta})`;
  }

  resetCurrentInterval(song = this.manager?.song || getSong()) {
    this.wakeAtCurrentPosition();
    this.moveToOffset(this.sequenceBaselineOffset, song);
    this.restartIntervalSequence();
    this.requestSectionStatusRefresh(song);
    return 'reset current interval: sequence offset 0';
  }

  resetOriginal(song = this.manager?.song || getSong()) {
    this.wakeAtCurrentPosition();
    this.moveToOffset(this.originalBaselineOffset, song);
    this.sequenceBaselineOffset = this.originalBaselineOffset;
    this.restartIntervalSequence();
    this.requestSectionStatusRefresh(song);
    return 'reset original: original offset 0';
  }

  setOriginalToCurrent(song = this.manager?.song || getSong()) {
    this.wakeAtCurrentPosition();
    this.originalBaselineOffset = this.liveSongOffset;
    this.sequenceBaselineOffset = this.liveSongOffset;
    this.restartIntervalSequence();
    this.requestSectionStatusRefresh(song);
    return 'set original to current: baselines rebased';
  }

  requestSectionStatusRefresh(song = this.manager?.song || getSong()) {
    if (!song || song.isHeadless) {
      return;
    }

    if (typeof song.publish_UpdateSectionStatus === 'function') {
      song.publish_UpdateSectionStatus();
      return;
    }

    if (typeof song.requestUiFullRepaint === 'function') {
      song.requestUiFullRepaint();
    }
  }

  applyAutoSharpsFlats(song = this.manager?.song || getSong()) {
    if (!song || !Array.isArray(song.sections)) {
      return;
    }

    song.sections.forEach((section) => {
      const rootID = Number.parseInt(section?.rootID, 10) || 0;
      section.sharps = Constants.noteIdPrefersSharps(rootID);
    });

    const currentSection = typeof song.getCurrentSection === 'function' ? song.getCurrentSection() : null;
    if (currentSection) {
      song.sharps = !!currentSection.sharps;
    }

    if (!song.isHeadless && typeof song.requestUiFullRepaint === 'function') {
      song.requestUiFullRepaint();
    }
  }
}

export default TransposePlugin;
