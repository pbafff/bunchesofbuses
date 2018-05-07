// Set the dimensions of the map
var width = 1200,
    height = 600;

// Create a selection for the container div and append the svg element
var div = d3.select('#map-container'),
    canvas = div.select('canvas#container'),
    context = canvas.node().getContext("2d");

canvas
    .attr('width', width)
    .attr('height', height);


d3.json('/brooklyn.json', function (err, json) {
    if (err) { throw err; }

    topojson.presimplify(json);

    var brooklyn = topojson.feature(json, json.objects.brooklyn);
    var routes = topojson.feature(json, json.objects.routes);
    var stops = topojson.feature(json, json.objects.stops);

    // create a first guess for the projection
    var center = d3.geoCentroid(routes)
    var scale = 150;
    var offset = [width / 2, height / 2];
    projection = d3.geoMercator().scale(scale).center(center)
        .translate(offset);

    // create the pathGenerator
    pathGenerator = d3.geoPath().projection(projection);
    circleGenerator = d3.geoCircle().radius(5);

    // using the pathGenerator determine the bounds of the current map and use 
    // these to determine better values for the scale and translation
    var bounds = pathGenerator.bounds(routes);
    var hscale = scale * width / (bounds[1][0] - bounds[0][0]);
    var vscale = scale * height / (bounds[1][1] - bounds[0][1]) * 0.9;
    var scale = (hscale < vscale) ? hscale : vscale;
    var offset = [width - (bounds[0][0] + bounds[1][0]) / 2,
    height - (bounds[0][1] + bounds[1][1]) / 1.9];

    // new projection
    projection = d3.geoMercator().center(center)
        .scale(scale).translate(offset);
    pathGenerator = pathGenerator.projection(projection).context(context);

    function render() {
        // Background
        context.fillStyle = '#1d2c4d';
        context.fillRect(0, 0, width, height);

        context.beginPath();
        pathGenerator(brooklyn);
        context.strokeStyle = "#2c66";
        context.fillStyle = '#2c66';
        context.lineWidth = '0.2';
        context.fill();
        context.stroke();

        context.beginPath();
        pathGenerator(routes);
        context.strokeStyle = '#ff9900';
        context.stroke();

        context.beginPath();
        pathGenerator(stops);
        context.strokeStyle = '#00b0ff';
        context.stroke();

        context.restore();
    }

    function zoomed() {
        context.save();
        context.clearRect(0, 0, width, height);
        context.translate(d3.event.transform.x, d3.event.transform.y);
        context.scale(d3.event.transform.k, d3.event.transform.k);

        render();
    }

    canvas
        .call(d3.zoom().scaleExtent([0.2, 30]).on("zoom", zoomed));

    render();
});