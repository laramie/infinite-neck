export class Wiring {
    constructor(tablename = "", relativeSection = "", listenToTablename = ""){
        this.tablename = tablename;
        this.relativeSection = relativeSection;
        this.listenToTablename = listenToTablename;
    }

    static fromJSON(wiringLike) {
        if (wiringLike instanceof Wiring) {
            return wiringLike;
        }
        const safeWiring = (wiringLike && typeof wiringLike === 'object') ? wiringLike : {};
        return new Wiring(
            safeWiring.tablename ?? "",
            safeWiring.relativeSection ?? "",
            safeWiring.listenToTablename ?? ""
        );
    }

	toJSON() {
		return {
			tablename: this.tablename,
			relativeSection: this.relativeSection,
			listenToTablename: this.listenToTablename
		};
	}

	clone() {
		return Wiring.fromJSON(this.toJSON());
	}
}