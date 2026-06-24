import properties from './properties.json' with { type: 'json' };
import { MenuItemProxy } from '../MenuItemProxy.js';
import { PluginProperty } from '../PluginProperty.js';
import { buildCaption, buildValueReference } from '../PluginProperty.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { createLookupContext, lookupClassForNote } from '../../colorFunctions.js';
import EventBus from '../../event-bus.js';
import { getSong } from '../../infinite-neck.js';
import {
  chordNotesFromStoredChord,
  modeNotesFromStoredMode
} from '../chart/chart-tonal-resolver.js';

const ARPEGGIO_OWNER = 'ArpeggioPlugin';
const STYLE_EVERY = 'every';
const STYLE_ALTERNATE = 'alternate';
const STYLE_RANDOM = 'random';
const STYLE_BACH = 'bach';
const SOURCE_TYPE_NAMED_NOTE = 'NamedNote';
const SOURCE_TYPE_SINGLE_NOTE = 'SingleNote';
const SOURCE_TYPE_AUTO_CHART_CHORD = 'AutoChartChord';
const SOURCE_TYPE_AUTO_CHART_MODE = 'AutoChartMode';
const SOURCE_TYPE_AUTO_CHART_CHORD_MODE = 'AutoChartChordMode';
const SHOW_NOTE_NAME_OFF = 'off';
const SHOW_NOTE_NAME_ONE = 'one';
const SHOW_NOTE_NAME_ALL = 'all';
const SHOW_NOTE_NAME_PLAYED = 'played';
const TARGET_TABLE_OPTION_LIMIT = 9;
const POSITIONS_VALUE_TOKEN = 'positionsCurrentSection';
const POSITIONS_SUMMARY_TOKEN = 'positionsSummary';
const STRINGS_SUMMARY_TOKEN = 'stringsSummary';
const POSITIONS_UNSET_DISPLAY = '[]';
const POSITIONS_MENU_DEFAULT = '[[0,3],[4,7],[8,12]]';
const POSITION_NOT_PLAYED_YET = -1;
const FILL_POSITIONS_REQUEST_PATH = 'fill/op';

export class ArpeggioPlugin {
  constructor() {
    this.id = 'arpeggio';
    this.registeredName = 'arpeggio';
    this.menuTrigger = 'a';
    this.eventNames = ['DaCapo:OnSectionBegin', 'DaCapo:OnSongEnd', 'SongUiShowBeats', 'Looper:OnResetSong'];
    this.rowBoundsInitialized = false;
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
    this.skipNextSongUiShowBeats = false;
    this.songLoopCountForPositionPair = 0;
    this.randomSequenceCacheBySection = new Map();
    this.sectionRuntimeIdentityCounter = 1;
    this.debugRandomSequence = false;
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
    this.refreshDynamicPropertyOptions(this.manager?.song || getSong());
    return [
      this.getProperty('targetTable')?.getMenuNodeSpec(this),
      this.getProperty('apply')?.getMenuNodeSpec(this),
      this.getProperty('clear')?.getMenuNodeSpec(this),
      this.buildPositionsMenuNode(),
      this.buildStringsMenuNode(),
      this.getProperty('lowToHigh')?.getMenuNodeSpec(this),
      this.getProperty('upOnly')?.getMenuNodeSpec(this),
      this.getProperty('style')?.getMenuNodeSpec(this),
      this.getProperty('type')?.getMenuNodeSpec(this),
      this.getProperty('showNoteName')?.getMenuNodeSpec(this),
      this.getProperty('colorNotes')?.getMenuNodeSpec(this),
      this.getProperty('flashcard')?.getMenuNodeSpec(this),
      this.getProperty('help')?.getMenuNodeSpec(this)
    ].filter(Boolean);
  }

  updatePropertyOptions(propertyName, options = []) {
    const property = this.getProperty(propertyName);
    if (!property) {
      return;
    }
    property.options = options.map((option) => ({ ...option }));
  }

  refreshDynamicPropertyOptions(song = getSong()) {
    this.updatePropertyOptions('targetTable', this.buildTargetTableOptions(song));
    this.initializeStringLimitDefaults(song);
    this.ensureTargetTableSelection(song);
    this.normalizeRangeValues(song);
  }

  initializeStringLimitDefaults(song = getSong()) {
    if (this.rowBoundsInitialized) {
      return;
    }

    const tuning = this.getTargetTuning(song) || this.getEligibleTargetTunings(song)[0] || null;
    if (!tuning) {
      return;
    }

    const upperStringProperty = this.getProperty('minRow');
    const lowerStringProperty = this.getProperty('maxRow');
    const upperStringDefault = 0;
    const lowerStringDefault = this.getMaxAllowedRow(tuning);

    upperStringProperty.value = upperStringDefault;
    upperStringProperty.defaultValue = upperStringDefault;
    lowerStringProperty.value = lowerStringDefault;
    lowerStringProperty.defaultValue = lowerStringDefault;
    this.rowBoundsInitialized = true;
  }

  resetStringLimitDefaultsForTarget(song = getSong(), tuning = null) {
    const selectedTuning = tuning || this.getTargetTuning(song) || this.getEligibleTargetTunings(song)[0] || null;
    if (!selectedTuning) {
      return;
    }

    const upperStringProperty = this.getProperty('minRow');
    const lowerStringProperty = this.getProperty('maxRow');
    const upperStringDefault = 0;
    const lowerStringDefault = this.getMaxAllowedRow(selectedTuning);

    upperStringProperty.value = upperStringDefault;
    upperStringProperty.defaultValue = upperStringDefault;
    lowerStringProperty.value = lowerStringDefault;
    lowerStringProperty.defaultValue = lowerStringDefault;
    this.rowBoundsInitialized = true;
  }

  normalizeRangeValues(song = getSong()) {
    const tuning = this.getTargetTuning(song) || this.getEligibleTargetTunings(song)[0] || null;
    if (!tuning) {
      return;
    }

    const maxAllowedFret = this.getMaxAllowedFret(song);
    const maxAllowedRow = this.getMaxAllowedRow(tuning);
    const minFretProperty = this.getProperty('minFret');
    const maxFretProperty = this.getProperty('maxFret');
    const minRowProperty = this.getProperty('minRow');
    const maxRowProperty = this.getProperty('maxRow');

    minFretProperty.value = this.clampNumber(minFretProperty.getValue(), 0, maxAllowedFret);
    maxFretProperty.value = this.clampNumber(maxFretProperty.getValue(), 0, maxAllowedFret);
    if (minFretProperty.getValue() > maxFretProperty.getValue()) {
      maxFretProperty.value = minFretProperty.getValue();
    }

    minRowProperty.value = this.clampNumber(minRowProperty.getValue(), 0, maxAllowedRow);
    maxRowProperty.value = this.clampNumber(maxRowProperty.getValue(), 0, maxAllowedRow);
    if (minRowProperty.getValue() > maxRowProperty.getValue()) {
      maxRowProperty.value = minRowProperty.getValue();
    }
  }

