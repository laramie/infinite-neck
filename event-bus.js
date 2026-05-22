
// Minimal EventBus (no jQuery)
const EventBus = {
  _events: {},
  _logEvents: false,
  _wantStack: false,
  _logOptions: {},
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

      let showEvent = true;
      if (this._logOptions.filter && this._logOptions.filter.length>0){
        showEvent = false;
        let filterArray = this._logOptions.filter;
        for (let nameStart of filterArray) {
          if (event.startsWith(nameStart)) {
            showEvent = true;
            break;
          }
        }
      }
      if (showEvent){
        this._wantStack = false;
        let stack = this._wantStack ? getStack() : "";
        let msg =  " data:"+JSON.stringify(data)+stack; 
        let wantData = this._logOptions.data;
        if (!wantData){
          msg = '';
        }
        console.log(`%c ${event} #${gLogCount++} %c ${msg}`, "background: #78ff03; color: #740202; border-radius: 5px; padding: 3px;", "color: white;");
      }
    }
    if (!this._events[event]) return;
    this._events[event].forEach(handler => handler(event, data));
  },
  getLogEvents(){
    return this._logEvents;
  },
  setLogEvents(val, obj={}){
    this._logEvents = val;
    this._logOptions = obj;
    this._wantStack = obj.stack;
    console.log("EventBus logEvents:"+this._logEvents+' options:'+JSON.stringify(obj));
    return val;    
  }
};

let gLogCount = 0;

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


