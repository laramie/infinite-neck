export const ArpeggioPlugin = {
  events: ['DaCapo:OnSongEnd', 'DaCapo:OnSectionBegin'],
  handleEvent(eventName, payload, config) {
    console.log("ArpeggioPlugin::handleEvent:"+JSON.stringify(config));
  }
};
