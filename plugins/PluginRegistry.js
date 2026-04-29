// plugins/PluginRegistry.js
// A vanilla module for dynamic plugin registration and management
// Usage: import pluginRegistry and call register/unregister as needed

import { PluginManager } from './PluginManager.js';
import EventBus from '../event-bus.js';

// Singleton PluginManager instance
const pluginManager = new PluginManager(EventBus);

// Register a plugin with config
export function registerPlugin(plugin, config = {}) {
  pluginManager.register(plugin, config);
}

// Unregister a plugin
export function unregisterPlugin(plugin) {
  pluginManager.unregister(plugin);
}

// List all registered plugins (for debugging or UI)
export function listPlugins() {
  return pluginManager.plugins.map(({ plugin, config }) => ({ plugin, config }));
}

// Export the manager in case direct access is needed
export default pluginManager;
