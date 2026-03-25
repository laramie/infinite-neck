export class Wiring {
    constructor(tablename = "", relativeSection = "", listenToTablename = ""){
        this.tablename = tablename;
        this.relativeSection = relativeSection;
        this.listenToTablename = listenToTablename;
    }
}