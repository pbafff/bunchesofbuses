const db = require('./db/index');

export default class Bus {
    constructor(vehicleref, destination = null, state = null, trip_id = null, bunched = false) {
        this.vehicleref = vehicleref;
        this.destination = destination;
        this.state = state;
        this.trip_id = trip_id;
        this.bunched = JSON.parse(bunched);
        this.adjBuses = [];
    }

    static layoverBuses = new Set();
    static movingBuses = new Set();
    static busMap = new Map();

    addBunch(bunch) {
        this.bunch = bunch;
    }

    wait(reason) {
        this.state = reason;
        db.query(`INSERT INTO waiting(trip_id, time, value) VALUES ($1, NOW(), $2)`, [this.trip_id, true]).catch(e => console.log(e));
        this.timeoutId = setTimeout(() => {
            db.query(`UPDATE trips SET end_time = NOW() - INTERVAL '1 HOUR', termination_reason = $1, active = $2 WHERE trip_id = $3`, [`${reason}/timeout`, false, this.trip_id]).catch(e => console.log('54', e));
            db.query(`INSERT INTO waiting(trip_id, time, value) VALUES ($1, NOW(), $2)`, [this.trip_id, false]).catch(e => console.log('55', e));
            Bus.movingBuses.delete(this);
        }, 3600000);
    }

    returned() {
        this.state = 'tracking';
        clearTimeout(this.timeoutId);
        db.query(`INSERT INTO waiting(trip_id, time, value) VALUES ($1, NOW(), $2)`, [this.trip_id, false]).catch(e => console.log(e));
    }

    endNow(reason) {
        db.query(`UPDATE trips SET end_time = NOW(), termination_reason = $1, active = $2 WHERE trip_id = $3`, [reason, false, this.trip_id]).catch(e => console.log('60', e));
        clearTimeout(this.timeoutId);
        Bus.movingBuses.delete(this);
    }
}
