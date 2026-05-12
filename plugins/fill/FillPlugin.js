import properties from './properties.json' with { type: 'json' };
import { PluginProperty, buildCaption } from '../PluginProperty.js';
import { MenuItemProxy } from '../MenuItemProxy.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { createLookupContext, lookupClassForNote } from '../../colorFunctions.js';
import { PalettePresentation } from '../../presentation.js';
import { getSong } from '../../infinite-neck.js';

const FILL_OWNER = 'FillPlugin';
const MODE_NONE = 'none';
const MODE_KEEP = 'keep';
const MODE_ROLE = 'role';
const SINGLE_STYLE = Note.STYLENUM_SINGLE;
const TINY_STYLE = Note.STYLENUM_TINY;
const TINY_NONE = 'none';

const ROLE_CONFIG = {
  root: {
    trigger: 'r',
    modeProperty: 'rootMode',
    colorProperty: 'rootColor',
    canonicalColor: 'noteRoot',
    canonicalCaption: 'noteRoot'
  },
  chord: {
    trigger: 'c',
    modeProperty: 'chordMode',
    colorProperty: 'chordColor',
    canonicalColor: 'noteChord',
    canonicalCaption: 'noteChord'
  },
  scale: {
    trigger: 's',
    modeProperty: 'scaleMode',
    colorProperty: 'scaleColor',
    canonicalColor: 'noteScale',
    canonicalCaption: 'noteScale'
  }
};

const ROLE_PASS_ORDER = ['scale', 'chord', 'root'];

function stripHtml(text) {
  return `${text || ''}`.replace(/<[^>]+>/g, '');
}

function cloneOptions(options = []) {
  return options.map((option) => ({ ...option }));
}

function valuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

const TARGET_TABLE_OPTION_LIMIT = 9;

