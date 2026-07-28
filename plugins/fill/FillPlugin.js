import properties from './properties.json' with { type: 'json' };
import { PluginProperty, buildCaption, buildValueReference } from '../PluginProperty.js';
import { MenuItemProxy } from '../MenuItemProxy.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import {
  canonicalizeChordForStorage,
  canonicalizeModeForStorage,
  chordTypeFromStoredChord,
  modeTypeFromStoredMode
} from '../chart/chart-tonal-resolver.js';
import { Note } from '../../Note.js';
import { createLookupContext, lookupClassForNote } from '../../colorFunctions.js';
import { PalettePresentation } from '../../presentation.js';
import { getSong, getTransportController } from '../../infinite-neck.js';
import {
  computeRoleNoteSets as computeSharedRoleNoteSets,
  resolveRoleDecision,
  buildNamedRolePlan
} from '../../fill/fill-role-engine.js';

const FILL_OWNER = 'FillPlugin';
const MODE_NONE = 'none';
const MODE_KEEP = 'keep';
const MODE_ROLE = 'role';
const TINY_NONE = 'none';
const TARGET_TABLE_OPTION_LIMIT = 9;

const FAMILY_CONFIG = {
  named: {
    caption: 'named',
    trigger: 'n',
    styleNum: Note.STYLENUM_NAMED,
    supportsCopy: true,
    usesRange: false
  },
  single: {
    caption: 'single',
    trigger: 's',
    styleNum: Note.STYLENUM_SINGLE,
    supportsCopy: false,
    usesRange: true
  },
  tiny: {
    caption: 'tiny',
    trigger: 't',
    styleNum: Note.STYLENUM_TINY,
    supportsCopy: true,
    usesRange: true
  }
};

const ROLE_CONFIG = {
  root: {
    trigger: 'r',
    canonicalColor: 'noteRoot',
    canonicalCaption: 'noteRoot'
  },
  chord: {
    trigger: 'c',
    canonicalColor: 'noteChord',
    canonicalCaption: 'noteChord'
  },
  scale: {
    trigger: 's',
    canonicalColor: 'noteScale',
    canonicalCaption: 'noteScale'
  }
};

const ROLE_PASS_ORDER = ['scale', 'chord', 'root'];
const FAMILY_NAMES = ['named', 'single', 'tiny'];
const ROLE_NAMES = ['root', 'chord', 'scale'];
const ROLE_AUDIT_LABEL = Object.freeze({
  root: 'root',
  chord: 'chord',
  scale: 'scale'
});
const POSITIONS_SUMMARY_TOKEN = 'positionsSummary';
const POSITIONS_VALUE_TOKEN = 'positionsCurrentSection';
const STRINGS_SUMMARY_TOKEN = 'stringsSummary';
const POSITIONS_UNSET_DISPLAY = '[]';
const POSITIONS_MENU_DEFAULT = '[[0,3],[4,7],[8,12]]';
const POSITION_NOT_PLAYED_YET = -1;
const ARPEGGIO_POSITIONS_REQUEST_PATH = 'arpeggio/p';

function getRoleShortLabel(roleName) {
  return roleName === 'root' ? 'r' : roleName === 'chord' ? 'c' : 's';
}

function stripHtml(text) {
  return `${text || ''}`.replace(/<[^>]+>/g, '');
}

