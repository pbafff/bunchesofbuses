var mongoose = require('mongoose')
    , Schema = mongoose.Schema;

var bayRidgeBuses = Schema({
    length: Number,
    buses: { type: [Schema.Types.Mixed] },
},
    { timestamps: true });

module.exports = mongoose.model('BayRidgeModel', bayRidgeBuses);