var request = require('request');
var express = require('express');
var router = express.Router();
var app = require('./app');
var mongoose = require('mongoose');
var async = require('async');
var BrownsvilleModel = require("./modules/brownsville");
var BayRidgeModel = require('./modules/bayridge');
var HospModel = require('./modules/hosp');
var fs = require('file-system');

var APIkey = "e76036fc-f470-4344-8df0-ce31c6cf01eb";
var format = "json";
var busLine = "MTA+NYCT_B8";

var APIURL = "https://bustime.mta.info/api/siri/vehicle-monitoring." + format + "?key=" + APIkey + "&LineRef=" + busLine;
var busesGeoJSON = {};
module.exports = function (io) {
    function makeCall() {
        setInterval(() => {
            request({ url: APIURL }, function (error, response, body) {
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
                        arr.forEach(element => {
                            // if (element.length > 0) {
                            var template = {
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": []
                                },
                                "properties": {

                                }
                            };
                            template.geometry.coordinates.push(element.VehicleLocation.Longitude);
                            template.geometry.coordinates.push(element.VehicleLocation.Latitude);
                            template.properties.VehicleRef = element.VehicleRef;
                            template.properties.DirectionRef = element.DirectionRef;
                            template.properties.DestinationName = element.DestinationName;
                            try {
                                template.properties.Distances = element.MonitoredCall.Extensions.Distances; //Cannot read property 'Extensions' of undefined
                            }
                            catch (err) {
                                console.log(err)
                            }
                            finally {
                                template.properties.StopPointName = element.MonitoredCall.StopPointName;
                                busesGeoJSON.features.push(template);
                            }
                            // };
                        });
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
                    // BrownsvilleModel.count({}, function (err, count) {
                    //     if (err) return handleError(err);
                    //     console.log(count);
                });
                // BrownsvilleModel.findOne({ 'buses.MonitoredCall.StopPointName': 'AV D/NEW YORK AV' }, function (err, thing) {
                //     if (err) return handleError(err);
                //     console.log(thing);
                //     })
                // });
                var bayRidge_instance = new BayRidgeModel({ buses: bayRidge, length: bayRidge.length });
                bayRidge_instance.save(function (err) {
                    if (err) return handleError(err);
                });
                var hosp_instance = new HospModel({ buses: hosp, length: hosp.length });
                hosp_instance.save(function (err) {
                    if (err) return handleError(err);
                });

            }
            );
        }, 60000);
    };
    makeCall();

    //Socket.IO
    io.on('connection', function (socket) {

        console.log('#####User has connected to apicall####');
        //ON Events
        socket.on('admin', function () {
            console.log('Successful Socket Test');
        });

        socket.emit('message', 'You are connected to apicall');

        setInterval(() => {
            socket.emit('JSON update', busesGeoJSON);
        }, 60000);

        //End ON Events
    });
    return router;
};