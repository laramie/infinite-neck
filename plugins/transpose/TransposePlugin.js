import properties from './properties.json' with { type: 'json' };
import { PluginProperty } from '../PluginProperty.js';
import { transposeSong } from '../../infinite-neck.js';

function formatOptions(propertiesByName) {
  return {
    NamedNotes: !!propertiesByName.get('NamedNotes')?.getValue(),
    PlayedNotes: !!propertiesByName.get('PlayedNotes')?.getValue(),
    RecordedNotes: !!propertiesByName.get('RecordedNotes')?.getValue()
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
    return undefined;
  }

  enable() {
    this.resetIntervalState();
    return 'Transpose enabled';
  }

  disable() {
    return 'Transpose disabled';
  }

  handleEvent(eventName) {
    return this.advanceInterval(`event ${eventName}`);
  }

  invokeAction(actionName) {
    switch (actionName) {
      case 'apply':
        return { result: this.advanceInterval('manual apply') };
      case 'help':
        return {
          result: 'Transpose help shown',
          message: '<pre>Transpose plugin\n\n- intervals: JSON array of integers\n- first interval represents the starting Song state\n- each trigger advances to the next interval\n- NamedNotes / PlayedNotes / RecordedNotes control which layers move</pre>'
        };
      default:
        return { result: `Unknown transpose action: ${actionName}` };
    }
  }

  getIntervals() {
    const value = this.getProperty('intervals')?.getValue();
    return Array.isArray(value) ? value : [];
  }

  resetIntervalState() {
    const intervals = this.getIntervals();
    this.currentIntervalIndex = 0;
    this.currentAppliedInterval = intervals.length > 0 ? intervals[0] : 0;
  }

  advanceInterval(sourceLabel) {
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
    }

    return `${sourceLabel}: interval ${nextInterval} (delta ${delta})`;
  }
}

export default TransposePlugin;
