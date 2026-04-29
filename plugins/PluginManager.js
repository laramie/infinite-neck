// plugins/PluginManager.js
export class PluginManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.plugins = [];
  }

  register(plugin, config = {}) {
    this.plugins.push({ plugin, config });
    (plugin.events || []).forEach(eventName => {
      this.eventBus.on(eventName, payload => plugin.handleEvent(eventName, payload, config));
    });
  }

  unregister(plugin) {
    this.plugins = this.plugins.filter(p => p.plugin !== plugin);
    (plugin.events || []).forEach(eventName => {
      this.eventBus.off(eventName, plugin.handleEvent);
    });
  }
}
