import properties from './properties.json' with { type: 'json' };
import { PluginProperty, buildCaption } from '../PluginProperty.js';
import { MenuItemProxy } from '../MenuItemProxy.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { lookupClassForNote } from '../../colorFunctions.js';
import { getSong, transposeSong } from '../../infinite-neck.js';
import { createTuningLayout } from '../../move-helpers.js';

const TRANSPOSE_PROG_EM_OPEN = '<em class="transposeProg">';
const TRANSPOSE_PROG_EM_CLOSE = '</em>';
const AUTO_COLOR_CLASS_RE = /^note([1-9]|1[0-2])$/;

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

function detectSingleNoteCollisions(playedNotes = [], recordedNotes = {}) {
  let collision = false;
  const playedCells = new Set();

  (playedNotes || []).forEach((note) => {
    const key = getCellKey(note);
    if (!key) {
      return;
    }
    if (playedCells.has(key)) {
      collision = true;
    }
    playedCells.add(key);
  });

  Object.values(recordedNotes || {}).forEach((notesForBeat) => {
    const beatCells = new Set();
    (notesForBeat || []).forEach((note) => {
      const key = getCellKey(note);
      if (!key) {
        return;
      }
      if (playedCells.has(key) || beatCells.has(key)) {
        collision = true;
      }
      beatCells.add(key);
    });
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

function normalizeSingleNoteColor(note, section) {
  if (!shouldRecalculateColor(note?.colorClass)) {
    return note?.colorClass;
  }
  const lookedUp = lookupClassForNote(note, { section, autoColor: true });
  return lookedUp?.colorClass || note.colorClass;
}

function transposeSingleNoteOnString(note, delta, tuning, layout, section, octavesMode) {
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

  const targetMidinum = openMidi + targetFret;
  const moved = clone(note);
  moved.row = `${row}`;
  moved.col = `${targetFret}`;
  moved.midinum = `${targetMidinum}`;
  moved.noteName = Constants.midinumToNoteName(targetMidinum);
  moved.colorClass = normalizeSingleNoteColor(moved, section);
  return moved;
}

function transposeSectionTableSingleNotes(sectionNotes, delta, tuning, section, octavesMode) {
  const layout = createTuningLayout(tuning);
  const playedNotes = (sectionNotes?.playedNotes || []).map((note) => {
    if (toInt(note?.styleNum, null) !== Note.STYLENUM_SINGLE) {
      return clone(note);
    }
    return transposeSingleNoteOnString(note, delta, tuning, layout, section, octavesMode);
  });
  const recordedNotes = buildRecordedNotes(sectionNotes?.recordedNotes || {}, (note) => {
    if (toInt(note?.styleNum, null) !== Note.STYLENUM_SINGLE) {
      return clone(note);
    }
    return transposeSingleNoteOnString(note, delta, tuning, layout, section, octavesMode);
  });

  return {
    playedNotes,
    recordedNotes,
    collision: detectSingleNoteCollisions(playedNotes, recordedNotes)
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
      this.getProperty('help')?.getMenuNodeSpec(this),
      ...['intervals', 'NamedNotes', 'SingleNotes', 'octaves', 'autoSharpsFlats', 'doLeadKey']
        .map((propertyName) => this.getProperty(propertyName)?.getMenuNodeSpec(this))
    ].filter(Boolean);
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
    return `current interval=${this.currentAppliedInterval} sequence offset=${this.getCurrentSequenceOffset()} original offset=${this.getCurrentOriginalOffset()} auto sharps/flats=${this.getAutoSharpsFlatsEnabled()} do lead key=${this.getDoLeadKeyEnabled()} named notes=${this.getNamedNotesEnabled()} single notes=${this.getSingleNotesEnabled()} octaves=${this.getOctavesDisplayValue()}`;
  }

  buildHelpMessage() {
    const graveyardKey = this.manager?.resolveValue(`plugin:${this.getId()}:graveyardKey`) || 'USER';
    return `<pre>${buildPluginHelpHeader(this, 'Transpose plugin:', this.buildSummary())}

Current settings:
- ${this.buildSummary()}
- intervals = ${JSON.stringify(this.getIntervals())}
- graveyard key = ${graveyardKey}
- single notes = ${this.getSingleNotesEnabled()}
- octaves = ${this.getOctavesDisplayValue()} (legal values: empty, 0, or positive integer)
- interval list is canonicalized to start from 0
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

  transposeSingleNotesAllSections(delta, song = this.manager?.song || getSong()) {
    if (delta === 0 || !song || !Array.isArray(song.sections)) {
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

        let result = transposeSectionTableSingleNotes(sectionNotes, delta, tuning, section, octavesMode);
        if (!octavesMode.isFullNeck && result.collision) {
          octavesMode = { value: '0', cap: 0, isFullNeck: true, notice: '' };
          this.getProperty('octaves')?.setValue('0');
          this.setOperationMessage('Transpose single-note collision detected for capped octaves; octaves reset to 0 and full-neck/off-screen placement used.');
          fallbackUsed = true;
          result = transposeSectionTableSingleNotes(sectionNotes, delta, tuning, section, octavesMode);
        }

        sectionNotes.playedNotes = result.playedNotes;
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

    if (this.getSingleNotesEnabled()) {
      this.transposeSingleNotesAllSections(delta, song);
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
    return 'reset current interval: sequence offset 0';
  }

  resetOriginal(song = this.manager?.song || getSong()) {
    this.wakeAtCurrentPosition();
    this.moveToOffset(this.originalBaselineOffset, song);
    this.sequenceBaselineOffset = this.originalBaselineOffset;
    this.restartIntervalSequence();
    return 'reset original: original offset 0';
  }

  setOriginalToCurrent() {
    this.wakeAtCurrentPosition();
    this.originalBaselineOffset = this.liveSongOffset;
    this.sequenceBaselineOffset = this.liveSongOffset;
    this.restartIntervalSequence();
    return 'set original to current: baselines rebased';
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
