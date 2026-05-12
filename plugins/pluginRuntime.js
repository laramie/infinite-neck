import EventBus from '../event-bus.js';
import { setGraveyardPluginSnapshotImporter } from '../graveyard.js';
import { PluginManager } from './PluginManager.js';

export const pluginManager = new PluginManager(EventBus);

setGraveyardPluginSnapshotImporter((pluginId, persisted, options) => {
	return pluginManager.importPluginSnapshot(pluginId, persisted, options);
});

export default pluginManager;
