import pluginManager from './pluginRuntime.js';
import { TransposePlugin } from './transpose/TransposePlugin.js';
import { ArpeggioPlugin } from './arpeggio/ArpeggioPlugin.js';
import { ClipPlugin } from './clip/ClipPlugin.js';
import { FillPlugin } from './fill/FillPlugin.js';
import { MovePlugin } from './move/MovePlugin.js';
import { TonalPlugin } from './tonal/TonalPlugin.js';

pluginManager.register(new TransposePlugin());
pluginManager.register(new ArpeggioPlugin());
pluginManager.register(new ClipPlugin());
pluginManager.register(new FillPlugin());
pluginManager.register(new MovePlugin());
pluginManager.register(new TonalPlugin());
pluginManager.refreshPluginsMenuNode();

export default pluginManager;
