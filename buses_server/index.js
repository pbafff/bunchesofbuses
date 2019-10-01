const gobutton = document.getElementById('gobutton'),
      route = document.getElementById('route'),
      begindate = document.getElementById('begin-date'),
      enddate = document.getElementById('end-date'),
      playbutton = document.getElementById('play'),
      seeker = document.getElementById('seeker'),
      time = document.getElementById('time'),
      factor = document.getElementById('factor');

const vrefs = new Set();
const timeline = new Map();
const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
const cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
let currentTime;
let animation = null;
let isplaying = false;
let range;
let p1 = 0, p2 = 0;
const data = [];
const graphData0 = new Map();

mapboxgl.accessToken = 'pk.eyJ1IjoicGJhZmYiLCJhIjoiY2swa2dlbmVrMDh2cTNtdXB6NDdmZm5xOSJ9.5wHw8zRmu4EqcplZyRnQow';

const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [-73.962484, 40.628349],
      zoom: 12
});


map.on('load', function () {
      gobutton.onclick = async () => {
            if (vrefs.size > 0) {
                  vrefs.forEach(x => {
                        map.removeLayer(x);
                        map.removeLayer(x + "_label");
                        map.removeSource(x);
                  });
                  vrefs.clear();
                  timeline.clear();
                  graphData0.clear();
                  currentTime = Date.parse(begindate.value + ':00');
                  time.innerHTML = new Date(currentTime).toLocaleTimeString('en-US', { timeZone: "America/New_York", hour12: true });
                  seeker.style.left = ((currentTime - Date.parse(begindate.value + ':00')) / range) * window.innerWidth + "px";
                  d3.select("#graph").html("");
                  data.length = 0;
                  playbutton.onclick = null;
            }

            range = Date.parse(enddate.value + ':00') - Date.parse(begindate.value + ':00');

            const res = await fetch(`/data/B/${route.value}/${begindate.value}/${enddate.value}`),
                  json = await res.json(),
                  rows = json.rows;

            rows.sort((a, b) => { return Date.parse(a.recordedattime) - Date.parse(b.recordedattime) });
            rows.forEach(x => vrefs.add(x.vehicleref));

            rows.forEach(x => timeline.set(Date.parse(x.recordedattime), []));
            rows.forEach(x => timeline.get(Date.parse(x.recordedattime)).push(x));

            vrefs.forEach(x => {
                  const filtered = rows.filter(y => y.vehicleref == x);
                  const allTimes = filtered.map(z => { return z.recordedattime });
                  filtered.forEach(j => j.allTimes = allTimes);
                  addSource(filtered[0]);
                  addCircleLayer(filtered);
                  addLabelLayer(filtered);
            });

            rows.filter(x => x.directionref == '0').forEach(x => {
                  const date = new Date(x.recordedattime);
                  const dateNoSeconds = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime();
                  if (graphData0.has(dateNoSeconds))
                        graphData0.get(dateNoSeconds).push(x);
                  else
                        graphData0.set(dateNoSeconds, [x]);
            });

            graphData0.forEach((value, key) => {
                  let count = 0;
                  const noDupes = value.filter((x, I) => { return !(value.some((y, i) => x.vehicleref == y.vehicleref && I < i)) });
                  noDupes.forEach((obj, i, arr) => {
                        count += arr.some(x => { return distance(obj.latitude, obj.longitude, x.latitude, x.longitude) * 1000 <= Number(factor.value) && x.vehicleref != obj.vehicleref }) ? 1 : 0;
                  });
                  data.push({ date: new Date(key), value: count });
                  graphData0.set(key, noDupes);
            });
            
            const width = document.querySelector("#graph").clientWidth - 12;
            const height = 60;

            const x = d3.scaleTime()
                  .domain(d3.extent(data, function (d) { return d.date; }))
                  .range([0, width]);

            const y = d3.scaleLinear()
                  .domain([0, d3.max(data, function (d) { return d.value; })])
                  .range([height, 0]);

            const svg = d3.select("#graph").append("svg")
                  .attr("width", width)
                  .attr("height", height)
                  .append("g");

            svg.append("path")
                  .datum(data)
                  .attr("fill", "#AD79A8")
                  .attr("fill-opacity", "0.75")
                  .attr("d", d3.area()
                        .x(function (d) { return x(d.date) })
                        .y0(y(0))
                        .y1(function (d) { return y(d.value) })
                        .curve(d3.curveBasis)
                  );

            playbutton.style.visibility = "visible";
            playbutton.onclick = playpause;

            currentTime = Date.parse(rows[0].recordedattime);
      }
});

function addSource(obj) {
      map.addSource(obj.vehicleref, {
            "type": "geojson",
            "data": { "type": "Point", "coordinates": [obj.longitude, obj.latitude] }
      });
}

