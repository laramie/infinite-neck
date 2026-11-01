import properties from './properties.json' with { type: 'json' };
import { PluginProperty, buildCaption, buildValueReference } from '../PluginProperty.js';
import { MenuItemProxy } from '../MenuItemProxy.js';
import { buildPluginEventsHelpFooter, buildPluginHelpHeader } from '../pluginHelp.js';
import { getSong } from '../../infinite-neck.js';
import { GraveType } from '../../graveyard.js';
import { Note } from '../../Note.js';
import EventBus from '../../event-bus.js';
import { allTunings } from '../../tunings.js';
import {
  MAP_CHOICE_TRIGGERS,
  MAX_USER_MAPS,
  applyStringMap,
  findMapIgnoringCase,
  listMidiPasteMaps,
  normalizeMapId,
  parseAddInput,
  parseMapSpec,
  prepareStringPairs,
  resolveMidiPasteMap
} from './midiPasteMaps.js';
import {
  TARGET_TABLE_OPTION_LIMIT,
  canMidiPasteBetweenTunings,
  createTuningLayout,
  getCellByRowCol,
  getCellByRowMidi,
  isMidiOnlyListenerProjection,
  projectListenerPlayedNotes,
  getTableID,
  getTuningCompatibilityID
} from '../../move-helpers.js';

const CLIP_SCHEMA_VERSION = 1;
const INCLUDED_STYLE_ORDER = [
  ['named', null],
  ['single', Note.STYLENUM_SINGLE],
  ['tiny', Note.STYLENUM_TINY],
  ['bend', Note.STYLENUM_BEND],
  ['fingering', Note.STYLENUM_FINGERING]
];
const RECORDED_FLATTEN_STYLE_ORDER = [
  Note.STYLENUM_SINGLE,
  Note.STYLENUM_TINY,
  Note.STYLENUM_BEND,
  Note.STYLENUM_FINGERING,
  Note.STYLENUM_MIDIPITCHES,
  Note.STYLENUM_MIDIPITCHESSINGLE
];

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeClipKey(rawValue, fallbackValue) {
  const normalized = `${rawValue || ''}`
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 _\-']/g, '');
  return normalized || fallbackValue;
}

function stripOwner(note) {
  const clone = cloneValue(note || {});
  delete clone.owner;
  return clone;
}

function toInteger(value, fallbackValue = -1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallbackValue;
}

function playedCollisionKey(note) {
  return `${note?.styleNum}:${note?.row}:${note?.col}`;
}

function recordedCollisionKey(note) {
  return `${note?.styleNum}:${note?.row}:${note?.col}`;
}

function getMidiPitchArray(tuning) {
  if (Array.isArray(tuning?.midiPitches)) {
    return [...tuning.midiPitches];
  }
  if (Array.isArray(tuning?.rowRange)) {
    return [...tuning.rowRange];
  }
  return [];
}

function arraysEqual(left = [], right = []) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => `${value}` === `${right[index]}`);
}

function valuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function tuningStringCount(tuning) {
  const explicit = toInteger(tuning?.nStrings, 0);
  if (explicit > 0) {
    return explicit;
  }
  return Array.isArray(tuning?.rowRange) ? tuning.rowRange.length : 0;
}

function getMaxRecordedCol(payload) {
  let maxCol = 0;
  Object.values(payload?.recordedNotesByBeat || {}).forEach((notes = []) => {
    (notes || []).forEach((note) => {
      const col = toInteger(note?.col, -1);
      if (col > maxCol) {
        maxCol = col;
      }
    });
  });
  return maxCol;
}

