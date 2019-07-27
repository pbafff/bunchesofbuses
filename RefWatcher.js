const uuid = require('uuid/v4');

module.exports = class RefWatcher {
    constructor(VehicleRef, DestinationName) {
        this.VehicleRef = VehicleRef;
        this.DestinationName = DestinationName;
        this.timerId;
    }

    newDeleteTimer() {
        if (this.timerId) clearInterval(this.timerId);

        this.timerId = setInterval(() => {
            RefWatcher.watchers.splice(RefWatcher.watchers.indexOf(this), 1);
        }, 3600000);
    }

    static watchers = [];

    static addRef(stop) {
        const newRef = new RefWatcher(stop.VehicleRef, stop.DestinationName);
        RefWatcher.watchers.push(newRef);
        return newRef;
    }

    static scanRefs(stops) {
        stops.forEach(x => {
            let watcher;
            if (watcher = RefWatcher.watchers.find(y => x.VehicleRef == y.VehicleRef)) {
                if (watcher.DestinationName !== x.DestinationName) {
                    const newId = uuid();
                    x.JourneyId = newId;
                    watcher.JourneyId = newId;
                    watcher.DestinationName = x.DestinationName;
                    watcher.newDeleteTimer();
                } else {
                    x.JourneyId = watcher.JourneyId;
                    watcher.newDeleteTimer();
                }
            }
            else {
                watcher = RefWatcher.addRef(x);
                const newId = uuid();
                x.JourneyId = newId;
                watcher.JourneyId = newId;
                watcher.newDeleteTimer();
            }
        });
    }
}
