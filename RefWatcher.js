const uuid = require('uuid/v4');
const db = require('./db/index');

module.exports = class RefWatcher {
    constructor(VehicleRef, DestinationName) {
        this.VehicleRef = VehicleRef;
        this.DestinationName = DestinationName;
    }

    static watchers = [];

    static addRef(stop) {
        const newRef = new RefWatcher(stop.VehicleRef, stop.DestinationName);
        RefWatcher.watchers.push(newRef);
        return newRef;
    }

    static async scanRefs(stops) {
	for (let i = 0; i < stops.length; i++) {
		let watcher;
            if (watcher = RefWatcher.watchers.find(y => stops[i].VehicleRef == y.VehicleRef)) {
                let mostRecent = await db.query('SELECT MAX(recordedattime) FROM stops WHERE journeyid = $1', [watcher.JourneyId]);
                mostRecent = mostRecent.rows[0].max;
                if (mostRecent != null && Date.now() - Date.parse(mostRecent) < 3600000) {
                    if (watcher.DestinationName !== stops[i].DestinationName) {
                        const newId = uuid();
                        stops[i].JourneyId = newId;
                        watcher.JourneyId = newId;
                        watcher.DestinationName = stops[i].DestinationName;
                    } else {
                        stops[i].JourneyId = watcher.JourneyId;
                    }
                } else {
                    const newId = uuid();
                    stops[i].JourneyId = newId;
                    watcher.JourneyId = newId;
                    watcher.DestinationName = stops[i].DestinationName;
                }
            }
            else {
                watcher = RefWatcher.addRef(stops[i]);
                const newId = uuid();
                stops[i].JourneyId = newId;
                watcher.JourneyId = newId;
            }
	} 
    }
}
