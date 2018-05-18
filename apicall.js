var request = require('request');
var express = require('express');
var router = express.Router();
var app = require('./app');
var mongoose = require('mongoose');
var BrownsvilleModel = require("./models/brownsville");
var BayRidgeModel = require('./models/bayridge');
var HospModel = require('./models/hosp');
var Trip = require('./models/trip');
var Bunch = require('./models/bunch');

var APIkey = "e76036fc-f470-4344-8df0-ce31c6cf01eb";
var format = "json";
var busLine = "MTA+NYCT_B8";

var APIURL = "https://bustime.mta.info/api/siri/vehicle-monitoring." + format + "?key=" + APIkey + "&LineRef=" + busLine;
var busesGeoJSON = {};
module.exports = function (io) {
    function makeCall() {
        var layoverBuses = new Set();
        var movingBuses = new Set();
        setInterval(() => {
            request({ url: APIURL }, function (error, response, body) { //'https://215e88da-ab10-40f1-bfe1-229f1c639ac1.mock.pstmn.io/b8'
                if (error) {
                    console.log('error: ', error);
                };
                var brownsville = [];
                var hosp = [];
                var bayRidge = [];
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

                function createGeoJSON() {
                    busesGeoJSON = {
                        "type": "FeatureCollection",
                        "timestamp": new Date().toLocaleString(),
                        "features": []
                    };

                    function pushTemplates(arr) {
                        // if (arr.length > 0) {
                        arr.forEach(element => {
                            var template = {
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": []
                                },
                                "properties": {

                                }
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
                        // };
                    };
                    pushTemplates(brownsville);
                    pushTemplates(bayRidge);
                    pushTemplates(hosp);
                    busesGeoJSON = JSON.stringify(busesGeoJSON, null, 3);
                };
                createGeoJSON();

                var brownsville_instance = new BrownsvilleModel({ buses: brownsville, length: brownsville.length });
                brownsville_instance.save(function (err) {
                    if (err) return handleError(err);
                });
                var bayRidge_instance = new BayRidgeModel({ buses: bayRidge, length: bayRidge.length });
                bayRidge_instance.save(function (err) {
                    if (err) return handleError(err);
                });
                var hosp_instance = new HospModel({ buses: hosp, length: hosp.length });
                hosp_instance.save(function (err) {
                    if (err) return handleError(err);
                });

                function checkForLayovers(...theArgs) {
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
                        });
                    });
                };

                checkForLayovers(bayRidge, brownsville, hosp);

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

                checkIfMovingYet(bayRidge, brownsville, hosp);

                function trackBuses(movingBuses, ...theArgs) {
                    var busMap = new Map();
                    movingBuses.forEach(bus => {
                        theArgs.forEach(arr => {
                            arr.forEach(element => {
                                if (element.VehicleRef === bus && bus.endsWith('tracking') !== true) {
                                    busMap.set(element, 'new');
                                } else if (element.VehicleRef === bus.slice(0, 12) && bus.endsWith('tracking') === true) {
                                    busMap.set(element, 'tracking');
                                };
                            })
                        })
                    });
                    for (var [key, value] of busMap) {
                        if (value === 'new') {
                            var bus_instance = new Trip({ trip_id: key.VehicleRef + ':' + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), vehicleref: key.VehicleRef, begin: Date.now(), destination: key.DestinationName, active: true });
                            bus_instance.save(function (err) {
                                if (err) return handleError(err);
                            });
                            movingBuses.add(key.VehicleRef + 'tracking');
                            movingBuses.delete(key.VehicleRef);
                        } else if (value === 'tracking' && key.MonitoredCall.Extensions.Distances.PresentableDistance === 'at stop') {
                            console.log('here ', key.VehicleRef, key.MonitoredCall.StopPointName);
                            Trip.findOneAndUpdate({ vehicleref: key.VehicleRef }, { $push: { stops: { time: Date.now(), stop: key.MonitoredCall.StopPointName } } }, { sort: { begin: 'desc' }, now: true }, function (err, res) {
                                if (err) console.log(err);
                                if (key.ProgressStatus === 'noProgress') {
                                    Trip.findByIdAndUpdate(res._id, { active: false, end: Date.now() }, function (err, res) { if (err) console.log(err); });
                                    movingBuses.delete(key.VehicleRef + 'tracking');
                                }
                            });
                        }
                    };
                }

                trackBuses(movingBuses, bayRidge, brownsville, hosp);
            });
        }, 5000);
    };
    makeCall();

    //Socket.IO
    io.on('connection', function (socket) {
        socket.emit('JSON update', busesGeoJSON);

        console.log('#####User has connected to apicall####');
        //ON Events
        socket.on('admin', function () {
            console.log('Successful Socket Test');
        });

        socket.emit('message', 'You are connected to apicall');

        setInterval(() => {
            socket.emit('JSON update', busesGeoJSON);
        }, 15000);

        //End ON Events
    });
    return router;
};