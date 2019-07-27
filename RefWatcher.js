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

    static scanRefs(stops) {
        stops.forEach(async x => {
            let watcher;
            if (watcher = RefWatcher.watchers.find(y => x.VehicleRef == y.VehicleRef)) {
                let mostRecent = await db.query('SELECT MAX(recordedattime) FROM stops WHERE journeyid = $1', [watcher.JourneyId]);
                mostRecent = mostRecent.rows[0].max;
                if (mostRecent && Date.now() - Date.parse(mostRecent) < 3600000) {
                    if (watcher.DestinationName !== x.DestinationName) {
                        const newId = uuid();
                        x.JourneyId = newId;
                        watcher.JourneyId = newId;
                        watcher.DestinationName = x.DestinationName;
                    } else {
                        x.JourneyId = watcher.JourneyId;
                    }
                } else {
                    const newId = uuid();
                    x.JourneyId = newId;
                    watcher.JourneyId = newId;
                    watcher.DestinationName = x.DestinationName;
                }
            }
            else {
                watcher = RefWatcher.addRef(x);
                const newId = uuid();
                x.JourneyId = newId;
                watcher.JourneyId = newId;
            }
        });
    }
}