export class FillPlugin {
  constructor() {
    this.id = 'fill';
    this.registeredName = 'fill';
    this.menuTrigger = 'f';
    this.eventNames = ['DaCapo:OnSectionBegin'];
    this.rowBoundsInitialized = false;
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
      chordFormula: '4,7',
      scaleFormula: '0,2,4,5,7,9,11',
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

    return legacyKeys.every((key) => valuesEqual(persistedProperties[key], legacyStub[key]));
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

  resolveRoleDisplay(roleName) {
    const config = ROLE_CONFIG[roleName];
    if (!config) {
      return undefined;
    }
    const modeValue = this.getProperty(config.modeProperty)?.getValue();
    if (modeValue === MODE_ROLE) {
      return this.getProperty(config.colorProperty)?.getValue();
    }
    return modeValue;
  }

  getVisibleMenuChildren() {
    const song = this.manager?.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    return [
      this.getProperty('targetTable').getMenuNodeSpec(this),
      this.buildOptionsMenuNode(),
      this.getProperty('apply').getMenuNodeSpec(this),
      this.getProperty('clear').getMenuNodeSpec(this),
      this.getProperty('clearSong').getMenuNodeSpec(this),
      this.getProperty('commitNotes').getMenuNodeSpec(this),
      this.getProperty('help').getMenuNodeSpec(this)
    ];
  }

  buildOptionsMenuNode() {
    return new MenuItemProxy(this, {
      name: 'options',
      caption: buildCaption('options', 'o'),
      trigger: 'o',
      children: [
        this.getProperty('chordFormula').getMenuNodeSpec(this),
        this.getProperty('scaleFormula').getMenuNodeSpec(this),
        this.getProperty('minFret').getMenuNodeSpec(this),
        this.getProperty('maxFret').getMenuNodeSpec(this),
        this.getProperty('minRow').getMenuNodeSpec(this),
        this.getProperty('maxRow').getMenuNodeSpec(this),
        this.buildRoleMenuNode('root'),
        this.buildRoleMenuNode('chord'),
        this.buildRoleMenuNode('scale'),
        this.getProperty('tinyNotes').getMenuNodeSpec(this),
        this.getProperty('apply').getMenuNodeSpec(this)
      ]
    });
  }

  buildRoleMenuNode(roleName) {
    const config = ROLE_CONFIG[roleName];
    const displayToken = `plugin:${this.id}:${roleName}Display`;
    const colorToken = this.getProperty(config.colorProperty).getResolverToken(this.id);

    return new MenuItemProxy(this, {
      name: roleName,
      caption: `${buildCaption(roleName, config.trigger)} [$${displayToken}]`,
      trigger: config.trigger,
      vars: [displayToken],
      children: [
        this.buildRoleModeChild(roleName, MODE_NONE, 'none', 'n'),
        ...(roleName === 'scale' ? [] : [this.buildRoleModeChild(roleName, MODE_KEEP, 'keep', 'k')]),
        new MenuItemProxy(this, {
          name: `${roleName}:roleMenu`,
          caption: `${buildCaption('role', 'r')} [$${colorToken}]`,
          trigger: 'r',
          vars: [colorToken],
          children: [
            new MenuItemProxy(this, {
              name: `${roleName}:canonical`,
              caption: buildCaption(config.canonicalCaption, 'n'),
              trigger: 'n',
              action: 'pluginAction:invoke',
              pluginId: this.id,
              actionName: `setRoleColor:${roleName}:${config.canonicalColor}`,
              popOnBang: true
            }),
            new MenuItemProxy(this, {
              name: `${roleName}:last`,
              caption: buildCaption('last', 'l'),
              trigger: 'l',
              action: 'pluginAction:invoke',
              pluginId: this.id,
              actionName: `setRoleColorLast:${roleName}`,
              popOnBang: true
            })
          ]
        })
      ]
    });
  }

  buildRoleModeChild(roleName, modeValue, caption, trigger) {
    const config = ROLE_CONFIG[roleName];
    return new MenuItemProxy(this, {
      name: `${roleName}:${modeValue}`,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginProperty:select',
      pluginId: this.id,
      propertyName: config.modeProperty,
      value: modeValue,
      popOnBang: true
    });
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
    this.rowBoundsInitialized = false;
    this.applyStaticDefaults();
    this.setStaticSelectOptions();
  }

  loadSongState(persistedProperties = {}, context = {}) {
    this.resetToDefaults();
    if (this.isLegacyEmptyPersistedState(persistedProperties)) {
      this.refreshDynamicPropertyOptions(context.song || getSong());
      return;
    }
    Object.entries(persistedProperties).forEach(([name, value]) => {
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

    if (name.endsWith('Mode')) {
      const normalized = `${rawValue}`;
      if (![MODE_NONE, MODE_KEEP, MODE_ROLE].includes(normalized)) {
        throw new Error(`FillPlugin invalid mode for ${name}: ${rawValue}`);
      }
      if (name === 'scaleMode' && normalized === MODE_KEEP) {
        property.value = MODE_ROLE;
        return property.getValue();
      }
      property.value = normalized;
      return property.getValue();
    }

    if (name.endsWith('Color')) {
      property.value = `${rawValue}`;
      return property.getValue();
    }

    if (this.isStringLimitProperty(name)) {
      property.value = context.persistedLoad ? property.normalize(rawValue) : this.toStoredRowIndex(rawValue, song);
      this.rowBoundsInitialized = true;
      this.normalizeRangeValues(song);
      return property.getValue();
    }

    const nextValue = property.setValue(rawValue);
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
    if (fieldName === 'rootDisplay') {
      return this.resolveRoleDisplay('root');
    }
    if (fieldName === 'chordDisplay') {
      return this.resolveRoleDisplay('chord');
    }
    if (fieldName === 'scaleDisplay') {
      return this.resolveRoleDisplay('scale');
    }
    if (fieldName === 'tinyNotes') {
      return this.resolveTinyDisplay();
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
    if (eventName !== 'DaCapo:OnSectionBegin') {
      return {};
    }

    const song = context.song || getSong();
    return this.applyToSection(song, this.getSectionForPayload(song, payload));
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || getSong();

    if (actionName.startsWith('setRoleColor:')) {
      const [, roleName, colorValue] = actionName.split(':');
      return this.setRoleColorSelection(roleName, colorValue, song);
    }

    if (actionName.startsWith('setRoleColorLast:')) {
      const [, roleName] = actionName.split(':');
      const lastColor = PalettePresentation.getLastRestorableRbColor();
      return this.setRoleColorSelection(roleName, lastColor?.value || 'noteTransparent', song);
    }

    switch (actionName) {
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

  setRoleColorSelection(roleName, colorValue, song = getSong()) {
    const config = ROLE_CONFIG[roleName];
    if (!config) {
      throw new Error(`Unknown FillPlugin role: ${roleName}`);
    }
    this.setPropertyValue(config.modeProperty, MODE_ROLE, { song });
    this.setPropertyValue(config.colorProperty, colorValue, { song });
    return { result: `${roleName} color set to ${colorValue}` };
  }

  buildHelpMessage(song = getSong()) {
    return `<pre>${buildPluginHelpHeader(this, 'Fill plugin:', this.buildSummary(song))}

SingleNote fill only.

- target table = ${this.resolveValue('targetTable', { song }) || '<none>'}
- chord formula = ${this.resolveValue('chordFormula', { song })}
- scale formula = ${this.resolveValue('scaleFormula', { song })}
- fret range = ${this.getProperty('minFret')?.getValue()}..${this.getProperty('maxFret')?.getValue()}
- upper/lower string limit = ${this.resolveValue('minRow', { song })}..${this.resolveValue('maxRow', { song })}
- root color = ${this.resolveValue('rootDisplay', { song })}
- chord color = ${this.resolveValue('chordDisplay', { song })}
- scale color = ${this.resolveValue('scaleDisplay', { song })}
- tiny notes = ${this.resolveValue('tinyNotes', { song })}

Apply and Clear affect only the current section in the selected table.
Clear Song and Commit Notes affect all sections in the selected table.

Role pass order: scale, then chord, then root.
${buildPluginEventsHelpFooter(this)}</pre>`;
  }

  buildSummary(song = getSong()) {
    return `target table=${this.resolveValue('targetTable', { song }) || '<none>'} chord formula=${this.resolveValue('chordFormula', { song })} scale formula=${this.resolveValue('scaleFormula', { song })} fret range=${this.getProperty('minFret')?.getValue()}..${this.getProperty('maxFret')?.getValue()} upper/lower string limit=${this.resolveValue('minRow', { song })}..${this.resolveValue('maxRow', { song })} tiny notes=${this.resolveValue('tinyNotes', { song })}`;
  }

  resolveTinyDisplay() {
    const tinyValue = `${this.getProperty('tinyNotes')?.getValue() || TINY_NONE}`;
    return tinyValue;
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

  getCurrentRootNoteName(section) {
    const rootID = Number.parseInt(section?.rootID, 10) || 0;
    return Constants.NOTE_NAMES_ARRAY[rootID] || Constants.NOTE_NAMES_ARRAY[0];
  }

  parseFormulaValues(propertyName) {
    const text = `${this.getProperty(propertyName)?.getValue() || ''}`;
    if (!text) {
      return [];
    }
    return text.split(',').map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value));
  }

  computeRoleNoteSets(section) {
    const rootName = this.getCurrentRootNoteName(section);
    const rootID = Number.parseInt(section?.rootID, 10) || 0;

    return {
      root: new Set([rootName]),
      chord: new Set(
        this.parseFormulaValues('chordFormula').map((interval) => Constants.NOTE_NAMES_ARRAY[(rootID + interval) % 12])
      ),
      scale: new Set(
        this.parseFormulaValues('scaleFormula').map((interval) => Constants.NOTE_NAMES_ARRAY[(rootID + interval) % 12])
      )
    };
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

  buildFillPlan(song, section, tuning) {
    const roleNoteSets = this.computeRoleNoteSets(section);
    const candidates = this.collectCandidateCells(tuning);
    const minFret = Number.parseInt(this.getProperty('minFret')?.getValue(), 10) || 0;
    const maxFret = Number.parseInt(this.getProperty('maxFret')?.getValue(), 10) || 0;
    const upperRowLimit = Number.parseInt(this.getProperty('minRow')?.getValue(), 10) || 0;
    const lowerRowLimit = Number.parseInt(this.getProperty('maxRow')?.getValue(), 10) || 0;
    const plan = [];

    candidates.forEach((candidate) => {
      if (candidate.row < upperRowLimit || candidate.row > lowerRowLimit || candidate.col < minFret || candidate.col > maxFret) {
        return;
      }

      const decision = this.resolveCellDecision(candidate, roleNoteSets);
      if (!decision) {
        return;
      }

      plan.push({
        singleNote: this.buildSingleNote(candidate, decision.colorValue, section),
        tinyNote: this.buildTinyNote(candidate, section)
      });
    });

    return plan;
  }

  resolveCellDecision(candidate, roleNoteSets) {
    let selectedRole = null;

    ROLE_PASS_ORDER.forEach((roleName) => {
      const noteSet = roleNoteSets[roleName];
      if (!noteSet?.has(candidate.noteName)) {
        return;
      }

      const config = ROLE_CONFIG[roleName];
      const mode = `${this.getProperty(config.modeProperty)?.getValue() || MODE_ROLE}`;
      if (mode === MODE_ROLE) {
        selectedRole = {
          roleName,
          colorValue: `${this.getProperty(config.colorProperty)?.getValue() || config.canonicalColor}`
        };
        return;
      }

      if (mode === MODE_NONE) {
        selectedRole = null;
      }
    });

    return selectedRole;
  }

  buildSingleNote(candidate, colorValue, section) {
    const note = new Note({
      noteName: candidate.noteName,
      styleNum: SINGLE_STYLE,
      midinum: candidate.midinum,
      row: candidate.row,
      col: candidate.col,
      owner: FILL_OWNER
    });
    note.colorClass = this.resolvePersistedColorValue(colorValue, note, section);
    return note;
  }

  buildTinyNote(candidate, section) {
    const tinyValue = `${this.getProperty('tinyNotes')?.getValue() || TINY_NONE}`;
    if (tinyValue === TINY_NONE) {
      return null;
    }

    const note = new Note({
      noteName: candidate.noteName,
      styleNum: TINY_STYLE,
      midinum: candidate.midinum,
      row: candidate.row,
      col: candidate.col,
      owner: FILL_OWNER
    });
    note.colorClass = this.resolvePersistedColorValue(tinyValue, note, section);
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

  applyToCurrentSection(song = getSong()) {
    return this.applyToSection(song, this.getCurrentSection(song));
  }

  applyToSection(song = getSong(), section = this.getCurrentSection(song)) {
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();

    if (!song || !section || !tuning || !tableID) {
      return { result: 'Fill apply skipped: no target table selected' };
    }

    const sectionNotes = section.getSectionNotes(tableID);
    this.clearOwnedFillNotesInSection(sectionNotes);

    const occupiedCells = new Set(
      (sectionNotes.playedNotes || [])
        .filter((note) => Number.parseInt(note?.styleNum, 10) === SINGLE_STYLE)
        .map((note) => `${note.row}:${note.col}`)
    );

    const plan = this.buildFillPlan(song, section, tuning);
    let addedCount = 0;
    let tinyAddedCount = 0;
    let skippedCount = 0;

    plan.forEach(({ singleNote, tinyNote }) => {
      const key = `${singleNote.row}:${singleNote.col}`;
      if (occupiedCells.has(key)) {
        skippedCount += 1;
        return;
      }
      sectionNotes.playedNotes.push(singleNote);
      if (tinyNote) {
        sectionNotes.playedNotes.push(tinyNote);
        tinyAddedCount += 1;
      }
      occupiedCells.add(key);
      addedCount += 1;
    });

    this.refreshCurrentSectionUi(song);
    return { result: `Fill applied: added ${addedCount}, tiny ${tinyAddedCount}, skipped ${skippedCount}` };
  }

  clearOwnedFillNotesInSection(sectionNotes) {
    sectionNotes.removePlayedNotesWhere((note) => this.isOwnedFillNote(note));
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
      section.getSectionNotes(tableID).forEachPlayedNoteWhere(
        (note) => this.isOwnedFillNote(note),
        (note) => { delete note.owner; }
      );
    });
    this.refreshCurrentSectionUi(song);
    return { result: 'Fill committed generated notes' };
  }

  isOwnedFillNote(note) {
    const styleNum = Number.parseInt(note?.styleNum, 10);
    return note?.owner === FILL_OWNER && (styleNum === SINGLE_STYLE || styleNum === TINY_STYLE);
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