function addCircleLayer(arr) {
      map.addLayer({
            "id": arr[0].vehicleref,
            "source": arr[0].vehicleref,
            "type": "circle",
            'layout': {
                  'visibility': 'none'
            },
            "metadata": {
                  "begins": Date.parse(arr[0].recordedattime),
                  "ends": Date.parse(arr[arr.length - 1].recordedattime) + 1000,
                  "allTimes": arr[0].allTimes
            }
      });
}

function addLabelLayer(arr) {
      map.addLayer({
            "id": arr[0].vehicleref + "_label",
            "source": arr[0].vehicleref,
            "type": "symbol",
            'layout': {
                  'visibility': 'none',
                  "text-field": arr[0].vehicleref.slice(9),
                  "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                  "text-size": 11,
                  "text-offset": [0, 1.5],
                  "text-allow-overlap": true,
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true
            },
            "metadata": {
                  "begins": Date.parse(arr[0].recordedattime),
                  "ends": Date.parse(arr[arr.length - 1].recordedattime) + 1000,
                  "allTimes": arr[0].allTimes
            }
      });
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

function animate() {
      const value = timeline.get(currentTime);
      if (value) {
            value.forEach(obj => {
                  map.getSource(obj.vehicleref).setData({ type: "Point", coordinates: [obj.longitude, obj.latitude] });
                  map.getLayer(obj.vehicleref).metadata.directionref = obj.directionref;
                  map.setPaintProperty(obj.vehicleref + "_label", "text-color", obj.directionref == "0" ? "#AD79A8" : "#83d0f2");
            });
      }

      vrefs.forEach((ref, ref2, set) => {
            const layer = map.getLayer(ref);
            const visibility = layer.visibility;
            const metadata = layer.metadata;
            const allTimes = metadata.allTimes;

            if (visibility == "none" && metadata.begins <= currentTime && currentTime <= metadata.ends && Date.parse(allTimes.find(x => { return Date.parse(x) > currentTime })) - currentTime < 60000) {
                  map.setLayoutProperty(ref, "visibility", "visible");
                  map.setLayoutProperty(ref + "_label", "visibility", "visible");
            }
            if (visibility == "visible" && currentTime < metadata.begins || currentTime > metadata.ends) {
                  map.setLayoutProperty(ref, "visibility", "none");
                  map.setLayoutProperty(ref + "_label", "visibility", "none");
            }
            if (visibility == "visible" && Date.parse(allTimes.find(x => { return Date.parse(x) > currentTime })) - currentTime > 60000) {
                  map.setLayoutProperty(ref, "visibility", "none");
                  map.setLayoutProperty(ref + "_label", "visibility", "none");
            }
      });

      let color;
      const allVisibleLayerIds = Array.from(vrefs).filter(x => map.getLayer(x).visibility == "visible");
      const allVisibleSources = allVisibleLayerIds.map(x => map.getSource(x));
      const direction0 = allVisibleSources.filter(x => map.getLayer(x.id).metadata.directionref == "0");
      direction0.forEach(x => {
            if (direction0.some(y => { return distance(x._data.coordinates[1], x._data.coordinates[0], y._data.coordinates[1], y._data.coordinates[0]) * 1000 <= Number(factor.value) && y.id != x.id }))
                  color = "#ffe0fc";
            else
                  color = "#AD79A8";
            map.setPaintProperty(x.id, "circle-color", color);
      });

      seeker.style.left = ((currentTime - Date.parse(begindate.value + ':00')) / range) * window.innerWidth + "px";
      time.innerHTML = new Date(currentTime).toLocaleTimeString('en-US', { timeZone: "America/New_York", hour12: true });
      currentTime += 1000;

      if (currentTime > Date.parse(enddate.value + ':00'))
            cancelAnimationFrame(animation);

      animation = requestAnimationFrame(animate);
}

function playpause(toggle = true) {
      if (toggle) isplaying = !isplaying;
      if (animation) {
            cancelAnimationFrame(animation);
            animation = null;
      }
      else {
            animation = requestAnimationFrame(animate);
      }
}

seeker.onmousedown = function (e) {
      if (animation) {
            cancelAnimationFrame(animation);
            animation = null;
      }

      e = e || window.event;
      e.preventDefault();
      p2 = e.clientX;

      document.onmouseup = function () {
            if (isplaying) playpause(false);
            document.onmouseup = null;
            document.onmousemove = null;
      }

      document.onmousemove = function (e) {
            e = e || window.event;
            e.preventDefault();
            p1 = p2 - e.clientX;
            p2 = e.clientX;
            if (!(seeker.offsetLeft - p1 < 0) && !(seeker.offsetLeft - p1 > window.innerWidth)) {
                  seeker.style.left = (seeker.offsetLeft - p1) + "px";
                  const seekerpos = Math.round((seeker.offsetLeft) / (window.innerWidth) * 1000) / 1000;
                  currentTime = Date.parse(new Date(Date.parse(begindate.value + ':00') + seekerpos * range).toString()); //seekerpos = (i-begindate.value)/range
                  time.innerHTML = new Date(currentTime).toLocaleTimeString('en-US', { timeZone: "America/New_York", hour12: true });
            }
      }
}
