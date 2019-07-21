const db = require('./db/index');

export default class Bunch {
    constructor(bus0, bus1) {
        this.buses = [];
        this.buses.push(bus0, bus1);
        bus0.adjBuses.push(bus1);
        bus1.adjBuses.push(bus0);
        this.distances = {};
        this.setDistances(bus0);
        this.update();
    }

    static keygen(bus0, bus1) {
        const arr = [bus0.trip_id, bus1.trip_id].sort((a, b) => a.localeCompare(b));
        return `${arr[0]}|${arr[1]}`;
    }

    addBus(bus) {
        this.buses.forEach(b => bus.adjBuses.push(b));
        this.buses.push(bus);
        this.setDistances(bus);
    }

    removeBus(bus) {
        this.buses.pop(bus);
        this.buses.forEach(b => b.adjBuses.pop(bus));
        this.removeDistances(bus);
    }

    setDistances(bus) {
        bus.adjBuses.forEach(b => {
            const dist = Math.abs(bus.CallDistanceAlongRoute - b.CallDistanceAlongRoute);
            this.distances[Bunch.keygen(bus, b)] = dist;
        });
    }

    getDistances(bus) {
        const dists = {};
        bus.adjBuses.forEach(b => dists[b.trip_id] = this.distances[Bunch.keygen(bus, b)]);
        return dists;
    }

    removeDistances(bus) {
        bus.adjBuses.forEach(b => delete this.distances[Bunch.keygen(bus, b)]);
    }

    update() {
        this.buses.forEach(bus => {
            this.setDistances(bus);
        });
        db.query(`INSERT INTO `)
    }
}
