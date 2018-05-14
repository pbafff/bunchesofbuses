var mongoose = require('mongoose')
    , Schema = mongoose.Schema;

var hospBuses = Schema({
    length: Number,
    buses: { type: [Schema.Types.Mixed] },
},
    { timestamps: true });

module.exports = mongoose.model('HospModel', hospBuses);