function clipCountLabel(counts) {
  return INCLUDED_STYLE_ORDER
    .map(([kind]) => [kind, counts[kind] || 0])
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind}-${count}`)
    .join('-');
}

function getRecordCompatibilityID(record) {
  const payload = JSON.parse(record?.json || '{}');
  return getTuningCompatibilityID(record?.context) || getTuningCompatibilityID(payload?.source);
}

function isRecordedNotesClipRecord(record) {
  if (record?.context?.clipKind === 'recordedNotes') {
    return true;
  }
  try {
    const payload = JSON.parse(record?.json || '{}');
    return payload?.clipKind === 'recordedNotes';
  } catch (error) {
    return false;
  }
}

function createReviveSummary() {
  return {
    namedAdded: 0,
    namedOverwritten: 0,
    namedSkipped: 0,
    playedAdded: 0,
    playedOverwritten: 0,
    playedSkipped: 0,
    droppedOutOfRange: 0
  };
}

export class ClipPlugin {
  constructor() {
    this.id = 'clip';
    this.registeredName = 'clip';
    this.menuTrigger = 'c';
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

  refreshDynamicPropertyOptions(song = getSong()) {
    const property = this.getProperty('targetTable');
    if (!property) {
      return;
    }
    property.options = this.buildTargetTableOptions(song);
    this.ensureTargetTableSelection(song);
  }

  buildTargetTableOptions(song = getSong()) {
    return this.getEligibleTargetTunings(song)
      .slice(0, TARGET_TABLE_OPTION_LIMIT)
      .map((tuning, index) => ({
        value: getTableID(tuning),
        caption: `${index + 1}) ${tuning.baseID}`,
        trigger: `${index + 1}`
      }));
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

  getEligibleTargetTunings(song = getSong()) {
    if (!song || !Array.isArray(song.myTunings)) {
      return [];
    }
    return song.myTunings.filter((tuning) => tuning && tuning.baseID);
  }

  getSelectedTargetTableID() {
    return `${this.getProperty('targetTable')?.getValue() || ''}`;
  }

  getSelectedTargetTuning(song = getSong()) {
    const eligibleTunings = this.getEligibleTargetTunings(song);
    if (eligibleTunings.length === 0) {
      return null;
    }
    const selectedTableID = this.getSelectedTargetTableID();
    return eligibleTunings.find((tuning) => getTableID(tuning) === selectedTableID) || eligibleTunings[0] || null;
  }

  getCurrentSection(song = getSong()) {
    return song && typeof song.getCurrentSection === 'function' ? song.getCurrentSection() : null;
  }

  getVisibleMenuChildren() {
    const song = this.manager?.song || getSong();
    this.refreshDynamicPropertyOptions(song);
    return [
      this.getProperty('targetTable').getMenuNodeSpec(this),
      this.buildCopyMenuNode('copyToGraveyard', 'C copy', 'C'),
      this.buildCopyMenuNode('cutToGraveyard', 'X cut', 'X'),
      this.buildReviveMenuNode(song),
      this.buildMidiPasteMenuNode(song),
      this.buildCopyMenuNode('copyListenedToGraveyard', 'L copy Listened notes', 'L', 'defaultListenerClipName'),
      this.buildMidiPasteMapMenuNode(),
      this.getProperty('automatic').getMenuNodeSpec(this),
      this.getProperty('overwrite').getMenuNodeSpec(this),
      this.buildIncludeMenuNode(song),
      this.buildRecordedNotesMenuNode(song),
      this.buildClearClipsNode(),
      this.getProperty('help').getMenuNodeSpec(this)
    ].filter(Boolean);
  }

  buildCopyMenuNode(actionName, caption, trigger, defaultFieldName = 'defaultClipName') {
    const automatic = !!this.getProperty('automatic')?.getValue();
    const spec = {
      name: actionName,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName,
      popOnBang: !automatic
    };

    if (!automatic) {
      spec.input = {
        type: 'input',
        caption: 'clip name',
        default: `plugin:${this.id}:${defaultFieldName}`,
        datatype: 'string',
        id: 'value'
      };
    }

    return new MenuItemProxy(this, spec);
  }

  buildReviveMenuNode(song = getSong()) {
    const token = `plugin:${this.id}:reviveSummary`;
    const automatic = !!this.getProperty('automatic')?.getValue();
    const spec = {
      name: 'reviveFromGraveyard',
      caption: `${buildCaption('V paste', 'V')}${buildValueReference(token)}`,
      trigger: 'V',
      vars: [token],
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: 'reviveClipChoice',
      popOnBang: !automatic
    };

    if (!automatic) {
      spec.input = {
        type: 'input',
        caption: 'clip number',
        default: `plugin:${this.id}:defaultReviveChoice`,
        datatype: 'string',
        id: 'value',
        children: this.buildReviveChoicePreviewNodes(song)
      };
    }

    return new MenuItemProxy(this, spec);
  }

  buildReviveChoicePreviewNodes(song = getSong()) {
    const records = this.getCompatibleClipRecords(song);
    return this.buildChoicePreviewNodes(records, 'revive');
  }

  buildMidiPasteMenuNode(song = getSong()) {
    const token = `plugin:${this.id}:midiPasteSummary`;
    const automatic = !!this.getProperty('automatic')?.getValue();
    const spec = {
      name: 'midiPasteFromGraveyard',
      caption: `${buildCaption('MIDI Paste', 'M')}${buildValueReference(token)}`,
      trigger: 'M',
      vars: [token],
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: 'midiPasteClipChoice',
      popOnBang: !automatic
    };

    if (!automatic) {
      spec.input = {
        type: 'input',
        caption: 'clip number',
        default: `plugin:${this.id}:defaultMidiPasteChoice`,
        datatype: 'string',
        id: 'value',
        children: this.buildMidiPasteChoicePreviewNodes(song)
      };
    }

    return new MenuItemProxy(this, spec);
  }

  buildMidiPasteChoicePreviewNodes(song = getSong()) {
    const records = this.getMidiPasteClipRecords(song);
    return this.buildChoicePreviewNodes(records, 'midi-paste');
  }

  buildMidiPasteMapMenuNode() {
    return new MenuItemProxy(this, {
      name: 'midiPasteMap',
      caption: buildCaption('midi paste map', 'm'),
      trigger: 'm',
      children: [
        this.buildMidiPasteMapSelectNode(),
        new MenuItemProxy(this, {
          name: 'midiPasteMapAdd',
          caption: buildCaption('add', 'a'),
          trigger: 'a',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'addMidiPasteMap',
          popOnBang: true,
          input: {
            type: 'input',
            caption: '"id" 1:2, 3:4',
            datatype: 'string',
            id: 'value'
          }
        }),
        this.buildMidiPasteMapDeleteNode(),
        new MenuItemProxy(this, {
          name: 'midiPasteMapList',
          caption: buildCaption('list', 'l'),
          trigger: 'l',
          action: 'pluginAction:invoke',
          pluginId: this.id,
          actionName: 'listMidiPasteMaps',
          popOnBang: false
        })
      ]
    });
  }

  buildMidiPasteMapSelectNode() {
    const token = `plugin:${this.id}:midiPasteMapId`;
    const activeId = this.getActiveMidiPasteMapId();
    const choices = listMidiPasteMaps(this.getUserMidiPasteMaps())
      .slice(0, MAP_CHOICE_TRIGGERS.length)
      .map((map, index) => new MenuItemProxy(this, {
        name: `midiPasteMapSelect:${map.id}`,
        caption: `<b>${MAP_CHOICE_TRIGGERS[index]}</b>) ${escapeHtml(map.id)}${map.id === activeId ? ' &#x2713;' : ''}`,
        trigger: MAP_CHOICE_TRIGGERS[index],
        action: 'pluginAction:invoke',
        pluginId: this.id,
        actionName: `selectMidiPasteMap:${encodeURIComponent(map.id)}`,
        popOnBang: true
      }));
    choices.push(new MenuItemProxy(this, {
      name: 'midiPasteMapSelect:none',
      caption: buildCaption('none', 'n'),
      trigger: 'n',
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: 'selectMidiPasteMap:',
      popOnBang: true
    }));
    return new MenuItemProxy(this, {
      name: 'midiPasteMapSelect',
      caption: `${buildCaption('map', 'm')} [${buildValueReference(token)}]`,
      trigger: 'm',
      vars: [token],
      children: choices
    });
  }

  buildMidiPasteMapDeleteNode() {
    const userMaps = this.getUserMidiPasteMaps().slice(0, MAP_CHOICE_TRIGGERS.length);
    const children = userMaps.length > 0
      ? userMaps.map((map, index) => new MenuItemProxy(this, {
        name: `midiPasteMapDelete:${map.id}`,
        caption: `<b>${MAP_CHOICE_TRIGGERS[index]}</b>) ${escapeHtml(map.id)}`,
        trigger: MAP_CHOICE_TRIGGERS[index],
        children: [
          new MenuItemProxy(this, {
            name: `midiPasteMapDeleteYes:${map.id}`,
            caption: `<b>Y</b>es: delete ${escapeHtml(map.id)}`,
            trigger: 'Y',
            action: 'pluginAction:invoke',
            pluginId: this.id,
            actionName: `deleteMidiPasteMap:${encodeURIComponent(map.id)}`,
            popOnBang: true
          }),
          new MenuItemProxy(this, {
            name: `midiPasteMapDeleteNo:${map.id}`,
            caption: '<b>n</b>o: keep map',
            trigger: 'n',
            action: 'pluginAction:invoke',
            pluginId: this.id,
            actionName: 'keepMidiPasteMap',
            popOnBang: true
          })
        ]
      }))
      : [new MenuItemProxy(this, {
        name: 'midiPasteMapDelete:none',
        caption: 'no maps of your own',
        trigger: ''
      })];
    return new MenuItemProxy(this, {
      name: 'midiPasteMapDelete',
      caption: buildCaption('delete', 'd'),
      trigger: 'd',
      children
    });
  }

  buildChoicePreviewNodes(records = [], prefix = 'clip') {
    if (records.length === 0) {
      return [
        {
          name: `${prefix}:none`,
          caption: '0) none',
          trigger: ''
        }
      ];
    }

    return records.map(({ record }, index) => {
      const label = this.getClipRecordLabel(record, index + 1);
      return {
        name: `${prefix}:preview:${index + 1}`,
        caption: `${index + 1}) ${label}`,
        trigger: ''
      };
    });
  }

  getClipRecordLabel(record, fallbackIndex = 0) {
    return record?.context?.userKey || record?.context?.caption || `clip ${fallbackIndex}`;
  }

  buildIncludeMenuNode(song = getSong()) {
    const token = `plugin:${this.id}:includeSummary`;
    return new MenuItemProxy(this, {
      name: 'include',
      caption: `${buildCaption('include', 'i')}${buildValueReference(token)}`,
      trigger: 'i',
      vars: [token],
      children: [
        this.getProperty('includeNamed').getMenuNodeSpec(this),
        this.getProperty('includeSingle').getMenuNodeSpec(this),
        this.getProperty('includeTiny').getMenuNodeSpec(this),
        this.getProperty('includeBend').getMenuNodeSpec(this),
        this.getProperty('includeFingering').getMenuNodeSpec(this)
      ]
    });
  }

  buildRecordedActionNode(actionName, caption, trigger) {
    return new MenuItemProxy(this, {
      name: actionName,
      caption: buildCaption(caption, trigger),
      trigger,
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName,
      popOnBang: false
    });
  }

  buildRecordedStatusNode() {
    const token = `plugin:${this.id}:recordedStatus`;
    return new MenuItemProxy(this, {
      name: 'recordedStatus',
      caption: `status: [${buildValueReference(token)}]`,
      trigger: '',
      vars: [token]
    });
  }

  buildRecordedMidiPasteNode() {
    return this.getProperty('recordedMidiPaste').getMenuNodeSpec(this);
  }

  buildRecordedNotesMenuNode(song = getSong()) {
    return new MenuItemProxy(this, {
      name: 'recordedNotes',
      caption: buildCaption('recorded notes', 'r'),
      trigger: 'r',
      children: [
        new MenuItemProxy(this, {
          name: 'recordedNotesCopy',
          caption: buildCaption('copy', 'c'),
          trigger: 'c',
          children: [
            this.buildRecordedStatusNode(song),
            this.buildRecordedActionNode('copyRecordedCurrentBeat', 'current beat', 'c'),
            this.buildRecordedActionNode('copyRecordedAllBeats', 'all beats', 'a')
          ]
        }),
        new MenuItemProxy(this, {
          name: 'recordedNotesPaste',
          caption: buildCaption('paste', 'p'),
          trigger: 'p',
          children: [
            this.buildRecordedStatusNode(song),
            this.buildRecordedMidiPasteNode(song),
            this.buildRecordedActionNode('pasteRecordedAddAllBeats', 'add all beats', 'a'),
            this.buildRecordedActionNode('pasteRecordedInsertAllBeats', 'insert all beats', 'i'),
            this.buildRecordedActionNode('pasteRecordedPlayIntoCurrent', 'play beats into current', 'p'),
            this.buildRecordedActionNode('pasteRecordedSqueezeCurrentBeat', 'squeeze beats into current beat', 's'),
            this.buildRecordedActionNode('pasteRecordedFlattenToPlayedNotes', 'flatten beats into playedNotes', 'f')
          ]
        })
      ]
    });
  }

  buildClearClipsNode() {
    return new MenuItemProxy(this, {
      name: 'clearClips',
      caption: buildCaption('clear clipped notes', 'c'),
      trigger: 'c',
      action: 'pluginAction:invoke',
      pluginId: this.id,
      actionName: 'clearClips',
      popOnBang: false
    });
  }

  resetToDefaults() {
    this.properties.forEach((property) => property.reset());
  }

  loadSongState(persistedProperties = {}, context = {}) {
    this.resetToDefaults();
    this.refreshDynamicPropertyOptions(context.song || getSong());
    Object.entries(persistedProperties).forEach(([name, value]) => {
      const property = this.getProperty(name);
      if (!property || property.datatype === 'org.dynamide.Action') {
        return;
      }
      if (name === 'midiPasteUserMaps' || name === 'midiPasteMapId') {
        // A damaged stored map must never block opening the Song.
        try {
          this.setPropertyValue(name, value, context);
        } catch (error) {
          this.emitUserLogMessage(`MIDI Paste map data "${escapeHtml(name)}" ignored: ${escapeHtml(error.message)}`);
        }
        return;
      }
      this.setPropertyValue(name, value, context);
    });
    this.sanitizeMidiPasteMapState();
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
      throw new Error(`ClipPlugin unknown property: ${name}`);
    }
    this.refreshDynamicPropertyOptions(context.song || getSong());
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
      return ` ${this.buildIncludeSummary(song)}`;
    }
    if (fieldName === 'defaultClipName') {
      return this.buildDefaultClipName(song);
    }
    if (fieldName === 'defaultListenerClipName') {
      return this.buildDefaultClipName(song, this.collectListenerClipPayload(song));
    }
    if (fieldName === 'defaultReviveChoice') {
      return this.getCompatibleClipRecords(song).length > 0 ? '1' : '';
    }
    if (fieldName === 'defaultMidiPasteChoice') {
      return this.getMidiPasteClipRecords(song).length > 0 ? '1' : '';
    }
    if (fieldName === 'midiPasteMapId') {
      return escapeHtml(this.getActiveMidiPasteMapId() || 'none');
    }
    if (fieldName === 'recordedStatus') {
      return this.buildRecordedStatus(song);
    }
    if (fieldName === 'reviveSummary') {
      const records = this.getCompatibleClipRecords(song);
      const latestLabel = this.getClipRecordLabel(records[0]?.record) || 'none';
      return ` [${records.length}:${latestLabel}]`;
    }
    if (fieldName === 'midiPasteSummary') {
      const records = this.getMidiPasteClipRecords(song);
      const latestLabel = this.getClipRecordLabel(records[0]?.record) || 'none';
      return ` [${records.length}:${latestLabel}]`;
    }
    return undefined;
  }

  enable() {
    return 'Clip enabled';
  }

  disable() {
    return 'Clip disabled';
  }

  invokeAction(actionName, context = {}) {
    const song = context.song || this.manager?.song || getSong();
    switch (actionName) {
      case 'copyToGraveyard':
        return this.copyOrCut(song, context.args, false);
      case 'cutToGraveyard':
        return this.copyOrCut(song, context.args, true);
      case 'copyListenedToGraveyard':
        return this.copyListened(song, context.args);
      case 'copyRecordedCurrentBeat':
        return this.copyRecordedNotes(song, false);
      case 'copyRecordedAllBeats':
        return this.copyRecordedNotes(song, true);
      case 'pasteRecordedAddAllBeats':
        return this.pasteRecordedNotes(song, 'add');
      case 'pasteRecordedInsertAllBeats':
        return this.pasteRecordedNotes(song, 'insert');
      case 'pasteRecordedPlayIntoCurrent':
        return this.pasteRecordedNotes(song, 'play');
      case 'pasteRecordedSqueezeCurrentBeat':
        return this.pasteRecordedNotes(song, 'squeeze');
      case 'pasteRecordedFlattenToPlayedNotes':
        return this.pasteRecordedNotes(song, 'flatten');
      case 'clearClips':
        return this.clearClips(song);
      case 'addMidiPasteMap':
        return this.addMidiPasteMap(context.args?.value);
      case 'listMidiPasteMaps':
        return this.listMidiPasteMapsMessage();
      case 'keepMidiPasteMap':
        return { result: 'MIDI Paste map kept' };
      case 'help':
        return {
          result: 'Clip help shown',
          message: this.buildHelpMessage(song)
        };
      default:
        if (actionName === 'reviveClipChoice') {
          return this.reviveClipChoice(song, context.args?.value);
        }
        if (actionName === 'midiPasteClipChoice') {
          return this.midiPasteClipChoice(song, context.args?.value);
        }
        if (actionName.startsWith('selectMidiPasteMap:')) {
          return this.selectMidiPasteMap(decodeURIComponent(actionName.slice('selectMidiPasteMap:'.length)));
        }
        if (actionName.startsWith('deleteMidiPasteMap:')) {
          return this.deleteMidiPasteMap(decodeURIComponent(actionName.slice('deleteMidiPasteMap:'.length)));
        }
        if (actionName.startsWith('reviveClip:')) {
          return this.reviveClip(song, actionName.slice('reviveClip:'.length));
        }
        return { result: `Unknown clip action: ${actionName}` };
    }
  }

  buildSummary(song = getSong()) {
    const tuning = this.getSelectedTargetTuning(song);
    return `target table=${this.resolveValue('targetTable', { song }) || '<none>'} automatic=${this.getProperty('automatic')?.getValue()} overwrite=${this.getProperty('overwrite')?.getValue()} include=${this.buildIncludeSummary(song)} compatible clips=${this.getCompatibleClipRecords(song).length} midi clips=${this.getMidiPasteClipRecords(song).length} tuning=${tuning?.baseID || '<none>'}`;
  }

  buildHelpMessage(song = getSong()) {
    return `<pre>${buildPluginHelpHeader(this, 'Clip plugin:', this.buildSummary(song))}

