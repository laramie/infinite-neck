import { gMenuFile } from '../menu.js';
import { TABLE_ID_PREFIX } from '../Constants.js';
import { clearBeatAndSectionLooping, beatsLooping, sectionsLooping } from '../looper.js';
import { MenuItemProxy } from './MenuItemProxy.js';
import { buildCaption, buildValueReference } from './PluginProperty.js';
import { buildPluginAuditHtml } from './PluginAudit.js';

const DEFAULT_GRAVEYARD_KEY = 'USER';
const PLUGIN_GRAVEYARD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const ENABLED_CHECKMARK = '&#x1F5F9;';
const PERSISTED_SONG_MARK = '&#x1F5BA;';
const DEFAULT_PLUGIN_TRIGGER_ORDER = ['t', 'f', 'a', 'o', 'c', 'm'];
const PLUGIN_ORDER_DEBUG = false;

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
  const normalized = `${rawValue || ''}`.trim() || DEFAULT_GRAVEYARD_KEY;
  if (!PLUGIN_GRAVEYARD_KEY_PATTERN.test(normalized)) {
    throw new Error(`Plugin graveyard key must be an identifier: ${normalized}`);
  }
  return normalized;
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function canPromptForConfirmation() {
  return typeof window !== 'undefined' && typeof window.confirm === 'function';
}

function valuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function valueToBaseID(value) {
  const text = `${value || ''}`;
  return text.startsWith(TABLE_ID_PREFIX) ? text.slice(TABLE_ID_PREFIX.length) : text;
}

function normalizePluginResponse(response, fallbackResult) {
  if (typeof response === 'string') {
    return { result: response, message: '', messageJSON: '', preserveMenuStack: false };
  }
  if (response && typeof response === 'object') {
    let messageJSON = response.messageJSON || '';
    if (messageJSON && typeof messageJSON !== 'string') {
      messageJSON = JSON.stringify(messageJSON, null, 2);
    }
    return {
      result: response.result || fallbackResult,
      message: response.message || '',
      messageJSON,
      preserveMenuStack: response.preserveMenuStack === true
    };
  }
  return { result: fallbackResult, message: '', messageJSON: '', preserveMenuStack: false };
}

function getMenuNodeKey(node, index = 0) {
  if (!node) {
    return `missing:${index}`;
  }
  if (node.name) {
    return `name:${node.name}`;
  }
  if (node.pluginId && node.actionName) {
    return `action:${node.pluginId}:${node.actionName}`;
  }
  if (node.pluginId && node.propertyName) {
    return `property:${node.pluginId}:${node.propertyName}:${node.value ?? ''}`;
  }
  if (node.trigger) {
    return `trigger:${node.trigger}:${stripHtml(node.caption || '')}`;
  }
  return `index:${index}:${stripHtml(node.caption || '')}`;
}

function reconcileMenuChildren(existingChildren = [], nextChildren = []) {
  const buckets = new Map();
  existingChildren.forEach((child, index) => {
    const key = getMenuNodeKey(child, index);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(child);
  });

  return nextChildren.map((nextChild, index) => {
    const key = getMenuNodeKey(nextChild, index);
    const bucket = buckets.get(key) || [];
    const existingChild = bucket.shift();
    if (!existingChild) {
      return nextChild;
    }
    reconcileMenuNode(existingChild, nextChild);
    return existingChild;
  });
}

function reconcileMenuNode(targetNode, sourceNode) {
  const priorParent = targetNode.parent;
  const priorChildren = Array.isArray(targetNode.children) ? targetNode.children : [];

  targetNode.owner = sourceNode.owner;
  targetNode.name = sourceNode.name || '';
  targetNode.caption = sourceNode.caption || '';
  targetNode.trigger = sourceNode.trigger || '';
  targetNode.action = sourceNode.action || '';
  targetNode.input = sourceNode.input || null;
  targetNode.vars = Array.isArray(sourceNode.vars) ? sourceNode.vars : [];
  targetNode.popOnBang = !!sourceNode.popOnBang;
  targetNode.pluginId = sourceNode.pluginId;
  targetNode.propertyName = sourceNode.propertyName;
  targetNode.actionName = sourceNode.actionName;
  targetNode.value = sourceNode.value;
  targetNode.runtimeChildren = sourceNode.runtimeChildren;
  targetNode.children = reconcileMenuChildren(priorChildren, Array.isArray(sourceNode.children) ? sourceNode.children : []);

  if (priorParent !== undefined) {
    targetNode.parent = priorParent;
  }
}

