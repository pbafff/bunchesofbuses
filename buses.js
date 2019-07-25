const fetch = require('node-fetch');

const getBuses = (function () {
    let prevBuses = [[], []];
    let prevStops = [[], []];

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
                            "CallDistanceAlongRoute": x.MonitoredVehicleJourney.MonitoredCall.Extensions.Distances.CallDistanceAlongRoute
                        }
                    })
                    .sort((a, b) => a.CallDistanceAlongRoute - b.CallDistanceAlongRoute);

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
                                "DirectionRef": x.MonitoredVehicleJourney.DirectionRef,
                                "PublishedLineName": x.MonitoredVehicleJourney.PublishedLineName,
                                "DestinationName": x.MonitoredVehicleJourney.DestinationName,
                                "VehicleRef": x.MonitoredVehicleJourney.VehicleRef,
                                "StopPointName": x.MonitoredVehicleJourney.MonitoredCall.StopPointName,
                                "StopPointRef": x.MonitoredVehicleJourney.MonitoredCall.StopPointRef,
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
        else yield null;
    }
})()

function insertDistances(arr) {
    const distances = arr.map((x, i, arr) => {
        if (arr[i + 1]) return arr[i + 1].CallDistanceAlongRoute - x.CallDistanceAlongRoute
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

function vehicle_monitoring(route) {
    return `https://bustime.mta.info/api/siri/vehicle-monitoring.json?key=e76036fc-f470-4344-8df0-ce31c6cf01eb&LineRef=MTA+NYCT_${route}`;
}

module.exports = async function () {
    let i = 0;

    const spacing = [];
    const stops = [];

    for await (let dir of getBuses()) {
        if (i < 2) spacing.push(insertDistances(dir));
        if (i >= 2) stops.push(dir);
        i++;
    }

    return [spacing, stops];
}
