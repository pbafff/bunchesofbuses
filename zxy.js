var lat = 40.611472, // Latitude
    lon =  -73.998056,    // Longitude
    z = 15,        // Zoom level
    latRad,
    n,
    xTile,
    yTile;

latRad = lat * Math.PI / 180;
n = Math.pow(2, z);
xTile = Math.floor(n * ((lon + 180) / 360));
yTile = Math.floor(n * (1 - (Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2);
console.log(xTile, yTile);