import properties from './properties.json' with { type: 'json' };
import { PluginProperty } from '../PluginProperty.js';
import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { getSong } from '../../infinite-neck.js';

const ARPEGGIO_OWNER = 'ArpeggioPlugin';
const SUPPORTED_STYLE = 'every';

export class ArpeggioPlugin {
  constructor() {
    this.id = 'arpeggio';
    this.registeredName = 'arpeggio';
    this.menuTrigger = 'a';
    this.eventNames = ['DaCapo:OnSectionBegin'];
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
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
          result: 'Arpeggio help shown',
          message: this.buildHelpMessage(song)
        };
      default:
        return { result: `Unknown arpeggio action: ${actionName}` };
    }
  }

  buildSummary() {
    return `min=${this.getProperty('minFret')?.getValue()} max=${this.getProperty('maxFret')?.getValue()} style=${this.getProperty('style')?.getValue()} lowToHigh=${this.getProperty('lowToHigh')?.getValue()} upOnly=${this.getProperty('upOnly')?.getValue()}`;
  }

  buildHelpMessage(song) {
    const unsupportedMessage = this.getUnsupportedConfigurationMessage();
    const targetTuning = this.getTargetTuning(song);
    const tableID = targetTuning ? this.getTableID(targetTuning) : '<none>';
    return `<pre>Arpeggio plugin

Implemented in this iteration only for:
- style = every
- lowToHigh = true
- upOnly = true or false
- target instrument = first myTunings entry not wired as a Listener or Observer

Not implemented yet:
- style = alternate
- style = random
- lowToHigh = false

Current settings:
- ${this.buildSummary()}
- targetTable = ${tableID}
- maxAllowedFret = ${this.getMaxAllowedFret(song)}

${unsupportedMessage || 'Current settings are implemented.'}</pre>`;
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
    if (this.getProperty('style')?.getValue() !== SUPPORTED_STYLE) {
      return 'This iteration supports only style=every. Use help for the implemented combination.';
    }
    if (this.getProperty('lowToHigh')?.getValue() !== true) {
      return 'This iteration supports only lowToHigh=true. Use help for the implemented combination.';
    }
    return '';
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

  collectCandidatesForSection(section, tuning) {
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

    for (let row = rowRange.length - 1; row >= 0; row -= 1) {
      const openMidi = Number.parseInt(rowRange[row], 10);
      if (!Number.isFinite(openMidi)) {
        continue;
      }
      for (let fret = minFret; fret <= maxFret; fret += 1) {
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

  expandCandidateSequence(candidates, beatCount) {
    if (!Array.isArray(candidates) || candidates.length === 0 || beatCount <= 0) {
      return [];
    }

    if (candidates.length === 1) {
      return Array.from({ length: beatCount }, () => candidates[0]);
    }

    const upOnly = !!this.getProperty('upOnly')?.getValue();
    const cycle = upOnly
      ? [...candidates]
      : [...candidates, ...candidates.slice(1, -1).reverse()];

    return Array.from({ length: beatCount }, (_, idx) => cycle[idx % cycle.length]);
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
      return { result: 'Arpeggio clear skipped: no song' };
    }

    let removedCount = 0;
    let sectionCount = 0;
    song.sections.forEach((section) => {
      const sectionRemoved = this.clearGeneratedNotesInSection(section);
      if (sectionRemoved > 0) {
        sectionCount += 1;
        removedCount += sectionRemoved;
      }
    });

    return { result: `Arpeggio cleared: removed ${removedCount} generated notes in ${sectionCount} sections` };
  }

  applyToSection({ song = getSong(), payload = {}, eventName = 'manual', clearSectionFirst = true } = {}) {
    if (!song) {
      return { result: 'Arpeggio skipped: no song' };
    }

    const section = this.getTargetSection(song, payload);
    if (!section) {
      return { result: 'Arpeggio skipped: no current section' };
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
      return { result: 'Arpeggio skipped: no unwired instrument found in myTunings' };
    }

    const beatCount = typeof section.getBeats === 'function'
      ? section.getBeats()
      : (Number.parseInt(section?.beats, 10) || 0);
    const candidates = this.collectCandidatesForSection(section, tuning);
    if (candidates.length === 0) {
      return {
        result: `Arpeggio applied: no matching named notes for ${this.getTableID(tuning)}; removed=${removedCount}`
      };
    }

    const sequence = this.expandCandidateSequence(candidates, beatCount);
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

    return {
      result: `Arpeggio applied: table=${tableID} event=${eventName} generated=${generatedCount} preserved=${preservedCount} removed=${removedCount} beats=${beatCount}`
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
