const gobutton = document.getElementById('gobutton'),
      route = document.getElementById('route'),
      begindate = document.getElementById('begin-date'),
      enddate = document.getElementById('end-date'),
      play = document.getElementById('play'),
      seeker = document.getElementById('seeker'),
      time = document.getElementById('time'),
      factor = document.getElementById('factor');

mapboxgl.accessToken = 'pk.eyJ1IjoicGJhZmYiLCJhIjoiY2swa2dlbmVrMDh2cTNtdXB6NDdmZm5xOSJ9.5wHw8zRmu4EqcplZyRnQow';

const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [-73.962484, 40.628349],
      zoom: 12
});

map.on('load', function () {
      gobutton.onclick = async () => {
            const range = Date.parse(enddate.value + ':00') - Date.parse(begindate.value + ':00');
            let isplaying = false;

            const res = await fetch(`/data/B/${route.value}/${begindate.value}/${enddate.value}`),
                  json = await res.json(),
                  rows = json.rows,
                  vrefs = new Set(),
                  timeline = new Map();

            rows.sort((a, b) => { return Date.parse(a.recordedattime) - Date.parse(b.recordedattime) });
            rows.forEach(x => vrefs.add(x.vehicleref));

            rows.forEach(x => timeline.set(Date.parse(x.recordedattime), []));
            rows.forEach(x => timeline.get(Date.parse(x.recordedattime)).push(x));

            vrefs.forEach(x => {
                  const filtered = rows.filter(z => x == z.vehicleref);
                  filtered.forEach((y, i, arr) => {
                        if (arr[i - 1])
                              y.previous = arr[i - 1].recordedattime;
                        if (arr[i + 1])
                              y.next = arr[i + 1].recordedattime;
                  });
                  addSource(filtered[0]);
                  addLayer(filtered);
            });

            // const graphData0 = new Map();
            // dir0.forEach(x => {
            //       const date = new Date(x.recordedattime);
            //       const dateNoSeconds = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime();
            //       if (graphData0.has(dateNoSeconds))
            //             graphData0.get(dateNoSeconds).push(x);
            //       else
            //             graphData0.set(dateNoSeconds, [x]);
            // });

            // graphData0.forEach((value, key) => {
            //       value.sort((a, b) => { return a.distancealongroute - b.distancealongroute });
            //       let count = 0;
            //       const noDupes = value.filter((x, I) => {return !(value.some((y, i) => x.datedvehiclejourneyref == y.datedvehiclejourneyref && I < i))});
            //       noDupes.forEach((obj, i, arr) => {
            //             if (arr[i + 1])
            //                   count += Math.abs(arr[i + 1].distancealongroute - obj.distancealongroute) <= Number(factor.value) ? 1 : 0;
            //       });
            //       graphData0.set(key, [noDupes, count]);
            // });

            // console.log(graphData0);

            // const graphData1 = new Map();
            // dir1.forEach(x => {
            //       const date = new Date(x.recordedattime);
            //       const dateNoSeconds = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime();
            //       if (graphData1.has(dateNoSeconds))
            //             graphData1.get(dateNoSeconds).push(x);
            //       else
            //             graphData1.set(dateNoSeconds, [x]);
            // });

            // graphData1.forEach((value, key) => {
            //       value.sort((a, b) => { return a.distancealongroute - b.distancealongroute });
            //       let count = 0;
            //       const noDupes = value.filter((x, I) => {return !(value.some((y, i) => x.datedvehiclejourneyref == y.datedvehiclejourneyref && I < i))});
            //       noDupes.forEach((obj, i, arr) => {
            //             if (arr[i + 1])
            //                   count += Math.abs(arr[i + 1].distancealongroute - obj.distancealongroute) <= Number(factor.value) ? 1 : 0;
            //       });
            //       graphData1.set(key, [noDupes, count]);
            // });

            // console.log(graphData1);

            play.style.visibility = "visible";

            let currentTime = Date.parse(rows[0].recordedattime);
            let intervalid = null;

            play.onclick = run;

            function run(toggle = true) {
                  if (toggle) isplaying = !isplaying;
                  if (intervalid) {
                        clearInterval(intervalid);
                        intervalid = null;
                  }
                  else {
                        intervalid = setInterval(() => {
                              let value = timeline.get(currentTime);
                              if (value) {
                                    value.forEach(obj => {
                                          map.getSource(obj.vehicleref).setData({ type: "Point", coordinates: [obj.longitude, obj.latitude] });
                                          map.getLayer(obj.vehicleref).metadata.next = obj.next;
                                          map.setPaintProperty(obj.vehicleref, "text-color", obj.directionref == "0" ? "#AD79A8" : "#83d0f2");
                                    });
                              }

                              vrefs.forEach(ref => {
                                    const layer = map.getLayer(ref);
                                    const visibility = layer.visibility;
                                    const metadata = layer.metadata;
                                    const next = metadata.next;
                                    if (visibility == "none" && metadata.begins <= currentTime && currentTime <= metadata.ends && !(Date.parse(next) - currentTime > 600000))
                                          map.setLayoutProperty(ref, "visibility", "visible");
                                    else if (visibility == "visible" && currentTime < metadata.begins || currentTime > metadata.ends)
                                          map.setLayoutProperty(ref, "visibility", "none");
                                    else if (visibility == "visible" && Date.parse(next) - currentTime > 600000)
                                          map.setLayoutProperty(ref, "visibility", "none");
                              });

                              seeker.style.left = ((currentTime - Date.parse(begindate.value + ':00')) / range) * window.innerWidth + "px";

                              currentTime += 1000;
                              time.innerHTML = new Date(currentTime).toLocaleTimeString('en-US', { timeZone: "America/New_York", hour12: true });

                              if (currentTime >= Date.parse(enddate.value + ':00') + 1000)
                                    clearInterval(intervalid);
                        }, 5);
                  }
            }

            let p1 = 0, p2 = 0;
            seeker.onmousedown = function (e) {
                  if (intervalid) {
                        clearInterval(intervalid);
                        intervalid = null;
                  }

                  e = e || window.event;
                  e.preventDefault();
                  p2 = e.clientX;

                  document.onmouseup = function () {
                        if (isplaying) run(false);
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

                              let value = timeline.get(currentTime);
                              if (value) {
                                    value.forEach(obj => {
                                          map.getSource(obj.vehicleref).setData({ type: "Point", coordinates: [obj.longitude, obj.latitude] });
                                          map.setPaintProperty(obj.vehicleref, "text-color", obj.directionref == "0" ? "#AD79A8" : "#83d0f2");
                                          if (p1 < 0)
                                                map.getLayer(obj.vehicleref).metadata.next = obj.next;
                                          else
                                                map.getLayer(obj.vehicleref).metadata.previous = obj.previous;
                                    });
                              }

                              vrefs.forEach(ref => {
                                    const layer = map.getLayer(ref);
                                    const visibility = layer.visibility;
                                    const metadata = layer.metadata;
                                    const previous = metadata.previous;
                                    const next = metadata.next;
                                    if (p1 < 0) {
                                          if (visibility == "none" && metadata.begins <= currentTime && currentTime <= metadata.ends && !(Date.parse(next) - currentTime > 600000))
                                                map.setLayoutProperty(ref, "visibility", "visible");
                                          else if (visibility == "visible" && currentTime < metadata.begins || currentTime > metadata.ends)
                                                map.setLayoutProperty(ref, "visibility", "none");
                                          else if (visibility == "visible" && Date.parse(next) - currentTime > 600000)
                                                map.setLayoutProperty(ref, "visibility", "none");
                                    }
                                    else {
                                          if (visibility == "none" && metadata.begins <= currentTime && currentTime <= metadata.ends && !(currentTime - Date.parse(previous) > 600000))
                                                map.setLayoutProperty(ref, "visibility", "visible");
                                          else if (visibility == "visible" && currentTime < metadata.begins || currentTime > metadata.ends)
                                                map.setLayoutProperty(ref, "visibility", "none");
                                          else if (visibility == "visible" && currentTime - Date.parse(previous) > 600000)
                                                map.setLayoutProperty(ref, "visibility", "none");
                                    }
                              });
                        }
                  }
            }
      }

      function addSource(obj) {
            map.addSource(obj.vehicleref, {
                  "type": "geojson",
                  "data": { "type": "Point", "coordinates": [obj.longitude, obj.latitude] }
            });
      }

      function addLayer(arr) {
            map.addLayer({
                  "id": arr[0].vehicleref,
                  "source": arr[0].vehicleref,
                  "type": "symbol",
                  "paint": {
                        "icon-color": "#8b4040"
                  },
                  'layout': {
                        "icon-image": "bus",
                        "icon-size": 1,
                        'visibility': 'none',
                        "text-field": arr[0].vehicleref.slice(9),
                        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                        "text-size": 11,
                        "text-offset": [0, 2],
                        "text-allow-overlap": true,
                        "icon-allow-overlap": true,
                        "icon-ignore-placement": true
                  },
                  "metadata": { "begins": Date.parse(arr[0].recordedattime), "ends": Date.parse(arr[arr.length - 1].recordedattime) + 1000 }
            });
      }
});
