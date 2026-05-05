import EventBus from '../event-bus.js';
import { PluginManager } from './PluginManager.js';

export const pluginManager = new PluginManager(EventBus);

export default pluginManager;
