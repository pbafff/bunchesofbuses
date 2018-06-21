var request = require('request');
var express = require('express');
var router = express.Router();
var flatten = require('arr-flatten');
var Trip = require('../models/trip');

var APIkey = process.env.APIKEY;
var format = "json";
var busLine = "MTA+NYCT_B8";

var APIURL = "https://bustime.mta.info/api/siri/vehicle-monitoring." + format + "?key=" + APIkey + "&LineRef=" + busLine;
var busesGeoJSON = {};
var brownsville, hosp, bayRidge;
var layoverBuses = new Set();
var movingBuses = new Set();
let intervId;
let isRunning = false;

router.get('/toggle/:state', function(req, res) {
    if (req.params.state === 'on') {
        isRunning = true;
        intervId = setInterval(() => {
        request({ url: APIURL }, function (error, response, body) { //'https://215e88da-ab10-40f1-bfe1-229f1c639ac1.mock.pstmn.io/b8'
            if (error) {
                console.log('error: ', error);
            };
            brownsville = [];
            hosp = [];
            bayRidge = [];
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
    
            checkForLayovers(bayRidge, brownsville, hosp);
    
            checkIfMovingYet(bayRidge, brownsville, hosp);
    
            trackBuses(movingBuses, bayRidge, brownsville, hosp);
        });
        }, 5000);
        res.status(200);
        res.end();
    } else if (req.params.state === 'off') {
        clearInterval(intervId);
        isRunning = false;
        res.status(200);
        res.end();
    } else if (req.params.state === 'state') {
        res.send(isRunning);
        res.end();
    }
});

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
            console.log(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' | Dissappeared from layovers: ', bus);
        }
    };
    //add buses to layover set
    theArgs.forEach((arr) => {
        arr.forEach((element) => {
            if (element.ProgressRate === 'noProgress' && element.ProgressStatus === 'layover' && layoverBuses.has(element.VehicleRef) !== true) {
                layoverBuses.add(element.VehicleRef);
                console.log(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' | Current Layovers: ', layoverBuses);
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
                        movingBuses.add(element);
                        layoverBuses.delete(element);
                        console.log('moving buses ', movingBuses);
                    }
                });
            });
        }
    });
};

function trackBuses(movingBuses, ...theArgs) {
    var busMap = new Map();
    movingBuses.forEach(bus => {
        if (flatten(theArgs).some(element => element.VehicleRef === bus.slice(0, 12)) !== true) {
            movingBuses.delete(bus);
            Trip.update({vehicleref: bus.slice(0, 12)}, {active: false, end: Date.now()}, {sort: {begin: 'desc'}}, function (err, raw) {if (err) console.log(err)});
        }
        theArgs.forEach(arr => {
            arr.forEach(element => {
                if (element.VehicleRef === bus && bus.includes('tracking') !== true && bus.includes('bunched') !== true) {
                    busMap.set(element, 'new');
                } else if (element.VehicleRef === bus.slice(0, 12) && bus.includes('tracking')) {
                    if (bus.includes('bunched')) {
                        busMap.set(element, 'trackingbunched');
                    } else {
                        busMap.set(element, 'tracking');
                    }
                }
            })
        })
    });
    for (var [key, value] of busMap) {
        if (key.ProgressRate === 'noProgress') {
            Trip.update({ vehicleref: key.VehicleRef }, { active: false, end: Date.now() }, { sort: { begin: 'desc' } }, function (err, raw) { if (err) console.log(err); });
            movingBuses.delete(Array.from(movingBuses).filter(element => element.includes(key.VehicleRef))[0]);
        }
        if (value === 'new') {
            var bus_instance = new Trip({ trip_id: key.VehicleRef + ':' + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), vehicleref: key.VehicleRef, begin: Date.now(), destination: key.DestinationName, active: true });
            bus_instance.save(function (err) {
                if (err) return handleError(err);
            });
            movingBuses.add(key.VehicleRef + 'tracking');
            movingBuses.delete(key.VehicleRef);
        }
        if (value.includes('tracking') && key.MonitoredCall && key.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop' && key.ProgressRate !== 'noProgress') {
            Trip.update({ vehicleref: key.VehicleRef, 'stops.stop': { $ne: key.MonitoredCall.StopPointName }, active: true }, { $push: { stops: { time: Date.now(), stop: key.MonitoredCall.StopPointName } } }, { sort: { begin: 'desc' }, new: true }, function (err, raw) {
                if (err) console.log(err);
            });
        }
        if (value.includes('tracking') && flatten(theArgs).filter(element => element.DestinationName === key.DestinationName && element.VehicleRef !== key.VehicleRef && element.MonitoredCall).some(element => Math.abs(key.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute - element.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute) <= 609.6)) {
            if (value.includes('bunched')) {
                Trip.findOneAndUpdate({ vehicleref: key.VehicleRef }, { $inc: { bunch_time: 5 } }, { sort: { begin: 'desc' }, new: true }, ).exec(function (err, doc) {
                    if (err) console.log(err);
                    if (doc.bunch_time % 120 === 0) {
                        request({ url: 'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/18/json?key=yp3zE7zS5up8EAEqWyHMf2owUBBWIUNr&point=' + key.VehicleLocation.Latitude + ',' + key.VehicleLocation.Longitude + '&unit=MPH' }, function (error, response, body) {
                            try {
                                body = JSON.parse(body);
                                let speedRatio = body.flowSegmentData.currentSpeed / body.flowSegmentData.freeFlowSpeed;
                                Trip.update({_id: doc._id}, { $push: { bunch_data: { time: Date.now(), speed: speedRatio, coordinates: [key.VehicleLocation.Latitude, key.VehicleLocation.Longitude] } } }, function (err, raw) { if (err) console.log(err); });
                            }
                            catch (err) {
                                console.log(err)
                            }
                        });
                    }
                });
            } else {
                movingBuses.add(key.VehicleRef + 'trackingbunched');
                movingBuses.delete(key.VehicleRef + 'tracking');
            }
        }
        if (value.includes('trackingbunched') && flatten(theArgs).filter(element => element.DestinationName === key.DestinationName && element.VehicleRef !== key.VehicleRef).some(element => Math.abs(key.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute - element.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute) <= 609.6) !== true) {
            movingBuses.add(key.VehicleRef + 'tracking');
            movingBuses.delete(key.VehicleRef + 'trackingbunched');
        }
    }
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

    //Socket.IO
    io.on('connection', function (socket) {
        Trip.watch().on('change', change => console.log('from watch ', change));
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