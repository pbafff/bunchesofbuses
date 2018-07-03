var request = require('request');
var express = require('express');
var router = express.Router();
var flatten = require('arr-flatten');
var Trip = require('../models/trip');
const auth = require('express-basic-auth');
const events = require('events');

var APIkey = process.env.APIKEY;
var format = "json";
var busLine = "MTA+NYCT_B8";

var APIURL = "https://bustime.mta.info/api/siri/vehicle-monitoring." + format + "?key=" + APIkey + "&LineRef=" + busLine;
var busesGeoJSON = {};
var brownsville, hosp, bayRidge;
var layoverBuses = new Set();
var movingBuses = new Set();
var busMap = new Map();
let intervId;
let isRunning;

const username = process.env.USR;
const password = process.env.PASSWORD;

router.use(
    auth({ authorizer: myAuthorizer })
);

class Bus extends events.EventEmitter {
    constructor(bus) {
        super();
        this.vehicleref = bus;
        this.destination = null;
        this.state = null;
        this.id = null;
        this.bunched = false;
        this.on('returned', function () {
            this.state = 'tracking';
            clearTimeout(this.timeoutId);
            Trip.update({ _id: this.id }, { $push: { waiting: { time: Date.now(), value: false } } }, function (err, raw) { if (err) console.log(err) });
        });
    }
    wait(reason) {
        this.state = reason;
        Trip.update({ _id: this.id }, { $push: { waiting: { value: true, time: Date.now() } } }, function (err, raw) { if (err) console.log(err) });
        this.timeoutId = setTimeout(() => {
            Trip.update({ _id: this.id }, { active: false, end: new Date(Date.now() - 1800000), termination_reason: `${reason}/timeout`, $push: { waiting: { time: Date.now(), value: false } } }, function (err, raw) { if (err) console.log(err); });
            movingBuses.delete(this);
        }, 1800000);
    }
    endNow(reason) {
        Trip.update({ _id: this.id }, { active: false, end: Date.now(), termination_reason: reason }, function (err, raw) { if (err) console.log(err); });
        movingBuses.delete(this);
    }
};

runInterval();

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
        const { vehicleref, destination, state, id, bunched } = bus;
        const mappedBus = {};
        mappedBus.vehicleref = vehicleref;
        mappedBus.destination = destination;
        mappedBus.state = state;
        mappedBus.id = id;
        mappedBus.bunched = bunched;
        JSON.stringify(mappedBus, null, 2);
    });
    res.send({ movingBuses: buses });
    res.end();
});

router.get('/layoverbuses', function (req, res) {
    res.send({ layoverBuses: Array.from(layoverBuses) });
    res.end();
});

function myAuthorizer(user, pass) {
    return username === user && password === pass
};

