import { gMenuFile } from '../menu.js';
import { clearBeatAndSectionLooping, beatsLooping, sectionsLooping } from '../looper.js';
import { MenuItemProxy } from './MenuItemProxy.js';
import { buildCaption } from './PluginProperty.js';

const DEFAULT_GRAVEYARD_KEY = 'USER';
const ENABLED_CHECKMARK = '&#x1F5F9;';
const PERSISTED_SONG_MARK = '&#x1F5BA;';

function parseBoolean(rawValue) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }
  const text = `${rawValue}`.trim();
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  throw new Error(`Expected true or false, received: ${rawValue}`);
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return `${value}`;
}

function stripHtml(value) {
  return `${value || ''}`.replace(/<[^>]+>/g, '');
}

function normalizeGraveyardKey(rawValue) {
  const normalized = `${rawValue || ''}`
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 _\-']/g, '');
  return normalized || DEFAULT_GRAVEYARD_KEY;
}

function canPromptForConfirmation() {
  return typeof window !== 'undefined' && typeof window.confirm === 'function';
}

function valuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function normalizePluginResponse(response, fallbackResult) {
  if (typeof response === 'string') {
    return { result: response, message: '' };
  }
  if (response && typeof response === 'object') {
    return {
      result: response.result || fallbackResult,
      message: response.message || ''
    };
  }
  return { result: fallbackResult, message: '' };
}

