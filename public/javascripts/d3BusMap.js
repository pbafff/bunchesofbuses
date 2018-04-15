d3.selectAll("p").style("color", function () {
    return "hsl(" + Math.random() * 360 + ",100%,50%)";
});
d3.select("body")
    .selectAll("p")
    .data([4, 8, 15, 16, 23, 42])
    .enter().append("p")
    .text(function (d) { return "I’m number " + d + "!"; });
d3.select("body").style("background-color", "grey");