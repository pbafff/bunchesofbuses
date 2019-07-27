const uuid = require('uuid/v4');

module.exports =  class RefWatcher {
    constructor(VehicleRef, DestinationName) {
        this.VehicleRef = VehicleRef;
        this.DestinationName = DestinationName;
        this.timerId;
    }

    newDeleteTimer() {
        if (this.timerId) clearInterval(this.timerId);

        this.timerId = setInterval(() => {
            RefWatcher.refs.delete(this);
        }, 10800000);
    }

    static refs = new Set();

    static addRef(stop) {
        const newRef = new RefWatcher(stop.VehicleRef, stop.DestinationName);
        RefWatcher.refs.add(newRef);
        return newRef;
    }

    static scanRefs(stops) {
        const refs = Array.from(RefWatcher.refs);

        stops.forEach(x => {
            let y;
            if (y = refs.find(y => x.VehicleRef == y.VehicleRef)) {
                if (y.DestinationName !== x.DestinationName) {
                    x.JourneyId = uuid();
                    y.DestinationName = x.DestinationName;
                    y.newDeleteTimer();
                }
            } 
            else {
                y = RefWatcher.addRef(x);
                y.newDeleteTimer();
                x.JourneyId = uuid();
            }
        });
    }
}
