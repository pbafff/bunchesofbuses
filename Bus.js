const db = require('./db/index');

module.exports = class Bus {
    constructor(vehicleref, destination = null, state = null, trip_id = null) {
        this.vehicleref = vehicleref;
        this.destination = destination;
        this.state = state;
        this.trip_id = trip_id;
    }

    static layoverBuses = new Set();
    static movingBuses = new Set();
    static busMap = new Map();
    static called = 0;

    static getPositions(...destinations) {
        let pos;

        if (pos = Array.from(Bus.movingBuses)
            .filter(x => destinations.includes(x.destination))
            .map(x => {
                return { trip_id: x.trip_id, latitude: x.latitude, longitude: x.longitude, distance: x.distance }
            })
            .sort((a, b) => a.distance - b.distance)) {

            const distances = pos.map((x, i, arr) => { if (arr[i + 1]) return arr[i + 1].distance - x.distance });

            distances.pop();

            const odds = [];
            for (let x = 0; x <= pos.length - 1; x++) {
                odds.push(2 * x + 1);
            }

            for (let x = 0; x < odds.length - 1; x++) {
                pos.splice(odds[x], 0, { d: distances[x] });
            }

            return pos;
        } else return 0;
    }

    updatePositions = (function () {
        if (Bus.called) return;
        Bus.called++;

        setInterval(() => {
            if (Bus.getPositions(['BAY RIDGE 95 ST STA'])) {
                db.query(`INSERT INTO positions VALUES (NOW(), $1, $2)`, ['BROWNSVILLE ROCKAWAY AV', Bus.getPositions(['BROWNSVILLE ROCKAWAY AV'])]).catch(e => console.log(e));
            }

            if (Bus.getPositions(['BAY RIDGE 95 ST STA', 'V A HOSP'])) {
                db.query(`INSERT INTO positions VALUES (NOW(), $1, $2)`, ['BAY RIDGE 95 ST STA/V A HOSP', Bus.getPositions(['BAY RIDGE 95 ST STA', 'V A HOSP'])]).catch(e => console.log(e));
            }
        }, 60000);
    })()

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