Copies, cuts, and revives clip records for the current section and selected table.

- automatic = ${this.getProperty('automatic')?.getValue()}
- overwrite = ${this.getProperty('overwrite')?.getValue()}
- recorded midi paste = ${this.getProperty('recordedMidiPaste')?.getValue()}
- include = ${this.buildIncludeSummary(song)}
- target table = ${this.resolveValue('targetTable', { song }) || '<none>'}
- compatible clips = ${this.getCompatibleClipRecords(song).length}
- MIDI Paste clips = ${this.getMidiPasteClipRecords(song).length}
- clip records live in the Graveyard as type CLIP
- RecordedNotes copy/paste supports same-lineage, same-pitch beat clips
- supported played-note lanes include Single, Tiny, Bend, and optional Fingering
- cut removes only the included note lanes from the current section/table
- revive merges into the current section/table and drops out-of-range played notes
- MIDI Paste remaps played notes by MIDI. With no map selected it keeps the same string and works between 6-string guitars; with a midi paste map selected (m) it moves notes between the strings the map names, 1-based, string 1 at the top
- midi paste map = ${escapeHtml(this.getActiveMidiPasteMapId() || 'none')}; maps look like 1:1, 2:2 (source:dest), strings left out are skipped, and the reverse of A &gt; B is inferred
- Listener Copy captures listened-to model notes for true Listener tables only, ignores Observers, and projects played notes by row plus MIDI into the selected listener table before clipping

