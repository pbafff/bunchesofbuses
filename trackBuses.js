const request = require('request');
const router = require('express').Router();
const flatten = require('arr-flatten');
const db = require('./db/index');
// const argv = require('yargs').option('dest', {type: 'array', desc: 'Bus destinations'}).option('route', {type: 'string', desc: 'Bus route'}).argv;

const APIkey = process.env.APIKEY;
const APIURL = `https://bustime.mta.info/api/siri/vehicle-monitoring.json?bustimeObj=${APIkey}&LineRef=MTA+NYCT_B8`;

const brownsville = [];
const bayRidge = [];
const hosp = [];
const layoverBuses = new Set();
const movingBuses = new Set();
const busMap = new Map();
let intervId;
let isRunning;

router.get('/toggle/:state', function (req, res) {
    if (req.params.state === 'on' && isRunning === false) {
        runInterval();
        res.status(200);
        res.end();
    } else if (req.params.state === 'on' && isRunning === true) {
        res.send('Interval is already running');
        res.end();
    } else if (req.params.state === 'off' && isRunning === true) {
        clearInterval(intervId);
        isRunning = false;
        res.status(200);
        res.end();
    } else if (req.params.state === 'off' && isRunning === false) {
        res.send('Interval is already off');
        res.end();
    } else if (req.params.state === 'status') {
        res.send(isRunning);
        res.end();
    }
});

router.get('/movingbuses', function (req, res) {
    const buses = Array.from(movingBuses).map(bus => {
        const { vehicleref, destination, state, trip_id, bunched } = bus;
        const mappedBus = {};
        mappedBus.vehicleref = vehicleref;
        mappedBus.destination = destination;
        mappedBus.state = state;
        mappedBus.trip_id = trip_id;
        mappedBus.bunched = bunched;
        return JSON.stringify(mappedBus, null, 2);
    });
    res.send({ movingBuses: buses });
    res.end();
});

router.get('/layoverbuses', function (req, res) {
    res.send({ layoverBuses: Array.from(layoverBuses) });
    res.end();
});

class Bus {
    constructor(vehicleref, destination = null, state = null, trip_id = null, bunched = false) {
        this.vehicleref = vehicleref;
        this.destination = destination;
        this.state = state;
        this.trip_id = trip_id;
        this.bunched = JSON.parse(bunched);
        this.returned = function () {
            this.state = 'tracking';
            clearTimeout(this.timeoutId);
            db.query(`INSERT INTO waiting(trip_id, time, value) VALUES ($1, NOW(), $2)`, [this.trip_id, false]).catch(e => console.log(e));
        }
    }
    wait(reason) {
        this.state = reason;
        db.query(`INSERT INTO waiting(trip_id, time, value) VALUES ($1, NOW(), $2)`, [this.trip_id, true]).catch(e => console.log(e));
        this.timeoutId = setTimeout(() => {
            db.query(`UPDATE trips SET end_time = NOW() - INTERVAL '1 HOUR', termination_reason = $1, active = $2 WHERE trip_id = $3`, [`${reason}/timeout`, false, this.trip_id]).catch(e => console.log('54', e));
            db.query(`INSERT INTO waiting(trip_id, time, value) VALUES ($1, NOW(), $2)`, [this.trip_id, false]).catch(e => console.log('55', e));
            movingBuses.delete(this);
        }, 3600000);
    }
    endNow(reason) {
        db.query(`UPDATE trips SET end_time = NOW(), termination_reason = $1, active = $2 WHERE trip_id = $3`, [reason, false, this.trip_id]).catch(e => console.log('60', e));
        clearTimeout(this.timeoutId);
        movingBuses.delete(this);
    }
    pushToRedis() {
        redis.rpush([process.env.REDIS_KEY, this.vehicleref, this.destination, this.trip_id, JSON.stringify(this.bunched)], function (err) {
            if (err) console.log(err);
        });
    }
};

