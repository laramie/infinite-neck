import properties from './properties.json' with { type: 'json' };
import { PluginProperty } from '../PluginProperty.js';
import { buildPluginEventsHelpFooter } from '../pluginHelp.js';
import * as Constants from '../../Constants.js';
import { getSong, transposeSong } from '../../infinite-neck.js';

function formatOptions(propertiesByName) {
  return {
    NamedNotes: !!propertiesByName.get('NamedNotes')?.getValue(),
    PlayedNotes: !!propertiesByName.get('PlayedNotes')?.getValue(),
    RecordedNotes: !!propertiesByName.get('RecordedNotes')?.getValue(),
    doKeyLead: !!propertiesByName.get('doLeadKey')?.getValue()
  };
}

export class TransposePlugin {
  constructor() {
    this.id = 'transpose';
    this.registeredName = 'transpose';
    this.menuTrigger = 't';
    this.eventNames = ['DaCapo:OnSongEnd'];
    this.properties = properties.map((spec) => new PluginProperty(spec));
    this.propertyMap = new Map(this.properties.map((property) => [property.name, property]));
    this.resetIntervalState();
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
    this.resetIntervalState();
  }

  loadSongState(persistedProperties = {}) {
    this.resetToDefaults();
    Object.entries(persistedProperties).forEach(([name, value]) => {
      const property = this.getProperty(name);
      if (!property || property.datatype === 'org.dynamide.Action') {
        return;
      }
      property.setValue(value);
    });
    this.resetIntervalState();
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
    const nextValue = property.setValue(rawValue);
    if (name === 'intervals') {
      if (!Array.isArray(nextValue) || nextValue.length === 0) {
        throw new Error('intervals must contain at least one integer');
      }
      this.resetIntervalState();
    }
    return nextValue;
  }

  resolveValue(fieldName) {
    if (fieldName === 'currentInterval') {
      return this.currentAppliedInterval;
    }
    if (fieldName === 'currentOffset') {
      return this.currentNetOffset;
    }
    return undefined;
  }

  enable() {
    this.resetIntervalState();
    return 'Transpose enabled';
  }

  disable() {
    return 'Transpose disabled';
  }

  handleEvent(eventName, payload = {}, context = {}) {
    return this.advanceInterval(`event ${eventName}`, context.song || this.manager?.song || getSong());
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || this.manager?.song || getSong();
    switch (actionName) {
      case 'apply':
        return { result: this.advanceInterval('manual apply', song) };
      case 'reset':
        return { result: this.resetTranspose(song) };
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
    return `current interval=${this.currentAppliedInterval} offset=${this.currentNetOffset} auto sharps/flats=${this.getAutoSharpsFlatsEnabled()} do lead key=${this.getDoLeadKeyEnabled()} named notes=${this.getNamedNotesEnabled()} played notes=${this.getPlayedNotesEnabled()} recorded notes=${this.getRecordedNotesEnabled()}`;
  }

  buildHelpMessage() {
    return `<pre><b><u>Transpose plugin:</u> ${this.buildSummary()}</b>

Current settings:
- ${this.buildSummary()}
- intervals = ${JSON.stringify(this.getIntervals())}
- first interval represents the starting Song state
- each trigger advances to the next interval
- Reset returns the plugin-managed transpose offset to zero

${buildPluginEventsHelpFooter(this)}</pre>`;
  }

  getIntervals() {
    const value = this.getProperty('intervals')?.getValue();
    return Array.isArray(value) ? value : [];
  }

  getNamedNotesEnabled() {
    return !!this.getProperty('NamedNotes')?.getValue();
  }

  getPlayedNotesEnabled() {
    return !!this.getProperty('PlayedNotes')?.getValue();
  }

  getRecordedNotesEnabled() {
    return !!this.getProperty('RecordedNotes')?.getValue();
  }

  getAutoSharpsFlatsEnabled() {
    return !!this.getProperty('autoSharpsFlats')?.getValue();
  }

  getDoLeadKeyEnabled() {
    return !!this.getProperty('doLeadKey')?.getValue();
  }

  resetIntervalState() {
    const intervals = this.getIntervals();
    this.currentIntervalIndex = 0;
    this.currentAppliedInterval = intervals.length > 0 ? intervals[0] : 0;
    this.currentNetOffset = 0;
  }

  advanceInterval(sourceLabel, song = this.manager?.song || getSong()) {
    const intervals = this.getIntervals();
    if (intervals.length === 0) {
      return 'No intervals configured';
    }

    const nextIndex = intervals.length === 1 ? 0 : (this.currentIntervalIndex + 1) % intervals.length;
    const nextInterval = intervals[nextIndex];
    const delta = nextInterval - this.currentAppliedInterval;
    this.currentIntervalIndex = nextIndex;
    this.currentAppliedInterval = nextInterval;

    if (delta !== 0) {
      transposeSong(delta, formatOptions(this.propertyMap));
      this.currentNetOffset += delta;
      if (this.getAutoSharpsFlatsEnabled()) {
        this.applyAutoSharpsFlats(song);
      }
    }

    return `${sourceLabel}: interval ${nextInterval} (delta ${delta})`;
  }

  resetTranspose(song = this.manager?.song || getSong()) {
    if (this.currentNetOffset !== 0) {
      transposeSong(-this.currentNetOffset, formatOptions(this.propertyMap));
      if (this.getAutoSharpsFlatsEnabled()) {
        this.applyAutoSharpsFlats(song);
      }
    }
    this.resetIntervalState();
    return 'manual reset: offset 0';
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