  clampNumber(value, minValue, maxValue) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return minValue;
    }
    return Math.min(maxValue, Math.max(minValue, parsed));
  }

  isStringLimitProperty(propertyName) {
    return propertyName === 'minRow' || propertyName === 'maxRow';
  }

  toDisplayStringNumber(rowIndex, song = getSong()) {
    const maxAllowedRow = this.getMaxAllowedRow(this.getTargetTuning(song));
    const clampedRowIndex = this.clampNumber(rowIndex, 0, Math.max(0, maxAllowedRow));
    return clampedRowIndex + 1;
  }

  toStoredRowIndex(rawValue, song = getSong()) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Expected string number, received: ${rawValue}`);
    }
    const maxStringNumber = this.getMaxAllowedRow(this.getTargetTuning(song)) + 1;
    const clampedStringNumber = this.clampNumber(parsed, 1, Math.max(1, maxStringNumber));
    return clampedStringNumber - 1;
  }

  ensureTargetTableSelection(song = getSong()) {
    const property = this.getProperty('targetTable');
    if (!property) {
      return;
    }
    const options = property.options || [];
    if (options.length === 0) {
      property.value = '';
      property.defaultValue = '';
      return;
    }
    const fallbackValue = `${options[0].value}`;
    const currentDefaultValue = `${property.getDefaultValue() || ''}`;
    if (!options.some((option) => `${option.value}` === currentDefaultValue)) {
      property.defaultValue = fallbackValue;
    }
    const currentValue = `${property.getValue() || ''}`;
    if (!options.some((option) => `${option.value}` === currentValue)) {
      property.value = property.getDefaultValue();
    }
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
    this.rowBoundsInitialized = false;
    this.songLoopCountForPositionPair = 0;
    this.clearRandomSequenceCache();
  }

  loadSongState(persistedProperties = {}, context = {}) {
    this.resetToDefaults();
    const song = context.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    Object.entries(persistedProperties).forEach(([name, value]) => {
      const property = this.getProperty(name);
      if (!property || property.datatype === 'org.dynamide.Action') {
        return;
      }
      this.setPropertyValue(name, value, { ...context, persistedLoad: true });
    });
    this.normalizeSectionPositionsOnLoad(song);
    this.refreshDynamicPropertyOptions(song);
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

  resolveValue(fieldName, context = {}) {
    const song = context.song || getSong();
    if (fieldName === 'targetTable' || fieldName === 'maxAllowedFret' || fieldName === 'maxAllowedRow' || this.isStringLimitProperty(fieldName)) {
      this.refreshDynamicPropertyOptions(song);
    }
    if (fieldName === 'targetTable') {
      const value = this.getProperty('targetTable')?.getValue() || '';
      return value.startsWith(Constants.TABLE_ID_PREFIX) ? value.slice(Constants.TABLE_ID_PREFIX.length) : value;
    }
    if (fieldName === 'maxAllowedFret') {
      return this.getMaxAllowedFret(song);
    }
    if (fieldName === 'maxAllowedRow') {
      return this.getMaxAllowedRow(this.getTargetTuning(song)) + 1;
    }
    if (this.isStringLimitProperty(fieldName)) {
      return this.toDisplayStringNumber(this.getProperty(fieldName)?.getValue() || 0, song);
    }
    if (fieldName === POSITIONS_SUMMARY_TOKEN) {
      return this.getCurrentSectionPositionsSummary(song);
    }
    if (fieldName === POSITIONS_VALUE_TOKEN) {
      return this.getCurrentSectionPositionsDisplay(song);
    }
    if (fieldName === STRINGS_SUMMARY_TOKEN) {
      return this.getCurrentStringsSummary(song);
    }
    return undefined;
  }

  enable(context = {}) {
    const song = context.song || this.manager?.song || getSong();
    this.refreshCurrentSectionPositionState(song);
    return 'Arpeggio enabled';
  }

  disable(context = {}) {
    const song = context.song || this.manager?.song || getSong();
    this.emitDiamondPositionDisplay({ clearExisting: true, tableID: '', minFret: null, maxFret: null });
    this.emitNamedNoteDisplay({ clearExisting: true, cells: [] });
    this.requestSectionStatusRefresh(song);
    return 'Arpeggio disabled';
  }

  handleEvent(eventName, payload = {}, context = {}) {
    if (eventName === 'DaCapo:OnSongEnd') {
      this.incrementSongLoopCounter();
      return {};
    }

    if (eventName === 'Looper:OnResetSong') {
      const song = context.song || getSong();
      this.resetSongLoopCounter();
      this.clearRandomSequenceCache();
      this.resetAllSectionPositionIndexes(song);
      return this.clearGeneratedNotesInSong(song);
    }

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

    const regenerateRandomSequence = this.shouldRegenerateRandomSequence(eventName, payload);
    return this.applyToSection({
      song: context.song || getSong(),
      payload,
      eventName,
      clearSectionFirst: regenerateRandomSequence,
      regenerateRandomSequence
    });
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || getSong();
    const args = context.args || {};
    switch (actionName) {
      case 'apply':
        return this.applyToSection({
          song,
          clearSectionFirst: true,
          regenerateRandomSequence: !!args?.regenerateRandomSequence
        });
      case 'clear':
        return this.clearAndResetSong(song);
      case 'positions:setCurrentSection':
        return this.setPositionsForCurrentSection(song, args?.value);
      case 'positions:clearCurrentSection':
        return this.clearPositionsForCurrentSection(song);
      case 'positions:clearAllSections':
        return this.clearPositionsForAllSections(song);
      case 'positions:copyToAllSections':
        return this.copyPositionsToSections(song, { onlyUnset: false });
      case 'positions:copyToUnsetSections':
        return this.copyPositionsToSections(song, { onlyUnset: true });
      case 'positions:refreshCurrentSection':
        return { result: `positions=${this.getCurrentSectionPositionsDisplay(song)}` };
      case 'positions:importFromFill':
        return this.importPositionsFromPlugin(FILL_POSITIONS_REQUEST_PATH, song);
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
    return `target table=${this.resolveValue('targetTable') || '<none>'} fret range=${this.getProperty('minFret')?.getValue()}..${this.getProperty('maxFret')?.getValue()} upper/lower string limit=${this.resolveValue('minRow')}..${this.resolveValue('maxRow')} style=${this.getProperty('style')?.getValue()} type=${this.getSourceType()} low to high=${this.getProperty('lowToHigh')?.getValue()} up only=${this.getProperty('upOnly')?.getValue()} show note names=${this.getShowNoteNameMode()} color notes=${this.getColorNotesEnabled()} flashcard=${this.getFlashcardEnabled()} song loops per position=${this.getSongLoopsPerPositionPair()}`;
  }

  buildHelpMessage(song) {
    const unsupportedMessage = this.getUnsupportedConfigurationMessage();
    const targetTuning = this.getTargetTuning(song);
    const tableID = targetTuning ? this.getTableID(targetTuning) : '<none>';
    return `<pre>${buildPluginHelpHeader(this, 'Arpeggio plugin:', this.buildSummary())}

Current settings:
- ${this.buildSummary()}
- target table = ${tableID}
- max fret limit = ${this.getMaxAllowedFret(song)}
- upper/lower string limit = ${this.resolveValue('minRow', { song })}..${this.resolveValue('maxRow', { song })}

