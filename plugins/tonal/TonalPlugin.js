import properties from './properties.json' with { type: 'json' };
import { MenuItemProxy } from '../MenuItemProxy.js';
import { PluginProperty, buildCaption, buildValueReference } from '../PluginProperty.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { getSong, getTransportController } from '../../infinite-neck.js';
import {
  applyTonalSelection,
  buildOverflowResultSuffix,
  formatTonalSuggestionSummary,
  getTonalSuggestionState,
  TONAL_SUGGESTION_LIMIT,
  TonalAutoWrite
} from '../../tonalPicker-functions.js';

const TARGET_TABLE_OPTION_LIMIT = 9;

function escapeHtml(text) {
  return `${text || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeSuggestionIndex(rawIndex) {
  const parsed = Number.parseInt(rawIndex, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export class TonalPlugin {
  constructor() {
    this.id = 'tonal';
    this.registeredName = 'tonal';
    this.menuTrigger = 'o';
    this.eventNames = [];
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

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
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
      this.setPropertyValue(name, value, context);
    });
    this.refreshDynamicPropertyOptions(song);
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
      throw new Error(`TonalPlugin unknown property: ${name}`);
    }

    this.refreshDynamicPropertyOptions(context.song || getSong());
    return property.setValue(rawValue);
  }

  resolveValue(fieldName, context = {}) {
    const song = context.song || getSong();
    if (fieldName === 'targetTable') {
      this.refreshDynamicPropertyOptions(song);
      const value = this.getProperty('targetTable')?.getValue() || '';
      return value.startsWith(Constants.TABLE_ID_PREFIX) ? value.slice(Constants.TABLE_ID_PREFIX.length) : value;
    }
    if (fieldName === 'chordSummary') {
      return formatTonalSuggestionSummary('chord', this.getSuggestionState(song));
    }
    if (fieldName === 'modeSummary') {
      return formatTonalSuggestionSummary('mode', this.getSuggestionState(song));
    }
    return undefined;
  }

  refreshDynamicPropertyOptions(song = getSong()) {
    const property = this.getProperty('targetTable');
    if (!property) {
      return;
    }
    property.options = this.buildTargetTableOptions(song);
    this.ensureTargetTableSelection(song);
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

  buildTargetTableOptions(song = getSong()) {
    return this.getEligibleTargetTunings(song)
      .slice(0, TARGET_TABLE_OPTION_LIMIT)
      .map((tuning, index) => ({
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
    return song.myTunings.filter((tuning) => tuning && tuning.baseID && !wiredDisplayTables.has(`${Constants.TABLE_ID_PREFIX}${tuning.baseID}`));
  }

  getSelectedTargetTableID() {
    return `${this.getProperty('targetTable')?.getValue() || ''}`;
  }

  getCurrentSection(song = getSong()) {
    return song && typeof song.getCurrentSection === 'function' ? song.getCurrentSection() : null;
  }

  getCurrentSectionIndex(song = getSong()) {
    if (song && typeof song.getSectionsCurrentIndex === 'function') {
      return song.getSectionsCurrentIndex();
    }
    const section = this.getCurrentSection(song);
    return song && Array.isArray(song.sections) ? Math.max(0, song.sections.indexOf(section)) : 0;
  }

  getAutoWriteValue() {
    const propertyValue = `${this.getProperty('autoWrite')?.getValue() || TonalAutoWrite.CHART_AND_TABLE}`;
    return propertyValue === TonalAutoWrite.TABLE ? TonalAutoWrite.TABLE : TonalAutoWrite.CHART_AND_TABLE;
  }

  getSuggestionState(song = getSong()) {
    this.refreshDynamicPropertyOptions(song);
    return getTonalSuggestionState(
      song,
      this.getCurrentSection(song),
      this.getSelectedTargetTableID(),
      {
        autoWrite: this.getAutoWriteValue(),
        limit: TONAL_SUGGESTION_LIMIT
      }
    );
  }

  getVisibleMenuChildren() {
    const song = this.manager?.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    return [
      this.buildAcceptMenuNode(song),
      this.buildPrintExtraModesNode()
    ].filter(Boolean);
  }

  buildAcceptMenuNode(song = getSong()) {
    const state = this.getSuggestionState(song);
    return new MenuItemProxy(this, {
      name: 'accept',
      caption: buildCaption('accept', 'a'),
      trigger: 'a',
      children: [
        this.getProperty('targetTable').getMenuNodeSpec(this),
        this.getProperty('autoWrite').getMenuNodeSpec(this),
        this.buildActionNode('prevSection', 'prev section', 'p', false),
        this.buildActionNode('nextSection', 'next section', 'n', false),
        this.buildSuggestionMenuNode('chord', 'chords', 'c', state),
        this.buildImmediateAcceptNode('chord', 'Chord', 'C', state),
        this.buildSuggestionMenuNode('mode', 'modes', 'm', state),
        this.buildImmediateAcceptNode('mode', 'Mode', 'M', state),
        this.buildActionNode('refresh', 'refresh', 'r', false),
        this.getProperty('help').getMenuNodeSpec(this)
      ]
    });
  }

  buildPrintExtraModesNode() {
    return this.buildActionNode('printExtraModes', 'print extra modes', 'p', true);
  }

  buildActionNode(actionName, caption, trigger, popOnBang) {
    return new MenuItemProxy(this, {
      name: actionName,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName,
      popOnBang
    });
  }

  buildSuggestionMenuNode(kind, caption, trigger, state) {
    const token = `plugin:${this.id}:${kind === 'chord' ? 'chordSummary' : 'modeSummary'}`;
    const suggestions = kind === 'chord' ? state.chordSuggestions : state.modeSuggestions;
    const children = [
      this.buildIndexedAcceptNode(kind, 0, suggestions[0] || '<none>', 'a', true)
    ];

    suggestions.forEach((suggestion, index) => {
      children.push(this.buildIndexedAcceptNode(kind, index, suggestion, `${index + 1}`, true));
    });

    return new MenuItemProxy(this, {
      name: kind === 'chord' ? 'chords' : 'modes',
      caption: `${buildCaption(caption, trigger)} [${buildValueReference(token)}]`,
      trigger,
      vars: [token],
      children
    });
  }

  buildIndexedAcceptNode(kind, index, suggestion, trigger, includeOverflow) {
    const label = suggestion || '<none>';
    const actionName = `${kind === 'chord' ? 'acceptChordIndex' : 'acceptModeIndex'}:${index}:${includeOverflow ? 'overflow' : 'plain'}`;
    const caption = trigger === 'a' ? `accept 1: ${label}` : `${trigger}) ${label}`;
    return new MenuItemProxy(this, {
      name: `${kind}:${trigger}`,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName,
      popOnBang: true
    });
  }

  buildImmediateAcceptNode(kind, label, trigger, state) {
    const suggestion = kind === 'chord' ? state.chordSuggestions[0] : state.modeSuggestions[0];
    return new MenuItemProxy(this, {
      name: `acceptFirst${label}`,
      caption: buildCaption(`accept ${label} '${suggestion || '<none>'}'`, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: `acceptFirst${label}`,
      popOnBang: false
    });
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || this.manager?.song || getSong();

    switch (actionName) {
      case 'prevSection':
        return this.navigateSection('prev', song);
      case 'nextSection':
        return this.navigateSection('next', song);
      case 'refresh':
        return { result: `refreshed section ${this.getCurrentSectionIndex(song) + 1}` };
      case 'printExtraModes':
        return this.printExtraModes(song);
      case 'help':
        return {
          result: 'Tonal help shown',
          message: this.buildHelpMessage(song)
        };
      case 'acceptFirstChord':
        return this.acceptSuggestion(song, 'chord', 0, false);
      case 'acceptFirstMode':
        return this.acceptSuggestion(song, 'mode', 0, false);
      default:
        if (actionName.startsWith('acceptChordIndex:')) {
          const [, rawIndex, overflowFlag] = actionName.split(':');
          return this.acceptSuggestion(song, 'chord', normalizeSuggestionIndex(rawIndex), overflowFlag === 'overflow');
        }
        if (actionName.startsWith('acceptModeIndex:')) {
          const [, rawIndex, overflowFlag] = actionName.split(':');
          return this.acceptSuggestion(song, 'mode', normalizeSuggestionIndex(rawIndex), overflowFlag === 'overflow');
        }
        return { result: `Unknown tonal action: ${actionName}` };
    }
  }

  navigateSection(direction, song = getSong()) {
    const controller = typeof getTransportController === 'function' ? getTransportController() : null;
    const methodName = direction === 'prev' ? 'prevSection' : 'nextSection';
    if (controller && typeof controller[methodName] === 'function') {
      controller[methodName]();
      return { result: `section ${this.getCurrentSectionIndex(song) + 1}` };
    }

    if (song) {
      if (direction === 'prev' && typeof song.gotoPrevSectionStateOnly === 'function') {
        song.gotoPrevSectionStateOnly(false);
      }
      if (direction === 'next' && typeof song.gotoNextSectionStateOnly === 'function') {
        song.gotoNextSectionStateOnly(false);
      }
    }
    return { result: `section ${this.getCurrentSectionIndex(song) + 1}` };
  }

  acceptSuggestion(song, kind, index, includeOverflow) {
    const state = this.getSuggestionState(song);
    const suggestions = kind === 'chord' ? state.chordSuggestions : state.modeSuggestions;
    const hiddenCount = kind === 'chord' ? state.hiddenChordCount : state.hiddenModeCount;
    const suggestion = suggestions[index] || '';
    if (!suggestion) {
      return { result: `No ${kind} suggestions` };
    }

    applyTonalSelection({
      song,
      sectionIndex: this.getCurrentSectionIndex(song),
      tableID: this.getSelectedTargetTableID(),
      kind,
      value: suggestion,
      autoWrite: this.getAutoWriteValue()
    });

    const baseResult = `accepted ${kind} ${index + 1}: ${suggestion}`;
    return {
      result: includeOverflow ? `${baseResult}${buildOverflowResultSuffix(kind, hiddenCount)}` : baseResult
    };
  }

  printExtraModes(song = getSong()) {
    const state = this.getSuggestionState(song);
    const sectionIndex = this.getCurrentSectionIndex(song);
    const extraModes = state.extraModeSuggestions || [];
    const header = `Tonal extra modes: section ${sectionIndex + 1}, table ${this.resolveValue('targetTable', { song }) || '<none>'}`;
    const body = extraModes.length > 0 ? extraModes.map((mode) => `- ${mode}`).join('\n') : '- none';
    return {
      result: `printed ${extraModes.length} modes`,
      message: `<pre>${escapeHtml(header)}\n${escapeHtml(body)}</pre>`
    };
  }

  buildSummary(song = getSong()) {
    const state = this.getSuggestionState(song);
    const tableID = this.resolveValue('targetTable', { song }) || '<none>';
    return `section=${this.getCurrentSectionIndex(song) + 1} table=${tableID} autoWrite=${this.getAutoWriteValue()} tonalSourceSet=${state.tonalSourceSet || '<none>'} chords=${state.chordSuggestions.length} modes=${state.modeSuggestions.length}`;
  }

  buildHelpMessage(song = getSong()) {
    const state = this.getSuggestionState(song);
    const targetTable = this.resolveValue('targetTable', { song }) || '<none>';
    return `<pre>${buildPluginHelpHeader(this, 'Tonal plugin:', this.buildSummary(song))}

Fast section-by-section approval for Tonal suggestions.

- target table = ${targetTable}
- auto write = ${this.getAutoWriteValue()}
- tonalSourceSet = ${state.tonalSourceSet || '<none>'}
- chord summary = ${formatTonalSuggestionSummary('chord', state)}
- mode summary = ${formatTonalSuggestionSummary('mode', state)}
- /fpo opens the TonalPlugin root menu
- /fpoa keeps instrument, write policy, navigation, and accept actions on stable keys
- C accepts the first chord suggestion and stays in /fpoa
- M accepts the first mode suggestion and stays in /fpoa
- c and m open limited 1..9 suggestion lists
- p at /fpo prints the full unfiltered mode list to Messages only
- chart+table writes both Section.chart* and table tonal values

${buildPluginEventsHelpFooter(this)}</pre>`;
  }
}

export default TonalPlugin;