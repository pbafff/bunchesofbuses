getDistanceAlongRoute(process.argv[2], process.argv[3], process.argv[4]);

function getDistanceAlongRoute(latitude, longitude, polyline) {
    let lat = Number(latitude);
    let lon = Number(longitude);
    let pol = JSON.parse(polyline);

    let distances = pol.map((x, i) => { return { d: distance(lat, lon, x[0], x[1]), index: i } });
    distances = distances.sort((a, b) => a.d - b.d).slice(0, 2);
    distances = distances.sort((a, b) => a.index - b.index);

    let polylineWithBusCoord = pol;
    polylineWithBusCoord.splice(distances[1].index, 0, [lat, lon]);
    polylineWithBusCoord = polylineWithBusCoord.slice(0, distances[1].index + 1);
    const distanceAlongRoute = polylineWithBusCoord.reduce((acc, cur, i, arr) => {
        if (arr[i + 1]) return acc + distance(cur[0], cur[1], arr[i + 1][0], arr[i + 1][1]);
        else return acc;
    }, 0);
    console.log(distanceAlongRoute);
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