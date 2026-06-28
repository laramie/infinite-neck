import properties from './properties.json' with { type: 'json' };
import { PluginProperty, buildCaption, buildValueReference } from '../PluginProperty.js';
import { MenuItemProxy } from '../MenuItemProxy.js';
import { buildPluginHelpHeader } from '../pluginHelp.js';
import { GraveType } from '../../graveyard.js';
import { getSong } from '../../infinite-neck.js';
import {
  applyMovePlan,
  buildTargetTableOptions,
  getEligibleTargetTunings,
  getTableID
} from '../../move-helpers.js';

export class MovePlugin {
  constructor() {
    this.id = 'move';
    this.registeredName = 'move';
    this.menuTrigger = 'm';
    this.eventNames = [];
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
    this.resetRuntimeState();
  }

  setManager(manager) {
    this.manager = manager;
  }

  resetRuntimeState() {
    this.droppedNotes = [];
    this.applyCounter = 0;
    this.needsSectionBackupBeforeNextApply = true;
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
    return [];
  }

  getProperties() {
    return [...this.properties];
  }

  getProperty(name) {
    return this.propertyMap.get(name) || null;
  }

  refreshDynamicPropertyOptions(song = getSong()) {
    const property = this.getProperty('targetTable');
    if (!property) {
      return;
    }
    property.options = buildTargetTableOptions(song);
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

  getVisibleMenuChildren() {
    const song = this.manager?.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    return [
      this.getProperty('targetTable').getMenuNodeSpec(this),
      this.getProperty('apply').getMenuNodeSpec(this),
      this.getProperty('algorithm').getMenuNodeSpec(this),
      this.getProperty('motion').getMenuNodeSpec(this),
      this.buildIncludeMenuNode(),
      this.getProperty('showDroppedNotes').getMenuNodeSpec(this),
      this.getProperty('clearDroppedNotes').getMenuNodeSpec(this),
      this.getProperty('help').getMenuNodeSpec(this)
    ].filter(Boolean);
  }

  buildIncludeMenuNode() {
    const token = 'plugin:move:includeSummary';
    return new MenuItemProxy(this, {
      name: 'include',
      caption: `${buildCaption('include', 'i')}${buildValueReference(token)}`,
      trigger: 'i',
      vars: [token],
      children: [
        this.getProperty('includeSingle').getMenuNodeSpec(this),
        this.getProperty('includeTiny').getMenuNodeSpec(this),
        this.getProperty('includeHighlights').getMenuNodeSpec(this),
        this.getProperty('includeFingering').getMenuNodeSpec(this),
        this.getProperty('includePlayed').getMenuNodeSpec(this),
        this.getProperty('includeRecorded').getMenuNodeSpec(this)
      ]
    });
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
    this.resetRuntimeState();
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
    const song = this.manager?.song || getSong();
    this.refreshDynamicPropertyOptions(song);
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
      throw new Error(`MovePlugin unknown property: ${name}`);
    }
    const song = context.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    return property.setValue(rawValue);
  }

  resolveValue(fieldName, context = {}) {
    const song = context.song || getSong();
    if (fieldName === 'targetTable') {
      this.refreshDynamicPropertyOptions(song);
      const value = this.getProperty('targetTable')?.getValue() || '';
      return value.startsWith('tbl') ? value.slice(3) : value;
    }
    if (fieldName === 'includeSummary') {
      return ` ${this.buildIncludeFlagsSummary()}`;
    }
    return undefined;
  }

  enable() {
    return 'Move enabled';
  }

  disable() {
    return 'Move disabled';
  }

  getSelectedTargetTableID() {
    return `${this.getProperty('targetTable')?.getValue() || ''}`;
  }

  getTargetTuning(song = getSong()) {
    const eligibleTunings = getEligibleTargetTunings(song);
    if (eligibleTunings.length === 0) {
      return null;
    }
    const selectedTableID = this.getSelectedTargetTableID();
    return eligibleTunings.find((tuning) => getTableID(tuning) === selectedTableID) || eligibleTunings[0] || null;
  }

  getCurrentSection(song = getSong()) {
    return song && typeof song.getCurrentSection === 'function' ? song.getCurrentSection() : null;
  }

  getLookupContext(section) {
    return {
      section,
      autoColor: true
    };
  }

  buildSummary(song = getSong()) {
    const tuning = this.getTargetTuning(song);
    return `target table=${this.resolveValue('targetTable', { song }) || '<none>'} algorithm=${this.getProperty('algorithm')?.getValue()} motion=${this.getProperty('motion')?.getValue()} include single=${this.getProperty('includeSingle')?.getValue()} tiny=${this.getProperty('includeTiny')?.getValue()} highlights=${this.getProperty('includeHighlights')?.getValue()} fingering=${this.getProperty('includeFingering')?.getValue()} played=${this.getProperty('includePlayed')?.getValue()} recorded=${this.getProperty('includeRecorded')?.getValue()} tuning=${tuning?.baseID || '<none>'}`;
  }

  buildHelpMessage(song = getSong()) {
    return `<pre>${buildPluginHelpHeader(this, 'Move plugin:', this.buildSummary(song))}

Moves non-Named notes in the current section and selected table.

- target table = ${this.resolveValue('targetTable', { song }) || '<none>'}
- algorithm = ${this.getProperty('algorithm')?.getValue()}
- motion = ${this.getProperty('motion')?.getValue()}
- include single = ${this.getProperty('includeSingle')?.getValue()}
- include tiny/bend = ${this.getProperty('includeTiny')?.getValue()}
- include highlights = ${this.getProperty('includeHighlights')?.getValue()}
- include fingering = ${this.getProperty('includeFingering')?.getValue()}
- include played = ${this.getProperty('includePlayed')?.getValue()}
- include recorded = ${this.getProperty('includeRecorded')?.getValue()}
- apply counter = ${this.applyCounter}
- dropped notes entries = ${this.droppedNotes.length}

clear/backup clears the dropped-notes log and arms a fresh section backup before the next Apply.
That backup is buried in the graveyard. Revive it from the graveyard if you need to restore the prior section state.
</pre>`;
  }