export class PluginManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.plugins = new Map();
    this.song = null;
  }

  register(pluginInstance) {
    const pluginId = pluginInstance.getId();
    this.plugins.set(pluginId, {
      plugin: pluginInstance,
      enabled: false,
      enableOnSongLoad: false,
      graveyardKey: DEFAULT_GRAVEYARD_KEY,
      handlers: new Map()
    });
    if (typeof pluginInstance.setManager === 'function') {
      pluginInstance.setManager(this);
    }
    this.refreshPluginsMenuNode();
    return pluginInstance;
  }

  unregister(pluginId) {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      return false;
    }
    this.disablePluginEntry(entry);
    this.plugins.delete(pluginId);
    this.refreshPluginsMenuNode();
    return true;
  }

  getRegisteredPlugins() {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin);
  }

  getPluginById(pluginId) {
    return this.plugins.get(pluginId)?.plugin || null;
  }

  getPluginEntry(pluginId) {
    return this.plugins.get(pluginId) || null;
  }

  getPluginsMarkerNode(rootMenu = gMenuFile) {
    const stack = [rootMenu];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }
      if (node.runtimeChildren === 'pluginManager' || node.name === 'pluginsRuntime') {
        return node;
      }
      if (node.trigger === 'p' && /plugins/i.test(stripHtml(node.caption))) {
        return node;
      }
      if (Array.isArray(node.children)) {
        for (let idx = node.children.length - 1; idx >= 0; idx -= 1) {
          stack.push(node.children[idx]);
        }
      }
    }
    return null;
  }

  refreshPluginsMenuNode(rootMenu = gMenuFile) {
    const markerNode = this.getPluginsMarkerNode(rootMenu);
    if (!markerNode) {
      return null;
    }
    markerNode.name = 'pluginsRuntime';
    markerNode.runtimeChildren = 'pluginManager';
    markerNode.children = this.buildPluginsMenuChildren();
    return markerNode;
  }

  buildPluginsMenuChildren() {
    return this.getRegisteredPlugins().map((plugin) => this.buildPluginMenuNode(plugin));
  }

  buildPluginMenuNode(plugin) {
    const pluginId = plugin.getId();
    const statusToken = `plugin:${pluginId}:statusSuffix`;
    const pluginChildren = [
      ...this.buildManagedPropertyNodes(pluginId),
      ...plugin.getVisibleMenuChildren()
    ];
    return new MenuItemProxy(plugin, {
      name: pluginId,
      caption: `${buildCaption(plugin.getRegisteredName(), plugin.getMenuTrigger())}$${statusToken}`,
      trigger: plugin.getMenuTrigger(),
      vars: [statusToken],
      pluginId,
      children: pluginChildren
    });
  }

  buildManagedPropertyNodes(pluginId) {
    return [
      this.buildManagedBooleanNode(pluginId, 'enabled', 'Enable', 'E'),
      this.buildManagedBooleanNode(pluginId, 'enableOnSongLoad', 'Load enabled', 'L'),
      this.buildManagedBuryNode(pluginId)
    ];
  }

  buildManagedBooleanNode(pluginId, propertyName, caption, trigger) {
    const token = `plugin:${pluginId}:${propertyName}`;
    return new MenuItemProxy(this, {
      name: propertyName,
      caption: `${buildCaption(caption, trigger)} [$${token}]`,
      trigger,
      action: 'pluginProperty:toggle',
      pluginId,
      propertyName,
      vars: [token]
    });
  }

  buildManagedBuryNode(pluginId) {
    return new MenuItemProxy(this, {
      name: 'bury',
      caption: buildCaption('Bury', 'B'),
      trigger: 'B',
      action: 'pluginAction:bury',
      pluginId,
      popOnBang: true,
      input: {
        type: 'input',
        caption: 'graveyard key',
        default: `plugin:${pluginId}:graveyardKey`,
        datatype: 'string',
        id: 'value'
      }
    });
  }

  invokeMenuAction(menuItem, args = {}) {
    const pluginId = menuItem.pluginId;
    const entry = this.getPluginEntry(pluginId);
    if (!entry) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    switch (menuItem.action) {
      case 'pluginProperty:set': {
        const rawValue = args?.[menuItem.input?.id || 'value'];
        return this.setPropertyValue(entry, menuItem.propertyName, rawValue);
      }
      case 'pluginProperty:toggle':
        return this.togglePropertyValue(entry, menuItem.propertyName);
      case 'pluginProperty:select':
        return this.setPropertyValue(entry, menuItem.propertyName, menuItem.value);
      case 'pluginAction:invoke':
        return this.invokePluginAction(entry, menuItem.actionName);
      case 'pluginAction:bury': {
        const rawValue = args?.[menuItem.input?.id || 'value'];
        return this.buryPluginEntry(entry, rawValue);
      }
      default:
        throw new Error(`Unsupported plugin action: ${menuItem.action}`);
    }
  }

  setPropertyValue(entry, propertyName, rawValue) {
    if (propertyName === 'enabled') {
      const enabled = parseBoolean(rawValue);
      entry.enabled = enabled;
      if (enabled) {
        this.enablePluginEntry(entry);
      } else {
        this.disablePluginEntry(entry);
      }
      this.syncSongPlugins();
      return { result: `enabled=${enabled}` };
    }

    if (propertyName === 'enableOnSongLoad') {
      entry.enableOnSongLoad = parseBoolean(rawValue);
      this.syncSongPlugins();
      return { result: `enableOnSongLoad=${entry.enableOnSongLoad}` };
    }

    if (propertyName === 'graveyardKey') {
      entry.graveyardKey = normalizeGraveyardKey(rawValue);
      this.syncSongPlugins();
      return { result: `graveyardKey=${entry.graveyardKey}` };
    }

    const nextValue = entry.plugin.setPropertyValue(propertyName, rawValue, {
      song: this.song,
      pluginManager: this
    });
    this.syncSongPlugins();
    return { result: `${propertyName}=${formatValue(nextValue)}` };
  }

  togglePropertyValue(entry, propertyName) {
    if (propertyName === 'enabled') {
      const nextValue = !entry.enabled;
      entry.enabled = nextValue;
      if (nextValue) {
        this.enablePluginEntry(entry);
      } else {
        this.disablePluginEntry(entry);
      }
      this.syncSongPlugins();
      return { result: `enabled=${nextValue}` };
    }

    if (propertyName === 'enableOnSongLoad') {
      entry.enableOnSongLoad = !entry.enableOnSongLoad;
      this.syncSongPlugins();
      return { result: `enableOnSongLoad=${entry.enableOnSongLoad}` };
    }

    if (propertyName === 'graveyardKey') {
      throw new Error('graveyardKey is not toggleable');
    }

    const property = entry.plugin.getProperty(propertyName);
    if (!property) {
      throw new Error(`Unknown plugin property: ${propertyName}`);
    }
    const currentValue = !!property.getValue();
    const nextValue = entry.plugin.setPropertyValue(propertyName, !currentValue, {
      song: this.song,
      pluginManager: this
    });
    this.syncSongPlugins();
    return { result: `${propertyName}=${formatValue(nextValue)}` };
  }

  invokePluginAction(entry, actionName) {
    const response = entry.plugin.invokeAction(actionName, {
      song: this.song,
      pluginManager: this
    });
    this.syncSongPlugins();
    return normalizePluginResponse(response, `${actionName}`);
  }

  stopLoopingIfNeeded() {
    if (sectionsLooping() || beatsLooping()) {
      clearBeatAndSectionLooping();
      return true;
    }
    return false;
  }

  runPluginPreBury(entry) {
    if (typeof entry.plugin.beforeBury !== 'function') {
      return { proceed: true };
    }

    const response = entry.plugin.beforeBury({
      song: this.song,
      pluginManager: this,
      entry
    }) || {};

    if (response.proceed === false) {
      return {
        proceed: false,
        result: response.result || 'Bury cancelled',
        message: response.message || ''
      };
    }

    if (response.warning) {
      if (canPromptForConfirmation() && !window.confirm(response.warning)) {
        return {
          proceed: false,
          result: 'Bury cancelled',
          message: response.warning
        };
      }
      return {
        proceed: true,
        result: response.result || '',
        message: response.warning
      };
    }

    return {
      proceed: true,
      result: response.result || '',
      message: response.message || ''
    };
  }

  exportPluginEntryState(entry) {
    return {
      enabled: !!entry.enabled,
      enableOnSongLoad: !!entry.enableOnSongLoad,
      graveyardKey: entry.graveyardKey || DEFAULT_GRAVEYARD_KEY,
      properties: entry.plugin.exportSongState()
    };
  }

  replaceGraveyardRecord(entry, userKey, payload) {
    const context = {
      pluginId: entry.plugin.getId(),
      userKey,
      logicalKey: `${entry.plugin.getId()}::${userKey}`,
      schemaVersion: 1,
      caption: `${entry.plugin.getRegisteredName()} / ${userKey}`
    };

    if (typeof this.song.graveyard.buryReplacing === 'function') {
      this.song.graveyard.buryReplacing('PLUGIN', payload, context, (record) => (
        record?.type === 'PLUGIN'
        && record?.context?.pluginId === entry.plugin.getId()
        && record?.context?.userKey === userKey
      ));
      return;
    }

    this.song.graveyard.bury('PLUGIN', payload, context);
  }

  storePluginSnapshot(entry, rawValue, options = {}) {
    if (!entry || !this.song || !this.song.graveyard) {
      return { result: 'Bury unavailable' };
    }

    const userKey = normalizeGraveyardKey(rawValue || entry.graveyardKey || DEFAULT_GRAVEYARD_KEY);
    entry.graveyardKey = userKey;

    if (!options.skipLoopStop) {
      this.stopLoopingIfNeeded();
    }

    if (options.disableBeforeSnapshot) {
      this.disablePluginEntry(entry);
    }

    const payload = this.exportPluginEntryState(entry);
    payload.graveyardKey = userKey;
    this.replaceGraveyardRecord(entry, userKey, payload);
    this.syncSongPlugins();
    this.refreshPluginsMenuNode();
    return {
      result: `buried ${entry.plugin.getId()} as ${userKey}`,
      userKey
    };
  }

  resetPluginEntryState(entry) {
    this.disablePluginEntry(entry);
    entry.plugin.resetToDefaults();
    entry.enabled = false;
    entry.enableOnSongLoad = false;
    this.syncSongPlugins();
  }

  buryPluginEntry(entry, rawValue) {
    const preBury = this.runPluginPreBury(entry);
    if (!preBury.proceed) {
      return {
        result: preBury.result || 'Bury cancelled',
        message: preBury.message || ''
      };
    }

    const snapshotResult = this.storePluginSnapshot(entry, rawValue, {
      disableBeforeSnapshot: true
    });

    if (snapshotResult.result === 'Bury unavailable') {
      return snapshotResult;
    }

    this.resetPluginEntryState(entry);
    this.refreshPluginsMenuNode();
    return {
      result: snapshotResult.result,
      message: preBury.message || ''
    };
  }

  applyPersistedPluginState(entry, persisted = {}) {
    this.disablePluginEntry(entry);
    entry.plugin.resetToDefaults();
    entry.enabled = false;
    entry.enableOnSongLoad = false;
    entry.graveyardKey = normalizeGraveyardKey(persisted.graveyardKey || entry.graveyardKey || DEFAULT_GRAVEYARD_KEY);

    if (persisted.properties && typeof persisted.properties === 'object') {
      entry.plugin.loadSongState(persisted.properties, {
        song: this.song,
        pluginManager: this
      });
    }

    entry.enableOnSongLoad = !!persisted.enableOnSongLoad;
    entry.enabled = !!entry.enableOnSongLoad;
    if (entry.enabled) {
      this.enablePluginEntry(entry);
    }
  }

  importPluginSnapshot(pluginId, persisted = {}, options = {}) {
    const entry = this.getPluginEntry(pluginId);
    if (!entry) {
      throw new Error(`Unknown plugin for revive: ${pluginId}`);
    }

    this.stopLoopingIfNeeded();

    if (options.autoBuryCurrent !== false && this.shouldPersistPluginEntry(entry)) {
      this.storePluginSnapshot(entry, DEFAULT_GRAVEYARD_KEY, {
        disableBeforeSnapshot: false,
        skipLoopStop: true
      });
    }

    this.applyPersistedPluginState(entry, persisted);
    this.syncSongPlugins();
    this.refreshPluginsMenuNode();
    return {
      result: `revived ${pluginId} as ${entry.graveyardKey}`
    };
  }

  resolveValue(token) {
    if (typeof token !== 'string' || !token.startsWith('plugin:')) {
      return undefined;
    }

    const [, pluginId, fieldName] = token.split(':');
    const entry = this.getPluginEntry(pluginId);
    if (!entry) {
      return undefined;
    }

    if (fieldName === 'enabled') {
      return entry.enabled;
    }
    if (fieldName === 'statusSuffix') {
      return this.buildPluginStatusSuffix(entry);
    }
    if (fieldName === 'enabledSuffix') {
      return entry.enabled ? ENABLED_CHECKMARK : '';
    }
    if (fieldName === 'persistedSuffix') {
      return this.hasPersistedSongState(entry.plugin.getId()) ? PERSISTED_SONG_MARK : '';
    }
    if (fieldName === 'enableOnSongLoad') {
      return entry.enableOnSongLoad;
    }
    if (fieldName === 'graveyardKey') {
      return entry.graveyardKey || DEFAULT_GRAVEYARD_KEY;
    }

    if (typeof entry.plugin.resolveValue === 'function') {
      const resolved = entry.plugin.resolveValue(fieldName, {
        song: this.song,
        pluginManager: this
      });
      if (resolved !== undefined) {
        return Array.isArray(resolved) ? JSON.stringify(resolved) : resolved;
      }
    }

    const property = entry.plugin.getProperty(fieldName);
    if (!property) {
      return undefined;
    }

    const value = property.getValue();
    return Array.isArray(value) ? JSON.stringify(value) : value;
  }

  loadSongPluginState(song) {
    this.song = song || null;
    const persistedPlugins = song && song.plugins && typeof song.plugins === 'object' ? song.plugins : {};

    this.plugins.forEach((entry, pluginId) => {
      this.disablePluginEntry(entry);
      entry.plugin.resetToDefaults();
      entry.enabled = false;
      entry.enableOnSongLoad = false;
      entry.graveyardKey = DEFAULT_GRAVEYARD_KEY;

      const persisted = persistedPlugins[pluginId];
      if (persisted) {
        this.applyPersistedPluginState(entry, persisted);
      }
    });

    this.syncSongPlugins();
    this.refreshPluginsMenuNode();
  }

  buildPluginStatusSuffix(entry) {
    const marks = [];
    if (entry.enabled) {
      marks.push(ENABLED_CHECKMARK);
    }
    if (this.hasPersistedSongState(entry.plugin.getId())) {
      marks.push(PERSISTED_SONG_MARK);
    }
    return marks.length > 0 ? ` ${marks.join(' ')}` : '';
  }

  hasPersistedSongState(pluginId) {
    if (!this.song || !this.song.plugins || typeof this.song.plugins !== 'object') {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(this.song.plugins, pluginId);
  }

  syncSongPlugins() {
    if (!this.song) {
      return;
    }
    this.song.plugins = this.exportSongPluginState();
  }

  exportSongPluginState() {
    const result = {};
    this.plugins.forEach((entry, pluginId) => {
      if (!this.shouldPersistPluginEntry(entry)) {
        return;
      }
      result[pluginId] = this.exportPluginEntryState(entry);
    });
    return result;
  }

  shouldPersistPluginEntry(entry) {
    if (entry.enableOnSongLoad) {
      return true;
    }

    if ((entry.graveyardKey || DEFAULT_GRAVEYARD_KEY) !== DEFAULT_GRAVEYARD_KEY) {
      return true;
    }

    const exportedProperties = entry.plugin.exportSongState();
    const properties = typeof entry.plugin.getProperties === 'function'
      ? entry.plugin.getProperties().filter((property) => property.datatype !== 'org.dynamide.Action')
      : [];

    if (properties.length === 0) {
      return Object.keys(exportedProperties).length > 0;
    }

    const propertyNames = new Set(properties.map((property) => property.name));
    const hasExtraPersistedKeys = Object.keys(exportedProperties).some((name) => !propertyNames.has(name));
    if (hasExtraPersistedKeys) {
      return true;
    }

    return properties.some((property) => {
      const exportedValue = Object.prototype.hasOwnProperty.call(exportedProperties, property.name)
        ? exportedProperties[property.name]
        : property.getDefaultValue();
      return !valuesEqual(exportedValue, property.getDefaultValue());
    });
  }

  enablePluginEntry(entry) {
    if (entry.handlers.size > 0) {
      entry.enabled = true;
      this.syncSongPlugins();
      return;
    }
    entry.enabled = true;
    if (typeof entry.plugin.enable === 'function') {
      entry.plugin.enable({ song: this.song, pluginManager: this });
    }
    entry.plugin.getEventNames().forEach((eventName) => {
      const handler = (busEventName, payload) => {
        if (!entry.enabled) {
          return;
        }
        const response = entry.plugin.handleEvent(busEventName, payload, {
          song: this.song,
          pluginManager: this
        });
        const normalized = normalizePluginResponse(response, `${entry.plugin.getId()}:${busEventName}`);
        if (normalized.result || normalized.message) {
          this.eventBus.trigger('PluginManager:ShowResult', {
            pluginId: entry.plugin.getId(),
            eventName: busEventName,
            result: normalized.result,
            message: normalized.message
          });
        }
        this.syncSongPlugins();
      };
      entry.handlers.set(eventName, handler);
      this.eventBus.on(eventName, handler);
    });
    this.syncSongPlugins();
  }

  disablePluginEntry(entry) {
    entry.enabled = false;
    entry.handlers.forEach((handler, eventName) => {
      this.eventBus.off(eventName, handler);
    });
    entry.handlers.clear();
    if (typeof entry.plugin.disable === 'function') {
      entry.plugin.disable({ song: this.song, pluginManager: this });
    }
    this.syncSongPlugins();
  }
}
