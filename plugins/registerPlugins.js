import pluginManager from './pluginRuntime.js';
import { TransposePlugin } from './transpose/TransposePlugin.js';
import { ArpeggioPlugin } from './arpeggio/ArpeggioPlugin.js';
import { FillPlugin } from './fill/FillPlugin.js';

pluginManager.register(new TransposePlugin());
pluginManager.register(new ArpeggioPlugin());
pluginManager.register(new FillPlugin());
pluginManager.refreshPluginsMenuNode();

export default pluginManager;