export class PluginManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.plugins = new Map();
    this.song = null;
    this.eventHandlers = new Map();
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

  getPluginMenuOptions(requestPath, options = {}) {
    const requestText = `${requestPath || ''}`.trim();
    const slashIndex = requestText.indexOf('/');
    if (!requestText || slashIndex <= 0 || slashIndex === requestText.length - 1) {
      return {
        status: 'error',
        code: 'invalid-request-path',
        message: `Invalid plugin menu request path: ${requestPath}`
      };
    }

    const pluginId = requestText.slice(0, slashIndex).trim();
    const menuPath = requestText.slice(slashIndex + 1).trim();
    if (!pluginId || !menuPath) {
      return {
        status: 'error',
        code: 'invalid-request-path',
        message: `Invalid plugin menu request path: ${requestPath}`
      };
    }

    const entry = this.getPluginEntry(pluginId);
    if (!entry?.plugin) {
      return {
        status: 'error',
        code: 'unknown-plugin',
        message: `Unknown plugin for request path ${requestText}`
      };
    }

    if (typeof entry.plugin.exportMenuOptions !== 'function') {
      return {
        status: 'error',
        code: 'unsupported-export',
        message: `Plugin ${pluginId} does not support menu options export`
      };
    }

    try {
      const response = entry.plugin.exportMenuOptions(menuPath, {
        song: this.song,
        pluginManager: this,
        sectionRef: `${options.sectionRef || ''}`,
        instrumentRef: `${options.instrumentRef || ''}`
      });

      if (!response || typeof response !== 'object') {
        return {
          status: 'error',
          code: 'invalid-export-response',
          message: `Plugin ${pluginId} returned invalid export response for ${requestText}`
        };
      }

      if (response.status !== 'ok') {
        return {
          status: 'error',
          code: response.code || 'export-rejected',
          message: response.message || `Plugin ${pluginId} rejected export for ${requestText}`
        };
      }

      const responsePluginId = `${response.pluginId || pluginId}`.trim();
      const responseMenuPath = `${response.menuPath || menuPath}`.trim();
      if (responsePluginId !== pluginId || responseMenuPath !== menuPath) {
        return {
          status: 'error',
          code: 'route-mismatch',
          message: `Requested ${pluginId}/${menuPath} but supplier returned ${responsePluginId}/${responseMenuPath}`
        };
      }

      return {
        status: 'ok',
        pluginId,
        menuPath,
        payload: response.payload
      };
    } catch (error) {
      return {
        status: 'error',
        code: 'export-failed',
        message: error?.message || `Plugin ${pluginId} export failed for ${requestText}`
      };
    }
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
    markerNode.children = reconcileMenuChildren(markerNode.children || [], this.buildPluginsMenuChildren());
    return markerNode;
  }

  buildPluginsMenuChildren() {
    return [
      ...this.getRegisteredPlugins().map((plugin) => this.buildPluginMenuNode(plugin)),
      this.buildPluginsAuditNode()
    ];
  }

  buildPluginsAuditNode() {
    return new MenuItemProxy(this, {
      name: 'pluginAudit',
      caption: buildCaption('Audit plugins', 'A'),
      trigger: 'A',
      action: 'pluginAction:audit',
      popOnBang: true
    });
  }

  buildPluginMenuNode(plugin) {
    const pluginId = plugin.getId();
    const statusToken = `plugin:${pluginId}:statusSuffix`;
    const pluginChildren = [
      ...this.buildManagedPropertyNodes(plugin),
      ...plugin.getVisibleMenuChildren()
    ];
    return new MenuItemProxy(plugin, {
      name: pluginId,
      caption: `${buildCaption(plugin.getRegisteredName(), plugin.getMenuTrigger())}${buildValueReference(statusToken)}`,
      trigger: plugin.getMenuTrigger(),
      vars: [statusToken],
      pluginId,
      children: pluginChildren
    });
  }

  pluginHasRegisteredEvents(plugin) {
    if (!plugin || typeof plugin.getEventNames !== 'function') {
      return false;
    }
    const eventNames = plugin.getEventNames();
    return Array.isArray(eventNames) && eventNames.length > 0;
  }

  getKnownPluginTriggers() {
    const triggers = [];
    this.plugins.forEach((entry) => {
      const trigger = `${entry?.plugin?.getMenuTrigger?.() || ''}`.trim().toLowerCase();
      if (!trigger || triggers.includes(trigger)) {
        return;
      }
      triggers.push(trigger);
    });
    return triggers;
  }

  getDefaultPluginTriggerOrder() {
    const knownTriggers = this.getKnownPluginTriggers();
    const result = [];

    DEFAULT_PLUGIN_TRIGGER_ORDER.forEach((trigger) => {
      if (knownTriggers.includes(trigger) && !result.includes(trigger)) {
        result.push(trigger);
      }
    });

    knownTriggers.forEach((trigger) => {
      if (!result.includes(trigger)) {
        result.push(trigger);
      }
    });

    return result;
  }

  tokenizePluginOrderInput(rawValue = '') {
    if (Array.isArray(rawValue)) {
      return rawValue.map((value) => `${value || ''}`);
    }
    const text = `${rawValue || ''}`.trim();
    if (!text) {
      return [];
    }
    if (text.includes(',')) {
      return text.split(',');
    }
    return text.split('');
  }

  normalizePluginFiringOrder(rawValue = '') {
    const knownTriggers = this.getKnownPluginTriggers();
    const preferred = this.tokenizePluginOrderInput(rawValue)
      .map((value) => `${value || ''}`.trim().toLowerCase())
      .filter((value) => value && knownTriggers.includes(value));

    const deduped = [];
    preferred.forEach((trigger) => {
      if (!deduped.includes(trigger)) {
        deduped.push(trigger);
      }
    });

    this.getDefaultPluginTriggerOrder().forEach((trigger) => {
      if (!deduped.includes(trigger)) {
        deduped.push(trigger);
      }
    });

    return deduped;
  }

  getSongPluginFiringOrder() {
    return this.normalizePluginFiringOrder(this.song?.pluginFiringOrder || []);
  }

  getPluginFiringOrderDisplay() {
    return this.getSongPluginFiringOrder().join(',');
  }

  getPluginFiringOrderInput() {
    return this.getPluginFiringOrderDisplay();
  }

  setSongPluginFiringOrder(rawValue = '') {
    const normalized = this.normalizePluginFiringOrder(rawValue);
    if (this.song && typeof this.song === 'object') {
      this.song.pluginFiringOrder = [...normalized];
    }
    this.refreshPluginsMenuNode();
    return normalized;
  }

  getEnabledPluginEntriesInTriggerOrder() {
    const orderedEntries = [];
    const triggerOrder = this.getSongPluginFiringOrder();
    triggerOrder.forEach((trigger) => {
      this.plugins.forEach((entry) => {
        if (!entry?.enabled) {
          return;
        }
        if (`${entry.plugin.getMenuTrigger() || ''}`.toLowerCase() !== trigger) {
          return;
        }
        if (!orderedEntries.includes(entry)) {
          orderedEntries.push(entry);
        }
      });
    });
    return orderedEntries;
  }

  refreshEventSubscriptions() {
    const desiredEvents = new Set();
    this.plugins.forEach((entry) => {
      if (!entry?.enabled || !this.pluginHasRegisteredEvents(entry.plugin)) {
        return;
      }
      entry.plugin.getEventNames().forEach((eventName) => desiredEvents.add(eventName));
    });

    this.eventHandlers.forEach((handler, eventName) => {
      if (desiredEvents.has(eventName)) {
        return;
      }
      this.eventBus.off(eventName, handler);
      this.eventHandlers.delete(eventName);
    });

    desiredEvents.forEach((eventName) => {
      if (this.eventHandlers.has(eventName)) {
        return;
      }
      const handler = (busEventName, payload) => {
        this.dispatchPluginEvent(busEventName, payload);
      };
      this.eventHandlers.set(eventName, handler);
      this.eventBus.on(eventName, handler);
    });
  }

  dispatchPluginEvent(eventName, payload) {
    const orderedEntries = this.getEnabledPluginEntriesInTriggerOrder();
    if (PLUGIN_ORDER_DEBUG) {
      const triggerOrder = this.getSongPluginFiringOrder().join(',');
      const matchingPlugins = orderedEntries
        .filter((entry) => entry.plugin.getEventNames().includes(eventName))
        .map((entry) => entry.plugin.getId())
        .join(',');
      console.log(`[PluginOrder] event=${eventName} order=[${triggerOrder}] listeners=[${matchingPlugins}]`);
    }

    orderedEntries.forEach((entry) => {
      if (!entry.enabled || !entry.plugin.getEventNames().includes(eventName)) {
        return;
      }

      const response = entry.plugin.handleEvent(eventName, payload, {
        song: this.song,
        pluginManager: this
      });
      const normalized = normalizePluginResponse(response, `${entry.plugin.getId()}:${eventName}`);
      if (normalized.result || normalized.message) {
        this.eventBus.trigger('PluginManager:ShowResult', {
          pluginId: entry.plugin.getId(),
          eventName,
          result: normalized.result,
          message: normalized.message
        });
      }
      this.syncSongPlugins();
    });
  }

  buildManagedPropertyNodes(plugin) {
    const pluginId = plugin.getId();
    const managedNodes = [];

    if (this.pluginHasRegisteredEvents(plugin)) {
      managedNodes.push(
        this.buildManagedBooleanNode(pluginId, 'enabled', 'Enable', 'E'),
        this.buildManagedBooleanNode(pluginId, 'enableOnSongLoad', 'Load enabled', 'L')
      );
    }

    managedNodes.push(this.buildManagedGraveyardNode(pluginId));
    return managedNodes;
  }

  buildManagedBooleanNode(pluginId, propertyName, caption, trigger) {
    const token = `plugin:${pluginId}:${propertyName}`;
    return new MenuItemProxy(this, {
      name: propertyName,
      caption: `${buildCaption(caption, trigger)} [${buildValueReference(token)}]`,
      trigger,
      action: 'pluginProperty:toggle',
      pluginId,
      propertyName,
      vars: [token]
    });
  }

  buildGraveyardInput(pluginId) {
    return {
      type: 'input',
      caption: 'graveyard key',
      default: `plugin:${pluginId}:graveyardKey`,
      datatype: 'string',
      id: 'value'
    };
  }

  buildManagedGraveyardNode(pluginId) {
    return new MenuItemProxy(this, {
      name: 'graveyard',
      caption: buildCaption('graveyard', 'g'),
      trigger: 'g',
      pluginId,
      children: [
        this.buildManagedGraveyardBuryNode(pluginId),
        this.buildManagedGraveyardRaiseNode(pluginId),
        this.buildManagedGraveyardSaveNode(pluginId),
        this.buildManagedGraveyardLinkNode(pluginId)
      ]
    });
  }

  buildManagedGraveyardBuryNode(pluginId) {
    return new MenuItemProxy(this, {
      name: 'bury',
      caption: buildCaption('bury (save+clear)', 'b'),
      trigger: 'b',
      action: 'pluginAction:graveyardBury',
      pluginId,
      popOnBang: true,
      input: this.buildGraveyardInput(pluginId)
    });
  }

  buildManagedGraveyardRaiseNode(pluginId) {
    const records = this.getPluginGraveyardRecords(pluginId, 9);
    const children = records.length > 0
      ? records.map(({ record, graveyardIndex }, index) => this.buildManagedGraveyardRaiseRecordNode(pluginId, record, graveyardIndex, index + 1))
      : [new MenuItemProxy(this, {
        name: 'noPluginSnapshots',
        caption: 'no plugin snapshots',
        action: 'noAction',
        pluginId
      })];

    return new MenuItemProxy(this, {
      name: 'raise',
      caption: buildCaption('raise', 'r'),
      trigger: 'r',
      pluginId,
      children
    });
  }

  buildManagedGraveyardRaiseRecordNode(pluginId, record, graveyardIndex, ordinal) {
    const ordinalText = `${ordinal}`;
    const captionText = this.getPluginGraveyardRecordCaption(record);
    return new MenuItemProxy(this, {
      name: `raise:${graveyardIndex}`,
      caption: `<b>${ordinalText}</b> ${captionText}`,
      trigger: ordinalText,
      action: 'pluginAction:graveyardRaise',
      pluginId,
      value: graveyardIndex,
      popOnBang: true
    });
  }

  buildManagedGraveyardSaveNode(pluginId) {
    return new MenuItemProxy(this, {
      name: 'save',
      caption: buildCaption('save', 's'),
      trigger: 's',
      action: 'pluginAction:graveyardSave',
      pluginId,
      popOnBang: true,
      input: this.buildGraveyardInput(pluginId)
    });
  }

  buildManagedGraveyardLinkNode(pluginId) {
    return new MenuItemProxy(this, {
      name: 'link',
      caption: buildCaption('link', 'l'),
      trigger: 'l',
      action: 'pluginAction:graveyardLink',
      pluginId,
      popOnBang: true,
      input: this.buildGraveyardInput(pluginId)
    });
  }

  invokeMenuAction(menuItem, args = {}) {
    if (menuItem.action === 'pluginAction:audit') {
      return this.invokePluginAuditAction();
    }

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
      case 'pluginProperty:selectByBaseID': {
        const rawBaseID = args?.[menuItem.input?.id || 'value'];
        return this.setPropertyValueByBaseID(entry, menuItem.propertyName, rawBaseID);
      }
      case 'pluginAction:invoke':
        return this.invokePluginAction(entry, menuItem.actionName, args);
      case 'pluginAction:graveyardBury': {
        const rawValue = args?.[menuItem.input?.id || 'value'];
        return this.buryPluginEntry(entry, rawValue);
      }
      case 'pluginAction:graveyardSave': {
        const rawValue = args?.[menuItem.input?.id || 'value'];
        return this.savePluginEntry(entry, rawValue);
      }
      case 'pluginAction:graveyardLink': {
        const rawValue = args?.[menuItem.input?.id || 'value'];
        return this.linkPluginEntry(entry, rawValue);
      }
      case 'pluginAction:graveyardRaise':
        return this.raisePluginSnapshotByGraveyardIndex(pluginId, menuItem.value);
      default:
        throw new Error(`Unsupported plugin action: ${menuItem.action}`);
    }
  }

  invokePluginAuditAction() {
    return {
      result: 'plugin audit',
      message: buildPluginAuditHtml({ song: this.song, pluginManager: this })
    };
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
      this.refreshPluginsMenuNode();
      return { result: `enabled=${enabled}` };
    }

    if (propertyName === 'enableOnSongLoad') {
      entry.enableOnSongLoad = parseBoolean(rawValue);
      this.syncSongPlugins();
      this.refreshPluginsMenuNode();
      return { result: `enableOnSongLoad=${entry.enableOnSongLoad}` };
    }

    if (propertyName === 'graveyardKey') {
      entry.graveyardKey = normalizeGraveyardKey(rawValue);
      this.syncSongPlugins();
      this.refreshPluginsMenuNode();
      return { result: `graveyardKey=${entry.graveyardKey}` };
    }

    const nextValue = entry.plugin.setPropertyValue(propertyName, rawValue, {
      song: this.song,
      pluginManager: this
    });
    this.syncSongPlugins();
    this.refreshPluginsMenuNode();
    return { result: `${propertyName}=${formatValue(nextValue)}` };
  }

  setPropertyValueByBaseID(entry, propertyName, rawBaseID) {
    const baseID = `${rawBaseID || ''}`.trim();
    if (!baseID) {
      throw new Error('Instrument baseID is required');
    }
    const property = entry.plugin?.getProperty?.(propertyName);
    const options = Array.isArray(property?.options) ? property.options : [];
    const option = options.find((candidate) => valueToBaseID(candidate?.value) === baseID);
    if (!option) {
      throw new Error(`Instrument baseID not found: ${baseID}`);
    }
    const result = this.setPropertyValue(entry, propertyName, option.value);
    return { result: `${propertyName}=${baseID}`, preserveMenuStack: result.preserveMenuStack === true };
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
      this.refreshPluginsMenuNode();
      return { result: `enabled=${nextValue}` };
    }

    if (propertyName === 'enableOnSongLoad') {
      entry.enableOnSongLoad = !entry.enableOnSongLoad;
      this.syncSongPlugins();
      this.refreshPluginsMenuNode();
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
    this.refreshPluginsMenuNode();
    return { result: `${propertyName}=${formatValue(nextValue)}` };
  }

  invokePluginAction(entry, actionName, args = {}) {
    const response = entry.plugin.invokeAction(actionName, {
      song: this.song,
      pluginManager: this,
      args
    });
    this.syncSongPlugins();
    this.refreshPluginsMenuNode();
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
    const resultVerb = options.resultVerb || 'buried';
    return {
      result: `${resultVerb} ${entry.plugin.getId()} as ${userKey}`,
      userKey
    };
  }

  savePluginEntry(entry, rawValue) {
    return this.storePluginSnapshot(entry, rawValue, {
      disableBeforeSnapshot: false,
      skipLoopStop: true,
      resultVerb: 'saved'
    });
  }

  getPluginGraveyardRecords(pluginId, limit = 9) {
    if (!this.song || !this.song.graveyard || !Array.isArray(this.song.graveyard.records)) {
      return [];
    }

    const records = [];
    for (let index = this.song.graveyard.records.length - 1; index >= 0; index -= 1) {
      const record = this.song.graveyard.records[index];
      if (record?.type === 'PLUGIN' && record?.context?.pluginId === pluginId) {
        records.push({ record, graveyardIndex: index });
        if (records.length >= limit) {
          break;
        }
      }
    }
    return records;
  }

  getPluginGraveyardRecordCaption(record) {
    return record?.context?.userKey
      || record?.context?.caption
      || record?.context?.logicalKey
      || `${record?.timestamp || 'snapshot'}`;
  }

  findPluginGraveyardRecordIndex(pluginId, userKey) {
    const normalizedKey = normalizeGraveyardKey(userKey);
    if (!this.song || !this.song.graveyard || !Array.isArray(this.song.graveyard.records)) {
      return -1;
    }

    for (let index = this.song.graveyard.records.length - 1; index >= 0; index -= 1) {
      const record = this.song.graveyard.records[index];
      if (record?.type !== 'PLUGIN') {
        continue;
      }
      if (record?.context?.pluginId !== pluginId) {
        continue;
      }
      if (record?.context?.userKey === normalizedKey || record?.context?.logicalKey === `${pluginId}::${normalizedKey}`) {
        return index;
      }
    }
    return -1;
  }

  findPluginGraveyardRecord(pluginId, userKey) {
    const index = this.findPluginGraveyardRecordIndex(pluginId, userKey);
    return index >= 0 ? this.song.graveyard.records[index] : null;
  }

  raisePluginSnapshotByGraveyardIndex(pluginId, graveyardIndex) {
    const index = Number.parseInt(`${graveyardIndex}`, 10);
    const record = this.song?.graveyard?.records?.[index];
    if (!record || record.type !== 'PLUGIN' || record.context?.pluginId !== pluginId) {
      return { result: `missing ${pluginId} snapshot` };
    }

    const persisted = JSON.parse(record.json);
    const result = this.importPluginSnapshot(pluginId, persisted, { autoBuryCurrent: true });
    record.lastRevived = Date.now();
    this.eventBus.trigger('PluginGraveyard:raised', { pluginId, graveyardIndex: index, userKey: record.context?.userKey });
    this.eventBus.trigger('SongUiFullRepaint');
    return {
      result: result.result || `revived ${pluginId} as ${record.context?.userKey || index}`
    };
  }

  raisePluginSnapshotByKey(pluginId, userKey) {
    const normalizedKey = normalizeGraveyardKey(userKey);
    const index = this.findPluginGraveyardRecordIndex(pluginId, normalizedKey);
    if (index < 0) {
      return { result: `missing ${pluginId}.${normalizedKey}`, missing: true };
    }
    return this.raisePluginSnapshotByGraveyardIndex(pluginId, index);
  }

  buildPluginRaiseFragment(pluginId, userKey) {
    const normalizedKey = normalizeGraveyardKey(userKey);
    return `#raise=${pluginId}.${normalizedKey}`;
  }

  appendPluginGraveyardLinkToSongInfo(entry, userKey) {
    if (!this.song) {
      return { result: 'link unavailable' };
    }

    const normalizedKey = normalizeGraveyardKey(userKey);
    const pluginId = entry.plugin.getId();
    const fragment = this.buildPluginRaiseFragment(pluginId, normalizedKey);
    const label = `${pluginId}.${normalizedKey}`;
    const line = `\n<br>Raise plugin state: <a href="${escapeHtml(fragment)}">${escapeHtml(label)}</a>`;
    this.song.info = `${this.song.info || ''}${line}`;
    this.eventBus.trigger('PluginGraveyard:linkAdded', { pluginId, userKey: normalizedKey, fragment });
    return {
      result: `linked ${label}`,
      fragment
    };
  }

  linkPluginEntry(entry, rawValue) {
    const snapshotResult = this.savePluginEntry(entry, rawValue);
    if (snapshotResult.result === 'Bury unavailable') {
      return snapshotResult;
    }

    const linkResult = this.appendPluginGraveyardLinkToSongInfo(entry, snapshotResult.userKey);
    return {
      result: linkResult.result,
      message: linkResult.fragment || ''
    };
  }

  parsePluginRaiseHash(hash = '') {
    return this.parsePluginRaiseHashEntries(hash).items;
  }

  parsePluginRaiseHashEntries(hash = '') {
    const text = `${hash || ''}`.trim().replace(/^#/, '');
    if (!text.startsWith('raise=')) {
      return { items: [], errors: [] };
    }

    const items = [];
    const errors = [];
    text
      .slice('raise='.length)
      .split(',')
      .map((segment) => segment.trim().replace(/^raise=/, ''))
      .filter(Boolean)
      .forEach((segment) => {
        const dotIndex = segment.indexOf('.');
        if (dotIndex <= 0 || dotIndex === segment.length - 1) {
          errors.push(`invalid ${segment}`);
          return;
        }
        const pluginId = segment.slice(0, dotIndex).trim();
        const userKey = segment.slice(dotIndex + 1).trim();
        if (!PLUGIN_GRAVEYARD_KEY_PATTERN.test(pluginId) || !PLUGIN_GRAVEYARD_KEY_PATTERN.test(userKey)) {
          errors.push(`invalid ${segment}`);
          return;
        }
        items.push({ pluginId, userKey });
      });
    return { items, errors };
  }

  raisePluginSnapshotsFromHash(hash = '') {
    const parsed = this.parsePluginRaiseHashEntries(hash);
    const raises = parsed.items;
    if (raises.length === 0 && parsed.errors.length === 0) {
      return { result: 'no plugin snapshots raised', message: '' };
    }

    const results = parsed.errors.concat(raises.map(({ pluginId, userKey }) => {
      try {
        const result = this.raisePluginSnapshotByKey(pluginId, userKey);
        return result.result || `${pluginId}.${userKey}`;
      } catch (error) {
        return `${pluginId}.${userKey}: ${error.message}`;
      }
    }));

    const html = results.map((result) => `<div>${escapeHtml(result)}</div>`).join('');
    this.eventBus.trigger('UserLog', { subSystem: 'PluginManager', message: html });
    return {
      result: `processed ${results.length} plugin raise link${results.length === 1 ? '' : 's'}`,
      message: html,
      results
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
    if (token === 'plugin:manager:firingOrderDisplay') {
      return this.getPluginFiringOrderDisplay();
    }
    if (token === 'plugin:manager:firingOrderInput') {
      return this.getPluginFiringOrderInput();
    }

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
    if (this.song && typeof this.song === 'object') {
      this.song.pluginFiringOrder = this.normalizePluginFiringOrder(this.song.pluginFiringOrder || []);
    }
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
    this.refreshEventSubscriptions();
    this.refreshPluginsMenuNode();
  }

  buildPluginStatusSuffix(entry) {
    const marks = [];
    if (entry.enabled && this.pluginHasRegisteredEvents(entry.plugin)) {
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
    if (entry.enabled) {
      entry.enabled = true;
      this.refreshEventSubscriptions();
      this.syncSongPlugins();
      return;
    }
    entry.enabled = true;
    if (typeof entry.plugin.enable === 'function') {
      entry.plugin.enable({ song: this.song, pluginManager: this });
    }
    this.refreshEventSubscriptions();
    this.syncSongPlugins();
  }

  disablePluginEntry(entry) {
    const wasEnabled = entry.enabled;
    entry.enabled = false;
    if (wasEnabled && typeof entry.plugin.disable === 'function') {
      entry.plugin.disable({ song: this.song, pluginManager: this });
    }
    this.refreshEventSubscriptions();
    this.syncSongPlugins();
  }
}
