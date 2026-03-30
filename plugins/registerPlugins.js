// plugins/registerPlugins.js
import { PluginManager } from './PluginManager.js';
import { PluginTransposeSong } from './PluginTransposeSong.js';
import { PluginFillChord } from './PluginFillChord.js';
import EventBus from '../event-bus.js';

// Example config objects (could come from GUI/REPL)
const transposeConfig = { amount: 1, NamedNotes: true, PlayedNotes: false, RecordedNotes: false };
const fillChordConfig = { /* future: chord/scale/root options */ };

const pluginManager = new PluginManager(EventBus);
pluginManager.register(PluginTransposeSong, transposeConfig);
pluginManager.register(PluginFillChord, fillChordConfig);

// Export for use elsewhere
export default pluginManager;