Implemented in this iteration for:
- style = every
- style = alternate
- style = random
- style = bach
- type = NamedNote or SingleNote
- type = NamedNote, SingleNote, AutoChartChord, AutoChartMode, or AutoChartChordMode
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

  getSourceType() {
    return this.getProperty('type')?.getValue() || SOURCE_TYPE_NAMED_NOTE;
  }

  buildPositionsMenuNode() {
    const summaryToken = `plugin:${this.id}:${POSITIONS_SUMMARY_TOKEN}`;
    const token = `plugin:${this.id}:${POSITIONS_VALUE_TOKEN}`;
    return new MenuItemProxy(this, {
      name: 'positions',
      caption: `${buildCaption('positions', 'p')} [${buildValueReference(summaryToken)}]`,
      trigger: 'p',
      vars: [summaryToken],
      children: [
        this.getProperty('minFret').getMenuNodeSpec(this),
        this.getProperty('maxFret').getMenuNodeSpec(this),
        new MenuItemProxy(this, {
          name: 'positions:clearAllSections',
          caption: buildCaption('cLear all sections', 'L'),
          trigger: 'L',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:clearAllSections',
          popOnBang: true
        }),
        new MenuItemProxy(this, {
          name: 'positions:clearCurrentSection',
          caption: buildCaption('clear This section', 'T'),
          trigger: 'T',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:clearCurrentSection',
          popOnBang: true
        }),
        new MenuItemProxy(this, {
          name: 'positions:copyToAllSections',
          caption: buildCaption('Copy to all sections', 'C'),
          trigger: 'C',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:copyToAllSections',
          popOnBang: true
        }),
        new MenuItemProxy(this, {
          name: 'positions:copyToUnsetSections',
          caption: buildCaption('copy to Unset sections', 'U'),
          trigger: 'U',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:copyToUnsetSections',
          popOnBang: true
        }),
        new MenuItemProxy(this, {
          name: 'positions:refreshCurrentSection',
          caption: buildCaption('Refresh values', 'R'),
          trigger: 'R',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:refreshCurrentSection',
          popOnBang: true
        }),
        new MenuItemProxy(this, {
          name: 'positions:setCurrentSection',
          caption: `${buildCaption('values this section', 'v')} [${buildValueReference(token)}]`,
          trigger: 'v',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:setCurrentSection',
          vars: [token],
          popOnBang: true,
          input: {
            type: 'input',
            caption: 'arrays of positions',
            default: token,
            datatype: 'String',
            id: 'value'
          }
        }),
        this.getProperty('songLoopsPerPositionPair').getMenuNodeSpec(this),
        new MenuItemProxy(this, {
          name: 'positions:importFromFill',
          caption: buildCaption('Import from fill', 'I'),
          trigger: 'I',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:importFromFill',
          popOnBang: true
        })
      ]
    });
  }

  exportMenuOptions(menuPath, context = {}) {
    const normalizedMenuPath = `${menuPath || ''}`.trim();
    if (normalizedMenuPath !== 'p') {
      return {
        status: 'error',
        code: 'route-mismatch',
        message: `Arpeggio export supports only path p, received ${normalizedMenuPath || '<empty>'}`
      };
    }

    const sectionRef = `${context.sectionRef || ''}`;
    const instrumentRef = `${context.instrumentRef || ''}`;
    if (sectionRef !== '' || instrumentRef !== '') {
      return {
        status: 'error',
        code: 'unsupported-scope',
        message: 'Arpeggio export currently supports only Current section and instrument'
      };
    }

    const song = context.song || this.manager?.song || getSong();
    const section = this.getTargetSection(song);
    const positions = this.getSectionPositions(section) || [];
    return {
      status: 'ok',
      pluginId: this.id,
      menuPath: normalizedMenuPath,
      payload: {
        minFret: Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0,
        maxFret: Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0,
        songLoopsPerPositionPair: this.getSongLoopsPerPositionPair(),
        positions: this.clonePositions(positions)
      }
    };
  }

  parseImportedInteger(payload, fieldName) {
    const value = payload?.[fieldName];
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Imported ${fieldName} must be an integer`);
    }
    return parsed;
  }

  normalizeImportedPositionsPayload(payload, song = getSong()) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Imported payload must be an object');
    }

    const section = this.getTargetSection(song);
    if (!section) {
      throw new Error('No current section selected');
    }

    const tuning = this.getTargetTuning(song);
    if (!tuning) {
      throw new Error('No target instrument available in myTunings');
    }

    const minFret = this.parseImportedInteger(payload, 'minFret');
    const maxFret = this.parseImportedInteger(payload, 'maxFret');
    const songLoopsPerPositionPair = this.parseImportedInteger(payload, 'songLoopsPerPositionPair');
    if (songLoopsPerPositionPair < 1) {
      throw new Error('Imported songLoopsPerPositionPair must be >= 1');
    }

    const rawPositions = payload.positions;
    if (!Array.isArray(rawPositions)) {
      throw new Error('Imported positions must be an array');
    }
    const positions = this.validatePositionsValue(rawPositions, tuning);
    return {
      section,
      minFret,
      maxFret,
      songLoopsPerPositionPair,
      positions
    };
  }

  importPositionsFromPlugin(requestPath, song = getSong()) {
    const pluginManager = this.manager;
    if (!pluginManager || typeof pluginManager.getPluginMenuOptions !== 'function') {
      return {
        result: 'positions import failed',
        message: 'Arpeggio positions import failed: plugin manager export route unavailable'
      };
    }

    const supplierResponse = pluginManager.getPluginMenuOptions(requestPath);
    if (!supplierResponse || supplierResponse.status !== 'ok') {
      return {
        result: 'positions import failed',
        message: `Arpeggio positions import failed: ${supplierResponse?.message || 'supplier request failed'}`
      };
    }

    try {
      const imported = this.normalizeImportedPositionsPayload(supplierResponse.payload, song);
      this.setPropertyValue('minFret', imported.minFret, { song });
      this.setPropertyValue('maxFret', imported.maxFret, { song });
      this.setPropertyValue('songLoopsPerPositionPair', imported.songLoopsPerPositionPair, { song });

      if (imported.positions.length === 0) {
        this.clearSectionPositions(imported.section);
      } else {
        this.setSectionPositions(imported.section, imported.positions);
        this.setLastPositionIndex(imported.section, POSITION_NOT_PLAYED_YET);
      }
      this.refreshCurrentSectionPositionState(song, imported.section);

      const positionsSummary = imported.positions.length === 0
        ? 'positions=cleared'
        : `positions=${this.formatPositionsValue(imported.positions)}`;
      return {
        result: `Arpeggio imported from fill: minFret=${imported.minFret} maxFret=${imported.maxFret} loops=${imported.songLoopsPerPositionPair} ${positionsSummary}`
      };
    } catch (error) {
      return {
        result: 'positions import failed',
        message: `Arpeggio positions import failed: ${error?.message || 'invalid payload'}`
      };
    }
  }

  getSongLoopsPerPositionPair() {
    const value = Number.parseInt(this.getProperty('songLoopsPerPositionPair')?.getValue(), 10);
    if (!Number.isFinite(value) || value < 1) {
      return 1;
    }
    return value;
  }

  incrementSongLoopCounter() {
    this.songLoopCountForPositionPair += 1;
    if (!Number.isFinite(this.songLoopCountForPositionPair) || this.songLoopCountForPositionPair < 0) {
      this.songLoopCountForPositionPair = 0;
    }
  }

  resetSongLoopCounter() {
    this.songLoopCountForPositionPair = 0;
  }

  getSectionPositionIndexForCurrentSongLoop(section, positions = []) {
    const safePositions = Array.isArray(positions) ? positions : [];
    if (safePositions.length === 0) {
      return null;
    }

    const loopsPerPositionPair = this.getSongLoopsPerPositionPair();
    const songLoopCount = Math.max(0, Number.parseInt(this.songLoopCountForPositionPair, 10) || 0);
    const pairCycleCount = Math.floor(songLoopCount / loopsPerPositionPair);
    const nextIndex = pairCycleCount % safePositions.length;
    this.setLastPositionIndex(section, nextIndex);
    return nextIndex;
  }

  buildStringsMenuNode() {
    const summaryToken = `plugin:${this.id}:${STRINGS_SUMMARY_TOKEN}`;
    return new MenuItemProxy(this, {
      name: 'strings',
      caption: `${buildCaption('strings', 's')} [${buildValueReference(summaryToken)}]`,
      trigger: 's',
      vars: [summaryToken],
      children: [
        this.getProperty('minRow').getMenuNodeSpec(this),
        this.getProperty('maxRow').getMenuNodeSpec(this)
      ]
    });
  }

  getApprovedCaptionState(context = {}) {
    const song = context.song || this.manager?.song || getSong();
    const section = context.section || this.getTargetSection(song);
    const positions = this.getSectionPositions(section);
    const enabled = !!this.manager?.getPluginEntry?.(this.id)?.enabled;
    const lastPositionIndex = this.getLastPositionIndex(section);
    const currentIndex = Array.isArray(positions) && positions.length > 0
      ? ((lastPositionIndex !== null && lastPositionIndex >= 0) ? lastPositionIndex : 0)
      : lastPositionIndex;
    return {
      enabled,
      hasSection: !!section,
      positions,
      currentIndex,
      lowerString: this.resolveValue('minRow', { song }),
      upperString: this.resolveValue('maxRow', { song })
    };
  }

  buildPositionsStatusWidget(state) {
    if (!state.enabled || !state.hasSection || !Array.isArray(state.positions) || state.positions.length === 0) {
      return '';
    }
    const rangeCell = `<td class="arpeggioStringRange"><span class="arpeggioLowerString">${state.lowerString}</span>:<span class="arpeggioUpperString">${state.upperString}</span></td>`;
    const tds = state.positions.map((position, index) => {
      const tdClass = index === state.currentIndex ? ' class="arpeggioCurrentPositionPair"' : '';
      return `<td${tdClass}>${position[0]}</td><td${tdClass}>${position[1]}</td>`;
    }).join('');
    return `<span class="arpeggioPositionsStatus"><table><tr>${rangeCell}${tds}</tr></table></span>`;
  }

  getApprovedCaptionValue(tokenName, context = {}) {
    const state = this.getApprovedCaptionState(context);

    if (tokenName === 'arpeggioPositionsStatus') {
      return this.buildPositionsStatusWidget(state);
    }

    return '';
  }

  getArpeggioSectionData(section) {
    if (!section || typeof section !== 'object') {
      return null;
    }
    const pluginData = section.pluginData;
    if (!pluginData || typeof pluginData !== 'object') {
      return null;
    }
    const arpeggio = pluginData.arpeggio;
    return arpeggio && typeof arpeggio === 'object' ? arpeggio : null;
  }

  ensureArpeggioSectionData(section) {
    if (!section || typeof section !== 'object') {
      return null;
    }
    if (!section.pluginData || typeof section.pluginData !== 'object') {
      section.pluginData = {};
    }
    if (!section.pluginData.arpeggio || typeof section.pluginData.arpeggio !== 'object') {
      section.pluginData.arpeggio = {};
    }
    return section.pluginData.arpeggio;
  }

  pruneEmptyArpeggioSectionData(section) {
    if (!section || !section.pluginData || typeof section.pluginData !== 'object') {
      return;
    }
    const arpeggio = section.pluginData.arpeggio;
    if (arpeggio && typeof arpeggio === 'object' && Object.keys(arpeggio).length === 0) {
      delete section.pluginData.arpeggio;
    }
  }

  clonePositions(positions = []) {
    return (positions || []).map((position) => [...position]);
  }

  getSectionPositions(section) {
    const arpeggio = this.getArpeggioSectionData(section);
    if (!Array.isArray(arpeggio?.positions) || arpeggio.positions.length === 0) {
      return null;
    }
    return arpeggio.positions
      .filter((position) => Array.isArray(position) && position.length === 2)
      .map((position) => position.map((value) => Number.parseInt(value, 10)));
  }

  setSectionPositions(section, positions) {
    if (!Array.isArray(positions) || positions.length === 0) {
      this.clearSectionPositions(section);
      return;
    }
    const arpeggio = this.ensureArpeggioSectionData(section);
    arpeggio.positions = this.clonePositions(positions);
  }

  clearSectionPositions(section) {
    const arpeggio = this.getArpeggioSectionData(section);
    if (!arpeggio) {
      return;
    }
    delete arpeggio.positions;
    delete arpeggio.lastPositionIndex;
    this.pruneEmptyArpeggioSectionData(section);
  }

  getLastPositionIndex(section) {
    const arpeggio = this.getArpeggioSectionData(section);
    if (!arpeggio || arpeggio.lastPositionIndex === undefined || arpeggio.lastPositionIndex === null || arpeggio.lastPositionIndex === '') {
      return null;
    }
    const value = Number.parseInt(arpeggio.lastPositionIndex, 10);
    return Number.isInteger(value) ? value : null;
  }

  setLastPositionIndex(section, index) {
    const arpeggio = this.ensureArpeggioSectionData(section);
    arpeggio.lastPositionIndex = Number.parseInt(index, 10);
  }

  resetSectionPositionIndex(section) {
    const positions = this.getSectionPositions(section);
    if (!positions) {
      this.clearSectionPositions(section);
      return;
    }
    this.setLastPositionIndex(section, POSITION_NOT_PLAYED_YET);
  }

  resetAllSectionPositionIndexes(song = getSong()) {
    if (!song || !Array.isArray(song.sections)) {
      return 0;
    }
    let count = 0;
    song.sections.forEach((section) => {
      const positions = this.getSectionPositions(section);
      if (!positions) {
        this.clearSectionPositions(section);
        return;
      }
      this.setLastPositionIndex(section, POSITION_NOT_PLAYED_YET);
      count += 1;
    });
    return count;
  }

  clearAndResetSong(song = getSong()) {
    const resetCount = this.resetAllSectionPositionIndexes(song);
    const clearResult = this.clearGeneratedNotesInSong(song);
    this.refreshCurrentSectionPositionState(song);
    return {
      result: `${clearResult.result}; reset ${resetCount} position counters`
    };
  }

  normalizeSectionPositionsOnLoad(song = getSong()) {
    if (!song || !Array.isArray(song.sections)) {
      return;
    }
    song.sections.forEach((section) => {
      const positions = this.getSectionPositions(section);
      if (!positions) {
        this.clearSectionPositions(section);
        return;
      }
      this.setSectionPositions(section, positions);
      this.setLastPositionIndex(section, POSITION_NOT_PLAYED_YET);
    });
  }

  getSectionPositionsDisplay(section) {
    const positions = this.getSectionPositions(section);
    return positions ? this.formatPositionsValue(positions) : POSITIONS_UNSET_DISPLAY;
  }

  getCurrentSectionPositionsDisplay(song = getSong()) {
    return this.getSectionPositionsDisplay(this.getTargetSection(song));
  }

  getCurrentSectionPositionsSummary(song = getSong()) {
    const section = this.getTargetSection(song);
    const positions = this.getSectionPositions(section);
    if (positions) {
      return this.formatPositionsValue(positions);
    }
    const minFret = Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0;
    const maxFret = Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0;
    return `${minFret}:${maxFret}`;
  }

  getCurrentStringsSummary(song = getSong()) {
    return `${this.resolveValue('minRow', { song })}:${this.resolveValue('maxRow', { song })}`;
  }

  parsePositionsInput(rawValue) {
    const text = `${rawValue ?? ''}`.trim();
    if (text === '') {
      return [];
    }

    if (text.includes(';')) {
      return text.split(';')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
          const parts = segment.split(',').map((part) => part.trim()).filter(Boolean);
          if (parts.length === 1) {
            const start = this.parsePositionInteger(parts[0], rawValue);
            return [start, start + 4];
          }
          if (parts.length === 2) {
            return [this.parsePositionInteger(parts[0], rawValue), this.parsePositionInteger(parts[1], rawValue)];
          }
          throw new Error(`Invalid positions segment: ${segment}`);
        });
    }

    if (!text.startsWith('[')) {
      const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) {
        throw new Error(`Invalid positions input: ${rawValue}`);
      }
      const numbers = parts.map((part) => this.parsePositionInteger(part, rawValue));
      if (numbers.length >= 2) {
        return Array.from({ length: numbers.length - 1 }, (_, idx) => [numbers[idx], numbers[idx + 1]]);
      }
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected positions array');
    }
    return parsed;
  }

  parsePositionInteger(value, rawValue) {
    const text = `${value}`.trim();
    if (!/^-?\d+$/.test(text)) {
      throw new Error(`Expected integer in positions input: ${rawValue}`);
    }
    return Number.parseInt(text, 10);
  }

  normalizePositionsValue(rawValue, tuning) {
    const parsed = this.parsePositionsInput(rawValue);
    const normalized = this.validatePositionsValue(parsed, tuning);
    return this.clonePositions(normalized);
  }

  validatePositionsValue(positions, tuning) {
    if (!Array.isArray(positions)) {
      throw new Error('Expected positions array');
    }
    return positions.map((position) => {
      if (!Array.isArray(position) || position.length !== 2) {
        throw new Error(`Invalid position pair: ${JSON.stringify(position)}`);
      }
      const minFret = this.parsePositionInteger(position[0], JSON.stringify(position));
      const maxFret = this.parsePositionInteger(position[1], JSON.stringify(position));
      if (minFret < 0 || maxFret < 0) {
        throw new Error(`Negative frets are not allowed: ${JSON.stringify(position)}`);
      }
      if (minFret > maxFret) {
        throw new Error(`Reversed position pair: ${JSON.stringify(position)}`);
      }
      const maxAllowedFret = Number.parseInt(tuning?.frets, 10);
      if (Number.isInteger(maxAllowedFret) && maxFret > maxAllowedFret) {
        throw new Error(`Position exceeds target tuning fret range 0..${maxAllowedFret}: ${JSON.stringify(position)}`);
      }
      return [minFret, maxFret];
    });
  }

  formatPositionsValue(positions) {
    return JSON.stringify(this.clonePositions(positions));
  }

  buildPositionsRejectResponse(reason, rawValue) {
    return {
      result: 'positions rejected',
      message: `Arpeggio positions rejected: ${reason}. Attempted: ${rawValue}`
    };
  }

  resolveEffectiveFretWindow(section, tuning, options = {}) {
    const positions = this.getSectionPositions(section);
    const defaultMinFret = Math.max(0, Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0);
    const maxAllowedFret = this.getMaxAllowedFret({ myTunings: [tuning], wirings: [] });
    const defaultMaxFret = Math.min(maxAllowedFret, Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0);

    if (!positions) {
      return {
        minFret: defaultMinFret,
        maxFret: defaultMaxFret,
        positionsUsed: false,
        appliedIndex: null
      };
    }

    const appliedIndex = this.getSectionPositionIndexForCurrentSongLoop(section, positions);
    const [minFret, maxFret] = positions[appliedIndex];
    return {
      minFret,
      maxFret,
      positionsUsed: true,
      appliedIndex
    };
  }

  setPositionsForCurrentSection(song = getSong(), rawValue = '') {
    const section = this.getTargetSection(song);
    if (!section) {
      return { result: 'positions skipped: no current section selected' };
    }
    const tuning = this.getTargetTuning(song);
    if (!tuning) {
      return { result: 'positions skipped: no target instrument available in myTunings' };
    }
    if (`${rawValue ?? ''}`.trim() === '') {
      this.clearSectionPositions(section);
      return { result: 'positions cleared for current section' };
    }
    try {
      const positions = this.normalizePositionsValue(rawValue, tuning);
      if (positions.length === 0) {
        this.clearSectionPositions(section);
        return { result: 'positions cleared for current section' };
      }
      this.setSectionPositions(section, positions);
      this.setLastPositionIndex(section, POSITION_NOT_PLAYED_YET);
      this.refreshCurrentSectionPositionState(song, section);
      return { result: `positions=${this.formatPositionsValue(positions)}` };
    } catch (error) {
      return this.buildPositionsRejectResponse(error?.message || 'invalid positions', rawValue);
    }
  }

  clearPositionsForCurrentSection(song = getSong()) {
    const section = this.getTargetSection(song);
    if (!section) {
      return { result: 'positions skipped: no current section selected' };
    }
    this.clearSectionPositions(section);
    this.refreshCurrentSectionPositionState(song, section);
    return { result: 'positions cleared for current section' };
  }

  clearPositionsForAllSections(song = getSong()) {
    if (!song || !Array.isArray(song.sections)) {
      return { result: 'positions skipped: no song loaded' };
    }
    const currentSection = this.getTargetSection(song);
    let clearedCount = 0;
    song.sections.forEach((section) => {
      if (this.getSectionPositions(section) || this.getLastPositionIndex(section) !== null) {
        this.clearSectionPositions(section);
        clearedCount += 1;
      }
    });
    this.refreshCurrentSectionPositionState(song, currentSection);
    return { result: `positions cleared across ${clearedCount} sections` };
  }

  copyPositionsToSections(song = getSong(), { onlyUnset = false } = {}) {
    if (!song || !Array.isArray(song.sections)) {
      return { result: 'positions skipped: no song loaded' };
    }
    const currentSection = this.getTargetSection(song);
    const sourcePositions = this.getSectionPositions(currentSection);
    if (!sourcePositions) {
      return { result: 'positions copy skipped: current section unset' };
    }
    this.setLastPositionIndex(currentSection, POSITION_NOT_PLAYED_YET);
    let copiedCount = 0;
    song.sections.forEach((section) => {
      if (section === currentSection) {
        return;
      }
      if (onlyUnset && this.getSectionPositions(section)) {
        return;
      }
      this.setSectionPositions(section, sourcePositions);
      this.setLastPositionIndex(section, POSITION_NOT_PLAYED_YET);
      copiedCount += 1;
    });
    this.refreshCurrentSectionPositionState(song, currentSection);
    return {
      result: onlyUnset
        ? `positions copied to ${copiedCount} unset sections`
        : `positions copied to ${copiedCount} sections`
    };
  }

  refreshCurrentSectionPositionState(song = getSong(), section = null) {
    if (!song || song.isHeadless) {
      return;
    }

    this.requestSectionStatusRefresh(song);

    const currentSection = section || this.getTargetSection(song);
    if (!currentSection) {
      return;
    }

    if (typeof song.getCurrentSection === 'function' && song.getCurrentSection() !== currentSection) {
      return;
    }

    const enabled = !!this.manager?.getPluginEntry?.(this.id)?.enabled;
    if (!enabled) {
      return;
    }

    this.refreshNamedNoteDisplay({
      song,
      eventName: 'manual'
    });
  }

  buildTargetTableOptions(song = getSong()) {
    const tunings = this.getEligibleTargetTunings(song).slice(0, TARGET_TABLE_OPTION_LIMIT);
    return tunings.map((tuning, index) => ({
      value: this.getTableID(tuning),
      caption: `${index + 1}) ${tuning.baseID}`,
      trigger: `${index + 1}`
    }));
  }

  getEligibleTargetTunings(song = getSong()) {
    if (!song || !Array.isArray(song.myTunings)) {
      return [];
    }
    const wiredTableNames = new Set((song.wirings || []).map((wiring) => wiring?.tablename).filter(Boolean));
    return song.myTunings.filter((tuning) => !wiredTableNames.has(this.getTableID(tuning)));
  }

  getSelectedTargetTableID() {
    return `${this.getProperty('targetTable')?.getValue() || ''}`;
  }

  getTargetTuning(song = getSong()) {
    const eligibleTunings = this.getEligibleTargetTunings(song);
    if (eligibleTunings.length === 0) {
      return null;
    }
    const selectedTableID = this.getSelectedTargetTableID();
    return eligibleTunings.find((tuning) => this.getTableID(tuning) === selectedTableID) || eligibleTunings[0] || null;
  }

  getMaxAllowedFret(song = getSong()) {
    const targetTuning = this.getTargetTuning(song);
    if (!targetTuning) {
      return 24;
    }
    return Number.parseInt(targetTuning.frets, 10) || 0;
  }

  getMaxAllowedRow(tuning = this.getTargetTuning(getSong())) {
    return Math.max(0, (Array.isArray(tuning?.rowRange) ? tuning.rowRange.length : 1) - 1);
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

  shouldRegenerateRandomSequence(eventName = 'manual', payload = {}) {
    if (eventName !== 'DaCapo:OnSectionBegin') {
      return false;
    }

    if (payload?.regenerateRandomSequence === true) {
      return true;
    }

    if (payload?.reuseRandomSequence === true) {
      return false;
    }

    const transportAction = `${payload?.transportAction || payload?.action || ''}`.trim();
    const action = transportAction.toLowerCase();
    if (action === 'restartsection' || action === 'startloopsections' || action === 'startloopbeats' || action === 'loopbeatswrap') {
      return false;
    }
    if (action === 'loopsectionstransition' || action === 'gofirstsection') {
      return true;
    }
    if (transportAction.length > 0) {
      return true;
    }

    return true;
  }

  clearRandomSequenceCache() {
    this.randomSequenceCacheBySection.clear();
  }

  getSectionRuntimeIdentity(section) {
    if (!section || typeof section !== 'object') {
      return 'unknown';
    }
    if (!Object.prototype.hasOwnProperty.call(section, '__arpeggioRuntimeIdentity')) {
      section.__arpeggioRuntimeIdentity = `s${this.sectionRuntimeIdentityCounter}`;
      this.sectionRuntimeIdentityCounter += 1;
    }
    return section.__arpeggioRuntimeIdentity;
  }

  buildRandomSequenceCacheKey({
    section,
    tableID,
    sourceType,
    minRow,
    maxRow,
    minFret,
    maxFret,
    beatCount,
    candidates,
    fretWindow
  } = {}) {
    const sectionIdentity = this.getSectionRuntimeIdentity(section);
    const candidatesSignature = (candidates || []).map((candidate) => this.getCandidatePositionKey(candidate)).join('|');
    return [
      sectionIdentity,
      tableID || '',
      sourceType || '',
      `${minRow}:${maxRow}`,
      `${minFret}:${maxFret}`,
      `${Number.parseInt(beatCount, 10) || 0}`,
      `${Number.isInteger(fretWindow?.appliedIndex) ? fretWindow.appliedIndex : -1}`,
      candidatesSignature
    ].join('~');
  }

  buildRandomizedCycle(candidates = []) {
    const remaining = [...candidates];
    const randomizedCycle = [];
    while (remaining.length > 0) {
      const randomIndex = Math.floor(this.getRandomNumber() * remaining.length);
      randomizedCycle.push(remaining.splice(randomIndex, 1)[0]);
    }
    return randomizedCycle;
  }

  buildRandomSequenceForBeatCount(uniqueCandidates = [], beatCount = 0) {
    if (!Array.isArray(uniqueCandidates) || uniqueCandidates.length === 0 || beatCount <= 0) {
      return [];
    }
    if (uniqueCandidates.length === 1) {
      return Array.from({ length: beatCount }, () => uniqueCandidates[0]);
    }

    const sequence = [];
    while (sequence.length < beatCount) {
      const cycle = this.buildRandomizedCycle(uniqueCandidates);
      sequence.push(...cycle);
    }
    return sequence.slice(0, beatCount);
  }

  getCachedRandomSequence(candidates, beatCount, context = {}) {
    const uniqueCandidates = this.dedupeCandidatesByPosition(candidates);
    const cacheKey = this.buildRandomSequenceCacheKey({
      section: context.section,
      tableID: context.tableID,
      sourceType: context.sourceType,
      minRow: context.minRow,
      maxRow: context.maxRow,
      minFret: context.minFret,
      maxFret: context.maxFret,
      beatCount,
      candidates: uniqueCandidates,
      fretWindow: context.fretWindow
    });
    const sectionKey = this.getSectionRuntimeIdentity(context.section);
    const cached = this.randomSequenceCacheBySection.get(sectionKey);
    const shouldRegenerate = !!context.regenerateRandomSequence;
    const shouldReuse = !shouldRegenerate && cached && cached.cacheKey === cacheKey;

    if (shouldReuse) {
      return cached.sequence;
    }

    const sequence = this.buildRandomSequenceForBeatCount(uniqueCandidates, beatCount);
    this.randomSequenceCacheBySection.set(sectionKey, {
      cacheKey,
      sequence
    });

    if (this.debugRandomSequence) {
      console.log(`Arpeggio random sequence regenerated: section=${sectionKey} beats=${beatCount} candidates=${uniqueCandidates.length}`);
    }

    return sequence;
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

  getDiamondPositionDisplayPayload({ section = null, tableID = '', fretWindow = null } = {}) {
    const enabled = !!this.manager?.getPluginEntry?.(this.id)?.enabled;
    const activeIndex = Number.isInteger(fretWindow?.appliedIndex)
      ? fretWindow.appliedIndex
      : this.getLastPositionIndex(section);
    const positions = this.getSectionPositions(section);

    if (!enabled || !section || !tableID || !Array.isArray(positions) || positions.length === 0 || !Number.isInteger(activeIndex) || activeIndex < 0) {
      return {
        owner: ARPEGGIO_OWNER,
        clearExisting: true,
        tableID,
        minFret: null,
        maxFret: null
      };
    }

    const activeRange = positions[activeIndex];
    if (!Array.isArray(activeRange) || activeRange.length !== 2) {
      return {
        owner: ARPEGGIO_OWNER,
        clearExisting: true,
        tableID,
        minFret: null,
        maxFret: null
      };
    }

    return {
      owner: ARPEGGIO_OWNER,
      clearExisting: true,
      tableID,
      minFret: activeRange[0],
      maxFret: activeRange[1]
    };
  }

  emitDiamondPositionDisplay(payload = {}) {
    EventBus.trigger('NoteTable:ShowDiamondPositionRange', {
      owner: ARPEGGIO_OWNER,
      clearExisting: !!payload.clearExisting,
      tableID: payload.tableID || '',
      minFret: payload.minFret,
      maxFret: payload.maxFret
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

  syncDiamondPositionDisplay({ song = getSong(), section = null, tableID = '', fretWindow = null } = {}) {
    if (!song || song.isHeadless) {
      return;
    }

    if (section && typeof song.getCurrentSection === 'function' && song.getCurrentSection() !== section) {
      return;
    }

    this.emitDiamondPositionDisplay(this.getDiamondPositionDisplayPayload({ section, tableID, fretWindow }));
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

  requestSectionStatusRefresh(song = getSong()) {
    if (!song || song.isHeadless) {
      return;
    }
    EventBus.trigger('UpdateSectionStatus', {
      sectionIndex: typeof song.getSectionsCurrentIndex === 'function'
        ? song.getSectionsCurrentIndex()
        : undefined
    });
  }

  refreshNamedNoteDisplay({ song = getSong(), payload = {}, eventName = 'SongUiShowBeats' } = {}) {
    if (!song) {
      return;
    }

    const section = this.getTargetSection(song, payload);
    const tuning = this.getTargetTuning(song);
    if (!section || !tuning) {
      this.emitNamedNoteDisplay({ clearExisting: true, cells: [] });
      this.emitDiamondPositionDisplay({ clearExisting: true, tableID: '', minFret: null, maxFret: null });
      return;
    }

    const beatCount = typeof section.getBeats === 'function'
      ? section.getBeats()
      : (Number.parseInt(section?.beats, 10) || 0);
    const fretWindow = this.resolveEffectiveFretWindow(section, tuning, { advance: false });
    const candidates = this.collectCandidatesForSection(section, tuning, {
      lowToHigh: [STYLE_RANDOM, STYLE_BACH].includes(this.getStyle()) ? true : this.isLowToHigh(),
      minFret: fretWindow.minFret,
      maxFret: fretWindow.maxFret
    });
    const sequence = this.expandCandidateSequence(candidates, beatCount, {
      song,
      section,
      tableID: this.getTableID(tuning),
      sourceType: this.getSourceType(),
      minRow: this.getProperty('minRow')?.getValue(),
      maxRow: this.getProperty('maxRow')?.getValue(),
      minFret: fretWindow.minFret,
      maxFret: fretWindow.maxFret,
      fretWindow,
      regenerateRandomSequence: false,
      eventName
    });
    this.syncNamedNoteDisplay({
      song,
      section,
      tableID: this.getTableID(tuning),
      sequence,
      eventName
    });
    this.syncDiamondPositionDisplay({
      song,
      section,
      tableID: this.getTableID(tuning),
      fretWindow
    });
  }

  collectCandidatesForSection(section, tuning, options = {}) {
    const tableID = this.getTableID(tuning);
    const sectionNotes = section?.sectionNotesByTable?.[tableID];
    const targetNoteNames = this.collectCandidateNoteNames(sectionNotes, section);

    if (targetNoteNames.size === 0) {
      return [];
    }

    const minFret = Math.max(0, Number.parseInt(options.minFret ?? this.getProperty('minFret')?.getValue(), 10) || 0);
    const maxAllowedFret = this.getMaxAllowedFret({ myTunings: [tuning], wirings: [] });
    const maxFret = Math.min(maxAllowedFret, Number.parseInt(options.maxFret ?? this.getProperty('maxFret')?.getValue(), 10) || 0);
    const rowRange = Array.isArray(tuning.rowRange) ? tuning.rowRange : [];
    const candidates = [];
    const lowToHigh = options.lowToHigh ?? this.isLowToHigh();
    const maxAllowedRow = Math.max(0, rowRange.length - 1);
    const minRow = this.clampNumber(options.minRow ?? this.getProperty('minRow')?.getValue(), 0, maxAllowedRow);
    const maxRow = this.clampNumber(options.maxRow ?? this.getProperty('maxRow')?.getValue(), 0, maxAllowedRow);
    const rowIndexes = lowToHigh
      ? Array.from({ length: Math.max(0, maxRow - minRow + 1) }, (_, idx) => maxRow - idx)
      : Array.from({ length: Math.max(0, maxRow - minRow + 1) }, (_, idx) => minRow + idx);
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

  collectCandidateNoteNames(sectionNotes, section = null) {
    switch (this.getSourceType()) {
      case SOURCE_TYPE_SINGLE_NOTE:
        return this.collectSingleNoteSourceNames(sectionNotes);
      case SOURCE_TYPE_AUTO_CHART_CHORD:
        return this.collectAutoChartChordSourceNames(section);
      case SOURCE_TYPE_AUTO_CHART_MODE:
        return this.collectAutoChartModeSourceNames(section);
      case SOURCE_TYPE_AUTO_CHART_CHORD_MODE:
        return this.collectAutoChartChordModeSourceNames(section);
      case SOURCE_TYPE_NAMED_NOTE:
      default:
        return this.collectNamedNoteSourceNames(sectionNotes);
    }
  }

  collectNamedNoteSourceNames(sectionNotes) {
    const namedNotes = sectionNotes?.namedNotes || {};
    return new Set(
      Object.entries(namedNotes)
        .filter(([, note]) => note && typeof note === 'object' && Object.keys(note).length > 0)
        .map(([noteName]) => noteName)
    );
  }

  collectSingleNoteSourceNames(sectionNotes) {
    return new Set(
      (sectionNotes?.playedNotes || [])
        .filter((note) => note?.styleNum === Note.STYLENUM_SINGLE)
        .map((note) => `${note?.noteName || ''}`.trim())
        .filter((noteName) => noteName.length > 0)
    );
  }

  getEffectiveChartRootID(section) {
    const rootID = Number.parseInt(section?.rootID, 10);
    if (!Number.isInteger(rootID) || rootID < 0 || rootID >= Constants.NOTE_NAMES_ARRAY.length) {
      return 0;
    }
    return rootID;
  }

  collectAutoChartChordSourceNames(section) {
    const rootID = this.getEffectiveChartRootID(section);
    return chordNotesFromStoredChord(`${section?.chartChord || ''}`, rootID);
  }

  collectAutoChartModeSourceNames(section) {
    const rootID = this.getEffectiveChartRootID(section);
    return modeNotesFromStoredMode(`${section?.chartMode || ''}`, rootID);
  }

  collectAutoChartChordModeSourceNames(section) {
    const chordSet = this.collectAutoChartChordSourceNames(section);
    const modeSet = this.collectAutoChartModeSourceNames(section);
    return new Set([...chordSet, ...modeSet]);
  }

  expandCandidateSequence(candidates, beatCount, context = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0 || beatCount <= 0) {
      return [];
    }

    const style = this.getStyle();
    switch (style) {
      case STYLE_RANDOM:
        return this.getCachedRandomSequence(candidates, beatCount, {
          ...context,
          sourceType: context?.sourceType || this.getSourceType(),
          minRow: context?.minRow ?? this.getProperty('minRow')?.getValue(),
          maxRow: context?.maxRow ?? this.getProperty('maxRow')?.getValue(),
          minFret: context?.minFret,
          maxFret: context?.maxFret,
          regenerateRandomSequence: !!context?.regenerateRandomSequence
        });
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
    return this.buildRandomSequenceForBeatCount(this.dedupeCandidatesByPosition(candidates), beatCount);
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

  emitUserLogMessage(message) {
    if (!message) {
      return;
    }
    EventBus.trigger('UserLog', { subSystem: 'ArpeggioPlugin', message });
  }

  applyToSection({ song = getSong(), payload = {}, eventName = 'manual', clearSectionFirst = true, regenerateRandomSequence = false } = {}) {
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
      this.emitUserLogMessage(unsupportedMessage);
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
    const fretWindow = this.resolveEffectiveFretWindow(section, tuning, {});
    const candidates = this.collectCandidatesForSection(section, tuning, {
      lowToHigh: [STYLE_RANDOM, STYLE_BACH].includes(this.getStyle()) ? true : this.isLowToHigh(),
      minFret: fretWindow.minFret,
      maxFret: fretWindow.maxFret
    });
    if (candidates.length === 0) {
      this.requestSectionStatusRefresh(song);
      this.syncNamedNoteDisplay({ song, section, tableID: this.getTableID(tuning), sequence: [], eventName });
      this.syncDiamondPositionDisplay({
        song,
        section,
        tableID: this.getTableID(tuning),
        fretWindow
      });
      if (removedCount > 0) {
        this.requestCurrentBeatRefresh(song, section);
      }
      return {
        result: `Arpeggio applied: no matching named notes on target table ${this.getTableID(tuning)}; removed=${removedCount}`
      };
    }

    const tableID = this.getTableID(tuning);
    const sequenceWithContext = this.expandCandidateSequence(candidates, beatCount, {
      song,
      section,
      tableID,
      sourceType: this.getSourceType(),
      minRow: this.getProperty('minRow')?.getValue(),
      maxRow: this.getProperty('maxRow')?.getValue(),
      minFret: fretWindow.minFret,
      maxFret: fretWindow.maxFret,
      fretWindow,
      regenerateRandomSequence: !!regenerateRandomSequence,
      eventName
    });
    const sectionNotes = section.getSectionNotes(tableID);
    let generatedCount = 0;
    let preservedCount = 0;

    sequenceWithContext.forEach((candidate, index) => {
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
    this.requestSectionStatusRefresh(song);
    this.syncNamedNoteDisplay({ song, section, tableID, sequence: sequenceWithContext, eventName });
    this.syncDiamondPositionDisplay({ song, section, tableID, fretWindow });

    return {
      result: `Arpeggio applied: target table=${tableID} source=${eventName} generated=${generatedCount} preserved=${preservedCount} removed=${removedCount} beats=${beatCount}`
    };
  }

  validateValues(values, song = getSong()) {
    const maxAllowedFret = this.getMaxAllowedFret(song);
    // Throwing here can block song load; use UserLog feedback instead.
    if (values.minFret < 0 || values.minFret > maxAllowedFret) {
      this.emitUserLogMessage(`minFret must be between 0 and ${maxAllowedFret}`);
    }
    if (values.maxFret < 0 || values.maxFret > maxAllowedFret) {
      this.emitUserLogMessage(`maxFret must be between 0 and ${maxAllowedFret}`);
    }
    if (values.minFret > values.maxFret) {
      this.emitUserLogMessage('minFret must be less than or equal to maxFret');
    }
    const maxAllowedRow = this.getMaxAllowedRow(this.getTargetTuning(song));
    if (values.minRow < 0 || values.minRow > maxAllowedRow) {
      this.emitUserLogMessage(`minRow must be between 0 and ${maxAllowedRow}`);
    }
    if (values.maxRow < 0 || values.maxRow > maxAllowedRow) {
      this.emitUserLogMessage(`maxRow must be between 0 and ${maxAllowedRow}`);
    }
    if (values.minRow > values.maxRow) {
      this.emitUserLogMessage('minRow must be less than or equal to maxRow');
    }
    if (Number.isFinite(values.songLoopsPerPositionPair) && values.songLoopsPerPositionPair < 1) {
      this.emitUserLogMessage('songLoopsPerPositionPair must be greater than or equal to 1');
    }
  }

  setPropertyValue(name, rawValue, context = {}) {
    const property = this.getProperty(name);
    if (!property) {
      throw new Error(`ArpeggioPlugin unknown property: ${name}`);
    }

    const song = context.song || getSong();
    this.refreshDynamicPropertyOptions(song);

    const candidateValue = property.normalize(rawValue);
    const normalizedValue = this.isStringLimitProperty(name)
      ? (context.persistedLoad ? property.normalize(rawValue) : this.toStoredRowIndex(rawValue, song))
      : candidateValue;
    const nextValues = {
      minFret: this.getProperty('minFret')?.getValue(),
      maxFret: this.getProperty('maxFret')?.getValue(),
      minRow: this.getProperty('minRow')?.getValue(),
      maxRow: this.getProperty('maxRow')?.getValue(),
      lowToHigh: this.getProperty('lowToHigh')?.getValue(),
      upOnly: this.getProperty('upOnly')?.getValue(),
      style: this.getProperty('style')?.getValue(),
      songLoopsPerPositionPair: this.getSongLoopsPerPositionPair(),
      [name]: normalizedValue
    };

    this.validateValues(nextValues, song);
    if (name === 'songLoopsPerPositionPair') {
      const nextLoopCount = Number.parseInt(normalizedValue, 10);
      property.value = Number.isFinite(nextLoopCount) && nextLoopCount > 0 ? nextLoopCount : 1;
      return property.getValue();
    }
    if (this.isStringLimitProperty(name)) {
      property.value = context.persistedLoad ? property.normalize(rawValue) : this.toStoredRowIndex(rawValue, song);
      this.rowBoundsInitialized = true;
      this.normalizeRangeValues(song);
      return property.getValue();
    }

    const previousTargetTable = name === 'targetTable' ? `${property.getValue() || ''}` : '';
    const nextValue = property.setValue(rawValue);
    if (name === 'targetTable' && !context.persistedLoad && `${nextValue || ''}` !== previousTargetTable) {
      this.resetStringLimitDefaultsForTarget(song);
    }
    this.normalizeRangeValues(song);
    return nextValue;
  }
}

export default ArpeggioPlugin;
