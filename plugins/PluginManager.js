import { gMenuFile } from '../menu.js';
import { MenuItemProxy } from './MenuItemProxy.js';
import { buildCaption } from './PluginProperty.js';

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
    const enabledToken = `plugin:${pluginId}:enabled`;
    const pluginChildren = [
      ...this.buildManagedPropertyNodes(pluginId),
      ...plugin.getVisibleMenuChildren()
    ];
    return new MenuItemProxy(plugin, {
      name: pluginId,
      caption: `${buildCaption(plugin.getRegisteredName(), plugin.getMenuTrigger())} [$${enabledToken}]`,
      trigger: plugin.getMenuTrigger(),
      vars: [enabledToken],
      pluginId,
      children: pluginChildren
    });
  }

  buildManagedPropertyNodes(pluginId) {
    return [
      this.buildManagedBooleanNode(pluginId, 'enabled', 'enabled', 'e'),
      this.buildManagedBooleanNode(pluginId, 'enableOnSongLoad', 'load enabled', 'l')
    ];
  }

  buildManagedBooleanNode(pluginId, propertyName, caption, trigger) {
    const token = `plugin:${pluginId}:${propertyName}`;
    return new MenuItemProxy(this, {
      name: propertyName,
      caption: `${buildCaption(caption, trigger)} [$${token}]`,
      trigger,
      action: 'pluginProperty:set',
      pluginId,
      propertyName,
      vars: [token],
      popOnBang: true,
      input: {
        type: 'input',
        caption: 'true|false',
        default: token,
        datatype: 'boolean',
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
      case 'pluginProperty:select':
        return this.setPropertyValue(entry, menuItem.propertyName, menuItem.value);
      case 'pluginAction:invoke':
        return this.invokePluginAction(entry, menuItem.actionName);
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
      return { result: `enabled=${enabled}` };
    }

    if (propertyName === 'enableOnSongLoad') {
      entry.enableOnSongLoad = parseBoolean(rawValue);
      return { result: `enableOnSongLoad=${entry.enableOnSongLoad}` };
    }

    const nextValue = entry.plugin.setPropertyValue(propertyName, rawValue, {
      song: this.song,
      pluginManager: this
    });
    return { result: `${propertyName}=${formatValue(nextValue)}` };
  }

  invokePluginAction(entry, actionName) {
    const response = entry.plugin.invokeAction(actionName, {
      song: this.song,
      pluginManager: this
    });
    if (typeof response === 'string') {
      return { result: response };
    }
    if (response && typeof response === 'object') {
      return {
        result: response.result || `${actionName}`,
        message: response.message || ''
      };
    }
    return { result: `${actionName}` };
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
    if (fieldName === 'enableOnSongLoad') {
      return entry.enableOnSongLoad;
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

      const persisted = persistedPlugins[pluginId];
      if (persisted && persisted.properties && typeof persisted.properties === 'object') {
        entry.plugin.loadSongState(persisted.properties, {
          song: this.song,
          pluginManager: this
        });
      }

      if (persisted) {
        entry.enabled = !!persisted.enabled;
        entry.enableOnSongLoad = !!persisted.enableOnSongLoad;
      }
      if (entry.enableOnSongLoad) {
        entry.enabled = true;
      }
      if (entry.enabled) {
        this.enablePluginEntry(entry);
      }
    });

    this.refreshPluginsMenuNode();
  }

  exportSongPluginState() {
    const result = {};
    this.plugins.forEach((entry, pluginId) => {
      result[pluginId] = {
        enabled: !!entry.enabled,
        enableOnSongLoad: !!entry.enableOnSongLoad,
        properties: entry.plugin.exportSongState()
      };
    });
    return result;
  }

  enablePluginEntry(entry) {
    if (entry.handlers.size > 0) {
      entry.enabled = true;
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
        entry.plugin.handleEvent(busEventName, payload, {
          song: this.song,
          pluginManager: this
        });
      };
      entry.handlers.set(eventName, handler);
      this.eventBus.on(eventName, handler);
    });
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
  }
}
