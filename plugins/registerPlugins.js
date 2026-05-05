import pluginManager from './pluginRuntime.js';
import { TransposePlugin } from './transpose/TransposePlugin.js';
import { ArpeggioPlugin } from './arpeggio/ArpeggioPlugin.js';

pluginManager.register(new TransposePlugin());
pluginManager.register(new ArpeggioPlugin());
pluginManager.refreshPluginsMenuNode();

export default pluginManager;