function toMessageCaption(text) {
  return stripHtml(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&[A-Za-z0-9#]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cloneOptions(options = []) {
  return options.map((option) => ({ ...option }));
}

function valuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function capitalize(text = '') {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function cellKey(row, col) {
  return `${row}:${col}`;
}

const LEGACY_CHORD_FORMULA_TO_TONAL = Object.freeze({
  '4,7': 'M',
  '3,7': 'm',
  '4,8': 'aug',
  '3,6': 'dim',
  '3,6,9': 'dim7',
  '3,6,10': 'm7b5',
  '2,7': 'sus2',
  '5,7': 'sus4',
  '4,7,11': 'maj7',
  '3,7,10': 'm7',
  '4,7,10': '7',
  '4,10': '7no5',
  '3,7,11': 'm/ma7',
  '3,7,10,14': 'm9',
  '4,7,9,14': '6add9',
  '': ''
});

const LEGACY_MODE_FORMULA_TO_TONAL = Object.freeze({
  '0,2,4,5,7,9,11': 'major',
  '0,2,3,5,7,9,10': 'dorian',
  '0,1,3,5,7,8,10': 'phrygian',
  '0,2,4,6,7,9,11': 'lydian',
  '0,2,4,5,7,9,10': 'mixolydian',
  '0,2,3,5,7,8,10': 'minor',
  '0,1,3,5,6,8,10': 'locrian',
  '0,2,4,6,8,10': 'whole tone',
  '0,3,6,9': 'diminished',
  '0,3,5,7,10': 'minor pentatonic',
  '0,2,4,7,9': 'major pentatonic',
  '0,2,3,5,7,8,11': 'harmonic minor',
  '0,2,3,5,7,9,11': 'melodic minor',
  '0,2,4,6,7,9,10': 'lydian dominant',
  '0,1,4,5,7,8,10': 'double harmonic major',
  '0,1,3,5,7,9,11': 'neapolitan major',
  '0,1,3,5,7,8,11': 'balinese',
  '': ''
});

export class FillPlugin {
  constructor() {
    this.id = 'fill';
    this.registeredName = 'fill';
    this.menuTrigger = 'f';
    this.eventNames = ['DaCapo:OnSectionBegin', 'DaCapo:OnSongEnd', 'Looper:OnResetSong'];
    this.rowBoundsInitialized = false;
    this.songLoopCountForPositionPair = 0;
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
    this.applyStaticDefaults();
    this.setStaticSelectOptions();
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

  getFamilyModePropertyName(familyName, roleName) {
    return `${familyName}${capitalize(roleName)}Mode`;
  }

  getFamilyColorPropertyName(familyName, roleName) {
    return `${familyName}${capitalize(roleName)}Color`;
  }

  getFamilyDisplayFieldName(familyName, roleName) {
    return `${familyName}${capitalize(roleName)}Display`;
  }

  getFamilySummaryFieldName(familyName) {
    return `${familyName}Summary`;
  }

  getFamilyConfig(familyName) {
    return FAMILY_CONFIG[familyName] || null;
  }

  getRoleConfig(roleName) {
    return ROLE_CONFIG[roleName] || null;
  }

  setStaticSelectOptions() {
    this.updatePropertyOptions('chordFormula', cloneOptions(Constants.FILL_CHORD_OPTIONS));
    this.updatePropertyOptions('scaleFormula', cloneOptions(Constants.FILL_SCALE_OPTIONS));
  }

  applyStaticDefaults() {
    const maxFretProperty = this.getProperty('maxFret');
    if (maxFretProperty) {
      maxFretProperty.value = Constants.FIRST_POSITION_MAX_FRET;
      maxFretProperty.defaultValue = Constants.FIRST_POSITION_MAX_FRET;
    }
  }

  ensureDisplayState(song = getSong()) {
    this.refreshDynamicPropertyOptions(song);
  }

  updatePropertyOptions(propertyName, options = []) {
    const property = this.getProperty(propertyName);
    if (!property) {
      return;
    }
    property.options = cloneOptions(options);
  }

  refreshDynamicPropertyOptions(song = getSong()) {
    this.updatePropertyOptions('targetTable', this.buildTargetTableOptions(song));
    this.setStaticSelectOptions();
    this.initializeStringLimitDefaults(song);
    this.ensureDynamicSelections(song);
  }

  initializeStringLimitDefaults(song = getSong()) {
    if (this.rowBoundsInitialized) {
      return;
    }

    const tuning = this.getSelectedTargetTuning(song) || this.getEligibleTargetTunings(song)[0] || null;
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
    const selectedTuning = tuning || this.getSelectedTargetTuning(song) || this.getEligibleTargetTunings(song)[0] || null;
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

  ensureDynamicSelections(song = getSong()) {
    this.ensureTargetTableSelection(song);
    this.ensureFormulaSelection('chordFormula', Constants.FILL_CHORD_OPTIONS);
    this.ensureFormulaSelection('scaleFormula', Constants.FILL_SCALE_OPTIONS);
    this.normalizeRangeValues(song);
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

  ensureFormulaSelection(propertyName, options) {
    const property = this.getProperty(propertyName);
    if (!property) {
      return;
    }
    const currentValue = `${property.getValue() || ''}`;
    if (!options.some((option) => `${option.value}` === currentValue)) {
      property.value = options[0]?.value || '';
    }
  }

  isLegacyEmptyPersistedState(persistedProperties = {}) {
    const legacyStub = {
      targetTable: '',
      chordFormula: 'M',
      scaleFormula: 'major',
      minFret: 0,
      maxFret: 0,
      minRow: 0,
      maxRow: 0,
      rootMode: MODE_ROLE,
      rootColor: 'noteRoot',
      chordMode: MODE_ROLE,
      chordColor: 'noteChord',
      scaleMode: MODE_ROLE,
      scaleColor: 'noteScale'
    };

    const persistedKeys = Object.keys(persistedProperties);
    const legacyKeys = Object.keys(legacyStub);
    if (!persistedKeys.every((key) => key === 'tinyNotes' || legacyKeys.includes(key))) {
      return false;
    }

    const legacyChordValues = new Set(['4,7', 'M']);
    const legacyModeValues = new Set(['0,2,4,5,7,9,11', 'major']);

    return legacyKeys.every((key) => {
      if (key === 'chordFormula') {
        return legacyChordValues.has(`${persistedProperties[key]}`);
      }
      if (key === 'scaleFormula') {
        return legacyModeValues.has(`${persistedProperties[key]}`);
      }
      return valuesEqual(persistedProperties[key], legacyStub[key]);
    });
  }

  normalizeLegacyFormulaValue(name, rawValue) {
    const text = `${rawValue || ''}`;
    if (name === 'chordFormula') {
      return LEGACY_CHORD_FORMULA_TO_TONAL[text] ?? text;
    }
    if (name === 'scaleFormula') {
      return LEGACY_MODE_FORMULA_TO_TONAL[text] ?? text;
    }
    return rawValue;
  }

  normalizeLegacyPersistedProperties(persistedProperties = {}) {
    const normalized = { ...persistedProperties };
    ROLE_NAMES.forEach((roleName) => {
      const legacyModeName = `${roleName}Mode`;
      const legacyColorName = `${roleName}Color`;
      const singleModeName = this.getFamilyModePropertyName('single', roleName);
      const singleColorName = this.getFamilyColorPropertyName('single', roleName);
      if (normalized[singleModeName] == null && normalized[legacyModeName] != null) {
        normalized[singleModeName] = normalized[legacyModeName];
      }
      if (normalized[singleColorName] == null && normalized[legacyColorName] != null) {
        normalized[singleColorName] = normalized[legacyColorName];
      }
      delete normalized[legacyModeName];
      delete normalized[legacyColorName];
    });
    if (normalized.singleAddTiny == null && normalized.tinyNotes != null) {
      normalized.singleAddTiny = normalized.tinyNotes;
    }
    delete normalized.tinyNotes;
    return normalized;
  }

  normalizeRangeValues(song = getSong()) {
    const tuning = this.getSelectedTargetTuning(song) || this.getEligibleTargetTunings(song)[0] || null;
    if (!tuning) {
      return;
    }
    const maxAllowedFret = this.getMaxAllowedFret(song, tuning);
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

  isFamilyModeProperty(propertyName) {
    return FAMILY_NAMES.some((familyName) => ROLE_NAMES.some((roleName) => propertyName === this.getFamilyModePropertyName(familyName, roleName)));
  }

  isFamilyColorProperty(propertyName) {
    return FAMILY_NAMES.some((familyName) => ROLE_NAMES.some((roleName) => propertyName === this.getFamilyColorPropertyName(familyName, roleName)));
  }

  toDisplayStringNumber(rowIndex, song = getSong()) {
    const maxAllowedRow = this.getMaxAllowedRow(this.getSelectedTargetTuning(song));
    const clampedRowIndex = this.clampNumber(rowIndex, 0, Math.max(0, maxAllowedRow));
    return clampedRowIndex + 1;
  }

  toStoredRowIndex(rawValue, song = getSong()) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Expected string number, received: ${rawValue}`);
    }
    const maxStringNumber = this.getMaxAllowedRow(this.getSelectedTargetTuning(song)) + 1;
    const clampedStringNumber = this.clampNumber(parsed, 1, Math.max(1, maxStringNumber));
    return clampedStringNumber - 1;
  }

  getFamilyRoleMode(familyName, roleName) {
    return `${this.getProperty(this.getFamilyModePropertyName(familyName, roleName))?.getValue() || MODE_NONE}`;
  }

  getFamilyRoleColor(familyName, roleName) {
    const roleConfig = this.getRoleConfig(roleName);
    return `${this.getProperty(this.getFamilyColorPropertyName(familyName, roleName))?.getValue() || roleConfig?.canonicalColor || 'noteTransparent'}`;
  }

  resolveFamilyRoleDisplay(familyName, roleName) {
    const modeValue = this.getFamilyRoleMode(familyName, roleName);
    if (modeValue === MODE_ROLE) {
      return this.getFamilyRoleColor(familyName, roleName);
    }
    return modeValue;
  }

  getVisibleMenuChildren() {
    const song = this.manager?.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    return [
      this.getProperty('targetTable').getMenuNodeSpec(this),
      this.getProperty('apply').getMenuNodeSpec(this),
      this.getProperty('clear').getMenuNodeSpec(this),
      this.getProperty('clearSong').getMenuNodeSpec(this),
      this.getProperty('commitNotes').getMenuNodeSpec(this),
      this.buildOptionsMenuNode(song),
      this.getProperty('help').getMenuNodeSpec(this)
    ];
  }

  buildOptionsMenuNode(song = getSong()) {
    return new MenuItemProxy(this, {
      name: 'options',
      caption: buildCaption('options', 'o'),
      trigger: 'o',
      children: [
        this.buildUseChartMenuNode(),
        this.getProperty('automaticFromChart').getMenuNodeSpec(this),
        this.getProperty('chordFormula').getMenuNodeSpec(this),
        this.getProperty('scaleFormula').getMenuNodeSpec(this),
        this.buildPositionsMenuNode(),
        this.buildStringsMenuNode(song),
        this.buildFamilyMenuNode('named', song),
        this.buildFamilyMenuNode('single', song),
        this.buildFamilyMenuNode('tiny', song),
        this.buildAutoSectionNavActionNode('auto:prevSection', ', previous section', ','),
        this.buildAutoSectionNavActionNode('auto:nextSection', '. next section', '.'),
        this.getProperty('apply').getMenuNodeSpec(this),
        this.getProperty('clear').getMenuNodeSpec(this)
      ]
    });
  }

  buildAutoSectionNavActionNode(name, caption, trigger) {
    return new MenuItemProxy(this, {
      name,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: name,
      popOnBang: false
    });
  }

  buildUseChartMenuNode() {
    return new MenuItemProxy(this, {
      name: 'useChart',
      caption: buildCaption('use chart', 'u'),
      trigger: 'u',
      children: [
        this.buildUseChartActionNode('chord', 'useChartChord', 'c'),
        this.buildUseChartActionNode('mode', 'useChartMode', 'm')
      ]
    });
  }

  buildUseChartActionNode(caption, actionName, trigger) {
    return new MenuItemProxy(this, {
      name: `useChart:${caption}`,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName,
      popOnBang: true
    });
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
            default: POSITIONS_MENU_DEFAULT,
            datatype: 'String',
            id: 'value'
          }
        }),
        this.getProperty('songLoopsPerPositionPair').getMenuNodeSpec(this),
        new MenuItemProxy(this, {
          name: 'positions:importFromArpeggio',
          caption: buildCaption('Import from arpeggio', 'I'),
          trigger: 'I',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'positions:importFromArpeggio',
          popOnBang: true
        })
      ]
    });
  }

  exportMenuOptions(menuPath, context = {}) {
    const normalizedMenuPath = `${menuPath || ''}`.trim();
    if (normalizedMenuPath !== 'op') {
      return {
        status: 'error',
        code: 'route-mismatch',
        message: `Fill export supports only path op, received ${normalizedMenuPath || '<empty>'}`
      };
    }

    const sectionRef = `${context.sectionRef || ''}`;
    const instrumentRef = `${context.instrumentRef || ''}`;
    if (sectionRef !== '' || instrumentRef !== '') {
      return {
        status: 'error',
        code: 'unsupported-scope',
        message: 'Fill export currently supports only Current section and instrument'
      };
    }

    const song = context.song || this.manager?.song || getSong();
    const section = this.getCurrentSection(song);
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

    const section = this.getCurrentSection(song);
    if (!section) {
      throw new Error('No current section selected');
    }

    const tuning = this.getSelectedTargetTuning(song);
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
        message: 'Fill positions import failed: plugin manager export route unavailable'
      };
    }

    const supplierResponse = pluginManager.getPluginMenuOptions(requestPath);
    if (!supplierResponse || supplierResponse.status !== 'ok') {
      return {
        result: 'positions import failed',
        message: `Fill positions import failed: ${supplierResponse?.message || 'supplier request failed'}`
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
      this.refreshCurrentSectionUi(song);

      const positionsSummary = imported.positions.length === 0
        ? 'positions=cleared'
        : `positions=${this.formatPositionsValue(imported.positions)}`;
      return {
        result: `Fill imported from arpeggio: minFret=${imported.minFret} maxFret=${imported.maxFret} loops=${imported.songLoopsPerPositionPair} ${positionsSummary}`
      };
    } catch (error) {
      return {
        result: 'positions import failed',
        message: `Fill positions import failed: ${error?.message || 'invalid payload'}`
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

  buildStringsMenuNode(song = getSong()) {
    const token = `plugin:${this.id}:${STRINGS_SUMMARY_TOKEN}`;
    return new MenuItemProxy(this, {
      name: 'strings',
      caption: `${buildCaption('Strings', 'S')} [${buildValueReference(token)}]`,
      trigger: 'S',
      vars: [token],
      children: [
        this.getProperty('minRow').getMenuNodeSpec(this),
        this.getProperty('maxRow').getMenuNodeSpec(this)
      ]
    });
  }

  buildFamilyMenuNode(familyName) {
    const familyConfig = this.getFamilyConfig(familyName);
    const children = [];
    const summaryToken = `plugin:${this.id}:${this.getFamilySummaryFieldName(familyName)}`;

    if (familyConfig?.supportsCopy) {
      children.push(new MenuItemProxy(this, {
        name: `${familyName}:copyFromSingle`,
        caption: buildCaption('Copy from SingleNote', 'C'),
        trigger: 'C',
        action: 'pluginAction:invoke',
        pluginId: this.id,
        actionName: `copyFamilyFromSingle:${familyName}`,
        popOnBang: true
      }));
    }

    children.push(this.buildFamilyBulkActionMenuNode(familyName, 'allRoleNote', 'All role note', 'A'));
    children.push(this.buildFamilyBulkActionMenuNode(familyName, 'allNone', 'all None', 'N'));

    ROLE_NAMES.forEach((roleName) => {
      children.push(this.buildFamilyRoleMenuNode(familyName, roleName));
    });

    if (familyName === 'single') {
      children.push(this.getProperty('singleAddTiny').getMenuNodeSpec(this));
    }

    return new MenuItemProxy(this, {
      name: familyName,
      caption: `${buildCaption(familyConfig.caption, familyConfig.trigger)} [\${${summaryToken}}]`,
      trigger: familyConfig.trigger,
      vars: [summaryToken],
      children
    });
  }

  buildFamilyBulkActionMenuNode(familyName, actionName, caption, trigger) {
    return new MenuItemProxy(this, {
      name: `${familyName}:${actionName}`,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: `${actionName}:${familyName}`,
      popOnBang: true
    });
  }

  buildFamilyRoleMenuNode(familyName, roleName) {
    const roleConfig = this.getRoleConfig(roleName);
    const displayToken = `plugin:${this.id}:${this.getFamilyDisplayFieldName(familyName, roleName)}`;
    const colorToken = this.getProperty(this.getFamilyColorPropertyName(familyName, roleName)).getResolverToken(this.id);

    return new MenuItemProxy(this, {
      name: `${familyName}:${roleName}`,
      caption: `${buildCaption(roleName, roleConfig.trigger)} [\${${displayToken}}]`,
      trigger: roleConfig.trigger,
      vars: [displayToken],
      children: [
        this.buildFamilyRoleModeChild(familyName, roleName, MODE_NONE, 'none', 'n'),
        this.buildFamilyRoleModeChild(familyName, roleName, MODE_KEEP, 'keep', 'k'),
        new MenuItemProxy(this, {
          name: `${familyName}:${roleName}:roleMenu`,
          caption: `${buildCaption('role', 'r')} [\${${colorToken}}]`,
          trigger: 'r',
          vars: [colorToken],
          children: [
            new MenuItemProxy(this, {
              name: `${familyName}:${roleName}:canonical`,
              caption: buildCaption(roleConfig.canonicalCaption, 'n'),
              trigger: 'n',
              action: 'pluginAction:invoke',
              pluginId: this.id,
              actionName: `setFamilyRoleColor:${familyName}:${roleName}:${roleConfig.canonicalColor}`,
              popOnBang: true
            }),
            ...(roleName === 'root'
              ? [new MenuItemProxy(this, {
                name: `${familyName}:${roleName}:note1`,
                caption: buildCaption('note1', '1'),
                trigger: '1',
                action: 'pluginAction:invoke',
                pluginId: this.id,
                actionName: `setFamilyRoleColor:${familyName}:${roleName}:note1`,
                popOnBang: true
              })]
              : []),
            new MenuItemProxy(this, {
              name: `${familyName}:${roleName}:last`,
              caption: buildCaption('last', 'l'),
              trigger: 'l',
              action: 'pluginAction:invoke',
              pluginId: this.id,
              actionName: `setFamilyRoleColorLast:${familyName}:${roleName}`,
              popOnBang: true
            })
          ]
        })
      ]
    });
  }

  buildFamilyRoleModeChild(familyName, roleName, modeValue, caption, trigger) {
    return new MenuItemProxy(this, {
      name: `${familyName}:${roleName}:${modeValue}`,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginProperty:select',
      pluginId: this.id,
      propertyName: this.getFamilyModePropertyName(familyName, roleName),
      value: modeValue,
      popOnBang: true
    });
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
    this.rowBoundsInitialized = false;
    this.songLoopCountForPositionPair = 0;
    this.applyStaticDefaults();
    this.setStaticSelectOptions();
  }

  loadSongState(persistedProperties = {}, context = {}) {
    this.resetToDefaults();
    if (this.isLegacyEmptyPersistedState(persistedProperties)) {
      this.refreshDynamicPropertyOptions(context.song || getSong());
      return;
    }
    const normalizedPersistedProperties = this.normalizeLegacyPersistedProperties(persistedProperties);
    Object.entries(normalizedPersistedProperties).forEach(([name, value]) => {
      const property = this.getProperty(name);
      if (!property || property.datatype === 'org.dynamide.Action') {
        return;
      }
      this.setPropertyValue(name, value, {
        ...context,
        persistedLoad: true
      });
    });
    this.refreshDynamicPropertyOptions(context.song || getSong());
  }

  exportSongState() {
    this.refreshDynamicPropertyOptions(this.manager?.song || getSong());
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
      throw new Error(`FillPlugin unknown property: ${name}`);
    }

    const song = context.song || getSong();
    this.refreshDynamicPropertyOptions(song);

    if (this.isFamilyModeProperty(name)) {
      const normalized = `${rawValue}`;
      if (![MODE_NONE, MODE_KEEP, MODE_ROLE].includes(normalized)) {
        throw new Error(`FillPlugin invalid mode for ${name}: ${rawValue}`);
      }
      property.value = normalized;
      return property.getValue();
    }

    if (this.isFamilyColorProperty(name)) {
      property.value = `${rawValue}`;
      return property.getValue();
    }

    if (this.isStringLimitProperty(name)) {
      property.value = context.persistedLoad ? property.normalize(rawValue) : this.toStoredRowIndex(rawValue, song);
      this.rowBoundsInitialized = true;
      this.normalizeRangeValues(song);
      return property.getValue();
    }

    const previousTargetTable = name === 'targetTable' ? `${property.getValue() || ''}` : '';
    const normalizedRawValue = this.normalizeLegacyFormulaValue(name, rawValue);
    const nextValue = property.setValue(normalizedRawValue);
    if (name === 'targetTable' && !context.persistedLoad && `${nextValue || ''}` !== previousTargetTable) {
      this.resetStringLimitDefaultsForTarget(song);
    }
    if (name === 'automaticFromChart' && !context.persistedLoad && !!nextValue) {
      this.applyAutomaticFromChart(song, this.getCurrentSection(song));
    }
    this.normalizeRangeValues(song);
    return nextValue;
  }

  resolveValue(fieldName, context = {}) {
    const song = context.song || getSong();
    if (fieldName === 'targetTable' || fieldName === 'maxAllowedFret' || fieldName === 'maxAllowedRow' || this.isStringLimitProperty(fieldName)) {
      this.ensureDisplayState(song);
    }
    if (fieldName === 'targetTable') {
      const value = this.getProperty('targetTable')?.getValue() || '';
      return value.startsWith(Constants.TABLE_ID_PREFIX) ? value.slice(Constants.TABLE_ID_PREFIX.length) : value;
    }
    if (fieldName === 'chordFormula') {
      return this.resolveOptionCaption(Constants.FILL_CHORD_OPTIONS, this.getProperty('chordFormula')?.getValue());
    }
    if (fieldName === 'scaleFormula') {
      return this.resolveOptionCaption(Constants.FILL_SCALE_OPTIONS, this.getProperty('scaleFormula')?.getValue());
    }
    if (fieldName === 'singleAddTiny') {
      return this.resolveSingleAddTinyDisplay(song);
    }
    if (fieldName === POSITIONS_SUMMARY_TOKEN) {
      return this.getCurrentSectionPositionsSummary(song);
    }
    if (fieldName === POSITIONS_VALUE_TOKEN) {
      return this.getCurrentSectionPositionsDisplay(song);
    }
    if (fieldName === STRINGS_SUMMARY_TOKEN) {
      return `${this.resolveValue('minRow', { song })}:${this.resolveValue('maxRow', { song })}`;
    }
    for (const familyName of FAMILY_NAMES) {
      if (fieldName === this.getFamilySummaryFieldName(familyName)) {
        return this.buildFamilyMenuSummary(familyName);
      }
      for (const roleName of ROLE_NAMES) {
        if (fieldName === this.getFamilyDisplayFieldName(familyName, roleName)) {
          return this.resolveFamilyRoleDisplay(familyName, roleName);
        }
      }
    }
    if (this.isStringLimitProperty(fieldName)) {
      return this.toDisplayStringNumber(this.getProperty(fieldName)?.getValue() || 0, song);
    }
    if (fieldName === 'maxAllowedFret') {
      return this.getMaxAllowedFret(song);
    }
    if (fieldName === 'maxAllowedRow') {
      return this.getMaxAllowedRow(this.getSelectedTargetTuning(song)) + 1;
    }
    return undefined;
  }

  resolveSingleAddTinyDisplay(song = getSong()) {
    const tinyValue = `${this.getProperty('singleAddTiny')?.getValue() || TINY_NONE}`;
    return this.isStandaloneTinyActive(song) ? `${tinyValue} [disabled]` : tinyValue;
  }

  resolveOptionCaption(options, value) {
    const match = (options || []).find((option) => `${option.value}` === `${value}`);
    return match ? stripHtml(match.caption) : value;
  }

  enable() {
    return 'Fill enabled';
  }

  disable() {
    return 'Fill disabled';
  }

  handleEvent(eventName, payload = {}, context = {}) {
    if (eventName === 'DaCapo:OnSongEnd') {
      this.incrementSongLoopCounter();
      return {};
    }

    if (eventName === 'Looper:OnResetSong') {
      const song = context.song || getSong();
      this.resetSongLoopCounter();
      this.resetAllSectionPositionIndexes(song);
      return this.clearSong(song);
    }

    if (eventName !== 'DaCapo:OnSectionBegin') {
      return {};
    }

    const song = context.song || getSong();
    const section = this.getSectionForPayload(song, payload);
    if (this.getProperty('automaticFromChart')?.getValue()) {
      this.applyAutomaticFromChart(song, section);
      return this.applyToSection(song, section, { useSectionChart: true });
    }
    return this.applyToSection(song, section);
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || getSong();

    if (actionName.startsWith('setFamilyRoleColor:')) {
      const [, familyName, roleName, colorValue] = actionName.split(':');
      return this.setFamilyRoleColorSelection(familyName, roleName, colorValue, song);
    }

    if (actionName.startsWith('setFamilyRoleColorLast:')) {
      const [, familyName, roleName] = actionName.split(':');
      const lastColor = PalettePresentation.getLastRestorableRbColor();
      return this.setFamilyRoleColorSelection(familyName, roleName, lastColor?.value || 'noteTransparent', song);
    }

    if (actionName.startsWith('copyFamilyFromSingle:')) {
      const [, familyName] = actionName.split(':');
      return this.copyFamilyFromSingle(familyName, song);
    }

    if (actionName.startsWith('allRoleNote:')) {
      const [, familyName] = actionName.split(':');
      return this.setFamilyModesAllRole(familyName, song);
    }

    if (actionName.startsWith('allNone:')) {
      const [, familyName] = actionName.split(':');
      return this.setFamilyModesAllNone(familyName, song);
    }

    switch (actionName) {
      case 'positions:importFromArpeggio':
        return this.importPositionsFromPlugin(ARPEGGIO_POSITIONS_REQUEST_PATH, song);
      case 'positions:setCurrentSection':
        return this.setPositionsForCurrentSection(song, context.args?.value);
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
      case 'useChartChord':
        return this.useChartChord(song);
      case 'useChartMode':
        return this.useChartMode(song);
      case 'auto:prevSection':
        return this.navigateSection('prev', song);
      case 'auto:nextSection':
        return this.navigateSection('next', song);
      case 'apply':
        return this.applyToCurrentSection(song);
      case 'clear':
        return this.clearCurrentSection(song);
      case 'clearSong':
        return this.clearSong(song);
      case 'commitNotes':
        return this.commitNotes(song);
      case 'help':
        return {
          result: 'Fill help opened',
          message: this.buildHelpMessage(song)
        };
      default:
        return { result: `Unknown fill action: ${actionName}` };
    }
  }

  navigateSection(direction, song = getSong()) {
    const controller = typeof getTransportController === 'function' ? getTransportController() : null;
    const methodName = direction === 'prev' ? 'prevSection' : 'nextSection';
    if (controller && typeof controller[methodName] === 'function') {
      controller[methodName]();
    } else if (song) {
      if (direction === 'prev' && typeof song.gotoPrevSectionStateOnly === 'function') {
        song.gotoPrevSectionStateOnly(false);
      }
      if (direction === 'next' && typeof song.gotoNextSectionStateOnly === 'function') {
        song.gotoNextSectionStateOnly(false);
      }
    }

    if (this.getProperty('automaticFromChart')?.getValue()) {
      this.applyAutomaticFromChart(song, this.getCurrentSection(song));
    }

    const sectionIndex = song && typeof song.getSectionsCurrentIndex === 'function'
      ? song.getSectionsCurrentIndex()
      : (song && Array.isArray(song.sections) ? song.sections.indexOf(this.getCurrentSection(song)) : 0);
    return { result: `section ${Math.max(0, sectionIndex) + 1}` };
  }

  setFamilyRoleColorSelection(familyName, roleName, colorValue, song = getSong()) {
    if (!this.getFamilyConfig(familyName) || !this.getRoleConfig(roleName)) {
      throw new Error(`Unknown FillPlugin family role: ${familyName}:${roleName}`);
    }
    this.setPropertyValue(this.getFamilyModePropertyName(familyName, roleName), MODE_ROLE, { song });
    this.setPropertyValue(this.getFamilyColorPropertyName(familyName, roleName), colorValue, { song });
    return { result: `${familyName} ${roleName} color set to ${colorValue}` };
  }

  copyFamilyFromSingle(familyName, song = getSong()) {
    if (!this.getFamilyConfig(familyName) || familyName === 'single') {
      return { result: `Fill copy skipped: unsupported family ${familyName}` };
    }
    ROLE_NAMES.forEach((roleName) => {
      this.setPropertyValue(this.getFamilyModePropertyName(familyName, roleName), this.getFamilyRoleMode('single', roleName), { song });
      this.setPropertyValue(this.getFamilyColorPropertyName(familyName, roleName), this.getFamilyRoleColor('single', roleName), { song });
    });
    return { result: `${familyName} copied from SingleNote` };
  }

  setFamilyModesAllRole(familyName, song = getSong()) {
    const familyConfig = this.getFamilyConfig(familyName);
    if (!familyConfig) {
      return { result: `Fill all role note skipped: unsupported family ${familyName}` };
    }
    ROLE_NAMES.forEach((roleName) => {
      const roleConfig = this.getRoleConfig(roleName);
      this.setPropertyValue(this.getFamilyModePropertyName(familyName, roleName), MODE_ROLE, { song });
      this.setPropertyValue(this.getFamilyColorPropertyName(familyName, roleName), roleConfig.canonicalColor, { song });
    });
    return { result: `${familyName} set to all role note` };
  }

  setFamilyModesAllNone(familyName, song = getSong()) {
    const familyConfig = this.getFamilyConfig(familyName);
    if (!familyConfig) {
      return { result: `Fill all none skipped: unsupported family ${familyName}` };
    }
    ROLE_NAMES.forEach((roleName) => {
      this.setPropertyValue(this.getFamilyModePropertyName(familyName, roleName), MODE_NONE, { song });
    });
    return { result: `${familyName} set to all none` };
  }

  applyAutomaticFromChart(song = getSong(), section = this.getCurrentSection(song)) {
    this.useChartChordForSection(song, section, { emptySetsNone: true, noMatchSetsNone: true });
    this.useChartModeForSection(song, section, { emptySetsNone: true, noMatchSetsNone: true });
  }

  useChartChord(song = getSong()) {
    return this.useChartChordForSection(song, this.getCurrentSection(song));
  }

  useChartChordForSection(song = getSong(), section = this.getCurrentSection(song), options = {}) {
    const rawValue = `${section?.chartChord || ''}`.trim();
    if (!rawValue || rawValue.toLowerCase() === MODE_NONE) {
      if (options.emptySetsNone) {
        this.setPropertyValue('chordFormula', '', { song });
        return { result: 'No chartChord -> none' };
      }
      return { result: 'No chartChord' };
    }

    const canonicalValue = canonicalizeChordForStorage(rawValue);
    const chordType = chordTypeFromStoredChord(canonicalValue);
    const match = (Constants.FILL_CHORD_OPTIONS || []).find((option) => `${option.value}` === `${chordType}`) || null;
    if (!match) {
      if (options.noMatchSetsNone) {
        this.setPropertyValue('chordFormula', '', { song });
      }
      return {
        result: `No fill subset match for chartChord="${rawValue}" tonalType="${chordType || '<none>'}"`,
        message: this.buildChartMissMessage('chord', 'chartChord', rawValue, chordType || '<none>', Constants.FILL_CHORD_OPTIONS)
      };
    }

    this.setPropertyValue('chordFormula', match.value, { song });
    return { result: `chartChord -> ${this.getOptionMessageCaption(match)}` };
  }

  useChartMode(song = getSong()) {
    return this.useChartModeForSection(song, this.getCurrentSection(song));
  }

  useChartModeForSection(song = getSong(), section = this.getCurrentSection(song), options = {}) {
    const rawValue = `${section?.chartMode || ''}`.trim();
    if (!rawValue || rawValue.toLowerCase() === MODE_NONE) {
      if (options.emptySetsNone) {
        this.setPropertyValue('scaleFormula', '', { song });
        return { result: 'No chartMode -> none' };
      }
      return { result: 'No chartMode' };
    }

    const canonicalValue = canonicalizeModeForStorage(rawValue);
    const modeType = modeTypeFromStoredMode(canonicalValue);
    const match = (Constants.FILL_SCALE_OPTIONS || []).find((option) => `${option.value}` === `${modeType}`) || null;
    if (!match) {
      if (options.noMatchSetsNone) {
        this.setPropertyValue('scaleFormula', '', { song });
      }
      return {
        result: `No fill subset match for chartMode="${rawValue}" tonalType="${modeType || '<none>'}"`,
        message: this.buildChartMissMessage('mode', 'chartMode', rawValue, modeType || '<none>', Constants.FILL_SCALE_OPTIONS)
      };
    }

    this.setPropertyValue('scaleFormula', match.value, { song });
    return { result: `chartMode -> ${this.getOptionMessageCaption(match)}` };
  }

  getOptionMessageCaption(option) {
    return toMessageCaption(option?.caption || option?.value || '');
  }

  buildChartMissMessage(kind, fieldName, rawValue, normalizedValue, options) {
    const candidates = (options || []).map((option) => this.getOptionMessageCaption(option)).join(', ');
    return `Fill use chart ${kind}: no match for ${fieldName}="${rawValue}" normalized="${normalizedValue}" against [${candidates}]`;
  }

  buildHelpMessage(song = getSong()) {
    return `<pre>${buildPluginHelpHeader(this, 'Fill plugin:', this.buildSummary(song))}

NamedNote, SingleNote, and TinyNote fill.

- target table = ${this.resolveValue('targetTable', { song }) || '<none>'}
- chord = ${this.resolveValue('chordFormula', { song })}
- mode = ${this.resolveValue('scaleFormula', { song })}
- fret range = ${this.getProperty('minFret')?.getValue()}..${this.getProperty('maxFret')?.getValue()}
- upper/lower string limit = ${this.resolveValue('minRow', { song })}..${this.resolveValue('maxRow', { song })}
- song loops per position = ${this.getSongLoopsPerPositionPair()}
- named = ${this.buildFamilySummary('named')}
- single = ${this.buildFamilySummary('single')}; add TinyNote = ${this.resolveValue('singleAddTiny', { song })}
- tiny = ${this.buildFamilySummary('tiny')}

NamedNote ignores fret and string limits.
SingleNote and standalone TinyNote obey the configured fret and string limits.
Standalone TinyNote suppresses SingleNote add TinyNote whenever it emits at least one note.

Apply and Clear affect only the current section in the selected table.
Clear Song and Commit Notes affect all sections in the selected table.

Role pass order: scale, then chord, then root.
${buildPluginEventsHelpFooter(this)}</pre>`;
  }

  buildSummary(song = getSong()) {
    return `target table=${this.resolveValue('targetTable', { song }) || '<none>'} chord=${this.resolveValue('chordFormula', { song })} mode=${this.resolveValue('scaleFormula', { song })} fret range=${this.getProperty('minFret')?.getValue()}..${this.getProperty('maxFret')?.getValue()} upper/lower string limit=${this.resolveValue('minRow', { song })}..${this.resolveValue('maxRow', { song })} song loops per position=${this.getSongLoopsPerPositionPair()} named=${this.buildFamilySummary('named')} single=${this.buildFamilySummary('single')} addTiny=${this.resolveValue('singleAddTiny', { song })} tiny=${this.buildFamilySummary('tiny')}`;
  }

  getAuditInputs({ song = getSong() } = {}) {
    const automaticFromChart = this.getProperty('automaticFromChart')?.getValue();
    if (this.getProperty('automaticFromChart')?.getValue()) {
      const changed = !valuesEqual(
        automaticFromChart,
        this.getProperty('automaticFromChart')?.getDefaultValue()
      );
      return { value: 'auto-chart:true', changed };
    }

    const chord = `${this.resolveValue('chordFormula', { song }) || ''}`.trim();
    const mode = `${this.resolveValue('scaleFormula', { song }) || ''}`.trim();
    const lines = [];
    if (chord) {
      lines.push(`chord:${chord}`);
    }
    if (mode) {
      lines.push(`mode:${mode}`);
    }
    const changed = !valuesEqual(
      this.getProperty('chordFormula')?.getValue(),
      this.getProperty('chordFormula')?.getDefaultValue()
    ) || !valuesEqual(
      this.getProperty('scaleFormula')?.getValue(),
      this.getProperty('scaleFormula')?.getDefaultValue()
    ) || !valuesEqual(
      automaticFromChart,
      this.getProperty('automaticFromChart')?.getDefaultValue()
    );
    return lines.length > 0 ? { value: lines.join('<br>'), changed } : undefined;
  }

  getAuditFamilyOutputSummary(familyName) {
    const roles = ROLE_NAMES
      .filter((roleName) => this.getFamilyRoleMode(familyName, roleName) !== MODE_NONE)
      .map((roleName) => ROLE_AUDIT_LABEL[roleName]);
    return roles.length > 0 ? `${familyName}:${roles.join(',')}` : '';
  }

  getAuditOutputs() {
    const lines = FAMILY_NAMES
      .map((familyName) => this.getAuditFamilyOutputSummary(familyName))
      .filter((line) => line.length > 0);

    const defaultLines = FAMILY_NAMES
      .map((familyName) => {
        const roles = ROLE_NAMES
          .filter((roleName) => {
            const property = this.getProperty(this.getFamilyModePropertyName(familyName, roleName));
            const modeValue = `${property?.getDefaultValue() || MODE_NONE}`;
            return modeValue !== MODE_NONE;
          })
          .map((roleName) => ROLE_AUDIT_LABEL[roleName]);
        return roles.length > 0 ? `${familyName}:${roles.join(',')}` : '';
      })
      .filter((line) => line.length > 0);

    const changed = !valuesEqual(lines, defaultLines);
    return lines.length > 0 ? { value: lines.join('<br>'), changed } : undefined;
  }

  getSectionPositionsDisplay(section) {
    const positions = this.getSectionPositions(section);
    return positions ? this.formatPositionsValue(positions) : POSITIONS_UNSET_DISPLAY;
  }

  getCurrentSectionPositionsDisplay(song = getSong()) {
    return this.getSectionPositionsDisplay(this.getCurrentSection(song));
  }

  getCurrentSectionPositionsSummary(song = getSong()) {
    const section = this.getCurrentSection(song);
    const positions = this.getSectionPositions(section);
    if (positions) {
      return this.formatPositionsValue(positions);
    }
    const minFret = Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0;
    const maxFret = Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0;
    return `${minFret}:${maxFret}`;
  }

  setPositionsForCurrentSection(song = getSong(), rawValue = '') {
    const section = this.getCurrentSection(song);
    if (!section) {
      return { result: 'positions skipped: no current section selected' };
    }
    const tuning = this.getSelectedTargetTuning(song);
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
      this.refreshCurrentSectionUi(song);
      return { result: `positions=${this.formatPositionsValue(positions)}` };
    } catch (error) {
      return this.buildPositionsRejectResponse(error?.message || 'invalid positions', rawValue);
    }
  }

  clearPositionsForCurrentSection(song = getSong()) {
    const section = this.getCurrentSection(song);
    if (!section) {
      return { result: 'positions skipped: no current section selected' };
    }
    this.clearSectionPositions(section);
    return { result: 'positions cleared for current section' };
  }

  clearPositionsForAllSections(song = getSong()) {
    if (!song || !Array.isArray(song.sections)) {
      return { result: 'positions skipped: no song loaded' };
    }
    let clearedCount = 0;
    song.sections.forEach((section) => {
      if (this.getSectionPositions(section) || this.getLastPositionIndex(section) !== null) {
        this.clearSectionPositions(section);
        clearedCount += 1;
      }
    });
    return { result: `positions cleared across ${clearedCount} sections` };
  }

  copyPositionsToSections(song = getSong(), { onlyUnset = false } = {}) {
    if (!song || !Array.isArray(song.sections)) {
      return { result: 'positions skipped: no song loaded' };
    }
    const currentSection = this.getCurrentSection(song);
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
    return {
      result: onlyUnset
        ? `positions copied to ${copiedCount} unset sections`
        : `positions copied to ${copiedCount} sections`
    };
  }

  resolveEffectiveFretWindow(section, tuning) {
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

  getApprovedCaptionState(context = {}) {
    const song = context.song || this.manager?.song || getSong();
    const section = context.section || this.getCurrentSection(song);
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
    const rangeCell = `<td class="fillStringRange"><span class="fillLowerString">${state.lowerString}</span>:<span class="fillUpperString">${state.upperString}</span></td>`;
    const tds = state.positions.map((position, index) => {
      const tdClass = index === state.currentIndex ? ' class="fillCurrentPositionPair"' : '';
      return `<td${tdClass}>${position[0]}</td><td${tdClass}>${position[1]}</td>`;
    }).join('');
    return `<span class="fillPositionsStatus"><table><tr>${rangeCell}${tds}</tr></table></span>`;
  }

  getApprovedCaptionValue(tokenName, context = {}) {
    const state = this.getApprovedCaptionState(context);
    if (tokenName === 'fillPositionsStatus') {
      return this.buildPositionsStatusWidget(state);
    }
    return '';
  }

  buildFamilySummary(familyName) {
    return ROLE_NAMES.map((roleName) => `${roleName}=${this.resolveFamilyRoleDisplay(familyName, roleName)}`).join(' ');
  }

  buildFamilyMenuSummary(familyName) {
    return ROLE_NAMES.map((roleName) => `${getRoleShortLabel(roleName)}:${this.resolveFamilyRoleDisplay(familyName, roleName)}`).join(',');
  }

  buildTargetTableOptions(song = getSong()) {
    const tunings = this.getEligibleTargetTunings(song).slice(0, TARGET_TABLE_OPTION_LIMIT);
    return tunings.map((tuning, index) => ({
      value: `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`,
      caption: `${index + 1}) ${tuning.baseID}`,
      trigger: `${index + 1}`
    }));
  }

  getEligibleTargetTunings(song = getSong()) {
    if (!song || !Array.isArray(song.myTunings)) {
      return [];
    }
    const wiredDisplayTables = new Set((song.wirings || []).map((wiring) => wiring?.tablename).filter(Boolean));
    return song.myTunings.filter((tuning) => !wiredDisplayTables.has(`${Constants.TABLE_ID_PREFIX}${tuning.baseID}`));
  }

  getSelectedTargetTuning(song = getSong()) {
    const selectedTableID = this.getSelectedTargetTableID();
    return this.getEligibleTargetTunings(song).find((tuning) => `${Constants.TABLE_ID_PREFIX}${tuning.baseID}` === selectedTableID) || null;
  }

  getSelectedTargetTableID() {
    return `${this.getProperty('targetTable')?.getValue() || ''}`;
  }

  getMaxAllowedFret(song = getSong(), tuning = this.getSelectedTargetTuning(song)) {
    return Math.max(0, Number.parseInt(tuning?.frets, 10) || 0);
  }

  getMaxAllowedRow(tuning = this.getSelectedTargetTuning(getSong())) {
    return Math.max(0, (Array.isArray(tuning?.rowRange) ? tuning.rowRange.length : 1) - 1);
  }

  getCurrentSection(song = getSong()) {
    return song && typeof song.getCurrentSection === 'function' ? song.getCurrentSection() : null;
  }

  getSectionForPayload(song = getSong(), payload = {}) {
    const sectionIndex = Number.parseInt(payload?.sectionIndex, 10);
    if (song && Array.isArray(song.sections) && Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < song.sections.length) {
      return song.sections[sectionIndex];
    }
    return this.getCurrentSection(song);
  }

  getFillSectionData(section) {
    if (!section || typeof section !== 'object') {
      return null;
    }
    const pluginData = section.pluginData;
    if (!pluginData || typeof pluginData !== 'object') {
      return null;
    }
    const fill = pluginData.fill;
    return fill && typeof fill === 'object' ? fill : null;
  }

  ensureFillSectionData(section) {
    if (!section || typeof section !== 'object') {
      return null;
    }
    if (!section.pluginData || typeof section.pluginData !== 'object') {
      section.pluginData = {};
    }
    if (!section.pluginData.fill || typeof section.pluginData.fill !== 'object') {
      section.pluginData.fill = {};
    }
    return section.pluginData.fill;
  }

  pruneEmptyFillSectionData(section) {
    if (!section || !section.pluginData || typeof section.pluginData !== 'object') {
      return;
    }
    const fill = section.pluginData.fill;
    if (fill && typeof fill === 'object' && Object.keys(fill).length === 0) {
      delete section.pluginData.fill;
    }
  }

  clonePositions(positions = []) {
    return (positions || []).map((position) => [...position]);
  }

  getSectionPositions(section) {
    const fill = this.getFillSectionData(section);
    if (!Array.isArray(fill?.positions) || fill.positions.length === 0) {
      return null;
    }
    return fill.positions
      .filter((position) => Array.isArray(position) && position.length === 2)
      .map((position) => position.map((value) => Number.parseInt(value, 10)));
  }

  setSectionPositions(section, positions) {
    if (!Array.isArray(positions) || positions.length === 0) {
      this.clearSectionPositions(section);
      return;
    }
    const fill = this.ensureFillSectionData(section);
    fill.positions = this.clonePositions(positions);
  }

  clearSectionPositions(section) {
    const fill = this.getFillSectionData(section);
    if (!fill) {
      return;
    }
    delete fill.positions;
    delete fill.lastPositionIndex;
    this.pruneEmptyFillSectionData(section);
  }

  getLastPositionIndex(section) {
    const fill = this.getFillSectionData(section);
    if (!fill || fill.lastPositionIndex === undefined || fill.lastPositionIndex === null || fill.lastPositionIndex === '') {
      return null;
    }
    const value = Number.parseInt(fill.lastPositionIndex, 10);
    return Number.isInteger(value) ? value : null;
  }

  setLastPositionIndex(section, index) {
    const fill = this.ensureFillSectionData(section);
    fill.lastPositionIndex = Number.parseInt(index, 10);
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
      message: `Fill positions rejected: ${reason}. Attempted: ${rawValue}`
    };
  }

  computeRoleNoteSets(section, options = {}) {
    const rootID = Number.parseInt(section?.rootID, 10) || 0;
    return computeSharedRoleNoteSets({
      rootID,
      chordSource: options.useSectionChart
        ? `${section?.chartChord || ''}`
        : `${this.getProperty('chordFormula')?.getValue() || ''}`,
      modeSource: options.useSectionChart
        ? `${section?.chartMode || ''}`
        : `${this.getProperty('scaleFormula')?.getValue() || ''}`,
      useSectionChart: !!options.useSectionChart
    });
  }

  collectCandidateCells(tuning) {
    const candidates = [];
    const fretCount = Number.parseInt(tuning?.frets, 10) || 0;
    const rowRange = Array.isArray(tuning?.rowRange) ? tuning.rowRange : [];
    const totalColumns = tuning?.nut ? fretCount + 1 : fretCount;

    rowRange.forEach((openMidiRaw, rowIndex) => {
      const openMidi = Number.parseInt(openMidiRaw, 10);
      const banjoNut = Array.isArray(tuning?.banjoNut) ? tuning.banjoNut[rowIndex] : undefined;

      for (let colIndex = 0; colIndex < totalColumns; colIndex += 1) {
        let deadCell = false;
        if (banjoNut != null) {
          if (tuning.reverse) {
            if (colIndex > (totalColumns - banjoNut - 1)) {
              deadCell = true;
            }
          } else if (colIndex < banjoNut) {
            deadCell = true;
          }
        }
        if (deadCell) {
          continue;
        }

        const cellcol = tuning.reverse ? fretCount - colIndex : colIndex;
        const midinum = tuning.reverse ? openMidi + fretCount - colIndex : openMidi + colIndex;
        candidates.push({
          row: rowIndex,
          col: cellcol,
          midinum,
          noteName: Constants.midinumToNoteName(midinum)
        });
      }
    });

    return candidates;
  }

  isCandidateInRange(candidate, fretWindow = null) {
    const minFret = Number.parseInt(fretWindow?.minFret, 10);
    const maxFret = Number.parseInt(fretWindow?.maxFret, 10);
    const resolvedMinFret = Number.isFinite(minFret) ? minFret : (Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0);
    const resolvedMaxFret = Number.isFinite(maxFret) ? maxFret : (Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0);
    const upperRowLimit = Number.parseInt(this.getProperty('minRow')?.getValue(), 10) || 0;
    const lowerRowLimit = Number.parseInt(this.getProperty('maxRow')?.getValue(), 10) || 0;
    return candidate.row >= upperRowLimit && candidate.row <= lowerRowLimit && candidate.col >= resolvedMinFret && candidate.col <= resolvedMaxFret;
  }

  resolveFamilyDecision(familyName, noteName, roleNoteSets) {
    return resolveRoleDecision(noteName, roleNoteSets, {
      getModeForRole: (roleName) => this.getFamilyRoleMode(familyName, roleName),
      getColorForRole: (roleName) => this.getFamilyRoleColor(familyName, roleName),
      rolePassOrder: ROLE_PASS_ORDER
    });
  }

  buildNamedPlan(roleNoteSets) {
    return buildNamedRolePlan(roleNoteSets, {
      getModeForRole: (roleName) => this.getFamilyRoleMode('named', roleName),
      getColorForRole: (roleName) => this.getFamilyRoleColor('named', roleName),
      rolePassOrder: ROLE_PASS_ORDER,
      buildNamedNote: (noteName, colorValue) => this.buildNamedNote(noteName, colorValue)
    });
  }

  buildPlayedFamilyPlan(familyName, section, tuning, roleNoteSets, options = {}) {
    const fretWindow = options.fretWindow || null;
    const cellPlans = [];
    this.collectCandidateCells(tuning)
      .filter((candidate) => !this.getFamilyConfig(familyName).usesRange || this.isCandidateInRange(candidate, fretWindow))
      .forEach((candidate) => {
        const decision = this.resolveFamilyDecision(familyName, candidate.noteName, roleNoteSets);
        if (!decision.matched) {
          return;
        }
        cellPlans.push({
          row: candidate.row,
          col: candidate.col,
          preserveExisting: decision.preserveExisting,
          outputNote: decision.outputColorValue
            ? this.buildPlayedNote(familyName, candidate, decision.outputColorValue, section)
            : null
        });
      });
    return { cellPlans };
  }

  buildOverlayTinyPlan(section, singlePlan) {
    const tinyValue = `${this.getProperty('singleAddTiny')?.getValue() || TINY_NONE}`;
    if (tinyValue === TINY_NONE) {
      return { cellPlans: [] };
    }

    return {
      cellPlans: singlePlan.cellPlans
        .filter((cellPlan) => cellPlan.outputNote)
        .map((cellPlan) => ({
          row: cellPlan.row,
          col: cellPlan.col,
          preserveExisting: false,
          outputNote: this.buildPlayedNote('tiny', cellPlan.outputNote, tinyValue, section, true)
        }))
    };
  }

  buildCombinedOverlayTinyPlan(tinyPlan, overlayTinyPlan) {
    const combinedByCell = new Map();

    tinyPlan.cellPlans.forEach((cellPlan) => {
      if (cellPlan.preserveExisting) {
        combinedByCell.set(cellKey(cellPlan.row, cellPlan.col), {
          ...cellPlan,
          outputNote: null
        });
      }
    });

    overlayTinyPlan.cellPlans.forEach((cellPlan) => {
      const key = cellKey(cellPlan.row, cellPlan.col);
      if (combinedByCell.get(key)?.preserveExisting) {
        return;
      }
      combinedByCell.set(key, cellPlan);
    });

    return {
      cellPlans: Array.from(combinedByCell.values())
    };
  }

  buildApplyPlan(song, section, tuning, options = {}) {
    const roleNoteSets = this.computeRoleNoteSets(section, options);
    const rangeOptions = { fretWindow: options.fretWindow || null };
    const namedPlan = this.buildNamedPlan(roleNoteSets);
    const singlePlan = this.buildPlayedFamilyPlan('single', section, tuning, roleNoteSets, rangeOptions);
    const tinyPlan = this.buildPlayedFamilyPlan('tiny', section, tuning, roleNoteSets, rangeOptions);
    const standaloneTinyActive = tinyPlan.cellPlans.some((cellPlan) => cellPlan.outputNote);
    const overlayTinyPlan = standaloneTinyActive
      ? { cellPlans: [] }
      : this.buildCombinedOverlayTinyPlan(tinyPlan, this.buildOverlayTinyPlan(section, singlePlan));

    return {
      namedPlan,
      singlePlan,
      tinyPlan: standaloneTinyActive ? tinyPlan : overlayTinyPlan,
      standaloneTinyActive
    };
  }

  buildNamedNote(noteName, colorValue) {
    return new Note({
      noteName,
      styleNum: Note.STYLENUM_NAMED,
      colorClass: colorValue,
      owner: FILL_OWNER
    });
  }

  buildPlayedNote(familyName, candidate, colorValue, section, fromOutputNote = false) {
    const source = fromOutputNote ? candidate : null;
    const note = new Note({
      noteName: source?.noteName || candidate.noteName,
      styleNum: this.getFamilyConfig(familyName).styleNum,
      midinum: source?.midinum ?? candidate.midinum,
      row: source?.row ?? candidate.row,
      col: source?.col ?? candidate.col,
      owner: FILL_OWNER
    });
    note.colorClass = this.resolvePersistedColorValue(colorValue, note, section);
    return note;
  }

  resolvePersistedColorValue(colorValue, note, section) {
    if (colorValue !== 'noteAutomatic') {
      return colorValue;
    }
    const lookupResult = lookupClassForNote(note, createLookupContext({ section }));
    if (lookupResult && lookupResult.functionNum != null) {
      return `note${lookupResult.functionNum + 1}`;
    }
    if (lookupResult && lookupResult.colorClass) {
      return lookupResult.colorClass;
    }
    return 'noteTransparent';
  }

  isStandaloneTinyActive(song = getSong(), section = this.getCurrentSection(song), tuning = this.getSelectedTargetTuning(song)) {
    if (!song || !section || !tuning || !this.getSelectedTargetTableID()) {
      return false;
    }
    const roleNoteSets = this.computeRoleNoteSets(section);
    const effectiveWindow = this.resolveEffectiveFretWindow(section, tuning);
    return this.buildPlayedFamilyPlan('tiny', section, tuning, roleNoteSets, { fretWindow: effectiveWindow })
      .cellPlans
      .some((cellPlan) => cellPlan.outputNote);
  }

  applyToCurrentSection(song = getSong()) {
    const section = this.getCurrentSection(song);
    if (this.getProperty('automaticFromChart')?.getValue()) {
      this.applyAutomaticFromChart(song, section);
      return this.applyToSection(song, section, { useSectionChart: true });
    }
    return this.applyToSection(song, section);
  }

  applyToSection(song = getSong(), section = this.getCurrentSection(song), options = {}) {
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();

    if (!song || !section || !tuning || !tableID) {
      return { result: 'Fill apply skipped: no target table selected' };
    }

    const sectionNotes = section.getSectionNotes(tableID);
    this.clearOwnedFillNotesInSection(sectionNotes);

    const effectiveWindow = this.resolveEffectiveFretWindow(section, tuning);
    const plan = this.buildApplyPlan(song, section, tuning, {
      ...options,
      fretWindow: effectiveWindow
    });
    const counts = this.applyPlanToSection(sectionNotes, plan);

    this.refreshCurrentSectionUi(song);
    return {
      result: `Fill applied: named ${counts.namedAdded}, single ${counts.singleAdded}, tiny ${counts.tinyAdded}, overlay ${counts.overlayTinyAdded}, kept ${counts.kept}`
    };
  }

  applyPlanToSection(sectionNotes, plan) {
    const namedCounts = this.applyNamedPlan(sectionNotes, plan.namedPlan);
    const singleCounts = this.applyPlayedPlan(sectionNotes, plan.singlePlan, Note.STYLENUM_SINGLE);
    const tinyCounts = this.applyPlayedPlan(sectionNotes, plan.tinyPlan, Note.STYLENUM_TINY);
    return {
      namedAdded: namedCounts.added,
      singleAdded: singleCounts.added,
      tinyAdded: plan.standaloneTinyActive ? tinyCounts.added : 0,
      overlayTinyAdded: plan.standaloneTinyActive ? 0 : tinyCounts.added,
      kept: namedCounts.kept + singleCounts.kept + tinyCounts.kept
    };
  }

  applyNamedPlan(sectionNotes, plan) {
    let added = 0;
    let kept = 0;

    plan.notePlans.forEach((notePlan) => {
      const existingNote = sectionNotes.namedNotes?.[notePlan.noteName];
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

  applyPlayedPlan(sectionNotes, plan, styleNum) {
    let added = 0;
    let kept = 0;
    const planByCell = new Map(plan.cellPlans.map((cellPlan) => [cellKey(cellPlan.row, cellPlan.col), { ...cellPlan, hadExisting: false }]));

    sectionNotes.playedNotes = (sectionNotes.playedNotes || []).filter((note) => {
      if (Number.parseInt(note?.styleNum, 10) !== styleNum) {
        return true;
      }
      const decision = planByCell.get(cellKey(note.row, note.col));
      if (!decision) {
        return true;
      }
      if (decision.preserveExisting) {
        decision.hadExisting = true;
        return true;
      }
      return false;
    });

    planByCell.forEach((decision) => {
      if (decision.preserveExisting && decision.hadExisting) {
        kept += 1;
        return;
      }
      if (decision.outputNote) {
        sectionNotes.playedNotes.push(decision.outputNote);
        added += 1;
      }
    });

    return { added, kept };
  }

  clearOwnedFillNotesInSection(sectionNotes) {
    sectionNotes.removePlayedNotesWhere((note) => this.isOwnedFillPlayedNote(note));
    Object.entries(sectionNotes.namedNotes || {}).forEach(([noteName, note]) => {
      if (this.isOwnedFillNamedNote(note)) {
        sectionNotes.clearNamedNote(noteName);
      }
    });
  }

  clearCurrentSection(song = getSong()) {
    const section = this.getCurrentSection(song);
    const tableID = this.getSelectedTargetTableID(song);
    if (!section || !tableID) {
      return { result: 'Fill clear skipped: no target table selected' };
    }
    this.clearOwnedFillNotesInSection(section.getSectionNotes(tableID));
    this.refreshCurrentSectionUi(song);
    return { result: 'Fill cleared current section' };
  }

  clearSong(song = getSong()) {
    const tableID = this.getSelectedTargetTableID(song);
    if (!song || !tableID) {
      return { result: 'Fill clear song skipped: no target table selected' };
    }
    (song.sections || []).forEach((section) => {
      this.clearOwnedFillNotesInSection(section.getSectionNotes(tableID));
    });
    this.refreshCurrentSectionUi(song);
    return { result: 'Fill cleared all sections' };
  }

  commitNotes(song = getSong()) {
    const tableID = this.getSelectedTargetTableID(song);
    if (!song || !tableID) {
      return { result: 'Fill commit skipped: no target table selected' };
    }
    (song.sections || []).forEach((section) => {
      const sectionNotes = section.getSectionNotes(tableID);
      sectionNotes.forEachPlayedNoteWhere(
        (note) => this.isOwnedFillPlayedNote(note),
        (note) => { delete note.owner; }
      );
      Object.values(sectionNotes.namedNotes || {}).forEach((note) => {
        if (this.isOwnedFillNamedNote(note)) {
          delete note.owner;
        }
      });
    });
    this.refreshCurrentSectionUi(song);
    return { result: 'Fill committed generated notes' };
  }

  isOwnedFillPlayedNote(note) {
    const styleNum = Number.parseInt(note?.styleNum, 10);
    return note?.owner === FILL_OWNER && (styleNum === Note.STYLENUM_SINGLE || styleNum === Note.STYLENUM_TINY);
  }

  isOwnedFillNamedNote(note) {
    return note?.owner === FILL_OWNER;
  }

  refreshCurrentSectionUi(song = getSong()) {
    if (!song || song.isHeadless) {
      return;
    }
    if (typeof song.requestUiClearAll === 'function') {
      song.requestUiClearAll();
    }
    if (typeof song.requestUiReplay === 'function') {
      song.requestUiReplay();
    }
    if (typeof song.requestUiShowBeats === 'function') {
      song.requestUiShowBeats();
    }
  }
}

export default FillPlugin;