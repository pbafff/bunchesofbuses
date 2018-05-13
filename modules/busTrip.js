var mongoose = require('mongoose')
    , Schema = mongoose.Schema;

var trip = Schema({
    _id: Schema.Types.ObjectId,
    vehicleref: String,
    begin: {type: Date, default: Date.now},
    end: Date,
    destination: String,
    stops: [{time: Date, stop: String}],
    
});