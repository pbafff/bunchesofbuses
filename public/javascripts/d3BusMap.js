var width = 1200;
var height = 600;
var path;
var projection;

// Define Zoom Function Event Listener
function zoomFunction() {
  // var transform = d3.event.transform;
  var transform = d3.zoomTransform(this);
  d3.selectAll("path")
    .attr("transform", "translate(" + transform.x + "," + transform.y + ") scale(" + transform.k + ")");
  d3.selectAll('circle').attr("transform", function (d) {
    return "translate(" + transform.x + "," + transform.y + ") scale(" + transform.k + ")";
  });
 
}

// Define Zoom Behavior
var zoom = d3.zoom()
  .scaleExtent([0.2, 10])
  .on("zoom", zoomFunction);

var vis = d3.select("body").append("svg")
  .attr("width", width).attr("height", height).style('background-color', '#242f3e').call(zoom)
  .append("g")

var div = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

d3.json("/filtered-b8-routes-and-stops.json", function (json) {
  // create a first guess for the projection
  var center = d3.geoCentroid(json)
  var scale = 150;
  var offset = [width / 2, height / 2];
  projection = d3.geoMercator().scale(scale).center(center)
    .translate(offset);

  // create the path
  path = d3.geoPath().projection(projection);

  // using the path determine the bounds of the current map and use 
  // these to determine better values for the scale and translation
  var bounds = path.bounds(json);
  var hscale = scale * width / (bounds[1][0] - bounds[0][0]);
  var vscale = scale * height / (bounds[1][1] - bounds[0][1]) * 0.9;
  var scale = (hscale < vscale) ? hscale : vscale;
  var offset = [width - (bounds[0][0] + bounds[1][0]) / 2,
  height - (bounds[0][1] + bounds[1][1]) / 1.9];

  // new projection
  projection = d3.geoMercator().center(center)
    .scale(scale).translate(offset);
  path = path.projection(projection);

  function filterJson(item) {
    if (item.geometry.type === "MultiLineString" || item.geometry.type === "LineString") {
      return true;
    }
    return false;
  }

  vis.selectAll("path").data(json.features.filter(filterJson)).enter().append("path")
    .attr("d", path)
    .attr('class', 'route')
    .style("stroke", "#ca8f61")
    .style("stroke-width", "3")
    .style("fill", "none")


  function filterStops(item) {
    if (item.geometry.type === "Point") {
      return true;
    }
    return false;
  }

  vis.selectAll("path").data(json.features.filter(filterStops)).enter().append("path")
    .attr("d", path)
    .attr("class", "stop")
    .style("stroke", "#ca8f61")
    .style("stroke-width", "3")
    .style("fill", "none")
    .on("mouseover", function (d) {
      div.transition()
        .duration(200)
        .style("opacity", .9);
      div.html(d.properties.name + "<br/>")
        .style("left", (d3.event.pageX) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", function (d) {
      div.transition()
        .duration(500)
        .style("opacity", 0);
    });


});
