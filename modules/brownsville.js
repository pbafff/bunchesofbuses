var mongoose = require('mongoose')
    , Schema = mongoose.Schema;

var brownsvilleBuses = Schema({
    length: Number,
    buses: { type: [Schema.Types.Mixed] },
},
    { timestamps: true });

module.exports = mongoose.model('BrownsvilleModel', brownsvilleBuses);
