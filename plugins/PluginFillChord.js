// plugins/PluginFillChord.js
import { fillChord } from '../NoteTableController.js';

export const PluginFillChord = {
  events: ['DaCapo:OnSongEnd', 'DaCapo:OnSectionBegin'],
  handleEvent(eventName, payload, config) {
    // config can be used to select chord/scale/root, or just call fillChord()
    fillChord();
  }
};
