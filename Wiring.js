const wiringDefaults  = {
    tablename: "",
    relativeSection: "",
    listenToTablename: "",
    listenerProjection: 'row-midi'
};
export class Wiring {
    constructor(obj = {}) {
         Object.assign(this, wiringDefaults, obj);
    }

    toJSON() {
        const json = {
            tablename: this.tablename,
            relativeSection: this.relativeSection,
            listenToTablename: this.listenToTablename
        };
        if (this.listenerProjection && this.listenerProjection !== wiringDefaults.listenerProjection) {
            json.listenerProjection = this.listenerProjection;
        }
        return json;
    }
}