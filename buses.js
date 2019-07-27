const fetch = require('node-fetch');

const getBuses = (async function () {
    let prevBuses = [[], []];
    let prevStops = [[], []];
    let polylines = await getPolylines();

    return async function* () {
        const res = await fetch(vehicle_monitoring('B8'));
        const json = await res.json();

        if (json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity.length > 0) {

            let buses = json.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity;

            let i = 0;

            while (i < 2) {
                const _buses = buses.filter(x => x.MonitoredVehicleJourney.DirectionRef == `${i}`
                    && x.MonitoredVehicleJourney.ProgressRate === 'normalProgress')
                    .map(x => {
                        return {
                            "RecordedAtTime": x.RecordedAtTime,
                            "PublishedLineName": x.MonitoredVehicleJourney.PublishedLineName,
                            "DestinationName": x.MonitoredVehicleJourney.DestinationName,
                            "DirectionRef": x.MonitoredVehicleJourney.DirectionRef,
                            "VehicleRef": x.MonitoredVehicleJourney.VehicleRef,
                            "Longitude": x.MonitoredVehicleJourney.VehicleLocation.Longitude,
                            "Latitude": x.MonitoredVehicleJourney.VehicleLocation.Latitude,
                        }
                    })
                    .map(x => ({...x, "DistanceAlongRoute": getDistanceAlongRoute(x.Latitude, x.Longitude, polylines[i])}))
                    .sort((a, b) => a.DistanceAlongRoute - b.DistanceAlongRoute);

                if (JSON.stringify(_buses) !== JSON.stringify(prevBuses[i])) {
                    prevBuses[i] = _buses;
                    yield _buses;
                }
                else yield [];

                i++;
            }

            if (buses.some(x => 'at stop approaching'.includes(x.MonitoredVehicleJourney.MonitoredCall.Extensions.Distances.PresentableDistance))) {

                let i = 0;

                while (i < 2) {
                    let _buses = buses.filter(x => x.MonitoredVehicleJourney.ProgressRate === 'normalProgress'
                        && x.MonitoredVehicleJourney.DirectionRef == `${i}`)
                        .map(x => {
                            return {
                                "RecordedAtTime": x.RecordedAtTime,
                                "PublishedLineName": x.MonitoredVehicleJourney.PublishedLineName,
                                "DestinationName": x.MonitoredVehicleJourney.DestinationName,
                                "DirectionRef": x.MonitoredVehicleJourney.DirectionRef,
                                "StopPointName": x.MonitoredVehicleJourney.MonitoredCall.StopPointName,
                                "StopPointRef": x.MonitoredVehicleJourney.MonitoredCall.StopPointRef,
                                "VehicleRef": x.MonitoredVehicleJourney.VehicleRef,
                            }
                        });

                    _buses = _buses.map(x => {
                        if (!prevStops[i].some(y => JSON.stringify(x) === JSON.stringify(y))) {
                            return x;
                        }
                    });

                    prevStops[i] = _buses;
                    yield _buses;
                    i++;
                }
            }
        }
        else yield;
    }
})()

function insertDistances(arr) {
    const distances = arr.map((x, i, arr) => {
        if (arr[i + 1]) return arr[i + 1].DistanceAlongRoute - x.DistanceAlongRoute
    });

    distances.pop();

    const odds = [];
    for (let x = 0; x <= arr.length - 1; x++) {
        odds.push(2 * x + 1);
    }

    for (let x = 0; x < odds.length - 1; x++) {
        arr.splice(odds[x], 0, { d: distances[x] });
    }

    return arr;
}

function getDistanceAlongRoute(lat, lon, polyline) {
    let distances = polyline.map((x, i) => { return { d: distance(lat, lon, x[0], x[1]), index: i } });
    distances = distances.sort((a, b) => a.d - b.d).slice(0, 2);
    distances = distances.sort((a, b) => a.index - b.index);

    let polylineWithBusCoord = polyline;
    polylineWithBusCoord.splice(distances[1].index, 0, [lat, lon]);
    polylineWithBusCoord = polylineWithBusCoord.slice(0, distances[1].index + 1);
    const distanceAlongRoute = polylineWithBusCoord.reduce((acc, cur, i, arr) => {
        if (arr[i + 1]) return acc + distance(cur[0], cur[1], arr[i + 1][0], arr[i + 1][1]);
        else return acc;
    }, 0);
    return distanceAlongRoute;
}

function distance(lat1, lon1, lat2, lon2) {
    //haversine
    const p = 0.017453292519943295;    // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2 +
        c(lat1 * p) * c(lat2 * p) *
        (1 - c((lon2 - lon1) * p)) / 2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

async function getPolylines() {
    const res = await fetch('http://bustime.mta.info/api/search?q=B8');
    const json = await res.json();
    const directions = json.searchResults.matches[0].directions.map(x => { return { "directionId": x.directionId, "polylines": x.polylines } });

    directions.forEach(x => {
        if (x.polylines.length > 1) {
            x.polylines = x.polylines.map(y => decodePolyline(y)).flat();
        } else {
            x.polylines = decodePolyline(x.polylines[0])
        }
    });

    return [directions.find(x => x.directionId == '0').polylines, directions.find(x => x.directionId == '1').polylines];
}

function decodePolyline(encoded) {
    let len = encoded.length, index = 0, array = [], lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        array.push([lat * 1e-5, lng * 1e-5]);
    }

    return array;
}

function vehicle_monitoring(route) {
    return `https://bustime.mta.info/api/siri/vehicle-monitoring.json?key=e76036fc-f470-4344-8df0-ce31c6cf01eb&LineRef=MTA+NYCT_${route}`;
}

module.exports = async function () {
    let i = 0;

    const spacing = [];
    const stops = [];
    const getBusesGen = await getBuses;

    for await (let dir of getBusesGen()) {
        if (i < 2) spacing.push(insertDistances(dir));
        if (i >= 2) stops.push(dir);
        i++;
    }

    return [spacing, stops];
}