${buildPluginEventsHelpFooter(this)}</pre>`;
  }

  getIncludeConfig() {
    return {
      named: !!this.getProperty('includeNamed')?.getValue(),
      single: !!this.getProperty('includeSingle')?.getValue(),
      tiny: !!this.getProperty('includeTiny')?.getValue(),
      bend: !!this.getProperty('includeBend')?.getValue(),
      fingering: !!this.getProperty('includeFingering')?.getValue()
    };
  }

  getNoteCounts(song = getSong()) {
    const section = this.getCurrentSection(song);
    const tableID = this.getSelectedTargetTableID();
    if (!section || !tableID) {
      return { named: 0, single: 0, tiny: 0, bend: 0, fingering: 0 };
    }
    const sectionNotes = section.getSectionNotes(tableID);
    const playedNotes = sectionNotes?.playedNotes || [];
    return {
      named: Object.keys(sectionNotes?.namedNotes || {}).length,
      single: playedNotes.filter((note) => note?.styleNum === Note.STYLENUM_SINGLE).length,
      tiny: playedNotes.filter((note) => note?.styleNum === Note.STYLENUM_TINY).length,
      bend: playedNotes.filter((note) => note?.styleNum === Note.STYLENUM_BEND).length,
      fingering: playedNotes.filter((note) => note?.styleNum === Note.STYLENUM_FINGERING).length
    };
  }

  buildIncludeSummary(song = getSong()) {
    const include = this.getIncludeConfig();
    const counts = this.getNoteCounts(song);
    const active = [];
    if (include.named) active.push(`n:${counts.named}`);
    if (include.single) active.push(`s:${counts.single}`);
    if (include.tiny) active.push(`t:${counts.tiny}`);
    if (include.bend) active.push(`b:${counts.bend}`);
    if (include.fingering) active.push(`f:${counts.fingering}`);
    return active.length > 0 ? `[${active.join(',')}]` : '[none]';
  }

  getAuditInputs() {
    const include = this.getIncludeConfig();
    const active = [];
    if (include.named) active.push('n');
    if (include.single) active.push('s');
    if (include.tiny) active.push('t');
    if (include.bend) active.push('b');
    if (include.fingering) active.push('f');
    const includePropertyNames = ['includeNamed', 'includeSingle', 'includeTiny', 'includeBend', 'includeFingering'];
    const changed = includePropertyNames.some((propertyName) => {
      const property = this.getProperty(propertyName);
      return property ? !valuesEqual(property.getValue(), property.getDefaultValue()) : false;
    });
    const value = active.length > 0 ? `include:${active.join(',')}` : 'include:';
    return { value, changed };
  }

  getAuditOutputs() {
    return undefined;
  }

  buildDefaultClipName(song = getSong(), payload = null) {
    const now = new Date();
    const hhmm = `${now.getHours()}`.padStart(2, '0') + `${now.getMinutes()}`.padStart(2, '0');
    const counts = this.collectClipCounts(song, payload);
    const label = clipCountLabel(counts);
    return label ? `${label}-${hhmm}` : `empty-${hhmm}`;
  }

  collectClipCounts(song = getSong(), payload = null) {
    const resolvedPayload = payload || this.collectClipPayload(song);
    return resolvedPayload ? resolvedPayload.counts : { named: 0, single: 0, tiny: 0, bend: 0, fingering: 0 };
  }

  createEmptyClipPayload(tuning, tableID, include) {
    return {
      schemaVersion: CLIP_SCHEMA_VERSION,
      source: {
        tableID,
        baseID: tuning.baseID,
        fromBaseID: tuning.fromBaseID || tuning.baseID,
        baseInstrument: tuning.baseInstrument,
        nStrings: tuning.nStrings,
        rowRange: Array.isArray(tuning.rowRange) ? [...tuning.rowRange] : [],
        frets: tuning.frets,
        nut: tuning.nut,
        reverse: tuning.reverse
      },
      include: { ...include },
      counts: {
        named: 0,
        single: 0,
        tiny: 0,
        bend: 0,
        fingering: 0
      },
      sectionNotes: {
        namedNotes: {},
        playedNotes: []
      }
    };
  }

  addNamedNotesToPayload(payload, sectionNotes, include) {
    if (!include.named) {
      return;
    }
    Object.entries(sectionNotes?.namedNotes || {}).forEach(([noteName, note]) => {
      const clippedNote = stripOwner(note);
      clippedNote.noteName = clippedNote.noteName || noteName;
      payload.sectionNotes.namedNotes[noteName] = clippedNote;
      payload.counts.named += 1;
    });
  }

  addPlayedNoteToPayload(payload, note) {
    payload.sectionNotes.playedNotes.push(stripOwner(note));
    if (note?.styleNum === Note.STYLENUM_SINGLE) {
      payload.counts.single += 1;
    }
    if (note?.styleNum === Note.STYLENUM_TINY) {
      payload.counts.tiny += 1;
    }
    if (note?.styleNum === Note.STYLENUM_BEND) {
      payload.counts.bend += 1;
    }
    if (note?.styleNum === Note.STYLENUM_FINGERING) {
      payload.counts.fingering += 1;
    }
  }

  includesPlayedStyle(include, styleNum) {
    return (
      (styleNum === Note.STYLENUM_SINGLE && include.single)
      || (styleNum === Note.STYLENUM_TINY && include.tiny)
      || (styleNum === Note.STYLENUM_BEND && include.bend)
      || (styleNum === Note.STYLENUM_FINGERING && include.fingering)
    );
  }

  addPlayedNotesToPayload(payload, sectionNotes, include) {
    (sectionNotes?.playedNotes || []).forEach((note) => {
      if (this.includesPlayedStyle(include, note?.styleNum)) {
        this.addPlayedNoteToPayload(payload, note);
      }
    });
  }

  getTuningByTableID(song = getSong(), tableID = '') {
    return this.getEligibleTargetTunings(song).find((tuning) => getTableID(tuning) === `${tableID}`) || null;
  }

  getSelectedListenerSelection(song = getSong()) {
    const targetTableID = this.getSelectedTargetTableID();
    if (!song || !targetTableID || !Array.isArray(song.wirings)) {
      return null;
    }
    const wiring = song.wirings.find((candidate) => candidate?.tablename === targetTableID) || null;
    if (!wiring || !wiring.listenToTablename || wiring.relativeSection) {
      return null;
    }
    return {
      targetTableID,
      sourceTableID: `${wiring.listenToTablename}`,
      wiring
    };
  }

  collectClipPayload(song = getSong()) {
    const section = this.getCurrentSection(song);
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    if (!section || !tuning || !tableID) {
      return null;
    }
    const include = this.getIncludeConfig();
    const sectionNotes = section.getSectionNotes(tableID);
    const payload = this.createEmptyClipPayload(tuning, tableID, include);

    this.addNamedNotesToPayload(payload, sectionNotes, include);
    this.addPlayedNotesToPayload(payload, sectionNotes, include);

    return payload;
  }

  collectListenerClipPayload(song = getSong()) {
    const section = this.getCurrentSection(song);
    const selection = this.getSelectedListenerSelection(song);
    const targetTuning = this.getSelectedTargetTuning(song);
    const sourceTuning = this.getTuningByTableID(song, selection?.sourceTableID);
    if (!section || !selection || !targetTuning || !sourceTuning) {
      return null;
    }

    const include = this.getIncludeConfig();
    const sourceSectionNotes = section.getSectionNotes(selection.sourceTableID);
    const payload = this.createEmptyClipPayload(targetTuning, selection.targetTableID, include);
    const sourceLayout = createTuningLayout(sourceTuning);
    const targetLayout = createTuningLayout(targetTuning);
    const listenerProjection = `${selection?.wiring?.listenerProjection || 'row-midi'}`;

    this.addNamedNotesToPayload(payload, sourceSectionNotes, include);

    if (isMidiOnlyListenerProjection(listenerProjection)) {
      const projectedPlayedNotes = projectListenerPlayedNotes({
        playedNotes: sourceSectionNotes?.playedNotes || [],
        sourceTuning,
        targetTuning,
        listenerProjection
      });
      projectedPlayedNotes.forEach((note) => {
        if (!this.includesPlayedStyle(include, note?.styleNum)) {
          return;
        }
        this.addPlayedNoteToPayload(payload, note);
      });
    } else {
      (sourceSectionNotes?.playedNotes || []).forEach((note) => {
        if (!this.includesPlayedStyle(include, note?.styleNum)) {
          return;
        }
        const candidate = this.buildMidiPasteCandidate(note, sourceLayout, targetLayout);
        if (!candidate) {
          return;
        }
        this.addPlayedNoteToPayload(payload, candidate);
      });
    }

    return payload;
  }

  buildRecordedStatus(song = getSong()) {
    const section = this.getCurrentSection(song);
    const tableID = this.getSelectedTargetTableID();
    const tableLabel = tableID?.startsWith('tbl') ? tableID.slice(3) : (tableID || 'none');
    const sectionIndex = Array.isArray(song?.sections) && section ? song.sections.indexOf(section) : -1;
    const sectionNumber = sectionIndex >= 0 ? sectionIndex + 1 : '?';
    const beatNumber = section?.getBeat?.() || '?';
    return `${tableLabel}:${sectionNumber}:${beatNumber}`;
  }

  createRecordedClipPayload(song = getSong(), copyAllBeats = false) {
    const section = this.getCurrentSection(song);
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    if (!section || !tuning || !tableID) {
      return null;
    }
    const sectionNotes = section.getSectionNotes(tableID);
    const beatCount = section.getBeats?.() || 0;
    const currentBeat = section.getBeat?.() || 1;
    const sourceBeatNumbers = copyAllBeats
      ? Array.from({ length: beatCount }, (_, index) => index + 1)
      : [currentBeat];
    const recordedNotesByBeat = {};
    let noteCount = 0;
    sourceBeatNumbers.forEach((beatNumber) => {
      const notes = (sectionNotes?.recordedNotes?.[`${beatNumber}`] || []).map((note) => stripOwner(note));
      recordedNotesByBeat[`${beatNumber}`] = notes;
      noteCount += notes.length;
    });
    const sectionIndex = Array.isArray(song?.sections) ? song.sections.indexOf(section) : -1;
    return {
      schemaVersion: CLIP_SCHEMA_VERSION,
      clipKind: 'recordedNotes',
      source: {
        tableID,
        baseID: tuning.baseID,
        fromBaseID: tuning.fromBaseID || tuning.baseID,
        baseInstrument: tuning.baseInstrument,
        sectionIndex,
        sectionNumber: sectionIndex >= 0 ? sectionIndex + 1 : null,
        beatNumber: currentBeat,
        beatCount,
        nStrings: tuning.nStrings,
        midiPitches: getMidiPitchArray(tuning),
        rowRange: getMidiPitchArray(tuning),
        frets: tuning.frets,
        nut: tuning.nut,
        reverse: tuning.reverse
      },
      recordedNotesByBeat,
      sourceBeatNumbers,
      counts: {
        beats: sourceBeatNumbers.length,
        notes: noteCount
      }
    };
  }

  buildDefaultRecordedClipName(song = getSong(), payload = null) {
    const resolvedPayload = payload || this.createRecordedClipPayload(song, false);
    const now = new Date();
    const hhmm = `${now.getHours()}`.padStart(2, '0') + `${now.getMinutes()}`.padStart(2, '0');
    return `recorded-${resolvedPayload?.counts?.beats || 0}b-${resolvedPayload?.counts?.notes || 0}n-${hhmm}`;
  }

  copyRecordedNotes(song = getSong(), copyAllBeats = false) {
    const payload = this.createRecordedClipPayload(song, copyAllBeats);
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    if (!song?.graveyard || !payload || !tuning || !tableID) {
      return { result: 'recorded copy skipped: no current section or target table' };
    }
    if (!copyAllBeats && payload.counts.notes === 0) {
      return { result: 'recorded copy skipped: current beat empty' };
    }
    const userKey = this.buildDefaultRecordedClipName(song, payload);
    const context = {
      caption: userKey,
      userKey,
      logicalKey: `recordedClip::${userKey}`,
      clipKind: 'recordedNotes',
      tableID,
      baseID: tuning.baseID,
      fromBaseID: tuning.fromBaseID || tuning.baseID,
      schemaVersion: CLIP_SCHEMA_VERSION,
      counts: { ...payload.counts }
    };
    song.graveyard.bury(GraveType.CLIP, payload, context);
    return {
      result: `recorded copied ${payload.counts.beats} beats, ${payload.counts.notes} notes as ${userKey}`
    };
  }

  getRecordedClipRecords(song = getSong()) {
    const records = song?.graveyard?.records;
    if (!Array.isArray(records)) {
      return [];
    }
    const result = [];
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index];
      if (record?.type !== GraveType.CLIP) {
        continue;
      }
      let payload = null;
      try {
        payload = JSON.parse(record.json || '{}');
      } catch (error) {
        continue;
      }
      if (payload?.clipKind !== 'recordedNotes' && record?.context?.clipKind !== 'recordedNotes') {
        continue;
      }
      result.push({ record, index, payload });
    }
    return result;
  }

  normalizeRecordedSourceBeats(payload) {
    const sourceBeatNumbers = Array.isArray(payload?.sourceBeatNumbers)
      ? payload.sourceBeatNumbers
      : Object.keys(payload?.recordedNotesByBeat || {}).map((key) => Number.parseInt(key, 10)).filter(Number.isInteger).sort((a, b) => a - b);
    return sourceBeatNumbers.map((beatNumber) => ({
      originalBeatNumber: beatNumber,
      notes: (payload?.recordedNotesByBeat?.[`${beatNumber}`] || []).map((note) => new Note(stripOwner(note)))
    }));
  }

  isRecordedMidiPasteEnabled() {
    return this.getProperty('recordedMidiPaste')?.getValue() === true;
  }

  getRecordedSourceTuning(payload, targetTuning = {}) {
    const source = payload?.source || {};
    const rowRange = Array.isArray(source.rowRange)
      ? [...source.rowRange]
      : (Array.isArray(source.midiPitches) ? [...source.midiPitches] : []);
    return {
      ...source,
      rowRange,
      midiPitches: Array.isArray(source.midiPitches) ? [...source.midiPitches] : [...rowRange],
      frets: source.frets ?? targetTuning?.frets ?? getMaxRecordedCol(payload),
      nut: source.nut ?? targetTuning?.nut ?? true,
      reverse: source.reverse ?? targetTuning?.reverse ?? false,
      nStrings: source.nStrings || rowRange.length,
      baseInstrument: source.baseInstrument || targetTuning?.baseInstrument || ''
    };
  }

  mapRecordedSourceBeatsForMidiPaste(sourceBeats, sourceTuning, targetTuning, resolvedMap = null) {
    if (resolvedMap) {
      const run = this.startStringMapRun(sourceTuning, targetTuning, resolvedMap);
      const mappedBeats = sourceBeats.map((sourceBeat) => ({
        ...sourceBeat,
        notes: this.mapNotesInStringMapRun(run, sourceBeat.notes)
      }));
      this.finishStringMapRun(run);
      return { sourceBeats: mappedBeats, droppedOutOfRange: run.dropped, mapRun: run };
    }
    const sourceLayout = createTuningLayout(sourceTuning);
    const targetLayout = createTuningLayout(targetTuning);
    let droppedOutOfRange = 0;
    const mappedSourceBeats = sourceBeats.map((sourceBeat) => ({
      ...sourceBeat,
      notes: sourceBeat.notes.map((note) => {
        const candidate = this.buildMidiPasteCandidate(note, sourceLayout, targetLayout);
        if (!candidate) {
          droppedOutOfRange += 1;
          return null;
        }
        return candidate;
      }).filter(Boolean)
    }));
    return { sourceBeats: mappedSourceBeats, droppedOutOfRange };
  }

  getRecordedPasteContext(song = getSong()) {
    const records = this.getRecordedClipRecords(song);
    const selected = records[0];
    const section = this.getCurrentSection(song);
    const targetTuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    if (!selected) {
      return { error: 'no recordedNotes clip' };
    }
    if (!section || !targetTuning || !tableID) {
      return { error: 'no current section or target table' };
    }
    const source = selected.payload?.source || {};
    const sourceTuning = this.getRecordedSourceTuning(selected.payload, targetTuning);
    let sourceBeats = this.normalizeRecordedSourceBeats(selected.payload);
    if (sourceBeats.length === 0) {
      return { error: 'recordedNotes clip is empty' };
    }
    const exactPitchLayout = `${sourceTuning.nStrings || ''}` === `${targetTuning.nStrings || ''}`
      && arraysEqual(sourceTuning.midiPitches || [], getMidiPitchArray(targetTuning));
    let droppedOutOfRange = 0;
    let mapRun = null;
    const recordedMidiPaste = this.isRecordedMidiPasteEnabled();
    if (!recordedMidiPaste) {
      if (getTuningCompatibilityID(source) !== getTuningCompatibilityID(targetTuning)) {
        return { error: `${source.baseID || 'source'} incompatible with ${targetTuning.baseID}` };
      }
      if (`${sourceTuning.nStrings || ''}` !== `${targetTuning.nStrings || ''}`) {
        return { error: `${source.baseID || 'source'} string layout mismatch` };
      }
      if (!exactPitchLayout) {
        return { error: `${source.baseID || 'source'} pitch layout mismatch` };
      }
    } else if (!exactPitchLayout) {
      const resolvedMap = this.resolveMidiPasteMapFor(song, sourceTuning, targetTuning);
      if (!resolvedMap && !canMidiPasteBetweenTunings(sourceTuning, targetTuning)) {
        const activeMapId = this.getActiveMidiPasteMapId();
        const hint = activeMapId ? ` (map "${escapeHtml(activeMapId)}" does not fit)` : '';
        return { error: `${source.baseID || 'source'} unsupported for MIDI Paste to ${targetTuning.baseID}${hint}` };
      }
      const mapped = this.mapRecordedSourceBeatsForMidiPaste(sourceBeats, sourceTuning, targetTuning, resolvedMap);
      sourceBeats = mapped.sourceBeats;
      droppedOutOfRange = mapped.droppedOutOfRange;
      mapRun = mapped.mapRun || null;
    }
    return {
      ...selected,
      section,
      targetTuning,
      tableID,
      sectionNotes: section.getSectionNotes(tableID),
      sourceBeats,
      recordedMidiPaste,
      droppedOutOfRange,
      mapRun
    };
  }

  createRecordedPasteSummary() {
    return {
      beatsUsed: 0,
      notesAdded: 0,
      notesOverwritten: 0,
      namedSkipped: 0,
      droppedOutOfRange: 0,
      pitchIncluded: false,
      multiIncluded: false
    };
  }

  mergeRecordedNotesIntoBeat(sectionNotes, beatNumber, notes = [], summary = this.createRecordedPasteSummary()) {
    const key = `${beatNumber}`;
    const existing = Array.isArray(sectionNotes.recordedNotes?.[key]) ? sectionNotes.recordedNotes[key] : [];
    let merged = [...existing];
    notes.forEach((note) => {
      const candidate = new Note(stripOwner(note));
      const collisionKey = recordedCollisionKey(candidate);
      const before = merged.length;
      merged = merged.filter((existingNote) => recordedCollisionKey(existingNote) !== collisionKey);
      if (merged.length < before) {
        summary.notesOverwritten += before - merged.length;
      } else {
        summary.notesAdded += 1;
      }
      merged.push(candidate);
    });
    sectionNotes.recordedNotes = sectionNotes.recordedNotes || {};
    sectionNotes.recordedNotes[key] = merged;
    return summary;
  }

  playRecordedBeatsIntoCurrent(context) {
    const summary = this.createRecordedPasteSummary();
    const currentBeat = context.section.getBeat();
    const beatCount = context.section.getBeats();
    context.sourceBeats.forEach((sourceBeat, index) => {
      const destBeat = currentBeat + index;
      if (destBeat > beatCount) {
        return;
      }
      summary.beatsUsed += 1;
      this.mergeRecordedNotesIntoBeat(context.sectionNotes, destBeat, sourceBeat.notes, summary);
    });
    return {
      summary,
      result: `played ${summary.beatsUsed}/${context.sourceBeats.length} beats: added ${summary.notesAdded}, overwritten ${summary.notesOverwritten}`
    };
  }

  squeezeRecordedBeatsIntoCurrent(context) {
    const summary = this.createRecordedPasteSummary();
    const currentBeat = context.section.getBeat();
    context.sourceBeats.forEach((sourceBeat) => {
      summary.beatsUsed += 1;
      this.mergeRecordedNotesIntoBeat(context.sectionNotes, currentBeat, sourceBeat.notes, summary);
    });
    return {
      summary,
      result: `squeezed ${summary.beatsUsed} beats into beat ${currentBeat}: added ${summary.notesAdded}, overwritten ${summary.notesOverwritten}`
    };
  }

  insertRecordedBeats(context, insertBeforeCurrent = false) {
    const currentBeat = context.section.getBeat();
    const insertIndex = insertBeforeCurrent ? currentBeat : currentBeat + 1;
    const insertCount = context.sourceBeats.length;
    if (typeof context.song?.insertBeatsAtCurrentSection === 'function') {
      context.song.insertBeatsAtCurrentSection(insertIndex, insertCount);
    }
    const summary = this.createRecordedPasteSummary();
    context.sourceBeats.forEach((sourceBeat, index) => {
      const destBeat = insertIndex + index;
      summary.beatsUsed += 1;
      this.mergeRecordedNotesIntoBeat(context.sectionNotes, destBeat, sourceBeat.notes, summary);
    });
    const verb = insertBeforeCurrent ? 'inserted' : 'added';
    const where = insertBeforeCurrent ? 'before' : 'after';
    return {
      summary,
      result: `${verb} ${summary.beatsUsed} beats ${where} beat ${currentBeat}: ${summary.notesAdded} notes`
    };
  }

  flattenRecordedBeatsToPlayedNotes(context) {
    const summary = this.createRecordedPasteSummary();
    const playedNotes = Array.isArray(context.sectionNotes.playedNotes) ? context.sectionNotes.playedNotes : [];
    const collisionMap = new Map(playedNotes.map((note, index) => [playedCollisionKey(note), index]));
    RECORDED_FLATTEN_STYLE_ORDER.forEach((styleNum) => {
      context.sourceBeats.forEach((sourceBeat) => {
        sourceBeat.notes.forEach((note) => {
          if (note?.styleNum === Note.STYLENUM_NAMED) {
            summary.namedSkipped += 1;
            return;
          }
          if (note?.styleNum !== styleNum) {
            return;
          }
          const candidate = new Note(stripOwner(note));
          const appliedSummary = {
            playedAdded: 0,
            playedOverwritten: 0,
            playedSkipped: 0
          };
          this.applyPlayedCandidate(candidate, playedNotes, collisionMap, true, appliedSummary);
          summary.notesAdded += appliedSummary.playedAdded;
          summary.notesOverwritten += appliedSummary.playedOverwritten;
          if (candidate.styleNum === Note.STYLENUM_MIDIPITCHES) {
            summary.pitchIncluded = true;
          }
          if (candidate.styleNum === Note.STYLENUM_MIDIPITCHESSINGLE) {
            summary.multiIncluded = true;
          }
        });
      });
    });
    context.sectionNotes.playedNotes = playedNotes;
    summary.beatsUsed = context.sourceBeats.length;
    const temporary = [summary.pitchIncluded ? 'Pitch' : '', summary.multiIncluded ? 'Multi' : ''].filter(Boolean).join('/');
    return {
      summary,
      result: `flattened ${summary.beatsUsed} beats: added ${summary.notesAdded}, overwritten ${summary.notesOverwritten}${temporary ? `; ${temporary} are temporary` : ''}`
    };
  }

  pasteRecordedNotes(song = getSong(), mode = 'play') {
    const requiresRecOn = ['add', 'insert', 'play', 'squeeze'].includes(mode);
    const recording = song?.isRecording?.() === true;
    if (requiresRecOn && !recording) {
      return { result: 'REC mode required' };
    }
    if (mode === 'flatten' && recording) {
      return { result: 'REC mode must be off' };
    }
    const context = this.getRecordedPasteContext(song);
    if (context.error) {
      return { result: context.error };
    }
    const operationContext = { ...context, song };
    let outcome;
    if (mode === 'add') {
      outcome = this.insertRecordedBeats(operationContext, false);
    } else if (mode === 'insert') {
      outcome = this.insertRecordedBeats(operationContext, true);
    } else if (mode === 'squeeze') {
      outcome = this.squeezeRecordedBeatsIntoCurrent(operationContext);
    } else if (mode === 'flatten') {
      outcome = this.flattenRecordedBeatsToPlayedNotes(operationContext);
    } else {
      outcome = this.playRecordedBeatsIntoCurrent(operationContext);
    }
    context.record.lastRevived = Date.now();
    this.refreshSongUi(song);
    const droppedSuffix = context.droppedOutOfRange > 0 ? `; dropped ${context.droppedOutOfRange}` : '';
    const mapSuffix = context.mapRun
      ? `${this.describeStringMapRun(context.mapRun)}; unmapped ${context.mapRun.unmapped}; collisions ${context.mapRun.collisions}`
      : '';
    return { result: `${outcome.result}${droppedSuffix}${mapSuffix}` };
  }

  getCompatibleClipRecords(song = getSong()) {
    const graveyard = song?.graveyard;
    const tuning = this.getSelectedTargetTuning(song);
    if (!graveyard || !Array.isArray(graveyard.records) || !tuning) {
      return [];
    }
    const compatibilityID = getTuningCompatibilityID(tuning);
    const result = [];
    for (let index = graveyard.records.length - 1; index >= 0; index -= 1) {
      const record = graveyard.records[index];
      if (record?.type !== GraveType.CLIP) {
        continue;
      }
      if (isRecordedNotesClipRecord(record)) {
        continue;
      }
      if (getRecordCompatibilityID(record) !== compatibilityID) {
        continue;
      }
      result.push({ record, index });
    }
    return result;
  }

  getSourceTuningForRecord(record, song = getSong()) {
    const payload = JSON.parse(record?.json || '{}');
    const source = payload?.source || {};
    const liveTuning = (song?.myTunings || []).find((tuning) => (
      getTableID(tuning) === source.tableID
      || `${tuning?.baseID || ''}` === `${source.baseID || record?.context?.baseID || ''}`
    )) || null;
    const merged = {
      ...(liveTuning || {}),
      ...(source || {})
    };

    merged.baseID = merged.baseID || record?.context?.baseID || '';
    merged.fromBaseID = merged.fromBaseID || record?.context?.fromBaseID || liveTuning?.fromBaseID || merged.baseID;
    merged.baseInstrument = merged.baseInstrument || liveTuning?.baseInstrument || '';
    merged.nStrings = merged.nStrings || liveTuning?.nStrings || (Array.isArray(merged.rowRange) ? merged.rowRange.length : 0);
    merged.rowRange = Array.isArray(merged.rowRange) ? merged.rowRange : (Array.isArray(liveTuning?.rowRange) ? [...liveTuning.rowRange] : []);
    merged.frets = merged.frets ?? liveTuning?.frets ?? 0;
    merged.nut = merged.nut ?? liveTuning?.nut ?? false;
    merged.reverse = merged.reverse ?? liveTuning?.reverse ?? false;
    return merged;
  }

  emitUserLogMessage(message) {
    if (!message) {
      return;
    }
    EventBus.trigger('UserLog', { subSystem: 'ClipPlugin', message });
  }

  getUserMidiPasteMaps() {
    const value = this.getProperty('midiPasteUserMaps')?.getValue();
    return Array.isArray(value) ? value : [];
  }

  getActiveMidiPasteMapId() {
    return `${this.getProperty('midiPasteMapId')?.getValue() || ''}`;
  }

  getMidiPasteMapList() {
    return listMidiPasteMaps(this.getUserMidiPasteMaps());
  }

  // Drops stored maps that no longer parse or collide, and a stale active id.  Logs, never throws.
  sanitizeMidiPasteMapState() {
    const userProperty = this.getProperty('midiPasteUserMaps');
    const idProperty = this.getProperty('midiPasteMapId');
    if (!userProperty || !idProperty) {
      return;
    }
    const builtins = listMidiPasteMaps([]);
    const kept = [];
    userProperty.getValue().forEach((entry) => {
      const label = escapeHtml(`${entry?.id ?? ''}`);
      const normalized = normalizeMapId(entry?.id);
      const parsed = parseMapSpec(entry?.spec);
      const problem = normalized.error || parsed.errors[0] || '';
      if (problem) {
        this.emitUserLogMessage(`MIDI Paste map "${label}" dropped: ${escapeHtml(problem)}`);
        return;
      }
      if (findMapIgnoringCase([...builtins, ...kept], normalized.id)) {
        this.emitUserLogMessage(`MIDI Paste map "${label}" dropped: id already exists`);
        return;
      }
      if (kept.length >= MAX_USER_MAPS) {
        this.emitUserLogMessage(`MIDI Paste map "${label}" dropped: more than ${MAX_USER_MAPS} maps`);
        return;
      }
      kept.push({ id: normalized.id, spec: parsed.spec });
    });
    if (!valuesEqual(kept, userProperty.getValue())) {
      userProperty.setValue(kept);
    }
    const activeId = this.getActiveMidiPasteMapId();
    if (activeId && !this.getMidiPasteMapList().some((map) => map.id === activeId)) {
      this.emitUserLogMessage(`MIDI Paste map "${escapeHtml(activeId)}" is not available; no map selected`);
      idProperty.setValue('');
    }
  }

  addMidiPasteMap(rawValue) {
    const parsed = parseAddInput(rawValue);
    const reject = (reason) => {
      const message = `MIDI Paste map not added: ${reason}`;
      this.emitUserLogMessage(message);
      return { result: message };
    };
    if (!parsed.ok) {
      return reject(parsed.errors.map(escapeHtml).join('; '));
    }
    const maps = this.getMidiPasteMapList();
    if (findMapIgnoringCase(maps, parsed.id)) {
      return reject(`id "${escapeHtml(parsed.id)}" already exists`);
    }
    const userMaps = this.getUserMidiPasteMaps();
    if (userMaps.length >= MAX_USER_MAPS) {
      return reject(`no more than ${MAX_USER_MAPS} maps of your own`);
    }
    this.getProperty('midiPasteUserMaps').setValue([...userMaps, { id: parsed.id, spec: parsed.spec }]);
    const warnings = parsed.warnings.map(escapeHtml);
    warnings.forEach((warning) => this.emitUserLogMessage(`MIDI Paste map "${escapeHtml(parsed.id)}": ${warning}`));
    const warningSuffix = warnings.length > 0 ? ` (${warnings.join('; ')})` : '';
    return { result: `MIDI Paste map added: "${escapeHtml(parsed.id)}" ${escapeHtml(parsed.spec)}${warningSuffix}` };
  }

  selectMidiPasteMap(id) {
    const idProperty = this.getProperty('midiPasteMapId');
    if (!id) {
      idProperty.setValue('');
      return { result: 'MIDI Paste map: none' };
    }
    if (!this.getMidiPasteMapList().some((map) => map.id === id)) {
      return { result: `MIDI Paste map skipped: "${escapeHtml(id)}" not found` };
    }
    idProperty.setValue(id);
    return { result: `MIDI Paste map: "${escapeHtml(id)}"` };
  }

  deleteMidiPasteMap(id) {
    const userMaps = this.getUserMidiPasteMaps();
    if (!userMaps.some((map) => map.id === id)) {
      const builtin = this.getMidiPasteMapList().some((map) => map.builtin && map.id === id);
      return { result: `MIDI Paste map not deleted: "${escapeHtml(id)}" ${builtin ? 'is built in' : 'not found'}` };
    }
    this.getProperty('midiPasteUserMaps').setValue(userMaps.filter((map) => map.id !== id));
    const wasActive = this.getActiveMidiPasteMapId() === id;
    if (wasActive) {
      this.getProperty('midiPasteMapId').setValue('');
    }
    return { result: `MIDI Paste map deleted: "${escapeHtml(id)}"${wasActive ? '; no map selected' : ''}` };
  }

  listMidiPasteMapsMessage() {
    const maps = this.getMidiPasteMapList();
    const activeId = this.getActiveMidiPasteMapId();
    const rows = maps.map((map, index) => {
      const key = index < MAP_CHOICE_TRIGGERS.length ? MAP_CHOICE_TRIGGERS[index] : '-';
      return `<tr><td>${key}</td><td>${escapeHtml(map.id)}${map.id === activeId ? ' &#x2713;' : ''}</td><td>${escapeHtml(map.spec)}</td><td>${map.builtin ? 'built-in' : 'yours'}</td></tr>`;
    });
    const html = [
      "<table border='1' class='tblDisplayOptions'>",
      '<caption>MIDI Paste maps</caption>',
      '<tr><th>key</th><th>id</th><th>map (source:dest)</th><th>from</th></tr>',
      rows.join('\n'),
      '</table>'
    ].join('\n');
    return {
      result: `${maps.length} MIDI Paste maps; current: ${escapeHtml(activeId || 'none')}`,
      message: html
    };
  }

  lookupTuningForMapEndpoint(song = getSong()) {
    const songTunings = Array.isArray(song?.myTunings) ? song.myTunings.filter(Boolean) : [];
    const libraryTunings = Array.isArray(allTunings?.tunings) ? allTunings.tunings : [];
    return (id) => (
      songTunings.find((tuning) => `${tuning.fromBaseID || tuning.baseID || ''}` === id)
      || songTunings.find((tuning) => `${tuning.baseID || ''}` === id)
      || libraryTunings.find((tuning) => tuning.baseID === id)
      || null
    );
  }

  resolveMidiPasteMapFor(song, sourceTuning, targetTuning) {
    const activeId = this.getActiveMidiPasteMapId();
    if (!activeId) {
      return null;
    }
    return resolveMidiPasteMap({
      maps: this.getMidiPasteMapList(),
      activeId,
      sourceTuning,
      targetTuning,
      lookupTuning: this.lookupTuningForMapEndpoint(song)
    });
  }

  canMidiPasteBetween(song, sourceTuning, targetTuning) {
    return !!this.resolveMidiPasteMapFor(song, sourceTuning, targetTuning)
      || canMidiPasteBetweenTunings(sourceTuning, targetTuning);
  }

  startStringMapRun(sourceTuning, targetTuning, resolved) {
    const { rowPairs, skipped } = prepareStringPairs(
      resolved.pairs,
      tuningStringCount(sourceTuning),
      tuningStringCount(targetTuning)
    );
    return {
      resolved,
      sourceLayout: createTuningLayout(sourceTuning),
      targetLayout: createTuningLayout(targetTuning),
      rowPairs,
      skipped,
      dropped: 0,
      unmapped: 0,
      collisions: 0
    };
  }

  mapNotesInStringMapRun(run, notes = []) {
    const result = applyStringMap({
      notes,
      rowPairs: run.rowPairs,
      placeNote: (note, targetRow) => this.buildMidiPasteCandidateForRow(note, run.sourceLayout, run.targetLayout, targetRow)
    });
    run.dropped += result.dropped;
    run.unmapped += result.unmapped;
    run.collisions += result.collisions;
    return result.candidates;
  }

  finishStringMapRun(run) {
    const label = escapeHtml(run.resolved.id);
    if (run.skipped.length > 0) {
      const pairs = run.skipped.map(({ from, to }) => `${from}:${to}`).join(', ');
      this.emitUserLogMessage(`MIDI Paste map "${label}": skipped pairs ${pairs} because an instrument has fewer strings`);
    }
    if (run.collisions > 0) {
      this.emitUserLogMessage(`MIDI Paste map "${label}": ${run.collisions} notes landed on the same cell (many-to-one); the later pair won`);
    }
  }

  describeStringMapRun(run) {
    return ` [map "${escapeHtml(run.resolved.id)}" ${run.resolved.route}]`;
  }

  getMidiPasteClipRecords(song = getSong()) {
    const graveyard = song?.graveyard;
    const targetTuning = this.getSelectedTargetTuning(song);
    if (!graveyard || !Array.isArray(graveyard.records) || !targetTuning) {
      return [];
    }
    const result = [];
    for (let index = graveyard.records.length - 1; index >= 0; index -= 1) {
      const record = graveyard.records[index];
      if (record?.type !== GraveType.CLIP) {
        continue;
      }
      if (isRecordedNotesClipRecord(record)) {
        continue;
      }
      const sourceTuning = this.getSourceTuningForRecord(record, song);
      if (!this.canMidiPasteBetween(song, sourceTuning, targetTuning)) {
        continue;
      }
      result.push({ record, index, sourceTuning });
    }
    return result;
  }

  reviveClipChoice(song = getSong(), rawChoice) {
    const automatic = !!this.getProperty('automatic')?.getValue();
    const normalizedChoice = `${rawChoice || ''}`.trim() || (automatic ? '1' : '');
    const choice = Number.parseInt(normalizedChoice, 10);
    if (!Number.isInteger(choice) || choice < 1) {
      return { result: `Clip revive skipped: invalid choice ${rawChoice}` };
    }
    const records = this.getCompatibleClipRecords(song);
    const selected = records[choice - 1];
    if (!selected) {
      return { result: `Clip revive skipped: choice ${choice} not available` };
    }
    return this.reviveClip(song, selected.index);
  }

  midiPasteClipChoice(song = getSong(), rawChoice) {
    const automatic = !!this.getProperty('automatic')?.getValue();
    const normalizedChoice = `${rawChoice || ''}`.trim() || (automatic ? '1' : '');
    const choice = Number.parseInt(normalizedChoice, 10);
    if (!Number.isInteger(choice) || choice < 1) {
      return { result: `MIDI Paste skipped: invalid choice ${rawChoice}` };
    }
    const records = this.getMidiPasteClipRecords(song);
    const selected = records[choice - 1];
    if (!selected) {
      return { result: `MIDI Paste skipped: choice ${choice} not available` };
    }
    return this.midiPasteClip(song, selected.index);
  }

  applyNamedPayload(payload, sectionNotes, overwrite, summary) {
    Object.entries(payload?.sectionNotes?.namedNotes || {}).forEach(([noteName, note]) => {
      const candidate = new Note(stripOwner(note));
      candidate.noteName = candidate.noteName || noteName;
      const hasExisting = !!sectionNotes.namedNotes?.[noteName];
      if (hasExisting && !overwrite) {
        summary.namedSkipped += 1;
        return;
      }
      if (hasExisting) {
        summary.namedOverwritten += 1;
      } else {
        summary.namedAdded += 1;
      }
      sectionNotes.setNamedNote(noteName, candidate);
    });
  }

  applyPlayedCandidate(candidate, playedNotes, collisionMap, overwrite, summary) {
    const key = playedCollisionKey(candidate);
    const existingIndex = collisionMap.get(key);
    if (existingIndex != null && existingIndex >= 0) {
      if (!overwrite) {
        summary.playedSkipped += 1;
        return;
      }
      playedNotes.splice(existingIndex, 1, candidate);
      collisionMap.set(key, existingIndex);
      summary.playedOverwritten += 1;
      return;
    }
    playedNotes.push(candidate);
    collisionMap.set(key, playedNotes.length - 1);
    summary.playedAdded += 1;
  }

  resolveClipNoteMidinum(note, sourceLayout) {
    const explicitMidinum = toInteger(note?.midinum, null);
    if (Number.isInteger(explicitMidinum) && explicitMidinum >= 0) {
      return explicitMidinum;
    }
    const row = toInteger(note?.row, null);
    const col = toInteger(note?.col, null);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return null;
    }
    return getCellByRowCol(sourceLayout, row, col)?.midinum ?? null;
  }

  buildMidiPasteCandidate(note, sourceLayout, targetLayout) {
    const sourceRow = toInteger(note?.row, null);
    if (!Number.isInteger(sourceRow) || sourceRow < 0) {
      return null;
    }
    return this.buildMidiPasteCandidateForRow(note, sourceLayout, targetLayout, sourceRow);
  }

  buildMidiPasteCandidateForRow(note, sourceLayout, targetLayout, targetRow) {
    const sourceMidinum = this.resolveClipNoteMidinum(note, sourceLayout);
    if (!Number.isInteger(sourceMidinum)) {
      return null;
    }
    const targetCell = getCellByRowMidi(targetLayout, targetRow, sourceMidinum);
    if (!targetCell) {
      return null;
    }

    const candidate = new Note(stripOwner(note));
    candidate.noteName = targetCell.noteName;
    candidate.midinum = `${targetCell.midinum}`;
    candidate.row = `${targetCell.row}`;
    candidate.col = `${targetCell.col}`;
    return candidate;
  }

  copyOrCut(song = getSong(), args = {}, doCut = false) {
    const payload = this.collectClipPayload(song);
    const section = this.getCurrentSection(song);
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    const totalCount = Object.values(payload?.counts || {}).reduce((sum, value) => sum + value, 0);
    if (!song?.graveyard || !payload || !section || !tuning || !tableID) {
      return { result: 'Clip skipped: no current section or target table selected' };
    }
    if (totalCount === 0) {
      return { result: `Clip ${doCut ? 'cut' : 'copy'} skipped: no included notes found` };
    }

    const fallbackKey = this.buildDefaultClipName(song);
    const userKey = normalizeClipKey(args?.value, fallbackKey);
    const context = {
      caption: userKey,
      userKey,
      logicalKey: `clip::${userKey}`,
      tableID,
      baseID: tuning.baseID,
      fromBaseID: tuning.fromBaseID || tuning.baseID,
      schemaVersion: CLIP_SCHEMA_VERSION,
      counts: { ...payload.counts }
    };

    song.graveyard.bury(GraveType.CLIP, payload, context);

    let removedSummary = '';
    if (doCut) {
      const removed = this.removeIncludedNotesFromSection(section.getSectionNotes(tableID));
      removedSummary = ` removed named=${removed.named} played=${removed.played}`;
      this.refreshSongUi(song);
    }

    return {
      result: `Clip ${doCut ? 'cut' : 'copied'} ${totalCount} notes as ${userKey}.${removedSummary}`.trim()
    };
  }

  copyListened(song = getSong(), args = {}) {
    const selection = this.getSelectedListenerSelection(song);
    const payload = this.collectListenerClipPayload(song);
    const tuning = this.getSelectedTargetTuning(song);
    const totalCount = Object.values(payload?.counts || {}).reduce((sum, value) => sum + value, 0);
    if (!selection) {
      return { result: 'Clip listener-copy skipped: target table is not a Listener' };
    }
    if (!song?.graveyard || !payload || !tuning) {
      return { result: 'Clip listener-copy skipped: no current section or target table selected' };
    }
    if (totalCount === 0) {
      return {
        result: `Clip listener-copy skipped: no included listened notes found from ${selection.sourceTableID} to ${selection.targetTableID}`
      };
    }

    const fallbackKey = this.buildDefaultClipName(song, payload);
    const userKey = normalizeClipKey(args?.value, fallbackKey);
    const context = {
      caption: userKey,
      userKey,
      logicalKey: `clip::${userKey}`,
      tableID: selection.targetTableID,
      baseID: tuning.baseID,
      fromBaseID: tuning.fromBaseID || tuning.baseID,
      schemaVersion: CLIP_SCHEMA_VERSION,
      counts: { ...payload.counts }
    };

    song.graveyard.bury(GraveType.CLIP, payload, context);

    return {
      result: `Clip copied listened notes ${totalCount} as ${userKey} from ${selection.sourceTableID} to ${selection.targetTableID}.`
    };
  }

  removeIncludedNotesFromSection(sectionNotes) {
    const include = this.getIncludeConfig();
    let removedNamed = 0;
    let removedPlayed = 0;
    if (include.named) {
      removedNamed = Object.keys(sectionNotes?.namedNotes || {}).length;
      sectionNotes.namedNotes = {};
    }

    const allowedStyles = new Set();
    if (include.single) allowedStyles.add(Note.STYLENUM_SINGLE);
    if (include.tiny) allowedStyles.add(Note.STYLENUM_TINY);
    if (include.bend) allowedStyles.add(Note.STYLENUM_BEND);
    if (include.fingering) allowedStyles.add(Note.STYLENUM_FINGERING);

    const originalPlayedNotes = sectionNotes?.playedNotes || [];
    sectionNotes.playedNotes = originalPlayedNotes.filter((note) => {
      const shouldRemove = allowedStyles.has(note?.styleNum);
      if (shouldRemove) {
        removedPlayed += 1;
      }
      return !shouldRemove;
    });

    return {
      named: removedNamed,
      played: removedPlayed
    };
  }

  reviveClip(song = getSong(), rawIndex) {
    const section = this.getCurrentSection(song);
    const tuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    const recordIndex = Number.parseInt(rawIndex, 10);
    const record = song?.graveyard?.records?.[recordIndex];
    if (!section || !tuning || !tableID || !record || record.type !== GraveType.CLIP) {
      return { result: 'Clip revive skipped: compatible record not found' };
    }

    const payload = JSON.parse(record.json || '{}');
    const sectionNotes = section.getSectionNotes(tableID);
    const overwrite = !!this.getProperty('overwrite')?.getValue();
    const summary = createReviveSummary();

    this.applyNamedPayload(payload, sectionNotes, overwrite, summary);

    const playedNotes = Array.isArray(sectionNotes.playedNotes) ? sectionNotes.playedNotes : [];
    const collisionMap = new Map(playedNotes.map((note, index) => [playedCollisionKey(note), index]));
    const maxRow = Array.isArray(tuning.rowRange) ? tuning.rowRange.length - 1 : -1;
    const maxFret = Number.parseInt(tuning.frets, 10);

    (payload?.sectionNotes?.playedNotes || []).forEach((note) => {
      const candidate = new Note(stripOwner(note));
      const row = toInteger(candidate.row);
      const col = toInteger(candidate.col);
      if (row < 0 || col < 0 || row > maxRow || col > maxFret) {
        summary.droppedOutOfRange += 1;
        return;
      }
      this.applyPlayedCandidate(candidate, playedNotes, collisionMap, overwrite, summary);
    });

    sectionNotes.playedNotes = playedNotes;
    record.lastRevived = Date.now();
    this.refreshSongUi(song);

    return {
      result: `Clip revived ${record.context?.userKey || record.context?.caption || `clip ${recordIndex}`}: named +${summary.namedAdded} overwrite ${summary.namedOverwritten} skip ${summary.namedSkipped}; played +${summary.playedAdded} overwrite ${summary.playedOverwritten} skip ${summary.playedSkipped}; dropped ${summary.droppedOutOfRange}`
    };
  }

  midiPasteClip(song = getSong(), rawIndex) {
    const section = this.getCurrentSection(song);
    const targetTuning = this.getSelectedTargetTuning(song);
    const tableID = this.getSelectedTargetTableID();
    const recordIndex = Number.parseInt(rawIndex, 10);
    const record = song?.graveyard?.records?.[recordIndex];
    if (!section || !targetTuning || !tableID || !record || record.type !== GraveType.CLIP) {
      return { result: 'MIDI Paste skipped: compatible record not found' };
    }

    const payload = JSON.parse(record.json || '{}');
    const sourceTuning = this.getSourceTuningForRecord(record, song);
    const resolvedMap = this.resolveMidiPasteMapFor(song, sourceTuning, targetTuning);
    const activeMapId = this.getActiveMidiPasteMapId();
    if (!resolvedMap && !canMidiPasteBetweenTunings(sourceTuning, targetTuning)) {
      const hint = activeMapId ? ` (map "${escapeHtml(activeMapId)}" does not fit ${escapeHtml(sourceTuning.fromBaseID || sourceTuning.baseID)} to ${escapeHtml(targetTuning.fromBaseID || targetTuning.baseID)})` : '';
      return { result: `MIDI Paste skipped: source/target tunings are not supported for MIDI Paste${hint}` };
    }

    const sectionNotes = section.getSectionNotes(tableID);
    const overwrite = !!this.getProperty('overwrite')?.getValue();
    const summary = createReviveSummary();
    const sourceLayout = createTuningLayout(sourceTuning);
    const targetLayout = createTuningLayout(targetTuning);

    this.applyNamedPayload(payload, sectionNotes, overwrite, summary);

    const playedNotes = Array.isArray(sectionNotes.playedNotes) ? sectionNotes.playedNotes : [];
    const collisionMap = new Map(playedNotes.map((note, index) => [playedCollisionKey(note), index]));

    let mapRun = null;
    if (resolvedMap) {
      mapRun = this.startStringMapRun(sourceTuning, targetTuning, resolvedMap);
      this.mapNotesInStringMapRun(mapRun, payload?.sectionNotes?.playedNotes || []).forEach((candidate) => {
        this.applyPlayedCandidate(candidate, playedNotes, collisionMap, overwrite, summary);
      });
      summary.droppedOutOfRange += mapRun.dropped;
      this.finishStringMapRun(mapRun);
    } else {
      (payload?.sectionNotes?.playedNotes || []).forEach((note) => {
        const candidate = this.buildMidiPasteCandidate(note, sourceLayout, targetLayout);
        if (!candidate) {
          summary.droppedOutOfRange += 1;
          return;
        }
        this.applyPlayedCandidate(candidate, playedNotes, collisionMap, overwrite, summary);
      });
    }

    sectionNotes.playedNotes = playedNotes;
    record.lastRevived = Date.now();
    this.refreshSongUi(song);

    const mapLabel = mapRun ? this.describeStringMapRun(mapRun) : '';
    const mapTotals = mapRun ? `; unmapped ${mapRun.unmapped}; collisions ${mapRun.collisions}` : '';
    const notApplied = !mapRun && activeMapId ? ` [map "${escapeHtml(activeMapId)}" not applied: does not fit]` : '';
    return {
      result: `MIDI Paste revived ${this.getClipRecordLabel(record, recordIndex)}${mapLabel}: named +${summary.namedAdded} overwrite ${summary.namedOverwritten} skip ${summary.namedSkipped}; played +${summary.playedAdded} overwrite ${summary.playedOverwritten} skip ${summary.playedSkipped}; dropped ${summary.droppedOutOfRange}${mapTotals}${notApplied}`
    };
  }

  clearClips(song = getSong()) {
    if (!song?.graveyard || !Array.isArray(song.graveyard.records)) {
      return { result: 'Clip clear skipped: graveyard unavailable' };
    }
    const before = song.graveyard.records.length;
    song.graveyard.records = song.graveyard.records.filter((record) => record?.type !== GraveType.CLIP);
    return { result: `Clip clear removed ${before - song.graveyard.records.length} clip records` };
  }

  refreshSongUi(song) {
    if (typeof song?.requestUiFullRepaint === 'function') {
      song.requestUiFullRepaint();
      return;
    }
    if (typeof song?.requestUiReplay === 'function') {
      song.requestUiReplay();
    }
  }
}

export default ClipPlugin;