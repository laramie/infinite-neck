
// Minimal EventBus (no jQuery)
const EventBus = {
  _events: {},
  on(event, handler) {
    console.log("EventBus.on: "+event+" handler:"+JSON.stringify(handler));
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
  },
  off(event, handler) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(h => h !== handler);
  },
  trigger(event, data) {
    console.log("EventBus.trigger:"+JSON.stringify(event)+" data:"+JSON.stringify(data));
    if (!this._events[event]) return;
    this._events[event].forEach(handler => handler(event, data));
  }
};

export default EventBus;