function runInterval() {
    isRunning = true;
    intervId = setInterval(() => {
        request({ url: APIURL }, function (error, response, body) {
            if (error) {
                console.log('error: ', error);
            }
            try {
                var json = JSON.parse(body);
                for (var i = 0; i < json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity.length; i++) {
                    if (json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney.DirectionRef == 1 && json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney.DestinationName == "V A HOSP") {
                        hosp.push(json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney);

                    } else if (json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney.DirectionRef == 1 && json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney.DestinationName == "BAY RIDGE 95 ST STA") {
                        bayRidge.push(json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney);

                    } else if (json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney.DirectionRef == 0) {
                        brownsville.push(json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[i].MonitoredVehicleJourney);
                    }
                }
            } catch (err) {
                console.log(err)
            }
            checkForLayovers(bayRidge, brownsville, hosp);

            checkIfMovingYet(bayRidge, brownsville, hosp);

            trackBuses(bayRidge, brownsville, hosp);
        });
    }, 5000);
};

function checkForLayovers(...bustimeObjArrays) {
    //check if data on layover buses is still being returned by bustime. if not remove that bus from set.
    const everything = [];
    bustimeObjArrays.forEach(arr => {
        arr.forEach(bustimeObj => {
            everything.push(bustimeObj.VehicleRef);
        });
    });
    for (var bus of layoverBuses) {
        if (everything.indexOf(bus) === -1) {
            layoverBuses.delete(bus);
        }
    };
    //add buses to layover set
    bustimeObjArrays.forEach(arr => {
        arr.forEach(bustimeObj => {
            if (bustimeObj.ProgressRate === 'noProgress' && bustimeObj.ProgressStatus === 'layover' && layoverBuses.has(bustimeObj.VehicleRef) !== true) {
                layoverBuses.add(bustimeObj.VehicleRef);
            }
            //if element approaching or 1 stop away from end stops
        });
    });
};

function checkIfMovingYet(...bustimeObjArrays) {
    bustimeObjArrays.forEach(arr => {
        if (layoverBuses.size > 0) {
            layoverBuses.forEach(bus => {
                arr.forEach(bustimeObj => {
                    if (bustimeObj.VehicleRef === bus && bustimeObj.ProgressRate === 'normalProgress') {
                        movingBuses.add(new Bus(bus));
                        layoverBuses.delete(bus);
                    }
                });
            });
        }
    });
};

