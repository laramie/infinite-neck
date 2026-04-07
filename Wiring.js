const wiringDefaults  = {
    tablename: "",
    relativeSection: "",
    listenToTablename: ""
};
export class Wiring {
    constructor(obj = {}) {
         Object.assign(this, wiringDefaults, obj);
    }
}