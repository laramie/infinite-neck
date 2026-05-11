import properties from './properties.json' with { type: 'json' };
import { PluginProperty } from '../PluginProperty.js';
import { buildPluginEventsHelpFooter } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { createLookupContext, lookupClassForNote } from '../../colorFunctions.js';
import EventBus from '../../event-bus.js';
import { getSong } from '../../infinite-neck.js';

const ARPEGGIO_OWNER = 'ArpeggioPlugin';
const STYLE_EVERY = 'every';
const STYLE_ALTERNATE = 'alternate';
const STYLE_RANDOM = 'random';
const STYLE_BACH = 'bach';
const SHOW_NOTE_NAME_OFF = 'off';
const SHOW_NOTE_NAME_ONE = 'one';
const SHOW_NOTE_NAME_ALL = 'all';
const SHOW_NOTE_NAME_PLAYED = 'played';

export class ArpeggioPlugin {
  constructor() {
    this.id = 'arpeggio';
    this.registeredName = 'arpeggio';
    this.menuTrigger = 'a';
    this.eventNames = ['DaCapo:OnSectionBegin', 'SongUiShowBeats'];
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
    this.skipNextSongUiShowBeats = false;
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
    return this.properties
      .filter((property) => property.visibleInMenu)
      .map((property) => property.getMenuNodeSpec(this));
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
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

  setPropertyValue(name, rawValue, context = {}) {
    const property = this.getProperty(name);
    if (!property) {
      throw new Error(`ArpeggioPlugin unknown property: ${name}`);
    }

    const candidateValue = property.normalize(rawValue);
    const nextValues = {
      minFret: this.getProperty('minFret')?.getValue(),
      maxFret: this.getProperty('maxFret')?.getValue(),
      lowToHigh: this.getProperty('lowToHigh')?.getValue(),
      upOnly: this.getProperty('upOnly')?.getValue(),
      style: this.getProperty('style')?.getValue(),
      [name]: candidateValue
    };

    this.validateValues(nextValues, context.song || getSong());
    return property.setValue(rawValue);
  }

  resolveValue(fieldName, context = {}) {
    if (fieldName === 'maxAllowedFret') {
      return this.getMaxAllowedFret(context.song || getSong());
    }
    return undefined;
  }

  enable() {
    return 'Arpeggio enabled';
  }

  disable() {
    return 'Arpeggio disabled';
  }

  handleEvent(eventName, payload = {}, context = {}) {
    if (eventName === 'SongUiShowBeats') {
      if (this.skipNextSongUiShowBeats) {
        this.skipNextSongUiShowBeats = false;
        return {};
      }
      this.refreshNamedNoteDisplay({
        song: context.song || getSong(),
        payload,
        eventName
      });
      return {};
    }

    return this.applyToSection({
      song: context.song || getSong(),
      payload,
      eventName,
      clearSectionFirst: true
    });
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || getSong();
    switch (actionName) {
      case 'apply':
        return this.applyToSection({ song, clearSectionFirst: true });
      case 'clear':
        return this.clearGeneratedNotesInSong(song);
      case 'help':
        return {
          result: 'Arpeggio help opened',
          message: this.buildHelpMessage(song)
        };
      default:
        return { result: `Unknown arpeggio action: ${actionName}` };
    }
  }

  buildSummary() {
    return `fret range=${this.getProperty('minFret')?.getValue()}..${this.getProperty('maxFret')?.getValue()} style=${this.getProperty('style')?.getValue()} low to high=${this.getProperty('lowToHigh')?.getValue()} up only=${this.getProperty('upOnly')?.getValue()} show note names=${this.getShowNoteNameMode()} color notes=${this.getColorNotesEnabled()} flashcard=${this.getFlashcardEnabled()}`;
  }

  buildHelpMessage(song) {
    const unsupportedMessage = this.getUnsupportedConfigurationMessage();
    const targetTuning = this.getTargetTuning(song);
    const tableID = targetTuning ? this.getTableID(targetTuning) : '<none>';
    return `<pre><b><u>Arpeggio plugin:</u> ${this.buildSummary()}</b>

Current settings:
- ${this.buildSummary()}
- target table = ${tableID}
- max fret limit = ${this.getMaxAllowedFret(song)}

Implemented in this iteration for:
- style = every
- style = alternate
- style = random
- style = bach
- lowToHigh = true or false for every and alternate
- lowToHigh = true or false for bach
- upOnly = true or false for every, alternate, and bach
- showNoteName = off, one, all, or played
- colorNotes = true or false
- flashcard = true or false
- random ignores lowToHigh and upOnly
- random avoids replaying the same string/fret until its unique position set is exhausted
- bach starts from the section tonic when available, then follows the rolling alternate-up pattern on the tonic-relative ascent
- target instrument = first myTunings entry not wired as a Listener or Observer

${unsupportedMessage || 'Current settings are implemented.'}

${buildPluginEventsHelpFooter(this)}</pre>`;
  }

  getTableID(tuning) {
    return `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
  }

  getTargetTuning(song = getSong()) {
    if (!song || !Array.isArray(song.myTunings)) {
      return null;
    }
    const wiredTableNames = new Set((song.wirings || []).map((wiring) => wiring?.tablename).filter(Boolean));
    return song.myTunings.find((tuning) => !wiredTableNames.has(this.getTableID(tuning))) || null;
  }

  getMaxAllowedFret(song = getSong()) {
    const targetTuning = this.getTargetTuning(song);
    if (!targetTuning) {
      return 24;
    }
    return Number.parseInt(targetTuning.frets, 10) || 0;
  }

  getUnsupportedConfigurationMessage() {
    const style = this.getProperty('style')?.getValue();
    if (![STYLE_EVERY, STYLE_ALTERNATE, STYLE_RANDOM, STYLE_BACH].includes(style)) {
      return `Unknown style: ${style}. Use help for the implemented combinations.`;
    }
    return '';
  }

  getStyle() {
    return this.getProperty('style')?.getValue() || STYLE_EVERY;
  }

  getShowNoteNameMode() {
    return this.getProperty('showNoteName')?.getValue() || SHOW_NOTE_NAME_OFF;
  }

  getColorNotesEnabled() {
    return !!this.getProperty('colorNotes')?.getValue();
  }

  getFlashcardEnabled() {
    return !!this.getProperty('flashcard')?.getValue();
  }

  isLowToHigh() {
    return !!this.getProperty('lowToHigh')?.getValue();
  }

  getRandomNumber() {
    return Math.random();
  }

  getCandidatePositionKey(candidate) {
    return `${candidate?.row}:${candidate?.col}`;
  }

  getRootNoteName(section, song = getSong()) {
    const rootID = Number.parseInt(section?.rootID ?? song?.rootID, 10);
    if (!Number.isInteger(rootID) || rootID < 0 || rootID >= Constants.NOTE_NAMES_ARRAY.length) {
      return Constants.NOTE_NAMES_ARRAY[0];
    }
    return Constants.NOTE_NAMES_ARRAY[rootID];
  }

  getTargetSection(song, payload = {}) {
    if (!song) {
      return null;
    }
    const sectionIndex = Number.parseInt(payload?.sectionIndex, 10);
    if (Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < (song.sections || []).length) {
      return song.sections[sectionIndex];
    }
    if (typeof song.getCurrentSection === 'function') {
      return song.getCurrentSection();
    }
    return song.sections?.[0] || null;
  }

  requestCurrentBeatNumber(song, section = null) {
    if (song && typeof song.getBeat === 'function') {
      return Number.parseInt(song.getBeat(), 10) || 1;
    }
    return Number.parseInt(section?.currentBeat, 10) || 1;
  }

  resolveNamedNoteDisplayColorClass(candidate, section) {
    if (!this.getColorNotesEnabled()) {
      return 'noteTransparent';
    }

    const lookupResult = lookupClassForNote({
      noteName: candidate?.noteName,
      styleNum: Note.STYLENUM_NAMED,
      midinum: `${candidate?.midinum ?? ''}`,
      row: `${candidate?.row ?? ''}`
    }, createLookupContext({ section, autoColor: true }));

    return lookupResult?.colorClass || 'noteTransparent';
  }

  buildNamedNoteCell(candidate, tableID, section = null) {
    if (!candidate) {
      return null;
    }

    return {
      tableID,
      cellrow: `${candidate.row}`,
      cellcol: `${candidate.col}`,
      colorClass: this.resolveNamedNoteDisplayColorClass(candidate, section)
    };
  }

  dedupeNamedNoteCells(cells = []) {
    const seen = new Set();
    return (cells || []).filter((cell) => {
      if (!cell) {
        return false;
      }
      const key = `${cell.tableID}:${cell.cellrow}:${cell.cellcol}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  getCurrentBeatNamedNoteCells(sequence, song, section, tableID, beatNumber = null) {
    const currentBeat = beatNumber || this.requestCurrentBeatNumber(song, section);
    const currentCandidate = sequence[currentBeat - 1];
    if (!currentCandidate) {
      return [];
    }

    return [this.buildNamedNoteCell(currentCandidate, tableID, section)].filter(Boolean);
  }

  getAllNamedNoteCells(sequence, tableID, section = null) {
    return this.dedupeNamedNoteCells((sequence || []).map((candidate) => this.buildNamedNoteCell(candidate, tableID, section)));
  }

  getBeatNamedNoteCells(sequence, tableID, section, beatNumber) {
    return this.getCurrentBeatNamedNoteCells(sequence, null, section, tableID, beatNumber);
  }

  getFlashcardNamedNoteDisplayPayload(sequence, song, section, tableID, eventName = 'manual') {
    const mode = this.getShowNoteNameMode();
    const currentBeat = this.requestCurrentBeatNumber(song, section);
    const lastBeat = sequence.length;
    const isLastBeat = currentBeat >= lastBeat && lastBeat > 0;
    const previousBeat = currentBeat - 1;

    switch (mode) {
      case SHOW_NOTE_NAME_ONE: {
        let cells = [];
        if (previousBeat >= 1) {
          cells = this.getBeatNamedNoteCells(sequence, tableID, section, previousBeat);
        }
        if (isLastBeat) {
          cells = this.dedupeNamedNoteCells([
            ...cells,
            ...this.getBeatNamedNoteCells(sequence, tableID, section, currentBeat)
          ]);
        }
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: true,
          cells
        };
      }
      case SHOW_NOTE_NAME_ALL:
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: true,
          cells: currentBeat >= 2 || isLastBeat
            ? this.getAllNamedNoteCells(sequence, tableID, section)
            : []
        };
      case SHOW_NOTE_NAME_PLAYED: {
        let cells = [];
        if (previousBeat >= 1) {
          cells = this.getBeatNamedNoteCells(sequence, tableID, section, previousBeat);
        }
        if (isLastBeat) {
          cells = this.dedupeNamedNoteCells([
            ...cells,
            ...this.getBeatNamedNoteCells(sequence, tableID, section, currentBeat)
          ]);
        }
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: currentBeat <= 1 || eventName !== 'SongUiShowBeats',
          cells
        };
      }
      case SHOW_NOTE_NAME_OFF:
      default:
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: true,
          cells: []
        };
    }
  }

  getNamedNoteDisplayPayload(sequence, song, section, tableID, eventName = 'manual') {
    if (this.getFlashcardEnabled()) {
      return this.getFlashcardNamedNoteDisplayPayload(sequence, song, section, tableID, eventName);
    }

    const mode = this.getShowNoteNameMode();
    const currentBeat = this.requestCurrentBeatNumber(song, section);

    switch (mode) {
      case SHOW_NOTE_NAME_ONE:
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: true,
          cells: this.getCurrentBeatNamedNoteCells(sequence, song, section, tableID, currentBeat)
        };
      case SHOW_NOTE_NAME_ALL:
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: true,
          cells: this.getAllNamedNoteCells(sequence, tableID, section)
        };
      case SHOW_NOTE_NAME_PLAYED:
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: currentBeat <= 1 || eventName !== 'SongUiShowBeats',
          cells: this.getCurrentBeatNamedNoteCells(sequence, song, section, tableID, currentBeat)
        };
      case SHOW_NOTE_NAME_OFF:
      default:
        return {
          owner: ARPEGGIO_OWNER,
          clearExisting: true,
          cells: []
        };
    }
  }

  emitNamedNoteDisplay(payload = {}) {
    EventBus.trigger('NoteTable:ShowNamedNotesAtCells', {
      owner: ARPEGGIO_OWNER,
      clearExisting: !!payload.clearExisting,
      cells: Array.isArray(payload.cells) ? payload.cells : []
    });
  }

  syncNamedNoteDisplay({ song = getSong(), section = null, tableID = '', sequence = [], eventName = 'manual' } = {}) {
    if (!song || song.isHeadless) {
      return;
    }

    if (section && typeof song.getCurrentSection === 'function' && song.getCurrentSection() !== section) {
      return;
    }

    this.emitNamedNoteDisplay(this.getNamedNoteDisplayPayload(sequence, song, section, tableID, eventName));
  }

  requestCurrentBeatRefresh(song, section = null) {
    if (!song || song.isHeadless || typeof song.requestUiShowBeats !== 'function') {
      return;
    }

    if (section && typeof song.getCurrentSection === 'function' && song.getCurrentSection() !== section) {
      return;
    }

    this.skipNextSongUiShowBeats = true;
    song.requestUiShowBeats();
  }

  refreshNamedNoteDisplay({ song = getSong(), payload = {}, eventName = 'SongUiShowBeats' } = {}) {
    if (!song) {
      return;
    }

    const section = this.getTargetSection(song, payload);
    const tuning = this.getTargetTuning(song);
    if (!section || !tuning) {
      this.emitNamedNoteDisplay({ clearExisting: true, cells: [] });
      return;
    }

    const beatCount = typeof section.getBeats === 'function'
      ? section.getBeats()
      : (Number.parseInt(section?.beats, 10) || 0);
    const candidates = this.collectCandidatesForSection(section, tuning, {
      lowToHigh: [STYLE_RANDOM, STYLE_BACH].includes(this.getStyle()) ? true : this.isLowToHigh()
    });
    const sequence = this.expandCandidateSequence(candidates, beatCount, { song, section });
    this.syncNamedNoteDisplay({
      song,
      section,
      tableID: this.getTableID(tuning),
      sequence,
      eventName
    });
  }

  collectCandidatesForSection(section, tuning, options = {}) {
    const tableID = this.getTableID(tuning);
    const sectionNotes = section?.sectionNotesByTable?.[tableID];
    const namedNotes = sectionNotes?.namedNotes || {};
    const targetNoteNames = new Set(
      Object.entries(namedNotes)
        .filter(([, note]) => note && typeof note === 'object' && Object.keys(note).length > 0)
        .map(([noteName]) => noteName)
    );

    if (targetNoteNames.size === 0) {
      return [];
    }

    const minFret = Math.max(0, Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0);
    const maxAllowedFret = this.getMaxAllowedFret({ myTunings: [tuning], wirings: [] });
    const maxFret = Math.min(maxAllowedFret, Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0);
    const rowRange = Array.isArray(tuning.rowRange) ? tuning.rowRange : [];
    const candidates = [];
    const lowToHigh = options.lowToHigh ?? this.isLowToHigh();
    const rowIndexes = lowToHigh
      ? Array.from({ length: rowRange.length }, (_, idx) => rowRange.length - 1 - idx)
      : Array.from({ length: rowRange.length }, (_, idx) => idx);
    const frets = lowToHigh
      ? Array.from({ length: Math.max(0, maxFret - minFret + 1) }, (_, idx) => minFret + idx)
      : Array.from({ length: Math.max(0, maxFret - minFret + 1) }, (_, idx) => maxFret - idx);

    for (const row of rowIndexes) {
      const openMidi = Number.parseInt(rowRange[row], 10);
      if (!Number.isFinite(openMidi)) {
        continue;
      }
      for (const fret of frets) {
        const midinum = openMidi + fret;
        const noteName = Constants.midinumToNoteName(midinum);
        if (!targetNoteNames.has(noteName)) {
          continue;
        }
        candidates.push({ noteName, midinum, row, col: fret });
      }
    }

    return candidates;
  }

  expandCandidateSequence(candidates, beatCount, context = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0 || beatCount <= 0) {
      return [];
    }

    const style = this.getStyle();
    switch (style) {
      case STYLE_RANDOM:
        return this.expandRandomSequence(candidates, beatCount);
      case STYLE_BACH:
        return this.expandBachSequence(candidates, beatCount, context);
      case STYLE_ALTERNATE:
        return this.expandAlternateSequence(candidates, beatCount);
      case STYLE_EVERY:
      default:
        return this.expandEverySequence(candidates, beatCount);
    }
  }

  expandEverySequence(candidates, beatCount) {
    if (candidates.length === 1) {
      return Array.from({ length: beatCount }, () => candidates[0]);
    }
    const upOnly = !!this.getProperty('upOnly')?.getValue();
    const cycle = upOnly
      ? [...candidates]
      : [...candidates, ...candidates.slice(1, -1).reverse()];

    return Array.from({ length: beatCount }, (_, idx) => cycle[idx % cycle.length]);
  }

  expandRandomSequence(candidates, beatCount) {
    const uniqueCandidates = this.dedupeCandidatesByPosition(candidates);
    if (uniqueCandidates.length === 1) {
      return Array.from({ length: beatCount }, () => uniqueCandidates[0]);
    }

    const remaining = [...uniqueCandidates];
    const randomizedCycle = [];
    while (remaining.length > 0) {
      const randomIndex = Math.floor(this.getRandomNumber() * remaining.length);
      randomizedCycle.push(remaining.splice(randomIndex, 1)[0]);
    }

    return Array.from({ length: beatCount }, (_, idx) => randomizedCycle[idx % randomizedCycle.length]);
  }

  dedupeCandidatesByPosition(candidates) {
    const seen = new Set();
    return (candidates || []).filter((candidate) => {
      const positionKey = this.getCandidatePositionKey(candidate);
      if (seen.has(positionKey)) {
        return false;
      }
      seen.add(positionKey);
      return true;
    });
  }

  expandAlternateSequence(candidates, beatCount) {
    if (candidates.length === 1) {
      return Array.from({ length: beatCount }, () => candidates[0]);
    }

    const ascendingOddPositions = candidates.filter((candidate, idx) => idx % 2 === 0);
    const descendingEvenPositions = candidates.filter((candidate, idx) => idx % 2 === 1).reverse();
    const upOnly = !!this.getProperty('upOnly')?.getValue();
    const cycle = upOnly
      ? this.buildAlternateUpOnlyCycle(candidates)
      : [...ascendingOddPositions, ...descendingEvenPositions];

    return Array.from({ length: beatCount }, (_, idx) => cycle[idx % cycle.length]);
  }

  buildAlternateUpOnlyCycle(candidates) {
    if (candidates.length <= 2) {
      return candidates.length === 2
        ? [candidates[0], candidates[1], candidates[0]]
        : [...candidates];
    }

    const ascending = [];
    if (candidates.length % 2 === 0) {
      for (let idx = 0; idx <= candidates.length - 4; idx += 1) {
        ascending.push(candidates[idx], candidates[idx + 2]);
      }
      ascending.push(candidates[candidates.length - 1]);
    } else {
      for (let idx = 0; idx <= candidates.length - 3; idx += 1) {
        ascending.push(candidates[idx], candidates[idx + 2]);
      }
    }

    const descendingTail = [];
    const descendingStartIndex = candidates.length % 2 === 0 ? candidates.length - 3 : candidates.length - 2;
    for (let idx = descendingStartIndex; idx >= 1; idx -= 1) {
      descendingTail.push(candidates[idx], candidates[idx + 1]);
    }
    descendingTail.push(candidates[0]);

    return [...ascending, ...descendingTail];
  }

  expandBachSequence(candidates, beatCount, context = {}) {
    const bachCycle = this.buildBachCycle(candidates, context.section, context.song);
    if (bachCycle.length === 0) {
      return [];
    }

    const firstKey = this.getCandidatePositionKey(bachCycle[0]);
    const lastKey = this.getCandidatePositionKey(bachCycle[bachCycle.length - 1]);
    const repeatCycle = firstKey === lastKey ? bachCycle.slice(1) : bachCycle;
    const sequence = [];

    while (sequence.length < beatCount) {
      const source = sequence.length === 0 ? bachCycle : repeatCycle;
      if (source.length === 0) {
        break;
      }
      const remaining = beatCount - sequence.length;
      sequence.push(...source.slice(0, remaining));
    }

    return sequence;
  }

  buildBachCycle(candidates, section, song = getSong()) {
    const bachContext = this.buildBachContext(candidates, section, song);
    if (!bachContext) {
      return [];
    }

    const {
      actingRoot,
      aboveActingRoot,
      belowActingRoot,
      octave,
      belowOctave,
      aboveOctave,
      ascentCandidates
    } = bachContext;
    if (!octave) {
      return this.buildCanonicalBachUpCycle(ascentCandidates);
    }

    const upSequence = this.buildCanonicalBachUpCycle(ascentCandidates);
    if (belowOctave) {
      upSequence.push(octave, belowOctave);
    } else {
      upSequence.push(octave);
    }
    if (aboveOctave) {
      upSequence.push(aboveOctave);
    }
    upSequence.push(octave);

    if (!!this.getProperty('upOnly')?.getValue()) {
      return this.isLowToHigh()
        ? upSequence
        : this.rotateBachCycleToSecondOctave(upSequence, octave);
    }

    const downwardCandidates = [octave, ...ascentCandidates.slice().reverse()];
    const downwardSequence = this.buildCanonicalBachDownCycle(downwardCandidates);
    const downClosed = this.closeBachDownSequence({
      downwardSequence,
      actingRoot,
      aboveActingRoot,
      belowActingRoot
    });

    const cycle = [...upSequence, ...downClosed];
    return this.isLowToHigh()
      ? cycle
      : this.rotateBachCycleToSecondOctave(cycle, octave);
  }

  buildCanonicalBachUpCycle(ascentCandidates) {
    if (!Array.isArray(ascentCandidates) || ascentCandidates.length === 0) {
      return [];
    }
    if (ascentCandidates.length === 1) {
      return [...ascentCandidates];
    }

    const result = [];
    for (let idx = 0; idx <= ascentCandidates.length - 3; idx += 1) {
      result.push(ascentCandidates[idx], ascentCandidates[idx + 2]);
    }
    result.push(ascentCandidates[ascentCandidates.length - 2]);
    return result;
  }

  buildBachContext(candidates, section, song = getSong()) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const rootNoteName = this.getRootNoteName(section, song);
    const rootIndex = Constants.noteNameToNoteID(rootNoteName);
    const noteOrder = Array.from({ length: Constants.NOTE_NAMES_ARRAY.length }, (_, offset) =>
      Constants.NOTE_NAMES_ARRAY[(rootIndex + offset) % Constants.NOTE_NAMES_ARRAY.length]
    );
    const actingRootName = noteOrder.find((noteName) => candidates.some((candidate) => candidate.noteName === noteName));
    if (!actingRootName) {
      return null;
    }

    const actingRootIndex = candidates.findIndex((candidate) => candidate.noteName === actingRootName);
    if (actingRootIndex < 0) {
      return null;
    }

    const orderedFromRoot = candidates.slice(actingRootIndex);
    const actingRoot = orderedFromRoot[0];
    const aboveActingRoot = orderedFromRoot[1] || null;
    const belowActingRoot = actingRootIndex > 0 ? candidates[actingRootIndex - 1] : null;
    const octaveRelativeIndex = orderedFromRoot.findIndex((candidate, idx) => idx > 0
      && candidate.noteName === actingRoot.noteName
      && (candidate.midinum - actingRoot.midinum) >= 12);
    const octave = octaveRelativeIndex >= 0 ? orderedFromRoot[octaveRelativeIndex] : null;
    const ascentCandidates = octaveRelativeIndex >= 0
      ? orderedFromRoot.slice(0, octaveRelativeIndex)
      : orderedFromRoot;
    const belowOctave = octaveRelativeIndex > 0
      ? orderedFromRoot[octaveRelativeIndex - 1]
      : null;
    const aboveOctave = octaveRelativeIndex >= 0
      ? (orderedFromRoot[octaveRelativeIndex + 1] || null)
      : null;

    return {
      actingRoot,
      aboveActingRoot,
      belowActingRoot,
      octave,
      belowOctave,
      aboveOctave,
      ascentCandidates
    };
  }

  buildAlternatingAscentPattern(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }
    if (candidates.length <= 2) {
      return [...candidates];
    }

    const result = [];
    if (candidates.length % 2 === 0) {
      for (let idx = 0; idx <= candidates.length - 4; idx += 1) {
        result.push(candidates[idx], candidates[idx + 2]);
      }
      result.push(candidates[candidates.length - 1]);
      return result;
    }

    for (let idx = 0; idx <= candidates.length - 3; idx += 1) {
      result.push(candidates[idx], candidates[idx + 2]);
    }
    return result;
  }

  buildAlternatingDescentPattern(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }
    if (candidates.length <= 2) {
      return [...candidates];
    }

    const result = [candidates[0]];
    for (let idx = 0; idx <= candidates.length - 3; idx += 1) {
      result.push(candidates[idx + 2], candidates[idx + 1]);
    }
    return result;
  }

  buildCanonicalBachDownCycle(downwardCandidates) {
    if (!Array.isArray(downwardCandidates) || downwardCandidates.length < 3) {
      return [];
    }
    const result = [];
    for (let idx = 0; idx <= downwardCandidates.length - 3; idx += 1) {
      result.push(downwardCandidates[idx + 2], downwardCandidates[idx + 1]);
    }
    return result;
  }

  closeBachDownSequence({ downwardSequence, actingRoot, aboveActingRoot, belowActingRoot }) {
    const result = [...(downwardSequence || [])];
    const actingRootKey = this.getCandidatePositionKey(actingRoot);
    const aboveActingRootKey = this.getCandidatePositionKey(aboveActingRoot);
    const lastRootIndex = result.findLastIndex((candidate) => this.getCandidatePositionKey(candidate) === actingRootKey);

    if (lastRootIndex >= 0) {
      const hasAboveAfterRoot = aboveActingRoot && result.slice(lastRootIndex + 1)
        .some((candidate) => this.getCandidatePositionKey(candidate) === aboveActingRootKey);
      if (hasAboveAfterRoot) {
        if (belowActingRoot) {
          result.push(belowActingRoot);
        }
        result.push(actingRoot);
        return result;
      }

      if (aboveActingRoot) {
        result.push(aboveActingRoot);
      }
      if (belowActingRoot) {
        result.push(belowActingRoot);
      }
      result.push(actingRoot);
      return result;
    }

    if (belowActingRoot) {
      const lastCandidate = result[result.length - 1];
      if (!lastCandidate || this.getCandidatePositionKey(lastCandidate) !== this.getCandidatePositionKey(belowActingRoot)) {
        result.push(belowActingRoot);
      }
    }
    result.push(actingRoot);
    return result;
  }

  rotateBachCycleToSecondOctave(cycle, octave) {
    const octaveKey = this.getCandidatePositionKey(octave);
    const octaveIndexes = cycle
      .map((candidate, idx) => ({ candidate, idx }))
      .filter(({ candidate }) => this.getCandidatePositionKey(candidate) === octaveKey)
      .map(({ idx }) => idx);
    const rotationIndex = octaveIndexes[1] ?? octaveIndexes[0] ?? 0;
    const rotatedTail = cycle.slice(rotationIndex);
    const rotatedHead = cycle.slice(0, rotationIndex);
    if (rotatedTail.length === 0 || rotatedHead.length === 0) {
      return [...rotatedTail, ...rotatedHead];
    }

    const seamMatches = this.getCandidatePositionKey(rotatedTail[rotatedTail.length - 1])
      === this.getCandidatePositionKey(rotatedHead[0]);
    return seamMatches
      ? [...rotatedTail, ...rotatedHead.slice(1)]
      : [...rotatedTail, ...rotatedHead];
  }

  hasEquivalentRecordedNote(notesInBeat, candidate) {
    return (notesInBeat || []).some((note) =>
      Number.parseInt(note?.styleNum, 10) === Note.STYLENUM_MIDIPITCHESSINGLE
      && Number.parseInt(note?.midinum, 10) === candidate.midinum
      && Number.parseInt(note?.row, 10) === candidate.row
    );
  }

  makeRecordedNote(candidate) {
    const note = Note.newNote(candidate.noteName, Note.STYLENUM_MIDIPITCHESSINGLE);
    note.midinum = `${candidate.midinum}`;
    note.row = `${candidate.row}`;
    note.col = `${candidate.col}`;
    note.owner = ARPEGGIO_OWNER;
    return note;
  }

  clearGeneratedNotesInSection(section) {
    if (!section?.sectionNotesByTable) {
      return 0;
    }

    let removedCount = 0;
    Object.values(section.sectionNotesByTable).forEach((sectionNotes) => {
      if (!sectionNotes?.recordedNotes) {
        return;
      }
      Object.keys(sectionNotes.recordedNotes).forEach((beatKey) => {
        const notesInBeat = Array.isArray(sectionNotes.recordedNotes[beatKey]) ? sectionNotes.recordedNotes[beatKey] : [];
        const filteredNotes = notesInBeat.filter((note) => note?.owner !== ARPEGGIO_OWNER);
        removedCount += notesInBeat.length - filteredNotes.length;
        if (filteredNotes.length > 0) {
          sectionNotes.recordedNotes[beatKey] = filteredNotes;
        } else {
          delete sectionNotes.recordedNotes[beatKey];
        }
      });
    });
    return removedCount;
  }

  clearGeneratedNotesInSong(song = getSong()) {
    if (!song || !Array.isArray(song.sections)) {
      return { result: 'Arpeggio clear skipped: no song loaded' };
    }

    let removedCount = 0;
    let sectionCount = 0;
    const currentSection = typeof song.getCurrentSection === 'function' ? song.getCurrentSection() : null;
    let removedFromCurrentSection = 0;
    song.sections.forEach((section) => {
      const sectionRemoved = this.clearGeneratedNotesInSection(section);
      if (sectionRemoved > 0) {
        sectionCount += 1;
        removedCount += sectionRemoved;
      }
      if (currentSection && section === currentSection) {
        removedFromCurrentSection = sectionRemoved;
      }
    });

    if (removedFromCurrentSection > 0) {
      this.requestCurrentBeatRefresh(song, currentSection);
      this.emitNamedNoteDisplay({ clearExisting: true, cells: [] });
    }

    return { result: `Arpeggio cleared: removed ${removedCount} generated notes across ${sectionCount} sections` };
  }

  applyToSection({ song = getSong(), payload = {}, eventName = 'manual', clearSectionFirst = true } = {}) {
    if (!song) {
      return { result: 'Arpeggio skipped: no song loaded' };
    }

    const section = this.getTargetSection(song, payload);
    if (!section) {
      return { result: 'Arpeggio skipped: no current section selected' };
    }

    const removedCount = clearSectionFirst ? this.clearGeneratedNotesInSection(section) : 0;
    const unsupportedMessage = this.getUnsupportedConfigurationMessage();
    if (unsupportedMessage) {
      console.warn(unsupportedMessage);
      return {
        result: `Arpeggio skipped: ${unsupportedMessage}`,
        message: this.buildHelpMessage(song)
      };
    }

    const tuning = this.getTargetTuning(song);
    if (!tuning) {
      return { result: 'Arpeggio skipped: no target instrument available in myTunings' };
    }

    const beatCount = typeof section.getBeats === 'function'
      ? section.getBeats()
      : (Number.parseInt(section?.beats, 10) || 0);
    const candidates = this.collectCandidatesForSection(section, tuning, {
      lowToHigh: [STYLE_RANDOM, STYLE_BACH].includes(this.getStyle()) ? true : this.isLowToHigh()
    });
    if (candidates.length === 0) {
      if (removedCount > 0) {
        this.requestCurrentBeatRefresh(song, section);
      }
      return {
        result: `Arpeggio applied: no matching named notes on target table ${this.getTableID(tuning)}; removed=${removedCount}`
      };
    }

    const sequence = this.expandCandidateSequence(candidates, beatCount, { song, section });
    const tableID = this.getTableID(tuning);
    const sectionNotes = section.getSectionNotes(tableID);
    let generatedCount = 0;
    let preservedCount = 0;

    sequence.forEach((candidate, index) => {
      const beatKey = `${index + 1}`;
      if (!Array.isArray(sectionNotes.recordedNotes[beatKey])) {
        sectionNotes.recordedNotes[beatKey] = [];
      }
      if (this.hasEquivalentRecordedNote(sectionNotes.recordedNotes[beatKey], candidate)) {
        preservedCount += 1;
        return;
      }
      sectionNotes.recordedNotes[beatKey].push(this.makeRecordedNote(candidate));
      generatedCount += 1;
    });

    this.requestCurrentBeatRefresh(song, section);
    this.syncNamedNoteDisplay({ song, section, tableID, sequence, eventName });

    return {
      result: `Arpeggio applied: target table=${tableID} source=${eventName} generated=${generatedCount} preserved=${preservedCount} removed=${removedCount} beats=${beatCount}`
    };
  }

  validateValues(values, song = getSong()) {
    const maxAllowedFret = this.getMaxAllowedFret(song);
    //throw means you can't open the song file. :(  Just do console.warn for now.
    if (values.minFret < 0 || values.minFret > maxAllowedFret) {
      //throw new Error(`minFret must be between 0 and ${maxAllowedFret}`);
      console.warn(`minFret must be between 0 and ${maxAllowedFret}`);
    }
    if (values.maxFret < 0 || values.maxFret > maxAllowedFret) {
      //throw new Error(`maxFret must be between 0 and ${maxAllowedFret}`);
      console.warn(`maxFret must be between 0 and ${maxAllowedFret}`);
    }
    if (values.minFret > values.maxFret) {
      //throw new Error('minFret must be less than or equal to maxFret');
      console.warn('minFret must be less than or equal to maxFret');
    }
  }
}

export default ArpeggioPlugin;