  buildIncludeFlagsSummary() {
    const include = [];
    if (this.getProperty('includeSingle')?.getValue()) include.push('s');
    if (this.getProperty('includeTiny')?.getValue()) include.push('t');
    if (this.getProperty('includeHighlights')?.getValue()) include.push('h');
    if (this.getProperty('includeFingering')?.getValue()) include.push('f');
    if (this.getProperty('includePlayed')?.getValue()) include.push('p');
    if (this.getProperty('includeRecorded')?.getValue()) include.push('r');
    return `[${include.join(',')}]`;
  }

  getAuditInputs() {
    const include = this.buildIncludeFlagsSummary().slice(1, -1);
    return `include:${include}`;
  }

  getAuditOutputs() {
    return undefined;
  }

  buildOptionsSummary() {
    return `motions:${this.getProperty('motion')?.getValue()} include:${this.buildIncludeFlagsSummary()} targetTable:${this.getSelectedTargetTableID()}`;
  }

  appendApplyStartEntry(tableID) {
    this.droppedNotes.push({
      algorithm: this.getProperty('algorithm')?.getValue(),
      reason: 'apply start',
      optionsSummary: this.buildOptionsSummary(),
      applyNumber: this.applyCounter,
      beat: null,
      tableID,
      storageKind: null
    });
  }

  appendNoopEntry(tableID, reason) {
    this.droppedNotes.push({
      algorithm: this.getProperty('algorithm')?.getValue(),
      reason,
      optionsSummary: this.buildOptionsSummary(),
      applyNumber: this.applyCounter,
      beat: null,
      tableID,
      storageKind: null
    });
  }

  buryCurrentSection(song, section) {
    if (!song?.graveyard || !section) {
      return;
    }
    const sectionIndex = Array.isArray(song.sections) ? song.sections.indexOf(section) : -1;
    song.graveyard.bury(GraveType.SECTION, section, {
      SectionIndex: sectionIndex,
      caption: section.caption,
      MovePlugin: {
        applyNumber: `${this.applyCounter}`
      }
    });
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || this.manager?.song || getSong();
    switch (actionName) {
      case 'apply':
        return this.applyToCurrentSection(song);
      case 'showDroppedNotes':
        return {
          result: 'Move dropped notes shown',
          messageJSON: JSON.stringify({ droppedNotes: this.droppedNotes }, null, 2)
        };
      case 'clearDroppedNotes':
        this.droppedNotes = [];
        this.needsSectionBackupBeforeNextApply = true;
        return { result: 'Move dropped notes cleared' };
      case 'help':
        return {
          result: 'Move help opened',
          message: this.buildHelpMessage(song)
        };
      default:
        return { result: `Unknown move action: ${actionName}` };
    }
  }

  applyToCurrentSection(song = getSong()) {
    const section = this.getCurrentSection(song);
    const tuning = this.getTargetTuning(song);
    if (!section) {
      return { result: 'Move skipped: no current section selected' };
    }
    if (!tuning) {
      return { result: 'Move skipped: no target instrument available in myTunings' };
    }

    this.applyCounter += 1;
    const tableID = getTableID(tuning);
    this.appendApplyStartEntry(tableID);

    if (this.needsSectionBackupBeforeNextApply) {
      this.buryCurrentSection(song, section);
      this.needsSectionBackupBeforeNextApply = false;
    }

    const include = {
      single: !!this.getProperty('includeSingle')?.getValue(),
      tiny: !!this.getProperty('includeTiny')?.getValue(),
      highlights: !!this.getProperty('includeHighlights')?.getValue(),
      fingering: !!this.getProperty('includeFingering')?.getValue(),
      played: !!this.getProperty('includePlayed')?.getValue(),
      recorded: !!this.getProperty('includeRecorded')?.getValue()
    };

    if (!include.single && !include.tiny && !include.highlights && !include.fingering) {
      this.appendNoopEntry(tableID, 'no-op warning: no note styles selected');
      return { result: 'Move apply: no-op, no note styles selected' };
    }
    if (!include.played && !include.recorded) {
      this.appendNoopEntry(tableID, 'no-op warning: neither played nor recorded selected');
      return { result: 'Move apply: no-op, neither played nor recorded selected' };
    }

    const sectionNotes = section.getSectionNotes(tableID);
    const plan = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: this.getProperty('motion')?.getValue(),
      algorithm: this.getProperty('algorithm')?.getValue(),
      include,
      lookupContext: this.getLookupContext(section),
      logContext: {
        algorithm: this.getProperty('algorithm')?.getValue(),
        optionsSummary: this.buildOptionsSummary(),
        applyNumber: this.applyCounter
      }
    });

    sectionNotes.playedNotes = plan.playedNotes;
    sectionNotes.recordedNotes = plan.recordedNotes;
    this.droppedNotes.push(...plan.droppedEntries);

    if (typeof song?.requestUiFullRepaint === 'function') {
      song.requestUiFullRepaint();
    }

    return {
      result: `Move apply: moved ${plan.movedCount} of ${plan.candidateCount}, dropped ${plan.droppedEntries.length}`
    };
  }
}