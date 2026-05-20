
// Minimal EventBus (no jQuery)
const EventBus = {
  _events: {},
  _logEvents: false,
  on(event, handler) {
    //console.log("EventBus.on: "+event+" handler:"+JSON.stringify(handler));
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
  },
  off(event, handler) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(h => h !== handler);
  },
  trigger(event, data) {
    if (this._logEvents){
      //if (  event.startsWith("DaCapo")
      //   || event.startsWith("Looper")){
      let stack = getStack();
        console.log("EventBus.trigger:"+JSON.stringify(event)+" data:"+JSON.stringify(data)+stack);
      //}
    }
    if (!this._events[event]) return;
    this._events[event].forEach(handler => handler(event, data));
  },
  getLogEvents(){
    return this._logEvents;
  },
  setLogEvents(val){
    this._logEvents = val;
    console.log("EventBus logEvents:"+this._logEvents);
    return val;    
  }
};

function getStack(){
  try {
    let ls = new Error("EventBus Location");
    ls.name = "LocationStack";
    throw ls;
  } catch (e) {
    return `\n${e.stack}`;
  }

}

export default EventBus;


