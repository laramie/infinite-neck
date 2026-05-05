import { transposeSong } from '../../infinite-neck.js';

export const TransposePlugin = {
  events: ['DaCapo:OnSongEnd', 'DaCapo:OnSectionBegin'],
  handleEvent(eventName, payload, config) {
    console.log("TransposePlugin::handleEvent:"+JSON.stringify(config));
    //transposeSong(config.amount, config);
  }
};
