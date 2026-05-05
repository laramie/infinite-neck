import properties from './properties.json' with { type: 'json' };
import { PluginProperty } from '../PluginProperty.js';
import { getSong } from '../../infinite-neck.js';

export class ArpeggioPlugin {
  constructor() {
    this.id = 'arpeggio';
    this.registeredName = 'Arpeggio';
    this.menuTrigger = 'a';
    this.eventNames = ['DaCapo:OnSongEnd', 'DaCapo:OnSectionBegin'];
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

  setPropertyValue(name, rawValue) {
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

    this.validateValues(nextValues);
    return property.setValue(rawValue);
  }

  resolveValue(fieldName) {
    if (fieldName === 'maxAllowedFret') {
      return this.getMaxAllowedFret();
    }
    return undefined;
  }

  enable() {
    return 'Arpeggio enabled';
  }

  disable() {
    return 'Arpeggio disabled';
  }

  handleEvent(eventName) {
    return this.invokeAction('apply', { eventName });
  }

  invokeAction(actionName) {
    switch (actionName) {
      case 'apply': {
        const summary = this.buildSummary();
        return { result: `Arpeggio applied: ${summary}` };
      }
      case 'help':
        return {
          result: 'Arpeggio help shown',
          message: `<pre>Arpeggio plugin\n\n- minFret / maxFret are validated against the current tuning\n- style is one of every, alternate, random\n- booleans currently require strict JSON true or false\n\nCurrent max allowed fret: ${this.getMaxAllowedFret()}</pre>`
        };
      default:
        return { result: `Unknown arpeggio action: ${actionName}` };
    }
  }

  buildSummary() {
    return `min=${this.getProperty('minFret')?.getValue()} max=${this.getProperty('maxFret')?.getValue()} style=${this.getProperty('style')?.getValue()} lowToHigh=${this.getProperty('lowToHigh')?.getValue()} upOnly=${this.getProperty('upOnly')?.getValue()}`;
  }

  getMaxAllowedFret() {
    const song = getSong();
    if (!song) {
      return 24;
    }

    let tunings = Array.isArray(song.myTunings) ? song.myTunings : [];
    const visibleTableIds = Array.isArray(song.visibleNoteTables) ? song.visibleNoteTables : [];
    if (visibleTableIds.length > 0) {
      tunings = tunings.filter((tuning) => visibleTableIds.includes(`table${tuning.baseID}`));
    }
    if (tunings.length === 0) {
      tunings = Array.isArray(song.myTunings) ? song.myTunings : [];
    }
    if (tunings.length === 0) {
      return 24;
    }
    return Math.max(...tunings.map((tuning) => Number.parseInt(tuning.frets, 10) || 0));
  }

  validateValues(values) {
    const maxAllowedFret = this.getMaxAllowedFret();
    if (values.minFret < 0 || values.minFret > maxAllowedFret) {
      throw new Error(`minFret must be between 0 and ${maxAllowedFret}`);
    }
    if (values.maxFret < 0 || values.maxFret > maxAllowedFret) {
      throw new Error(`maxFret must be between 0 and ${maxAllowedFret}`);
    }
    if (values.minFret > values.maxFret) {
      throw new Error('minFret must be less than or equal to maxFret');
    }
  }
}

export default ArpeggioPlugin;
