var json = require('./filtered-b8-routes-and-stops.json');
var mta = require('./MTA NYCT_B8_STOPS.json');
var _ = require('underscore');

var stops = json.features.slice(6);
var direction0 = mta.data.entry.stopGroupings[0].stopGroups[1].stopIds;
var direction1 = mta.data.entry.stopGroupings[0].stopGroups[0].stopIds;

function filterJson(item) {
    
}