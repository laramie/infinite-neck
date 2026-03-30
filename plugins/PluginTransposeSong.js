// plugins/PluginTransposeSong.js
import { transposeSong } from '../infinite-neck.js';

export const PluginTransposeSong = {
  events: ['DaCapo:OnSongEnd', 'DaCapo:OnSectionBegin'],
  handleEvent(eventName, payload, config) {
    // config: { amount, NamedNotes, PlayedNotes, RecordedNotes }
    transposeSong(config.amount, config);
  }
};
