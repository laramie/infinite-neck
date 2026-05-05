// plugins/registerPlugins.js
import { PluginManager } from './PluginManager.js';
import { TransposePlugin } from './transpose/TransposePlugin.js';
import { ArpeggioPlugin } from './arpeggio/ArpeggioPlugin.js';
import EventBus from '../event-bus.js';

const transposeConfig = { amount: 1, NamedNotes: true, PlayedNotes: false, RecordedNotes: false };
const arpeggioConfig = { /* future: chord/scale/root options */ };

const pluginManager = new PluginManager(EventBus);
pluginManager.register(TransposePlugin, transposeConfig);
pluginManager.register(ArpeggioPlugin, arpeggioConfig);

// Export for use elsewhere
export default pluginManager;
