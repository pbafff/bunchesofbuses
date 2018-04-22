var width = 1200;
var height = 600;
var path;

var vis = d3.select("body").append("svg")
  .attr("width", width).attr("height", height).style('background-color', '#242f3e')

d3.json("/filtered-b8-routes-and-stops.json", function (json) {
  // create a first guess for the projection
  var center = d3.geoCentroid(json)
  var scale = 150;
  var offset = [width / 2, height / 2];
  var projection = d3.geoMercator().scale(scale).center(center)
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

  // add a rectangle to see the bound of the svg
  vis.append("rect").attr('width', width).attr('height', height)
    .style('stroke', 'black').style('fill', 'none');

  function filterJson(item) {
    if (item.geometry.type === "MultiLineString" || item.geometry.type === "LineString") {
      return true;
    }
    return false;
  }

  vis.selectAll("path").data(json.features.filter(filterJson)).enter().append("path")
    .attr("d", path)
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
    .on('mouseover', dissapear)
    .on('mouseout', reappear)


});

function dissapear() {
  d3.select(this).style(
    'visibility', 'hidden'
  )
}
function reappear() {
  d3.select(this).style(
    'visibility', 'visible'
  )
}