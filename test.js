var Trip = require('./models/trip');
var mongoose = require('mongoose');
var app = require('./app');

Trip.findOneAndUpdate({ "vehicleref": "MTA NYCT_799" }, { $push: { stops: { time: Date.now(), stop: 'POTS' }}}, { new: true }, function (err, res) {
    if (err) console.log(err);
});