function runInterval() {
    isRunning = true;
    intervId = setInterval(() => {
        request({ url: APIURL }, function (error, response, body) { //'https://215e88da-ab10-40f1-bfe1-229f1c639ac1.mock.pstmn.io/b8'
            if (error) {
                console.log('error: ', error);
            };
            brownsville = [];
            hosp = [];
            bayRidge = [];
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

function checkForLayovers(...theArgs) {
    //check if bus is still there
    var everything = [];
    theArgs.forEach((arr) => {
        arr.forEach(element => {
            everything.push(element.VehicleRef);
        });
    });
    for (var bus of layoverBuses) {
        if (everything.indexOf(bus) === -1) {
            layoverBuses.delete(bus);
        }
    };
    //add buses to layover set
    theArgs.forEach((arr) => {
        arr.forEach((element) => {
            if (element.ProgressRate === 'noProgress' && element.ProgressStatus === 'layover' && layoverBuses.has(element.VehicleRef) !== true) {
                layoverBuses.add(element.VehicleRef);
            }
            //if element approaching or 1 stop away from end stops
        });
    });
};

function checkIfMovingYet(...theArgs) {
    theArgs.forEach(arr => {
        if (layoverBuses.size > 0) {
            layoverBuses.forEach((element) => {
                arr.forEach((bus) => {
                    if (bus.VehicleRef === element && bus.ProgressRate === 'normalProgress') {
                        movingBuses.add(new Bus(element));
                        layoverBuses.delete(element);
                    }
                });
            });
        }
    });
};

function trackBuses(...theArgs) {
    movingBuses.forEach(bus => {
        if (flatten(theArgs).some(element => element.VehicleRef === bus.vehicleref) !== true && bus.state !== 'disappeared' && bus.state !== 'no progress') {
            bus.wait('disappeared');
        }
    });
    movingBuses.forEach(bus => {
        theArgs.forEach(arr => {
            arr.forEach(element => {
                if (element.VehicleRef === bus.vehicleref && bus.state === null) {
                    bus.state = 'new';
                    bus.destination = element.DestinationName;
                    busMap.set(element, bus);
                } else if (element.VehicleRef === bus.vehicleref && bus.state === 'tracking') {
                    busMap.set(element, bus);
                } else if (element.VehicleRef === bus.vehicleref && element.DestinationName === bus.destination && bus.state === 'disappeared') {
                    bus.emit('returned');
                    busMap.set(element, bus);
                } else if (element.VehicleRef === bus.vehicleref && element.DestinationName === bus.destination && element.ProgressRate === 'normalProgress' && bus.state === 'no progress') {
                    bus.emit('returned');
                    busMap.set(element, bus);
                }
            })
        })
    });
    try {
        for (let [key, value] of busMap) {
            if (value.state === 'new') {
                var busInstance = new Trip({ trip_id: key.VehicleRef + ':' + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), vehicleref: key.VehicleRef, begin: Date.now(), destination: key.DestinationName, active: true });
                busInstance.save(function (err, doc) {
                    if (err) return handleError(err);
                    value.id = doc._id;
                });
                value.state = 'tracking';
            }
            if (value.state === 'tracking' && key.MonitoredCall) {
                if (key.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop' || key.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching') {
                    Trip.update({ _id: value.id, 'stops.stop': { $ne: key.MonitoredCall.StopPointName }, active: true }, { $push: { stops: { time: Date.now(), stop: key.MonitoredCall.StopPointName } } }, function (err, raw) {
                        if (err) console.log(err);
                    });
                }
            }
            if (value.state === 'tracking' && flatten(theArgs).filter(element => element.DestinationName === key.DestinationName && element.VehicleRef !== key.VehicleRef && element.MonitoredCall).some(element => Math.abs(key.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute - element.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute) <= 609.6)) {
                if (value.bunched) {
                    Trip.findOneAndUpdate({ _id: value.id }, { $inc: { bunch_time: 5 } }).exec(function (err, doc) {
                        if (err) console.log(err);
                        if (doc.bunch_time % 120 === 0) {
                            request({ url: 'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/18/json?key=yp3zE7zS5up8EAEqWyHMf2owUBBWIUNr&point=' + key.VehicleLocation.Latitude + ',' + key.VehicleLocation.Longitude + '&unit=MPH' }, function (error, response, body) {
                                try {
                                    body = JSON.parse(body);
                                    let speedRatio = body.flowSegmentData.currentSpeed / body.flowSegmentData.freeFlowSpeed;
                                    Trip.update({ _id: doc._id }, { $push: { bunch_data: { time: Date.now(), speed: speedRatio, coordinates: [key.VehicleLocation.Latitude, key.VehicleLocation.Longitude] } } }, function (err, raw) { if (err) console.log(err); });
                                }
                                catch (err) {
                                    console.log(err)
                                }
                            });
                        }
                    });
                } else {
                    value.bunched = true;
                }
            }
            if (value.bunched && flatten(theArgs).filter(element => element.DestinationName === key.DestinationName && element.VehicleRef !== key.VehicleRef).some(element => Math.abs(key.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute - element.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute) <= 609.6) !== true) {
                value.bunched = false;
            }
            if (key.ProgressRate && key.ProgressRate === 'noProgress') {
                value.wait('no progress');
                continue;
            }
            if (key.DestinationName === 'BAY RIDGE 95 ST STA' && key.MonitoredCall.StopPointName === '4 AV/95 ST') {
                if (key.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching' || key.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                    value.endNow('reached terminal');
                }
            }
            if (key.DestinationName === 'BROWNSVILLE ROCKAWAY AV' && key.DestinationName.StopPointName === 'ROCKAWAY AV/HEGEMAN AV') {
                if (key.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching' || key.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                    value.endNow('reached terminal');
                }
            }
            if (key.DestinationName === 'V A HOSP' && key.DestinationName.StopPointName === 'VA HOSPITAL/MAIN ENT BAY 2') {
                if (key.MonitoredCall.Extensions.Distances.PresentableDistance === 'approaching' || key.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                    value.endNow('reached terminal');
                }
            }
        }
    }
    catch (err) {
        if (err) console.log(err);
    }
    busMap.clear();
};

function createGeoJSON(socket) {
    busesGeoJSON = {
        "type": "FeatureCollection",
        "timestamp": new Date().toLocaleString(),
        "features": []
    };

    function pushTemplates(arr) {
        if (arr && arr.length > 0) {
            arr.forEach(element => {
                var template = { //rewrite as constructor
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": []
                    },
                    "properties": {}
                };
                try {
                    template.geometry.coordinates.push(element.VehicleLocation.Longitude);
                    template.geometry.coordinates.push(element.VehicleLocation.Latitude);
                    template.properties.VehicleRef = element.VehicleRef;
                    template.properties.DirectionRef = element.DirectionRef;
                    template.properties.DestinationName = element.DestinationName;
                    template.properties.Distances = element.MonitoredCall.Extensions.Distances; //Cannot read property 'Extensions' of undefined
                    template.properties.StopPointName = element.MonitoredCall.StopPointName;
                    template.properties.ProgressRate = element.ProgressRate;
                    busesGeoJSON.features.push(template);
                }
                catch (err) {
                    console.log(new Date().toLocaleString());
                    console.log(err)
                }
            });
        };
    };
    pushTemplates(brownsville);
    pushTemplates(bayRidge);
    pushTemplates(hosp);

    if (busesGeoJSON.features.length > 0) {
        busesGeoJSON = JSON.stringify(busesGeoJSON, null, 3);
        socket.emit('JSON update', busesGeoJSON)
    };
};

module.exports = function (io) {
    // let emittedChange;
    // Trip.watch().on('change', change => emittedChange = change);
    //Socket.IO
    io.on('connection', function (socket) {
        createGeoJSON(socket)
        // socket.emit('JSON update', busesGeoJSON);

        console.log('#####User has connected to apicall####');
        //ON Events

        socket.emit('message', 'You are connected to apicall');

        setInterval(() => {
            createGeoJSON(socket);
            // socket.emit('JSON update', busesGeoJSON);
        }, 5000);

        //End ON Events
    });
    return router;
};