function trackBuses(...bustimeObjArrays) {
    const bustimeObjs = flatten(bustimeObjArrays);

    movingBuses.forEach(bus => {
        if (bustimeObjs.some(element => element.VehicleRef === bus.vehicleref) !== true && bus.state !== 'disappeared' && bus.state !== 'no progress') {
            bus.wait('disappeared');
        }
    });

    movingBuses.forEach(movingBus => {
        bustimeObjArrays.forEach(arr => {
            arr.forEach(bustimeObj => {
                if (bustimeObj.VehicleRef === movingBus.vehicleref && movingBus.state === null) {
                    movingBus.state = 'new';
                    movingBus.destination = bustimeObj.DestinationName;
                    busMap.set(bustimeObj, movingBus);
                } else if (bustimeObj.VehicleRef === movingBus.vehicleref && movingBus.state === 'tracking') {
                    busMap.set(bustimeObj, movingBus);
                } else if (bustimeObj.VehicleRef === movingBus.vehicleref && bustimeObj.DestinationName === movingBus.destination && movingBus.state === 'disappeared') {
                    movingBus.returned();
                    busMap.set(bustimeObj, movingBus);
                } else if (bustimeObj.VehicleRef === movingBus.vehicleref && bustimeObj.DestinationName === movingBus.destination && bustimeObj.ProgressRate === 'normalProgress' && movingBus.state === 'no progress') {
                    movingBus.returned();
                    busMap.set(bustimeObj, movingBus);
                }
            });
        });
    });

    try {
        for (let [bustimeObj, movingBus] of busMap) {
            if (movingBus.state === 'new') {
                const trip_id = bustimeObj.VehicleRef + ':' + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                db.query(`INSERT INTO trips(trip_id, begin_time, vehicleref, destination, active) VALUES ($1, NOW(), $2, $3, $4)`, [trip_id, bustimeObj.VehicleRef, bustimeObj.DestinationName, true]).catch(e => console.log('233', e));
                movingBus.trip_id = trip_id;
                movingBus.state = 'tracking';
            }

            if (movingBus.state === 'tracking' && bustimeObj.MonitoredCall) {
                if (bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop' || bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching') {
                    db.query(`INSERT INTO stops(trip_id, time, stop, stop_point_ref) SELECT $1, NOW(), $2, $3 WHERE NOT EXISTS (SELECT trip_id, stop FROM stops WHERE trip_id = $1 AND stop = $2)`, [movingBus.trip_id, bustimeObj.MonitoredCall.StopPointName, bustimeObj.MonitoredCall.StopPointRef]).catch(e => console.log('239', e));
                }
            }

            if (movingBus.state === 'tracking' && bustimeObjs.filter(element => element.DestinationName === bustimeObj.DestinationName && element.VehicleRef !== bustimeObj.VehicleRef && element.MonitoredCall).some(element => Math.abs(bustimeObj.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute - element.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute) <= 609.6)) {//meters, 2000ft
                if (movingBus.bunched) {
                    db.query(`UPDATE trips SET bunch_time = coalesce(bunch_time, 0) + 5 WHERE trip_id = $1 RETURNING bunch_time`, [movingBus.trip_id])
                        .then(res => {
                            const bunch_time = res.rows[0].bunch_time;
                            if (Number.parseInt(bunch_time) % 120 === 0 || bunch_time === 5) {
                                request({ url: `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/18/json?bustimeObj=yp3zE7zS5up8EAEqWyHMf2owUBBWIUNr&point=${bustimeObj.VehicleLocation.Latitude},${bustimeObj.VehicleLocation.Longitude}&unit=MPH` }, function (error, response, body) {
                                    try {
                                        body = JSON.parse(body);
                                        const speedRatio = body.flowSegmentData.currentSpeed / body.flowSegmentData.freeFlowSpeed;
                                        db.query(`INSERT INTO bunch_data(trip_id, time, speed, latitude, longitude) VALUES ($1, NOW(), $2, $3, $4)`, [movingBus.trip_id, speedRatio, bustimeObj.VehicleLocation.Latitude, bustimeObj.VehicleLocation.Longitude]).catch(e => console.log(e));
                                    }
                                    catch (err) {
                                        console.log(err)
                                    }
                                });
                            }
                        }).catch(e => console.log('268', e));
                } else {
                    movingBus.bunched = true;
                }
            }

            if (movingBus.bunched) {
                if (bustimeObjs.some(element => element.DestinationName === bustimeObj.DestinationName && element.VehicleRef !== bustimeObj.VehicleRef) !== true) {
                    movingBus.bunched = false;
                } else if (bustimeObjs.filter(element => element.DestinationName === bustimeObj.DestinationName && element.VehicleRef !== bustimeObj.VehicleRef).some(element => Math.abs(bustimeObj.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute - element.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute) <= 609.6) !== true) {
                    movingBus.bunched = false;
                }
            }

            if (bustimeObj.ProgressRate && bustimeObj.ProgressRate === 'noProgress')
                movingBus.wait('no progress');

            if (movingBus.DestinationName === 'BAY RIDGE 95 ST STA' && bustimeObj.MonitoredCall.StopPointName === '4 AV/95 ST') {
                if (bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching' || bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                    movingBus.endNow('reached terminal');
                }
            }

            if (movingBus.DestinationName === 'BROWNSVILLE ROCKAWAY AV' && bustimeObj.DestinationName.StopPointName === 'ROCKAWAY AV/HEGEMAN AV') {
                if (bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching' || bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                    movingBus.endNow('reached terminal');
                }
            }

            if (movingBus.DestinationName === 'V A HOSP' && bustimeObj.DestinationName.StopPointName === 'VA HOSPITAL/MAIN ENT BAY 2') {
                if (bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching' || bustimeObj.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                    movingBus.endNow('reached terminal');
                }
            }
        }
    }
    catch (err) {
        if (err) console.log(err);
    }

    busMap.clear();
};

module.exports = runInterval;
